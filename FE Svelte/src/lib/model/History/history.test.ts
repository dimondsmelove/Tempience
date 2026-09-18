import { describe, expect, it } from 'vitest';
import type { Log } from '$lib/state/triplit/types';
import { historyOperations } from './history';

const log = (patch: Partial<Log> & Pick<Log, 'operationId' | 'entityId'>): Log => ({
	id: `${patch.operationId}:${patch.entityId}`,
	entityType: 'trace',
	action: 'updated',
	patch: {},
	occurredAt: '2026-09-13T10:00:00.000Z',
	deviceId: 'device',
	actor: 'user',
	cause: 'normal',
	...patch
});

describe('the journal of one record, as its Context reads it', () => {
	it('groups one operation into one entry, newest first', () => {
		const rows = [
			log({
				operationId: 'op-2',
				entityId: 'trace-1',
				occurredAt: '2026-09-13T12:00:00.000Z',
				patch: { content: { before: 'Старое', after: 'Новое' } }
			}),
			log({
				operationId: 'op-1',
				entityId: 'trace-1',
				occurredAt: '2026-09-13T10:00:00.000Z',
				patch: { description: { before: null, after: 'Описание' } }
			}),
			log({
				operationId: 'op-1',
				entityId: 'link-1',
				entityType: 'intersection',
				action: 'linked',
				occurredAt: '2026-09-13T10:00:00.000Z',
				patch: { snapshot: { id: 'link-1' } as never }
			})
		];
		const operations = historyOperations(rows);
		expect(operations.map((entry) => entry.operationId)).toEqual(['op-2', 'op-1']);
		// One action reads as one action: the record's own field and the link it made together.
		expect(operations[1].items.map((item) => [item.entityType, item.action])).toEqual([
			['trace', 'updated'],
			['intersection', 'linked']
		]);
		expect(operations[1].items[0].changes).toEqual([
			{ field: 'description', before: null, after: 'Описание' }
		]);
		// A creation is a whole row, not a difference: nothing is invented as a «before».
		expect(operations[1].items[1].changes).toEqual([]);
	});

	it('leaves out what the record does not hold itself', () => {
		const rows = [
			log({
				operationId: 'op-1',
				entityId: 'trace-1',
				patch: {
					aboutTime: { before: null, after: { basis: 'unknown' } },
					aboutAt: { before: null, after: 123 },
					revisions: { before: null, after: { content: 'op-1' } },
					updatedAt: { before: 'a', after: 'b' }
				}
			})
		];
		expect(historyOperations(rows)[0].items[0].changes.map((change) => change.field)).toEqual([
			'aboutTime'
		]);
	});

	it('leaves out the stamps a statement is guarded by, and keeps what it says', () => {
		const rows = [
			log({
				operationId: 'op-2',
				entityId: 'source-1',
				entityType: 'intentionAssessment',
				patch: {
					outcome: { before: 'completed', after: 'partial' },
					// A restated value takes a new revision; the journal keeps it, the history does not.
					outcomeRevision: { before: 'op-1', after: 'op-2' },
					openRevision: { before: 'op-1', after: 'op-2' },
					placementRevision: { before: null, after: 'op-2' },
					values: { before: null, after: { outcome: { value: 'partial' } } }
				} as never
			})
		];
		expect(historyOperations(rows)[0].items[0].changes).toEqual([
			{ field: 'outcome', before: 'completed', after: 'partial' }
		]);
	});

	it('keeps the moment and the cause of the operation', () => {
		const rows = [
			log({
				operationId: 'op-1',
				entityId: 'trace-1',
				occurredAt: '2026-09-13T10:00:05.000Z',
				cause: 'undo'
			}),
			log({
				operationId: 'op-1',
				entityId: 'link-1',
				entityType: 'intersection',
				action: 'deleted',
				occurredAt: '2026-09-13T10:00:00.000Z',
				cause: 'undo'
			})
		];
		const [operation] = historyOperations(rows);
		// The moment of the operation is the earliest of its entries, not of the last one written.
		expect(operation.occurredAt).toBe('2026-09-13T10:00:00.000Z');
		expect(operation.cause).toBe('undo');
	});

	it('is empty for a record whose journal has not been read', () => {
		expect(historyOperations([])).toEqual([]);
	});
});
