import { TriplitClient } from '@triplit/client';
import { expect, it } from 'vitest';
import { createTriplitRepository, type TempienceRepository } from '../repository';
import { schema } from '../schema';
import { getPendingChangeCount } from '../sync-status';
import type { Intersection, Trace, TraceDraft } from '../types';
import { assessmentIdFor } from './read';
import { evaluateIntention } from './result';

const serverUrl = process.env.TEMPIENCE_TEST_SYNC_URL;

/** Replicas store merged JSON maps in their own key order; compare values, not key order. */
const canonical = (value: unknown): string =>
	JSON.stringify(value, (_key, entry: unknown) =>
		entry !== null && typeof entry === 'object' && !Array.isArray(entry)
			? Object.fromEntries(
					Object.entries(entry as Record<string, unknown>).toSorted(([a], [b]) => (a < b ? -1 : 1))
				)
			: entry
	);
const collections = ['traces', 'intersections', 'intentionAssessments'] as const;

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

const evaluate = async (repository: TempienceRepository, intentionId: string) =>
	evaluateIntention(intentionId, await repository.listIntentionAssessments(true), {
		tracesById: new Map<string, Trace>(
			(await repository.listTraces(true)).map((row) => [row.id, row])
		),
		intersectionsById: new Map<string, Intersection>(
			(await repository.listIntersections(true)).map((row) => [row.id, row])
		)
	});

it.runIf(serverUrl)(
	'keeps a retarget binding and transferred source ahead of late offline first creations',
	async () => {
		const url = new URL(serverUrl!);
		if (!['127.0.0.1', 'localhost'].includes(url.hostname))
			throw new Error('This probe requires an isolated loopback sync server.');
		const health = await fetch(new URL('/healthz', url)).then((response) => response.json());
		if (health.projectId !== 'tempience-34-synthetic') throw new Error('Unexpected sync project.');
		const clients: TriplitClient<typeof schema>[] = [];
		const unsubscribes: (() => void)[] = [];
		const errors: string[] = [];
		const fulfilled = new Set<string>();
		try {
			for (let index = 0; index < 2; index++) {
				const response = await fetch(new URL('/pair', url), {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						code: 'tempience-34-isolated-test-code',
						deviceId: crypto.randomUUID()
					})
				});
				if (!response.ok) throw new Error(`Pairing failed: ${response.status}`);
				const { token } = await response.json();
				const client = new TriplitClient({
					schema,
					storage: { type: 'memory' },
					serverUrl,
					token,
					autoConnect: true
				});
				clients.push(client);
				await client.ready;
				for (const collection of collections)
					unsubscribes.push(
						client.subscribe(
							client.query(collection) as never,
							() => {},
							(error) => {
								errors.push(`${index}:${collection}:${String(error)}`);
							},
							{
								onRemoteFulfilled: () => {
									fulfilled.add(`${index}:${collection}`);
								}
							}
						)
					);
				unsubscribes.push(
					client.onFailureToSyncWrites((error) => {
						errors.push(`${index}:writes:${String(error)}`);
					})
				);
			}
			const [first, second] = clients.map(createTriplitRepository);
			const open = () => clients.every((client) => client.connectionStatus === 'OPEN');
			await expect.poll(open, { timeout: 10000 }).toBe(true);
			await expect.poll(() => fulfilled.size, { timeout: 10000 }).toBe(collections.length * 2);
			const raw = async (
				index: number,
				collection: (typeof collections)[number],
				id: string
			): Promise<Record<string, unknown> | undefined> =>
				(
					(await clients[index].fetch(clients[index].query(collection) as never, {
						policy: 'local-only'
					})) as Record<string, unknown>[]
				).find((row) => row.id === id);
			const has = async (index: number, collection: (typeof collections)[number], id: string) =>
				(await raw(index, collection, id)) !== undefined;
			const outboxEmpty = (index: number) =>
				expect.poll(() => getPendingChangeCount(clients[index]), { timeout: 10000 }).toBe(0);
			const watch = (id: string) => {
				for (const [index, client] of clients.entries())
					unsubscribes.push(
						client.onEntitySyncError('intentionAssessments', id, (error) => {
							errors.push(`${index}:entity:${id}:${String(error)}`);
						})
					);
			};

			const a = await first.createTrace(draft('A', 'intend'));
			const b = await first.createTrace(draft('B', 'intend'));
			const f = await first.createTrace(draft('F', 'actual'));
			const fa = await first.createIntersection({ fromId: f.id, toId: a.id, kind: 'evidence_for' });
			const fbOld = await first.createIntersection({
				fromId: f.id,
				toId: b.id,
				kind: 'evidence_for'
			});
			for (const id of [fa.id, fbOld.id])
				await expect.poll(() => has(1, 'intersections', id), { timeout: 10000 }).toBe(true);
			const sourceId = assessmentIdFor(fa.activationId ?? '');
			const oldTargetSourceId = assessmentIdFor(fbOld.activationId ?? '');
			watch(sourceId);
			watch(oldTargetSourceId);

			// Second goes offline with both links active and no source yet.
			await clients[1].disconnect();
			await expect.poll(() => clients[1].connectionStatus, { timeout: 10000 }).toBe('CLOSED');

			// First withdraws F->B, creates and corrects the source of F->A, then retargets it to B.
			await first.setIntersectionDeleted(fbOld.id, true);
			const created = await first.createEvidenceAssessment(fa.id, { outcome: 'completed' });
			const { assessment: corrected } = await first.editIntentionAssessment(sourceId, {
				outcome: 'partial'
			});
			const { link: fb, assessment: moved } = await first.correctEvidenceTarget(fa.id, b.id);
			expect(moved?.id).toBe(sourceId);
			await outboxEmpty(0);

			// Second, still offline and unaware, authors its first on F->A and on the old F->B.
			const late = await second.createEvidenceAssessment(fa.id, { open: true });
			expect(late.id).toBe(sourceId);
			const lateOld = await second.createEvidenceAssessment(fbOld.id, { outcome: 'alternative' });
			expect(lateOld.id).toBe(oldTargetSourceId);

			await clients[1].connect();
			await expect.poll(open, { timeout: 10000 }).toBe(true);
			await outboxEmpty(1);
			const candidates = async (index: number) =>
				Object.keys(
					((await raw(index, 'intentionAssessments', sourceId))?.initial as object | undefined) ??
						{}
				).length;
			await expect.poll(() => candidates(0), { timeout: 10000 }).toBe(2);
			await expect.poll(() => candidates(1), { timeout: 10000 }).toBe(2);
			await expect
				.poll(() => has(0, 'intentionAssessments', oldTargetSourceId), { timeout: 10000 })
				.toBe(true);
			await expect
				.poll(async () => (await raw(1, 'intersections', fb.id))?.activationId, { timeout: 10000 })
				.toBe(fb.activationId);

			for (const [index, repository] of [first, second].entries()) {
				const source = (await repository.listIntentionAssessments(true)).find(
					(row) => row.id === sourceId
				);
				expect(source).toMatchObject({
					intentionId: b.id,
					evidenceId: fb.id,
					activationId: fb.activationId,
					placementRevision: moved?.placementRevision,
					outcome: 'partial',
					outcomeRevision: corrected.outcomeRevision,
					open: true,
					firstAssessedAt: created.firstAssessedAt
				});
				const link = (await repository.listIntersections(true)).find((row) => row.id === fb.id);
				expect(link).toMatchObject({
					isDeleted: false,
					activationId: fb.activationId,
					assessmentId: sourceId
				});
				const result = await evaluate(repository, b.id);
				expect(result.outcome).toEqual({ value: 'partial', sourceId });
				expect(result.open).toEqual({ value: true, sourceId });
				expect(
					result.sources.find((entry) => entry.assessment.id === oldTargetSourceId)?.eligibility
				).toEqual({
					eligible: false,
					reason: 'activation_mismatch'
				});
				expect((await evaluate(repository, a.id)).outcome.value).toBeNull();
				expect(index).toBeLessThan(2);
			}
			const rowIds = {
				traces: [a.id, b.id, f.id],
				intersections: [fa.id, fb.id],
				intentionAssessments: [sourceId, oldTargetSourceId]
			};
			for (const collection of collections) {
				for (const id of rowIds[collection]) {
					expect(canonical(await raw(1, collection, id))).toBe(
						canonical(await raw(0, collection, id))
					);
				}
			}
			expect(errors).toEqual([]);
		} finally {
			for (const unsubscribe of unsubscribes) unsubscribe();
			for (const client of clients) await client.disconnect();
		}
	},
	60000
);
