import { describe, expect, it } from 'vitest';
import type { ExplorerSnapshot } from '$lib/model/Snapshot/types';
import { stableEntityId } from '$lib/scenarios/belgrade/scenario-import';
import {
	applyReview,
	decide,
	importProposalSet,
	markApplied,
	parsePreviewId,
	parseProposalSet,
	previewId,
	proposalCounts,
	proposalDecisions,
	proposalItems,
	proposalSnapshot
} from './Proposals';

const candidate = (candidateId: string, role: string, proposed: Record<string, unknown>) => ({
	candidateId,
	role,
	proposed,
	claimRefs: [],
	gate: 'mapped',
	reason: null
});
const manifest = {
	schemaVersion: 'tempience.calibration-review.v2',
	manifestId: 'm-1',
	title: 'Тест',
	sourceIds: [],
	claimRefs: [],
	claimEvidence: [],
	candidates: [
		candidate('s-root', 'scope', { name: 'Дом', note: null, startedAt: null, endedAt: null }),
		candidate('s-child', 'scope', { name: 'Кухня', note: null, startedAt: null, endedAt: null }),
		candidate('s-link', 'intersection', {
			fromId: 's-child',
			toId: 's-root',
			kind: 'child_of',
			context: null
		}),
		candidate('t-1', 'trace', {
			content: 'Купить плиту',
			relation: 'intend',
			aboutKind: 'instant',
			aboutTime: {
				basis: 'absolute',
				precision: 'day',
				certainty: 'exact',
				start: '2026-03-05',
				end: null
			},
			timezone: 'UTC'
		}),
		candidate('t-2', 'trace', {
			content: 'Ужин',
			relation: 'actual',
			aboutKind: 'instant',
			aboutTime: {
				basis: 'absolute',
				precision: 'day',
				certainty: 'exact',
				start: '2026-03-06',
				end: null
			},
			timezone: 'UTC'
		}),
		candidate('b-1', 'intersection', {
			fromId: 't-1',
			toId: 's-child',
			kind: 'belongs_to',
			context: null
		}),
		candidate('b-2', 'intersection', {
			fromId: 't-2',
			toId: 's-root',
			kind: 'belongs_to',
			context: null
		}),
		candidate('r-1', 'intersection', {
			fromId: 't-2',
			toId: 't-1',
			kind: 'related_to',
			context: null
		})
	]
};
const json = JSON.stringify(manifest);
const empty: ExplorerSnapshot = {
	traces: [],
	scopes: [],
	periods: [],
	intersections: [],
	scopeSegments: []
};

describe('proposals', () => {
	it('imports a manifest with every candidate pending and previews it as a snapshot', () => {
		const set = importProposalSet(json, '2026-09-06T10:00:00Z');
		expect(proposalCounts(set)).toEqual({
			pending: 2,
			accepted: 0,
			deferred: 0,
			excluded: 0,
			applied: 0
		});
		const preview = proposalSnapshot(set, empty);
		expect(preview.scopes.map((s) => s.name)).toEqual(['Дом', 'Кухня']);
		expect(preview.traces.map((t) => t.id)).toEqual([
			previewId('m-1', 't-1'),
			previewId('m-1', 't-2')
		]);
		expect(preview.intersections.map((i) => i.kind)).toEqual([
			'child_of',
			'belongs_to',
			'belongs_to',
			'related_to'
		]);
		expect(parsePreviewId(previewId('m-1', 't-1'))).toEqual({
			manifestId: 'm-1',
			candidateId: 't-1'
		});
		expect(proposalItems(set)[0]).toMatchObject({
			content: 'Купить плиту',
			scopeNames: ['Кухня'],
			decision: 'pending'
		});
	});

	it('reuses Scopes that already exist under their stable id and hides excluded records', () => {
		const set = decide(importProposalSet(json, ''), ['t-2'], 'excluded', 'дубль');
		const live: ExplorerSnapshot = {
			...empty,
			scopes: [
				{
					id: stableEntityId('m-1', 's-root'),
					name: 'Дом',
					note: null,
					startedAt: null,
					endedAt: null,
					origin: { kind: 'canonical', sourceId: 'x' }
				}
			]
		};
		const preview = proposalSnapshot(set, live);
		expect(preview.scopes.map((s) => s.name)).toEqual(['Кухня']);
		expect(preview.intersections.find((i) => i.kind === 'child_of')?.toId).toBe(
			stableEntityId('m-1', 's-root')
		);
		expect(preview.traces.map((t) => t.content)).toEqual(['Купить плиту']);
		expect([...proposalDecisions(set).values()]).toEqual(['pending']);
		expect(set.reviews['t-2']).toEqual({ decision: 'excluded', note: 'дубль' });
	});

	it('applies accepted records with their Scopes, parents and links, deferring the rest', () => {
		const set = decide(importProposalSet(json, ''), ['t-1'], 'accepted');
		const { review, candidateIds } = applyReview(set);
		expect(candidateIds.toSorted()).toEqual(['b-1', 's-child', 's-link', 's-root', 't-1']);
		expect(review.reviews['t-2'].decision).toBe('deferred');
		expect(review.reviews['r-1'].decision).toBe('deferred');
		const after = markApplied(set, candidateIds);
		expect(proposalCounts(after)).toMatchObject({ applied: 1, pending: 1 });
		expect(proposalSnapshot(after, empty).traces.map((t) => t.content)).toEqual(['Ужин']);
	});

	it('restores a checkpoint and drops malformed ones', () => {
		const set = decide(
			importProposalSet(json, '2026-09-06T10:00:00Z'),
			['t-1'],
			'deferred',
			'позже'
		);
		const restored = parseProposalSet(JSON.parse(JSON.stringify(set)));
		expect(restored?.reviews['t-1']).toEqual({ decision: 'deferred', note: 'позже' });
		expect(restored?.importedAt).toBe('2026-09-06T10:00:00Z');
		expect(parseProposalSet({ manifest: { nope: true } })).toBeNull();
		expect(parseProposalSet('x')).toBeNull();
	});
});
