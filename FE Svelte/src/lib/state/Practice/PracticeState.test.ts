import { describe, expect, it } from 'vitest';
import { PracticeState } from './Practice.svelte';
import type { PracticeSettingsRepository } from '$lib/state/triplit/PracticeSettings/PracticeSettings';
import type { PracticeRepository } from './types';
import type { Intersection, Scope, Trace, TraceKind, TraceKindV } from '$lib/state/triplit/types';
import type { PracticeSource } from '$lib/state/triplit/PracticeSettings/types';

const source: PracticeSource = {
	id: 'source',
	kindId: 'time',
	path: ['group', 'minutes'],
	scopeIds: ['walk']
};
const version: TraceKindV = {
	id: 'time-v1',
	kindId: 'time',
	generation: 1,
	parentKindVIds: [],
	createdAt: '2026-01-01T00:00:00Z',
	createdByDeviceId: 'test',
	dataSchema: {
		type: 'object',
		properties: { group: { type: 'object', properties: { minutes: { type: 'integer' } } } }
	}
};
const trace = (id: string): Trace => ({
	id,
	capturedAt: '2026-02-01T00:00:00Z',
	timezone: 'UTC',
	aboutKind: 'instant',
	aboutTime: {
		basis: 'absolute',
		precision: 'day',
		certainty: 'exact',
		start: '2026-02-01',
		end: null
	},
	aboutAt: null,
	aboutStart: null,
	aboutEnd: null,
	aboutTraceId: null,
	content: '',
	description: null,
	relation: 'actual',
	kindId: 'time',
	kindVId: 'time-v1',
	data: { group: { minutes: 30 } },
	isDeleted: false,
	lifecycleId: null,
	createdAt: '2026-02-01T00:00:00Z',
	updatedAt: '2026-02-01T00:00:00Z'
});
type IndexCallback = Parameters<PracticeRepository['subscribeKindIndex']>[1];
type IndexSnapshot = Parameters<IndexCallback>[0];
type HeadCallback = Parameters<PracticeRepository['subscribeTraceHeads']>[1];

describe('practice reader lifecycle', () => {
	it('keeps loading and rejects late heads when IDs change A → B → A', () => {
		let kindsNext: ((rows: TraceKind[]) => void) | undefined;
		let versionsNext: ((rows: TraceKindV[]) => void) | undefined;
		let scopesNext: ((rows: Scope[]) => void) | undefined;
		let linksNext: ((rows: Intersection[]) => void) | undefined;
		let sourceNext: ((value: PracticeSource | null) => void) | undefined;
		const indexNext: IndexCallback[] = [];
		const heads: Array<{ ids: readonly string[]; next: HeadCallback }> = [];
		const repository = {
			subscribeTraceKinds: ((next) => {
				kindsNext = next;
				return () => {};
			}) as PracticeRepository['subscribeTraceKinds'],
			subscribeTraceKindVersions: ((next) => {
				versionsNext = next;
				return () => {};
			}) as PracticeRepository['subscribeTraceKindVersions'],
			subscribeScopes: ((next) => {
				scopesNext = next;
				return () => {};
			}) as PracticeRepository['subscribeScopes'],
			subscribeIntersections: ((next) => {
				linksNext = next;
				return () => {};
			}) as PracticeRepository['subscribeIntersections'],
			subscribeKindIndex: ((_request, next) => {
				indexNext.push(next);
				return () => {};
			}) as PracticeRepository['subscribeKindIndex'],
			subscribeTraceHeads: ((request, next) => {
				heads.push({ ids: request.ids ?? [], next });
				return () => {};
			}) as PracticeRepository['subscribeTraceHeads']
		} as PracticeRepository;
		const settings = {
			subscribePracticeSource: (next: (value: PracticeSource | null) => void) => {
				sourceNext = next;
				return () => {};
			}
		} as unknown as PracticeSettingsRepository;
		const state = new PracticeState(repository, settings);
		state.start();
		kindsNext?.([
			{ id: 'time', name: 'Time', currentKindVId: 'time-v1', isDeleted: false } as TraceKind
		]);
		versionsNext?.([version]);
		scopesNext?.([
			{
				id: 'walk',
				name: 'Walk',
				isDeleted: false,
				colorHue: null,
				colorChroma: null,
				colorDepth: null
			} as Scope
		]);
		linksNext?.([]);
		sourceNext?.(source);
		expect(state.loading).toBe(true);
		expect(indexNext).toHaveLength(1);
		const ready = (ids: string[]) =>
			indexNext.at(-1)?.({
				kindId: 'time',
				resolvedScopeIds: null,
				status: 'ready',
				rows: ids.map((id) => ({ id, kindVId: 'time-v1', key: null, span: null, capturedAt: '' }))
			} as IndexSnapshot);
		ready(['a']);
		expect(heads).toHaveLength(1);
		heads[0].next([trace('a')]);
		expect(state.loading).toBe(false);
		ready(['b']);
		expect(state.loading).toBe(true);
		expect(state.traces).toEqual([]);
		ready(['a']);
		expect(heads).toHaveLength(3);
		heads[0].next([trace('stale-a')]);
		expect(state.traces).toEqual([]);
		expect(state.loading).toBe(true);
		heads[2].next([trace('a')]);
		expect(state.traces.map((row) => row.id)).toEqual(['a']);
		expect(state.loading).toBe(false);
		state.stop();
	});
});
