import { expect, it } from 'vitest';
import { schema } from '$lib/state/triplit/schema';
import {
	canonical,
	openSyncFixture,
	SYNC_URL,
	type SyncCollection
} from '$lib/state/triplit/sync.fixture';
import type { TraceDraft } from '$lib/state/triplit/types';
import { ViewportState } from '$lib/state/Viewport/Viewport.svelte';
import { buildRepositoryExplorerSnapshot } from '$lib/state/Workbench/snapshot';
import { WorkbenchState } from '$lib/state/Workbench/Workbench.svelte';
import { RecordsReader } from './Records.svelte';

/** A device subscribes to the whole schema, and so does this probe. */
const collections = Object.keys(schema) as SyncCollection[];

const draft = (content: string, relation: 'intend' | 'actual'): TraceDraft => ({
	content,
	capturedAt: '2026-09-13T08:00:00.000Z',
	timezone: 'UTC',
	aboutKind: 'instant',
	aboutTime: {
		basis: 'absolute',
		precision: 'day',
		certainty: 'exact',
		start: '2026-09-11',
		end: null
	},
	relation
});

const soon = <T>(read: () => T | Promise<T>) => expect.poll(read, { timeout: 10000 });

/**
 * Opt-in: needs the isolated loopback server (see the resumption note of the execution report).
 * Two replicas of the same synthetic space: one holds the Context, the other is the other device.
 */
it.runIf(SYNC_URL)(
	'shows in the Context what another device did, with no one reloading anything',
	async () => {
		const fx = await openSyncFixture(collections);
		const [here, there] = fx.replicas;
		const workbench = new WorkbenchState(new ViewportState({ start: 0, end: 1 }));
		const timeline = () =>
			workbench.load(() => buildRepositoryExplorerSnapshot(here.repository, 'sync-probe'));
		let stop = (): void => {};
		try {
			const plan = await there.repository.createTrace(draft('План', 'intend'));
			await soon(() => fx.has(0, 'traces', plan.id)).toBe(true);
			await timeline();
			expect(workbench.status).not.toBe('error');
			expect(workbench.view.traces.some((row) => row.id === plan.id)).toBe(true);

			// This device opens the record and follows it, the way the Context does.
			const records = new RecordsReader(here.repository);
			await records.load(plan.id);
			stop = records.watch();
			expect(records.result?.result?.outcome).toBeNull();

			// The other device states the outcome: a fact, a link to the plan, a statement on it.
			const fact = await there.repository.createTrace(draft('Факт', 'actual'));
			const link = await there.repository.createIntersection({
				fromId: fact.id,
				toId: plan.id,
				kind: 'evidence_for'
			});
			const source = await there.repository.createEvidenceAssessment(link.id, {
				outcome: 'completed'
			});
			await soon(() => records.result?.result?.outcome).toBe('completed');
			expect(records.result?.result?.sources).toMatchObject([
				{
					id: source.id,
					kind: 'evidence',
					outcome: 'completed',
					effective: true,
					factId: fact.id,
					evidenceId: link.id
				}
			]);
			expect(records.links.map((row) => row.otherId)).toContain(fact.id);

			// The journal of this record carries what the other device wrote, and only that.
			await soon(() => records.logs.some((log) => log.entityId === source.id)).toBe(true);
			const named = [plan.id, link.id, source.id];
			expect(records.logs.every((log) => named.includes(log.entityId))).toBe(true);
			expect(records.logs.find((log) => log.entityId === source.id)?.cause).toBe('normal');

			// The other device corrects its statement; the shown result follows the correction.
			await there.repository.editIntentionAssessment(source.id, { outcome: 'partial' });
			await soon(() => records.result?.result?.outcome).toBe('partial');

			// The other device deletes the record. The reader knows at once; the timeline the
			// Context picks its panel from is a snapshot, and a snapshot is read, not followed.
			await there.repository.setTraceDeleted(plan.id, true, 'user');
			await soon(() => records.result?.trace?.isDeleted).toBe(true);
			expect(workbench.view.traces.some((row) => row.id === plan.id)).toBe(true);
			await timeline();
			expect(workbench.view.traces.some((row) => row.id === plan.id)).toBe(false);

			// And brings it back.
			await there.repository.setTraceDeleted(plan.id, false, 'user');
			await soon(() => records.result?.trace?.isDeleted).toBe(false);
			await timeline();
			expect(workbench.view.traces.some((row) => row.id === plan.id)).toBe(true);

			// A reader that was stopped follows nothing: what happens next does not reach it.
			stop();
			await there.repository.editIntentionAssessment(source.id, { outcome: 'alternative' });
			await fx.acked(1);
			await soon(
				async () =>
					(await here.repository.listIntentionAssessments(true)).find((row) => row.id === source.id)
						?.outcome
			).toBe('alternative');
			expect(records.result?.result?.outcome).toBe('partial');

			// The rows themselves, as each replica holds them.
			const rows = {
				traces: [plan.id, fact.id],
				intersections: [link.id],
				intentionAssessments: [source.id]
			} as const;
			for (const collection of ['traces', 'intersections', 'intentionAssessments'] as const)
				for (const id of rows[collection])
					expect(canonical(await fx.raw(1, collection, id))).toBe(
						canonical(await fx.raw(0, collection, id))
					);
			expect(fx.errors).toEqual([]);
		} finally {
			stop();
			await fx.dispose();
		}
	},
	120000
);
