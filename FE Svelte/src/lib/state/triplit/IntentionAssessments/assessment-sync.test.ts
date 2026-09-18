import { TriplitClient } from '@triplit/client';
import { expect, it } from 'vitest';
import { createTriplitRepository } from '../repository';
import { schema } from '../schema';
import { getPendingChangeCount } from '../sync-status';
import type { Intersection, Trace } from '../types';
import { collectAssessmentContext, describeAssessmentEligibility } from './eligibility';
import { dayTime, traceDraft } from './fixture';
import { assessmentIdFor } from './read';

const serverUrl = process.env.TEMPIENCE_TEST_SYNC_URL;
const collections = ['traces', 'intersections', 'intentionAssessments'] as const;

it.runIf(serverUrl)(
	'merges concurrent first assessments, independent corrections and late writes across two clients',
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
				for (const collection of collections) {
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
				}
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
			const raw = async (index: number, id: string) =>
				(
					await clients[index].fetch(clients[index].query('intentionAssessments'), {
						policy: 'local-only'
					})
				).find((row) => row.id === id);
			const rows = async (index: number, ids: readonly string[]) =>
				(
					await clients[index].fetch(clients[index].query('intentionAssessments'), {
						policy: 'local-only'
					})
				)
					.filter((row) => ids.includes(row.id))
					.toSorted((a, b) => a.id.localeCompare(b.id));
			const disconnectSecond = async () => {
				await clients[1].disconnect();
				await expect.poll(() => clients[1].connectionStatus, { timeout: 10000 }).toBe('CLOSED');
			};
			const reconnectSecond = async () => {
				await clients[1].connect();
				await expect.poll(open, { timeout: 10000 }).toBe(true);
			};
			const firstOutboxEmpty = () =>
				expect.poll(() => getPendingChangeCount(clients[0]), { timeout: 10000 }).toBe(0);
			const watch = (id: string) => {
				for (const [index, client] of clients.entries())
					unsubscribes.push(
						client.onEntitySyncError('intentionAssessments', id, (error) => {
							errors.push(`${index}:entity:${id}:${String(error)}`);
						})
					);
			};

			const intention = await first.createTrace(traceDraft('Sync intention', 'intend'));
			const [f, g, h] = await Promise.all(
				['F', 'G', 'H'].map((content) =>
					first.createTrace(traceDraft(content, 'actual', dayTime('2026-09-11')))
				)
			);
			const link = async (fact: Trace) =>
				first.createIntersection({ fromId: fact.id, toId: intention.id, kind: 'evidence_for' });
			const fLink = await link(f);
			const gLink = await link(g);
			const hLink = await link(h);
			// The server keeps earlier runs: wait for this run's links, not for a count.
			await expect
				.poll(
					async () => {
						const ids = new Set((await second.listIntersections()).map((row) => row.id));
						return [fLink, gLink, hLink].every((row) => ids.has(row.id));
					},
					{ timeout: 10000 }
				)
				.toBe(true);
			const x = assessmentIdFor(fLink.activationId ?? '');
			watch(x);

			// Simultaneous first creation of one activation; the online client also corrects it first.
			await disconnectSecond();
			const created = await first.createEvidenceAssessment(fLink.id, { outcome: 'completed' });
			expect(created.id).toBe(x);
			const { assessment: corrected } = await first.editIntentionAssessment(x, {
				outcome: 'partial'
			});
			await firstOutboxEmpty();
			const late = await second.createEvidenceAssessment(fLink.id, { open: false });
			expect(late.id).toBe(x);
			expect(late.firstAssessedAt > created.firstAssessedAt).toBe(true);
			const gAssessment = await second.createEvidenceAssessment(gLink.id, {
				outcome: 'not_completed'
			});
			await reconnectSecond();
			const candidates = async (index: number) =>
				Object.keys(((await raw(index, x))?.initial as object | undefined) ?? {}).length;
			await expect.poll(() => candidates(0), { timeout: 10000 }).toBe(2);
			await expect.poll(() => candidates(1), { timeout: 10000 }).toBe(2);
			for (const repository of [first, second]) {
				const merged = (await repository.listIntentionAssessments()).find((row) => row.id === x);
				expect(merged).toMatchObject({
					firstAssessedAt: created.firstAssessedAt,
					outcome: 'partial',
					outcomeRevision: corrected.outcomeRevision,
					open: false,
					openRevision: late.openRevision
				});
			}
			await expect.poll(() => raw(0, gAssessment.id), { timeout: 10000 }).toBeDefined();
			expect(await raw(1, x)).toEqual(await raw(0, x));

			// Independent corrections of the two features on the same source while apart.
			await disconnectSecond();
			const { assessment: opened } = await first.editIntentionAssessment(x, { open: true });
			await firstOutboxEmpty();
			const { assessment: completed } = await second.editIntentionAssessment(x, {
				outcome: 'completed'
			});
			await reconnectSecond();
			const settled = async (index: number) => {
				const row = await raw(index, x);
				const values = row?.values as Record<string, { operationId: string }> | undefined;
				return `${values?.outcome?.operationId}/${values?.open?.operationId}`;
			};
			const expected = `${completed.outcomeRevision}/${opened.openRevision}`;
			await expect.poll(() => settled(0), { timeout: 10000 }).toBe(expected);
			await expect.poll(() => settled(1), { timeout: 10000 }).toBe(expected);
			for (const repository of [first, second]) {
				expect(
					(await repository.listIntentionAssessments()).find((row) => row.id === x)
				).toMatchObject({
					outcome: 'completed',
					open: true,
					firstAssessedAt: created.firstAssessedAt
				});
			}

			// A late first write against an activation that was replaced meanwhile stays detached.
			await disconnectSecond();
			await first.setIntersectionDeleted(hLink.id, true);
			const renewedLink = await first.createIntersection({
				fromId: h.id,
				toId: intention.id,
				kind: 'evidence_for'
			});
			expect(renewedLink.activationId).not.toBe(hLink.activationId);
			await firstOutboxEmpty();
			const stale = await second.createEvidenceAssessment(hLink.id, { open: false });
			expect(stale.activationId).toBe(hLink.activationId);
			watch(stale.id);
			await reconnectSecond();
			await expect.poll(() => raw(0, stale.id), { timeout: 10000 }).toBeDefined();
			await expect
				.poll(
					async () =>
						(await second.listIntersections()).find((row) => row.id === hLink.id)?.activationId,
					{ timeout: 10000 }
				)
				.toBe(renewedLink.activationId);
			for (const repository of [first, second]) {
				const traces = new Map<string, Trace>(
					(await repository.listTraces(true)).map((trace) => [trace.id, trace])
				);
				const links = new Map<string, Intersection>(
					(await repository.listIntersections(true)).map((row) => [row.id, row])
				);
				const detached = (await repository.listIntentionAssessments()).find(
					(row) => row.id === stale.id
				);
				expect(detached).toBeDefined();
				expect(
					describeAssessmentEligibility(
						detached!,
						collectAssessmentContext(detached!, traces, links)
					)
				).toEqual({ eligible: false, reason: 'activation_mismatch' });
				expect(
					(await repository.listIntentionAssessments()).some(
						(row) => row.activationId === renewedLink.activationId
					)
				).toBe(false);
			}

			// Revival with a newly explicit feature, then a conflicting late first creation from a
			// client that holds the link but never saw the source.
			const k = await first.createTrace(traceDraft('K', 'actual', dayTime('2026-09-11')));
			const kLink = await link(k);
			await expect
				.poll(async () => (await second.listIntersections()).some((row) => row.id === kLink.id), {
					timeout: 10000
				})
				.toBe(true);
			const kId = assessmentIdFor(kLink.activationId ?? '');
			watch(kId);
			await disconnectSecond();
			const kCreated = await first.createEvidenceAssessment(kLink.id, { outcome: 'completed' });
			await first.setIntentionAssessmentDeleted(kId, true);
			const kRevived = await first.createEvidenceAssessment(kLink.id, { open: false });
			await firstOutboxEmpty();
			const kLate = await second.createEvidenceAssessment(kLink.id, { open: true });
			expect(kLate.id).toBe(kId);
			await reconnectSecond();
			const kCandidates = async (index: number) =>
				Object.keys(((await raw(index, kId))?.initial as object | undefined) ?? {}).length;
			await expect.poll(() => kCandidates(0), { timeout: 10000 }).toBe(2);
			await expect.poll(() => kCandidates(1), { timeout: 10000 }).toBe(2);
			for (const repository of [first, second]) {
				expect(
					(await repository.listIntentionAssessments()).find((row) => row.id === kId)
				).toMatchObject({
					isDeleted: false,
					open: false,
					openRevision: kRevived.openRevision,
					outcome: 'completed',
					firstAssessedAt: kCreated.firstAssessedAt
				});
			}
			expect(await raw(1, kId)).toEqual(await raw(0, kId));

			const ids = [x, gAssessment.id, stale.id, kId];
			await expect.poll(async () => (await rows(1, ids)).length, { timeout: 10000 }).toBe(4);
			expect(await rows(1, ids)).toEqual(await rows(0, ids));
			expect(errors).toEqual([]);
		} finally {
			for (const unsubscribe of unsubscribes) unsubscribe();
			for (const client of clients) await client.disconnect();
		}
	},
	60000
);
