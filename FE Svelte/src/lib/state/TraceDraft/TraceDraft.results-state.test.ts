import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { evidenceOf, factFor, intentionOf, stateOf } from './results.fixture';
import { targetRefusal, targetState } from './targets';
import { openDraftFixture, operationLogs, type DraftFixture } from './TraceDraft.fixture';
import type { ResultTarget } from './types';

let fx: DraftFixture;
beforeEach(() => {
	fx = openDraftFixture();
});
afterEach(async () => {
	await fx.dispose();
});

const opened = async (): Promise<void> => {};

const targetFor = (targets: readonly ResultTarget[], otherId: string): ResultTarget =>
	targets.find((target) => target.otherId === otherId)!;

describe('TraceDraftState — an existing reference the save does not touch', () => {
	it('keeps a deleted intention’s link and assessment while an unrelated field is edited', async () => {
		const a = await intentionOf(fx, 'A');
		const saved = await factFor(fx, 'F', a.id, { outcome: 'completed' });
		await fx.repository.setTraceDeleted(a.id, true);
		const before = await fx.repository.listIntentionAssessments(true);
		const draft = await fx.open({ mode: 'edit', traceId: saved.trace.id });
		const target = targetFor(draft.results.targets, a.id);
		// The state is said from the start; it is not a delta, so it refuses nothing.
		expect(targetState(target, draft.targetContext)).toBe('deleted');
		expect(targetRefusal(target, draft.targetContext)).toBeNull();
		expect(draft.issues).toEqual([]);
		draft.description = 'Уточнённое описание';
		expect(draft.canSave).toBe(true);
		await draft.save(opened);
		expect(await operationLogs(fx, draft.commit!.operation.id)).toEqual(['trace:updated']);
		expect((await fx.repository.getTrace(saved.trace.id))?.description).toBe('Уточнённое описание');
		// Neither the reference nor its history was rewritten or dropped to allow that edit.
		expect(await evidenceOf(fx, saved.trace.id, true)).toEqual([[a.id, false]]);
		expect(await fx.repository.listIntentionAssessments(true)).toEqual(before);
	});

	it('refuses a new statement through a deleted intention and recovers when it is taken back', async () => {
		const a = await intentionOf(fx, 'A');
		const saved = await factFor(fx, 'F', a.id, { outcome: 'completed' });
		await fx.repository.setTraceDeleted(a.id, true);
		const before = await fx.repository.listIntentionAssessments(true);
		const draft = await fx.open({ mode: 'edit', traceId: saved.trace.id });
		draft.description = 'Уточнённое описание';
		draft.results.setOutcome(a.id, 'partial');
		expect(draft.issues.map((issue) => issue.key)).toEqual(['draft.targetDeleted']);
		expect(draft.canSave).toBe(false);
		// Taking back only the statement keeps the reference and the rest of the input.
		draft.results.clearInput(a.id);
		expect(draft.results.targets.map((target) => target.otherId)).toEqual([a.id]);
		expect(draft.description).toBe('Уточнённое описание');
		expect(draft.canSave).toBe(true);
		await draft.save(opened);
		expect(await operationLogs(fx, draft.commit!.operation.id)).toEqual(['trace:updated']);
		expect(await fx.repository.listIntentionAssessments(true)).toEqual(before);
	});

	it('refuses a reference this input adds to a deleted intention', async () => {
		const a = await intentionOf(fx, 'A');
		await fx.repository.setTraceDeleted(a.id, true);
		const draft = await fx.open({ mode: 'create' });
		draft.title = 'Новый факт';
		expect(draft.canSave).toBe(true);
		draft.results.add(a.id);
		expect(draft.issues.map((issue) => issue.key)).toEqual(['draft.targetDeleted']);
		expect(draft.canSave).toBe(false);
		draft.results.remove(a.id);
		expect(draft.canSave).toBe(true);
	});
});

describe('TraceDraftState — a source that moved to another link', () => {
	/** F→A with an assessment, retargeted to B, then F→A activated again: its source moved on. */
	const detachedFixture = async () => {
		const a = await intentionOf(fx, 'A');
		const b = await intentionOf(fx, 'B');
		const saved = await factFor(fx, 'F', a.id, { outcome: 'completed' });
		const linkFA = saved.links[0];
		await fx.repository.correctEvidenceTarget(linkFA.id, b.id);
		await fx.repository.setIntersectionDeleted(linkFA.id, false);
		return { a, b, saved, linkFA };
	};

	it('shows the moved source from the start and never lets the stale link claim it', async () => {
		const { a, b, saved, linkFA } = await detachedFixture();
		const before = await fx.repository.listIntentionAssessments(true);
		expect(await stateOf(fx, b.id)).toMatchObject({ outcome: 'completed' });
		expect(await stateOf(fx, a.id)).toMatchObject({ outcome: null });
		const draft = await fx.open({ mode: 'edit', traceId: saved.trace.id });
		expect(draft.evidenceRoles.find((role) => role.linkId === linkFA.id)?.source).toBe('detached');
		const stale = targetFor(draft.results.targets, a.id);
		expect(targetState(stale, draft.targetContext)).toBe('detached');
		expect(targetRefusal(stale, draft.targetContext)).toBeNull();
		// The link that now carries the source is an ordinary target beside it.
		expect(targetState(targetFor(draft.results.targets, b.id), draft.targetContext)).toBeNull();
		draft.title = 'F, уточнённый';
		expect(draft.canSave).toBe(true);
		await draft.save(opened);
		expect(await operationLogs(fx, draft.commit!.operation.id)).toEqual(['trace:updated']);
		expect(await fx.repository.listIntentionAssessments(true)).toEqual(before);
	});

	it('refuses a statement through the stale link and gives the input back after it is cancelled', async () => {
		const { a, saved } = await detachedFixture();
		const before = await fx.repository.listIntentionAssessments(true);
		const draft = await fx.open({ mode: 'edit', traceId: saved.trace.id });
		draft.title = 'F, уточнённый';
		draft.results.setOutcome(a.id, 'partial');
		expect(draft.issues.map((issue) => issue.key)).toEqual(['draft.targetDetached']);
		expect(draft.canSave).toBe(false);
		draft.results.clearInput(a.id);
		expect(draft.canSave).toBe(true);
		expect(draft.title).toBe('F, уточнённый');
		expect(draft.results.targets.map((target) => target.otherId).toSorted()).toEqual(
			draft.evidenceRoles.map((role) => role.otherId).toSorted()
		);
		await draft.save(opened);
		expect(await fx.repository.listIntentionAssessments(true)).toEqual(before);
	});

	it('refuses the whole save if a statement through the stale link is kept', async () => {
		const { a, saved } = await detachedFixture();
		const draft = await fx.open({ mode: 'edit', traceId: saved.trace.id });
		draft.results.setOutcome(a.id, 'partial');
		// The refusal is the form's, before any write; forcing it through is the repository's.
		await expect(
			fx.repository.saveTraceRecord({
				id: saved.trace.id,
				fields: {},
				assessments: [
					{ evidenceId: draft.results.targets[0].linkId!, values: { outcome: 'partial' } }
				]
			})
		).rejects.toMatchObject({ code: 'source_detached' });
	});
});
