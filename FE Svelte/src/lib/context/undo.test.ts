import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { factFor, intentionOf, stateOf } from '$lib/state/TraceDraft/results.fixture';
import { openDraftFixture, type DraftFixture } from '$lib/state/TraceDraft/TraceDraft.fixture';
import { UndoState } from '$lib/state/Undo/Undo.svelte';
import type { DataSpaceId } from '$lib/state/triplit/data-space';
import { offerUndo } from './undo';

let fx: DraftFixture;
let undo: UndoState;
const HERE = 'canonical' as DataSpaceId;

beforeEach(() => {
	fx = openDraftFixture();
	undo = new UndoState(60_000);
	undo.space = () => HERE;
});
afterEach(async () => {
	await fx.dispose();
});

const noRead = () => Promise.resolve();
/** What every action of these tests shares: the owner, the space and the repository. */
const base = () => ({
	undo,
	space: HERE,
	repository: fx.repository,
	read: noRead
});

describe('an action of the Context and the offer to take it back', () => {
	it('compensates the very operation it committed, and the newer statement stands again', async () => {
		const plan = await intentionOf(fx, 'План');
		const older = await factFor(fx, 'Ранний', plan.id, { outcome: 'partial' }, '2026-09-10');
		const newer = await factFor(fx, 'Поздний', plan.id, { outcome: 'completed' }, '2026-09-11');
		expect(await stateOf(fx, plan.id)).toMatchObject({ outcome: 'completed' });
		// Deleting the newer fact silences its statement and the older one decides again.
		const outcome = await offerUndo({
			...base(),
			label: 'Запись удалена',
			write: async () => {
				const { operation } = await fx.repository.setTraceDeleted(newer.trace.id, true, 'user');
				return { operationId: operation?.id ?? null };
			}
		});
		expect(outcome.written).toBe(true);
		expect(await stateOf(fx, plan.id)).toMatchObject({ outcome: 'partial' });
		expect(undo.pending?.label).toBe('Запись удалена');
		await undo.undo();
		// The same source is effective again; nothing else was rewritten to get there.
		expect(await stateOf(fx, plan.id)).toMatchObject({
			outcome: 'completed',
			sourceId: newer.assessments[0].id
		});
		expect(undo.pending).toBeNull();
		const rows = await fx.repository.listIntentionAssessments(true);
		expect(rows).toHaveLength(2);
		expect(rows.every((row) => !row.isDeleted)).toBe(true);
		// The inverse is an operation of its own, recorded as such.
		const logs = await fx.repository.listLogsFor([newer.trace.id]);
		expect(logs.some((log) => log.cause === 'undo')).toBe(true);
		expect(older.trace.id).not.toBe(newer.trace.id);
	});

	it('keeps the offer that stands when a later command wrote nothing', async () => {
		const plan = await intentionOf(fx, 'План');
		const other = await intentionOf(fx, 'Другой план');
		await offerUndo({
			...base(),
			label: 'Запись удалена',
			write: async () => {
				const { operation } = await fx.repository.setTraceDeleted(plan.id, true, 'user');
				return { operationId: operation?.id ?? null };
			}
		});
		expect(undo.pending?.label).toBe('Запись удалена');
		// Another device deleted the other record already; this command finds it gone.
		await fx.repository.setTraceDeleted(other.id, true, 'user');
		const redundant = await offerUndo({
			...base(),
			label: 'Другая запись удалена',
			write: async () => {
				const { operation } = await fx.repository.setTraceDeleted(other.id, true, 'user');
				return { operationId: operation?.id ?? null };
			}
		});
		// Accepted, wrote nothing, offered nothing: the earlier offer is still the one that stands.
		expect(redundant).toMatchObject({ written: true, refusal: null });
		expect(undo.pending?.label).toBe('Запись удалена');
		await undo.undo();
		expect(
			(await fx.repository.listTraces(true)).find((row) => row.id === plan.id)?.isDeleted
		).toBe(false);
		expect(
			(await fx.repository.listTraces(true)).find((row) => row.id === other.id)?.isDeleted
		).toBe(true);
	});

	it('takes back a correction by the correction, not by the statement lifecycle', async () => {
		const plan = await intentionOf(fx, 'План');
		const fact = await factFor(fx, 'Факт', plan.id, { outcome: 'partial' });
		const source = fact.assessments[0];
		await offerUndo({
			...base(),
			label: 'Оценка исправлена',
			write: async () => {
				const { operation } = await fx.repository.editIntentionAssessment(
					source.id,
					{ outcome: 'completed' },
					'user'
				);
				return { operationId: operation?.id ?? null };
			}
		});
		expect(await stateOf(fx, plan.id)).toMatchObject({ outcome: 'completed' });
		await undo.undo();
		expect(undo.pending).toBeNull();
		// The statement stands, saying what it said before the correction.
		expect(await stateOf(fx, plan.id)).toMatchObject({ outcome: 'partial', sourceId: source.id });
	});

	it('offers nothing when the command cannot name its operation', async () => {
		const plan = await intentionOf(fx, 'План');
		await offerUndo({
			...base(),
			label: 'Без операции',
			write: async () => ({ operationId: undefined })
		});
		expect(undo.pending).toBeNull();
		expect(plan.id).toBeTruthy();
	});

	it('keeps the action committed and the offer standing when the reading after it fails', async () => {
		const plan = await intentionOf(fx, 'План');
		const outcome = await offerUndo({
			...base(),
			label: 'Запись удалена',
			write: async () => {
				const { operation } = await fx.repository.setTraceDeleted(plan.id, true, 'user');
				return { operationId: operation?.id ?? null };
			},
			read: () => Promise.reject(new Error('Снимок недоступен.'))
		});
		expect(outcome).toMatchObject({ written: true, readFailure: new Error('Снимок недоступен.') });
		expect(undo.pending).not.toBeNull();
		expect(
			(await fx.repository.listTraces(true)).find((row) => row.id === plan.id)?.isDeleted
		).toBe(true);
	});

	it('releases what the command consumed at the commit, and never after a refusal', async () => {
		const plan = await intentionOf(fx, 'План');
		const steps: string[] = [];
		const refused = await offerUndo({
			...base(),
			label: 'Утверждение исправлено',
			write: () => Promise.reject(new Error('Хранилище отказало.')),
			committed: () => steps.push('released'),
			read: async () => {
				steps.push('read');
			}
		});
		// A refused command reaches neither the release nor the reading: the input is still there.
		expect(refused).toMatchObject({ written: false, refusal: new Error('Хранилище отказало.') });
		expect(steps).toEqual([]);
		expect(undo.pending).toBeNull();
		await offerUndo({
			...base(),
			label: 'Запись удалена',
			write: async () => {
				const { operation } = await fx.repository.setTraceDeleted(plan.id, true, 'user');
				return { operationId: operation?.id ?? null };
			},
			committed: () => steps.push('released'),
			read: async () => {
				steps.push('read');
			}
		});
		// An accepted one releases once, the moment it is accepted, before anything is read.
		expect(steps).toEqual(['released', 'read']);
		expect(undo.pending?.label).toBe('Запись удалена');
	});

	it('refuses a stale inverse whole, keeping the offer and changing nothing', async () => {
		const plan = await intentionOf(fx, 'План');
		const fact = await factFor(fx, 'Факт', plan.id, { outcome: 'completed' });
		await offerUndo({
			...base(),
			label: 'Связь снята',
			write: async () => {
				const { operation } = await fx.repository.setIntersectionDeleted(
					fact.links[0].id,
					true,
					'user'
				);
				return { operationId: operation?.id ?? null };
			}
		});
		// The same link is activated again by hand: the withdrawal is no longer the current state.
		await fx.repository.setIntersectionDeleted(fact.links[0].id, false, 'user');
		const before = await fx.repository.listIntersections(true);
		await undo.undo();
		expect(undo.failure).not.toBe('');
		expect(undo.pending?.label).toBe('Связь снята');
		// A refused inverse writes nothing at all, not even a part of itself.
		expect(await fx.repository.listIntersections(true)).toEqual(before);
	});
});
