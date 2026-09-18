import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { markerFields, plainFields } from '$lib/state/triplit/Traces/record.fixture';
import { openDraftFixture, operationLogs, type DraftFixture } from './TraceDraft.fixture';

let fx: DraftFixture;
beforeEach(() => {
	fx = openDraftFixture();
});
afterEach(async () => {
	await fx.dispose();
});

const opened = async (): Promise<void> => {};

/**
 * Rows as another device delivers them. The local commands refuse to create these shapes,
 * which is why a conflict can only arrive through sync; writing the row directly is how
 * that arrival is staged, not a way around the rule being tested.
 */
const deliver = async (row: Record<string, unknown>): Promise<void> => {
	await fx.client.insert('intersections', row as never);
};

/** An original and one supplement of it, both saved through the record command. */
const supplementOf = async (title = 'Уточнение') => {
	const original = await fx.repository.saveTraceRecord({ fields: plainFields('Оригинал') });
	const supplement = await fx.repository.saveTraceRecord({
		fields: markerFields(title),
		links: { add: [{ kind: 'revisits', originalId: original.trace.id }] }
	});
	return { original: original.trace, supplement: supplement.trace, link: supplement.links[0] };
};

describe('TraceDraftState — a saved supplement opened again', () => {
	it('keeps its own marker, its original and its editable text', async () => {
		const { original, supplement } = await supplementOf();
		const draft = await fx.open({ mode: 'edit', traceId: supplement.id });
		expect(draft.supplement).toEqual({
			status: 'valid',
			originalId: original.id,
			linkIds: [expect.any(String)]
		});
		expect(draft.relation).toBe('actual');
		expect(draft.values.placement).toEqual({
			aboutKind: 'trace_ref',
			aboutTime: null,
			aboutTraceId: null
		});
		draft.description = 'Что именно уточняется';
		await draft.save(opened);
		expect(await operationLogs(fx, draft.commit!.operation.id)).toEqual(['trace:updated']);
		const saved = await fx.repository.getTrace(supplement.id);
		expect(saved).toMatchObject({
			relation: 'actual',
			aboutKind: 'trace_ref',
			aboutTime: null,
			aboutTraceId: null,
			description: 'Что именно уточняется'
		});
		// Opened once more, the same rules are read from the record itself.
		const again = await fx.open({ mode: 'edit', traceId: supplement.id });
		expect(again.supplement?.status).toBe('valid');
		expect(again.description).toBe('Что именно уточняется');
	});

	it('stays a supplement of a deleted original and of one this replica does not have', async () => {
		const { original, supplement } = await supplementOf();
		await fx.repository.setTraceDeleted(original.id, true);
		const deleted = await fx.open({ mode: 'edit', traceId: supplement.id });
		// A deleted original still anchors the supplement: the rule is about existence, not activity.
		expect(deleted.supplement).toMatchObject({ status: 'valid', originalId: original.id });
		expect(deleted.results.rowOf(original.id)?.trace.isDeleted).toBe(true);
		deleted.description = 'После удаления оригинала';
		await deleted.save(opened);
		expect(await operationLogs(fx, deleted.commit!.operation.id)).toEqual(['trace:updated']);
		// An original no replica has left behind is unavailable, which is not the same as deleted.
		await fx.client.delete('traces', original.id);
		const missing = await fx.open({ mode: 'edit', traceId: supplement.id });
		expect(missing.supplement).toMatchObject({ status: 'unavailable', originalId: original.id });
		expect(missing.results.rowOf(original.id)).toBeNull();
	});

	it('names a supplement with two originals and repairs it by withdrawing one link', async () => {
		const { original, supplement } = await supplementOf();
		const second = await fx.repository.saveTraceRecord({ fields: plainFields('Второй оригинал') });
		// Two clients each linked one original while apart; both links arrive here.
		const extraId = `${supplement.id}-second-original`;
		await deliver({
			id: extraId,
			fromId: supplement.id,
			toId: second.trace.id,
			kind: 'revisits',
			activationId: 'remote-activation',
			isDeleted: false,
			createdAt: '2026-09-12T08:00:00.000Z',
			updatedAt: '2026-09-12T08:00:00.000Z'
		});
		const conflicted = await fx.open({ mode: 'edit', traceId: supplement.id });
		expect(conflicted.supplement).toMatchObject({
			status: 'ambiguous',
			originalIds: expect.arrayContaining([original.id, second.trace.id])
		});
		// The rule refuses to guess: no save passes while the record names two originals.
		conflicted.description = 'Правка во время конфликта';
		await conflicted.save(opened);
		expect(conflicted.phase).toBe('editing');
		expect(conflicted.failure?.code).toBe('supplement_cardinality');
		// The user withdraws the link they do not want; nothing was chosen for them.
		await fx.repository.setIntersectionDeleted(extraId, true, 'user');
		const repaired = await fx.open({ mode: 'edit', traceId: supplement.id });
		expect(repaired.supplement).toMatchObject({ status: 'valid', originalId: original.id });
		repaired.description = 'После разбора конфликта';
		await repaired.save(opened);
		expect(repaired.phase).toBe('closed');
	});

	it('names a marker saved as a plan and lets the form bring it back to a fact', async () => {
		const { supplement } = await supplementOf();
		// A plan-shaped marker can only arrive from another client: the local command refuses it.
		await expect(
			fx.repository.editTrace(supplement.id, { relation: 'intend' }, 'user')
		).rejects.toMatchObject({ code: 'supplement_relation' });
		await fx.client.update('traces', supplement.id, (row: Record<string, unknown>) => {
			row.relation = 'intend';
		});
		const draft = await fx.open({ mode: 'edit', traceId: supplement.id });
		expect(draft.supplement?.status).toBe('intention');
		expect(draft.relation).toBe('intend');
		draft.setRelation('actual');
		// The switch keeps the marker: a supplement has no date of its own to take.
		expect(draft.values.placement.aboutKind).toBe('trace_ref');
		expect(draft.values.placement.aboutTime).toBeNull();
		await draft.save(opened);
		expect(draft.phase).toBe('closed');
		expect(await fx.repository.getTrace(supplement.id)).toMatchObject({
			relation: 'actual',
			aboutKind: 'trace_ref',
			aboutTime: null
		});
	});
});
