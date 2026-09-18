import { describe, expect, it } from 'vitest';
import { plainTrace } from '$lib/state/TraceDraft/results.fixture';
import type { Intersection, Scope, Trace } from '$lib/state/triplit/types';
import { linkedRecords, type RecordRows } from './links';

const link = (
	id: string,
	fromId: string,
	toId: string,
	kind: Intersection['kind'],
	patch: Partial<Intersection> = {}
): Intersection => ({ id, fromId, toId, kind, isDeleted: false, ...patch }) as Intersection;

const traces: Trace[] = [
	plainTrace('fact', 'Факт', 'actual'),
	plainTrace('plan', 'Намерение', 'intend'),
	plainTrace('part', 'Часть', 'actual'),
	plainTrace('gone', 'Удалённое намерение', 'intend', undefined, { isDeleted: true })
];

const rows = (patch: Partial<RecordRows> = {}): RecordRows => ({
	traces,
	intersections: [
		link('l1', 'fact', 'plan', 'evidence_for'),
		link('l2', 'fact', 'gone', 'evidence_for'),
		link('l3', 'fact', 'absent', 'related_to'),
		link('l4', 'fact', 'plan', 'part_of', { isDeleted: true }),
		link('l5', 'fact', 'scope-1', 'belongs_to'),
		link('l6', 'part', 'fact', 'part_of')
	],
	assessments: [],
	scopes: [{ id: 'scope-1', name: 'Работа' } as Scope],
	catalog: { kinds: [], versions: [] },
	...patch
});

describe('linked records of one Trace', () => {
	it('lists every explicit link and says what became of the record at the other end', () => {
		const result = linkedRecords('fact', rows());
		expect(result.links.map((item) => [item.linkId, item.otherId, item.state])).toEqual([
			['l1', 'plan', 'active'],
			// A deleted record is known and readable: the row stays, out of the active timeline.
			['l2', 'gone', 'deleted'],
			// Nothing on this replica names it; the link is still shown, truthfully.
			['l3', 'absent', 'unavailable'],
			['l6', 'part', 'active']
		]);
		expect(result.links.map((item) => item.direction)).toEqual([
			'outgoing',
			'outgoing',
			'outgoing',
			'incoming'
		]);
	});

	it('names the record itself, so its Context does not look for it among its own links', () => {
		const result = linkedRecords('fact', rows());
		expect(result.summary?.title).toBe('Факт');
		// A record this replica does not hold has no summary and does not pretend to have one.
		expect(linkedRecords('absent', rows()).summary).toBeNull();
	});

	it('lists the Scopes this record belongs to, and the ones it was taken out of', () => {
		const result = linkedRecords('fact', {
			...rows(),
			intersections: [
				link('l5', 'fact', 'scope-1', 'belongs_to'),
				link('l7', 'fact', 'scope-2', 'belongs_to', { isDeleted: true }),
				// Another record's membership of the same Scope is not this record's history.
				link('l8', 'part', 'scope-1', 'belongs_to')
			]
		});
		expect(result.memberships).toEqual([
			{ linkId: 'l5', scopeId: 'scope-1', name: 'Работа', active: true },
			// A Scope this replica does not hold is named by nothing, and still shown.
			{ linkId: 'l7', scopeId: 'scope-2', name: null, active: false }
		]);
		// Membership is not a link between records: the Context lists it in «Принадлежность».
		expect(result.links.map((row) => row.linkId)).not.toContain('l5');
	});

	it('names the other record only when this replica has it', () => {
		const result = linkedRecords('fact', rows());
		expect(result.links.map((item) => item.summary?.title ?? null)).toEqual([
			'Намерение',
			'Удалённое намерение',
			null,
			'Часть'
		]);
	});

	it('leaves out withdrawn links, Scope membership and Kind placement', () => {
		const kinds = link('l7', 'kind-1', 'scope-1', 'belongs_to', {
			fromEntityType: 'traceKind'
		} as Partial<Intersection>);
		const result = linkedRecords('fact', {
			...rows(),
			intersections: [...rows().intersections, kinds]
		});
		expect(result.links.map((item) => item.linkId)).not.toContain('l4');
		expect(result.links.map((item) => item.linkId)).not.toContain('l5');
		expect(result.links.map((item) => item.linkId)).not.toContain('l7');
	});

	it('carries the references the record holds in its own fields', () => {
		const marker = plainTrace('marker', 'Дополнение', 'actual', null as never, {
			aboutKind: 'trace_ref',
			aboutTraceId: 'plan'
		});
		const anchored = plainTrace('anchored', 'Относительная', 'actual', {
			basis: 'relative',
			relation: 'after',
			precision: 'day',
			anchorTraceId: 'gone'
		} as never);
		const source = rows({ traces: [...traces, marker, anchored] });
		expect(
			linkedRecords('marker', source).links.map((item) => [item.linkId, item.kind, item.otherId])
		).toEqual([[null, 'trace_ref', 'plan']]);
		expect(
			linkedRecords('anchored', source).links.map((item) => [item.kind, item.otherId, item.state])
		).toEqual([['temporal_anchor', 'gone', 'deleted']]);
	});

	it('reads the supplement state of a marker from its own active originals', () => {
		const marker = plainTrace('marker', 'Дополнение', 'actual', null as never, {
			aboutKind: 'trace_ref',
			aboutTime: null,
			aboutTraceId: null
		});
		const source = (links: Intersection[]) =>
			rows({ traces: [...traces, marker], intersections: links });
		// An ordinary record is not governed by the rule at all.
		expect(linkedRecords('fact', rows()).supplement).toBeNull();
		expect(
			linkedRecords('marker', source([link('r1', 'marker', 'plan', 'revisits')])).supplement
		).toEqual({ status: 'valid', originalId: 'plan', linkIds: ['r1'] });
		// A withdrawn link leaves the supplement without an original, and is said so.
		expect(
			linkedRecords(
				'marker',
				source([link('r2', 'marker', 'plan', 'revisits', { isDeleted: true })])
			).supplement
		).toMatchObject({ status: 'orphan' });
		// Two originals arriving from two devices are named, never resolved by order.
		expect(
			linkedRecords(
				'marker',
				source([link('r1', 'marker', 'plan', 'revisits'), link('r3', 'marker', 'part', 'revisits')])
			).supplement
		).toMatchObject({ status: 'ambiguous', originalIds: ['plan', 'part'] });
	});
});
