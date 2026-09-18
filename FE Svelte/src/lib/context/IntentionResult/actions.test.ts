import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { factFor, intentionOf } from '$lib/state/TraceDraft/results.fixture';
import {
	flush,
	openDraftFixture,
	type DraftFixture
} from '$lib/state/TraceDraft/TraceDraft.fixture';
import { draftGuard } from '$lib/state/TraceDraft/guard.svelte';
import { resultInput } from '$lib/state/ResultInput/ResultInput.svelte';
import type { DataSpaceId } from '$lib/state/triplit/data-space';
import { UndoState } from '$lib/state/Undo/Undo.svelte';
import { assessDirectly, correctTarget } from './actions';

let fx: DraftFixture;
/** Two spaces a user legitimately has open over time; a restored backup keeps its ids. */
const HERE = 'canonical' as DataSpaceId;
const THERE = 'imported:backup' as DataSpaceId;

let undo: UndoState;

beforeEach(() => {
	fx = openDraftFixture();
	undo = new UndoState(60_000);
	undo.space = () => HERE;
});
afterEach(async () => {
	await fx.dispose();
});

const refuseRead = () => Promise.reject(new Error('Снимок недоступен.'));
const okRead = () => Promise.resolve();
/** How the correction is told about when it can be taken back. */
const offer = () => ({ undo, label: 'Адресат исправлен' });

describe('the Context commands of a result', () => {
	it('keeps a direct assessment committed when the reading after it fails, and reads again on retry', async () => {
		const plan = await intentionOf(fx, 'План');
		resultInput.set(HERE, plan.id, 'outcome', 'partial');
		const outcome = await assessDirectly(
			fx.repository,
			HERE,
			plan.id,
			resultInput.for(HERE, plan.id),
			refuseRead
		);
		// The statement stands; only the reading after it did not.
		expect(outcome).toMatchObject({
			written: true,
			refusal: null,
			readFailure: new Error('Снимок недоступен.')
		});
		const rows = await fx.repository.listIntentionAssessments(true);
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ source: 'direct', outcome: 'partial', open: null });
		// The entered values were taken at the commit, so a retry cannot send them twice.
		expect(resultInput.stated(HERE, plan.id)).toBe(false);
		expect(await fx.repository.listIntentionAssessments(true)).toHaveLength(1);
	});

	it('reports a refused command without touching the entered values or the rows', async () => {
		const plan = await intentionOf(fx, 'План');
		await fx.repository.setTraceDeleted(plan.id, true);
		resultInput.set(HERE, plan.id, 'open', false);
		const outcome = await assessDirectly(
			fx.repository,
			HERE,
			plan.id,
			resultInput.for(HERE, plan.id),
			okRead
		);
		expect(outcome.written).toBe(false);
		expect((outcome.refusal as Error).message).toContain('Намерение удалено');
		// Nothing was written, so what the user entered is still theirs to send again.
		expect(resultInput.stated(HERE, plan.id)).toBe(true);
		expect(await fx.repository.listIntentionAssessments(true)).toEqual([]);
		resultInput.clear(HERE, plan.id);
	});

	it('keeps a correction committed when the reading fails, with exactly one moved statement', async () => {
		const a = await intentionOf(fx, 'A');
		const b = await intentionOf(fx, 'B');
		const fact = await factFor(fx, 'Факт', a.id, { outcome: 'completed' });
		const source = fact.assessments[0];
		resultInput.openRetarget(HERE, fact.links[0].id);
		const outcome = await correctTarget(
			fx.repository,
			HERE,
			fact.links[0].id,
			b.id,
			refuseRead,
			offer()
		);
		expect(outcome).toMatchObject({ written: true, readFailure: new Error('Снимок недоступен.') });
		// The step closed at the commit, so the same correction is not offered to be repeated.
		expect(resultInput.retargetFor(HERE, fact.links[0].id)).toBeNull();
		const rows = await fx.repository.listIntentionAssessments(true);
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			id: source.id,
			intentionId: b.id,
			firstAssessedAt: source.firstAssessedAt
		});
		const links = (await fx.repository.listIntersections(true)).filter(
			(link) => link.kind === 'evidence_for'
		);
		expect(
			links
				.map((link) => [link.toId, link.isDeleted] as const)
				.toSorted((left, right) => String(left[0]).localeCompare(String(right[0])))
		).toEqual(
			[
				[a.id, true],
				[b.id, false]
			].toSorted((left, right) => String(left[0]).localeCompare(String(right[0])))
		);
	});

	it('is work the one exit gate waits for, and never runs twice at once', async () => {
		const plan = await intentionOf(fx, 'План');
		expect(draftGuard.busy).toBe(false);
		let release = (): void => {};
		const blocked = new Promise<void>((resolve) => {
			release = resolve;
		});
		resultInput.set(HERE, plan.id, 'outcome', 'completed');
		const running = assessDirectly(
			fx.repository,
			HERE,
			plan.id,
			resultInput.for(HERE, plan.id),
			() => blocked
		);
		await Promise.resolve();
		expect(draftGuard.busy).toBe(true);
		let left = false;
		draftGuard.exit(() => {
			left = true;
		});
		await Promise.resolve();
		expect(left).toBe(false);
		release();
		await running;
		await draftGuard.settle();
		expect(draftGuard.busy).toBe(false);
		// The exit that waited runs once the work it waited for has settled, not before.
		await flush();
		expect(left).toBe(true);
		expect(await fx.repository.listIntentionAssessments(true)).toHaveLength(1);
	});

	it('takes and clears only the space it was issued for, whatever became current meanwhile', async () => {
		const plan = await intentionOf(fx, 'План');
		// The same record id in two spaces: what a restored backup beside its original gives.
		resultInput.set(HERE, plan.id, 'outcome', 'partial');
		resultInput.set(THERE, plan.id, 'outcome', 'completed');
		let release = (): void => {};
		const blocked = new Promise<void>((resolve) => {
			release = resolve;
		});
		const running = assessDirectly(
			fx.repository,
			HERE,
			plan.id,
			resultInput.for(HERE, plan.id),
			() => blocked
		);
		// While the command runs the other space keeps its own unsent input untouched.
		expect(resultInput.for(THERE, plan.id)).toEqual({ outcome: 'completed' });
		release();
		await running;
		expect(resultInput.stated(HERE, plan.id)).toBe(false);
		expect(resultInput.for(THERE, plan.id)).toEqual({ outcome: 'completed' });
		const rows = await fx.repository.listIntentionAssessments(true);
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ outcome: 'partial' });
		resultInput.clear(THERE, plan.id);
	});

	it('offers the correction back when a statement moved with the link, and takes it back', async () => {
		const a = await intentionOf(fx, 'A');
		const b = await intentionOf(fx, 'B');
		const fact = await factFor(fx, 'Факт', a.id, { outcome: 'completed' });
		const source = fact.assessments[0];
		await correctTarget(fx.repository, HERE, fact.links[0].id, b.id, okRead, offer());
		expect(undo.pending?.label).toBe('Адресат исправлен');
		await undo.undo();
		// The statement is addressed to where it was, with its identity and its first time.
		const rows = await fx.repository.listIntentionAssessments(true);
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			id: source.id,
			intentionId: a.id,
			firstAssessedAt: source.firstAssessedAt
		});
		expect(undo.pending).toBeNull();
	});

	it('offers nothing back where there is nothing to return', async () => {
		const a = await intentionOf(fx, 'A');
		const b = await intentionOf(fx, 'B');
		// A link with no statement of its own: an inverse would withdraw a link that a first
		// assessment of another device may still be on its way to.
		const bare = await factFor(fx, 'Голый факт', a.id);
		await correctTarget(fx.repository, HERE, bare.links[0].id, b.id, okRead, offer());
		expect(undo.pending).toBeNull();
		// The correction itself stands: it is the offer that is absent, not the command.
		const links = (await fx.repository.listIntersections(true)).filter(
			(link) => link.kind === 'evidence_for' && !link.isDeleted
		);
		expect(links.map((link) => link.toId)).toEqual([b.id]);
		// And an address that was already the current one changes nothing to offer back.
		const fact = await factFor(fx, 'Факт', a.id, { outcome: 'completed' });
		await correctTarget(fx.repository, HERE, fact.links[0].id, a.id, okRead, offer());
		expect(undo.pending).toBeNull();
	});

	it('closes only the correction step of its own space', async () => {
		const a = await intentionOf(fx, 'A');
		const b = await intentionOf(fx, 'B');
		const fact = await factFor(fx, 'Факт', a.id);
		const evidenceId = fact.links[0].id;
		resultInput.openRetarget(THERE, evidenceId);
		resultInput.search(THERE, 'план');
		// A command of another space cannot end the step this one is preparing.
		await correctTarget(fx.repository, HERE, evidenceId, b.id, okRead, offer());
		expect(resultInput.retargetFor(THERE, evidenceId)).toMatchObject({ query: 'план' });
		expect(resultInput.retargetFor(HERE, evidenceId)).toBeNull();
		resultInput.closeRetarget(THERE);
	});
});
