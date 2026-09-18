import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { plainFields } from '$lib/state/triplit/Traces/record.fixture';
import type { TraceKindVDraft } from '$lib/state/triplit/types';
import { openDraftFixture, type DraftFixture } from './TraceDraft.fixture';

/** Every field optional: an empty document is a valid record of this Kind. */
const OBSERVATION: TraceKindVDraft = {
	dataSchema: {
		type: 'object',
		additionalProperties: false,
		properties: {
			note: { type: 'string', title: 'Наблюдение' },
			optionalNumber: { type: 'number', title: 'Необязательное число' },
			readings: { type: 'array', items: { type: 'number' }, title: 'Показания' },
			details: {
				type: 'object',
				properties: { depth: { type: 'number' }, tag: { type: 'string' } }
			}
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

describe('TraceDraftState — partial typed input at the JSON boundary', () => {
	it('treats a cleared optional field as omitted: valid, saveable, and equal to the baseline', async () => {
		const { kind } = await fx.kind('Наблюдение', OBSERVATION);
		const draft = await fx.open({ mode: 'create', kindId: kind.id });
		expect(draft.canSave).toBe(true);
		// What SJSF leaves behind after «-5» is typed and then cleared, or a nested field is emptied.
		draft.data.optionalNumber = undefined as never;
		draft.data.details = { depth: undefined as never, tag: 'x' };
		expect(draft.issues).toEqual([]);
		expect(draft.canSave).toBe(true);
		draft.data.details = { depth: undefined as never };
		await draft.save(async () => {});
		const saved = (await fx.repository.getTrace(draft.commit!.id))!;
		expect(saved.data).toEqual({ details: {} });
	});

	it('counts unparsable native text as unfinished input: not saveable, dirty, until cleared', async () => {
		const { kind, version } = await fx.kind('Наблюдение', OBSERVATION);
		const { trace: saved } = await fx.repository.saveTraceRecord({
			fields: plainFields(null, {
				description: 'Описание видно и без значений полей Kind.',
				kindId: kind.id,
				kindVId: version.id,
				data: {}
			})
		});
		const draft = await fx.open({ mode: 'edit', traceId: saved.id });
		expect([draft.dirty, draft.canSave]).toEqual([false, false]);
		// The form reports one control whose text the browser could not parse («-», «1e»).
		draft.data.optionalNumber = undefined as never;
		draft.reportNative(1);
		expect(draft.dirty).toBe(true);
		expect(draft.canSave).toBe(false);
		expect(draft.issueFor('data')).toBeNull();
		draft.touch('data');
		expect(draft.issueFor('data')?.key).toBe('draft.dataUnfinished');
		// «-5» parses: a value, changed and valid.
		draft.data.optionalNumber = -5;
		draft.reportNative(0);
		expect([draft.dirty, draft.canSave, draft.issueFor('data')]).toEqual([true, true, null]);
		// Cleared back to the original empty input: not dirty, no message, no save to offer.
		draft.data.optionalNumber = undefined as never;
		expect([draft.dirty, draft.canSave, draft.issueFor('data')]).toEqual([false, false, null]);
	});

	it('keeps a required field required and an unfinished array item incomplete', async () => {
		const { kind } = await fx.kind('Вес', {
			dataSchema: {
				type: 'object',
				additionalProperties: false,
				required: ['weight'],
				properties: {
					weight: { type: 'number' },
					readings: { type: 'array', items: { type: 'number' } }
				}
			}
		});
		const draft = await fx.open({ mode: 'create', kindId: kind.id });
		draft.data.weight = undefined as never;
		draft.touch('data');
		expect(draft.issueFor('data')?.key).toBe('draft.dataInvalid');
		draft.data.weight = 80;
		draft.data.readings = [1, undefined as never, 3];
		expect(draft.issueFor('data')).toEqual({
			field: 'data',
			key: 'draft.dataIncomplete',
			detail: '/readings/1'
		});
		expect(draft.canSave).toBe(false);
		draft.data.readings = [1, 2, 3];
		expect(draft.issueFor('data')).toBeNull();
		await draft.save(async () => {});
		expect((await fx.repository.getTrace(draft.commit!.id))!.data).toEqual({
			weight: 80,
			readings: [1, 2, 3]
		});
	});
});
