import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { TraceRecordSave } from '$lib/state/triplit/Traces/record';
import { flush, openDraftFixture, type DraftFixture } from './TraceDraft.fixture';
import { TraceDraftState } from './TraceDraft.svelte';
import type { TraceDraftRepository } from './types';

type Feed = { next: (rows: never[]) => void; fail: (error: unknown) => void };

/** Catalog subscriptions under test control: delivery, failure and stop counts are explicit. */
const controlled = (fx: DraftFixture) => {
	const feeds: Feed[] = [];
	const counts = { started: 0, stopped: 0 };
	const subscribe = (next: (rows: never[]) => void, fail: (error: unknown) => void) => {
		counts.started += 1;
		feeds.push({ next, fail });
		return () => {
			counts.stopped += 1;
		};
	};
	const repository: TraceDraftRepository = {
		subscribeTraceKinds: subscribe,
		subscribeTraceKindVersions: subscribe,
		subscribeScopes: subscribe,
		listLinkHeads: fx.repository.listLinkHeads,
		listKindMemberships: fx.repository.listKindMemberships,
		listIntersectionsTouching: fx.repository.listIntersectionsTouching,
		listTraceHeads: fx.repository.listTraceHeads,
		listIntentionAssessments: fx.repository.listIntentionAssessments,
		getTrace: fx.repository.getTrace,
		saveTraceRecord: (save: TraceRecordSave) => fx.repository.saveTraceRecord(save)
	};
	return { feeds, counts, repository };
};

let fx: DraftFixture;
beforeEach(() => {
	fx = openDraftFixture();
});
afterEach(async () => {
	await fx.dispose();
});

describe('TraceDraftState — loading lifecycle', () => {
	it('stops every started subscription once when a catalog refuses its first delivery', async () => {
		const { feeds, counts, repository } = controlled(fx);
		const opening = fx.open({ mode: 'create' }, { repository });
		await flush();
		expect(counts.started).toBe(3);
		feeds[0].next([]);
		feeds[1].fail(new Error('synthetic subscribe refusal'));
		const draft = await opening;
		expect(counts.stopped).toBe(3);
		expect([draft.phase, draft.diagnostic, draft.failure?.message]).toEqual([
			'editing',
			'draft.loadFailed',
			'synthetic subscribe refusal'
		]);
		expect(draft.canSave).toBe(false);
		draft.dispose();
		expect(counts.stopped).toBe(3);
	});

	it('stops every subscription when a later read fails after all catalogs arrived', async () => {
		const { feeds, counts, repository } = controlled(fx);
		const opening = fx.open(
			{ mode: 'create' },
			{
				repository: {
					...repository,
					listLinkHeads: async () => {
						throw new Error('synthetic read refusal');
					}
				}
			}
		);
		await flush();
		for (const feed of feeds) feed.next([]);
		const draft = await opening;
		expect(counts).toEqual({ started: 3, stopped: 3 });
		expect([draft.diagnostic, draft.failure?.message]).toEqual([
			'draft.loadFailed',
			'synthetic read refusal'
		]);
	});

	it('keeps a form closed while loading closed: what arrives later is dropped and disposed', async () => {
		const { feeds, counts, repository } = controlled(fx);
		const draft = new TraceDraftState({ mode: 'create' }, { repository, defaults: () => ({}) });
		const loading = draft.load();
		await flush();
		expect(counts.started).toBe(3);
		draft.discard();
		expect([draft.phase, counts.stopped]).toEqual(['closed', 3]);
		// A subscription that still answers after its stop changes nothing of the closed owner.
		feeds[0].next([{ id: 'late', name: 'Late' } as never]);
		feeds[1].next([]);
		feeds[2].next([]);
		await loading;
		expect([draft.phase, draft.kinds, draft.baseline]).toEqual(['closed', [], null]);
		expect(counts.stopped).toBe(3);
		draft.dispose();
		expect(counts.stopped).toBe(3);
	});

	it('records a subscription that answers synchronously before its stop is known', async () => {
		let stopped = 0;
		const immediate = (next: (rows: never[]) => void) => {
			next([]);
			return () => {
				stopped += 1;
			};
		};
		const draft = await fx.open(
			{ mode: 'create' },
			{
				repository: {
					...fx.repository,
					subscribeTraceKinds: immediate,
					subscribeTraceKindVersions: immediate,
					subscribeScopes: immediate
				}
			}
		);
		expect(draft.phase).toBe('editing');
		draft.discard();
		expect(stopped).toBe(3);
	});
});
