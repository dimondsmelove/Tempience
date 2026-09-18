import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { plainFields } from '$lib/state/triplit/Traces/record.fixture';
import type { TraceKindVDraft } from '$lib/state/triplit/types';
import { openDraftFixture, operationLogs, type DraftFixture } from './TraceDraft.fixture';
import { editSave } from './save';

const READING: TraceKindVDraft = {
	dataSchema: {
		type: 'object',
		additionalProperties: false,
		properties: {
			a: { type: 'number' },
			b: { type: 'number' },
			inner: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'string' } } },
			order: { type: 'array', items: { type: 'number' } }
		}
	}
};

let fx: DraftFixture;
beforeEach(() => {
	fx = openDraftFixture();
});
afterEach(async () => {
	await fx.dispose();
});

describe('TraceDraftState — explicit edit deltas', () => {
	it('sends no data when SJSF only reordered keys, so an independent data change survives', async () => {
		const { kind, version } = await fx.kind('Показание', READING);
		const { trace: saved } = await fx.repository.saveTraceRecord({
			fields: plainFields(null, {
				description: 'Исходное описание',
				kindId: kind.id,
				kindVId: version.id,
				data: { a: 1, b: 2, inner: { x: 1, y: 'y' }, order: [1, 2] }
			})
		});
		const draft = await fx.open({ mode: 'edit', traceId: saved.id });
		// The form hands the same JSON back with its keys in another order, nested too.
		draft.data = { order: [1, 2], inner: { y: 'y', x: 1 }, b: 2, a: 1 };
		expect(draft.dirty).toBe(false);
		draft.description = 'Только описание';
		expect(draft.dirty).toBe(true);
		const patch = editSave(saved.id, draft.values, draft.baseline!);
		expect(Object.keys(patch.fields)).toEqual(['description']);
		// Another writer changed the data meanwhile; this description-only save must not undo it.
		await fx.repository.saveTraceRecord({ id: saved.id, fields: { data: { a: 10, b: 2 } } });
		await draft.save(async () => {});
		const after = (await fx.repository.getTrace(saved.id))!;
		expect(after.content).toBe('Только описание');
		expect(after.data).toEqual({ a: 10, b: 2 });
		expect(await operationLogs(fx, draft.commit!.operation.id)).toEqual(['trace:updated']);
	});

	it('sends data for a real change, including array order and nested values', async () => {
		const { kind, version } = await fx.kind('Показание', READING);
		const { trace: saved } = await fx.repository.saveTraceRecord({
			fields: plainFields(null, {
				kindId: kind.id,
				kindVId: version.id,
				data: { a: 1, inner: { x: 1 }, order: [1, 2] }
			})
		});
		const draft = await fx.open({ mode: 'edit', traceId: saved.id });
		draft.data = { a: 1, inner: { x: 1 }, order: [2, 1] };
		expect(Object.keys(editSave(saved.id, draft.values, draft.baseline!).fields)).toEqual(['data']);
		draft.data = { a: 1, inner: { x: 2 }, order: [1, 2] };
		expect(draft.dirty).toBe(true);
		await draft.save(async () => {});
		expect((await fx.repository.getTrace(saved.id))!.data).toEqual({
			a: 1,
			inner: { x: 2 },
			order: [1, 2]
		});
	});

	it('saves and reloads a document whose own keys are `__proto__` and `constructor`, nested too', async () => {
		const { kind } = await fx.kind('Полезная нагрузка', {
			dataSchema: {
				type: 'object',
				additionalProperties: false,
				properties: { payload: { type: 'object' }, tags: { type: 'array' } }
			}
		});
		const document = JSON.parse(
			'{"payload":{"__proto__":{"label":"kept"},"constructor":"ordinary","normal":1},"tags":[{"__proto__":"own"}]}'
		) as Record<string, unknown>;
		const draft = await fx.open({ mode: 'create', kindId: kind.id });
		draft.data = JSON.parse(JSON.stringify(document)) as never;
		expect(draft.canSave).toBe(true);
		await draft.save(async () => {});
		const created = (await fx.repository.getTrace(draft.commit!.id))!;
		expect(JSON.stringify(created.data)).toBe(JSON.stringify(document));
		expect(Object.hasOwn(created.data!.payload as object, '__proto__')).toBe(true);
		expect(Object.getPrototypeOf(created.data!.payload)).toBe(Object.prototype);
		// The reloaded record is its own baseline: nothing to save, and a text edit sends no data.
		const edit = await fx.open({ mode: 'edit', traceId: created.id });
		expect(edit.dirty).toBe(false);
		edit.description = 'Только описание';
		expect(Object.keys(editSave(created.id, edit.values, edit.baseline!).fields)).toEqual([
			'description'
		]);
		await edit.save(async () => {});
		const after = (await fx.repository.getTrace(created.id))!;
		expect(JSON.stringify(after.data)).toBe(JSON.stringify(document));
		expect(after.content).toBe('Только описание');
	});

	it('stores a typed description equal to the Kind name as the user wrote it', async () => {
		const { kind } = await fx.kind('Наблюдение', READING);
		const draft = await fx.open({ mode: 'create', kindId: kind.id });
		draft.description = 'Наблюдение';
		await draft.save(async () => {});
		const created = (await fx.repository.getTrace(draft.commit!.id))!;
		expect(created.content).toBe('Наблюдение');
		const edit = await fx.open({ mode: 'edit', traceId: created.id });
		expect(edit.description).toBe('Наблюдение');
		edit.data.a = 3;
		await edit.save(async () => {});
		expect((await fx.repository.getTrace(created.id))!.content).toBe('Наблюдение');
	});
});
