import { expect, it } from 'vitest';
import { canonical, openSyncFixture, SYNC_URL, type SyncFixture } from '../sync.fixture';
import type { Intersection, Trace } from '../types';
import { traceRecordText } from './fields';
import { dayTime, plainFields } from './record.fixture';

const collections = [
	'traces',
	'intersections',
	'intentionAssessments',
	'scopes',
	'traceKinds',
	'traceKindVersions'
] as const;

const pick = <T extends { id: string }>(rows: T[], ids: readonly string[]): string =>
	canonical(ids.map((id) => rows.find((row) => row.id === id) ?? null));

it.runIf(SYNC_URL)(
	'replicates one form save with description, relations, assessments, typed and supplement records',
	async () => {
		const sync: SyncFixture = await openSyncFixture(collections);
		const [first, second] = sync.replicas.map((replica) => replica.repository);
		try {
			const scope = await first.createScope({ name: 'Sync Scope' });
			const { kind, kindV } = await first.createTraceKind({
				name: 'Sync Kind',
				initialKindV: {
					dataSchema: {
						type: 'object',
						additionalProperties: false,
						required: ['weight'],
						properties: { weight: { type: 'number' } }
					}
				}
			});
			const a = await first.saveTraceRecord({
				fields: plainFields('Sync intention A', {
					relation: 'intend',
					aboutTime: dayTime('2100-01-01')
				})
			});
			const b = await first.saveTraceRecord({
				fields: plainFields('Sync intention B', {
					relation: 'intend',
					aboutTime: dayTime('2100-01-02')
				})
			});
			const fact = await first.saveTraceRecord({
				fields: plainFields('Sync walk', { description: 'through the park' }),
				memberships: { add: [scope.id] },
				links: {
					add: [
						{ kind: 'evidence_for', intentionId: a.trace.id, assessment: { outcome: 'completed' } },
						{ kind: 'evidence_for', intentionId: b.trace.id, assessment: { open: false } }
					]
				}
			});
			const typed = await first.saveTraceRecord({
				fields: plainFields(null, {
					description: '',
					kindId: kind.id,
					kindVId: kindV.id,
					data: { weight: 74 }
				})
			});
			const supplement = await first.saveTraceRecord({
				fields: plainFields('Sync supplement', {
					aboutKind: 'trace_ref',
					aboutTime: null,
					aboutTraceId: null
				}),
				links: { add: [{ kind: 'revisits', originalId: fact.trace.id }] }
			});
			expect(fact.trace.description).toBe('through the park');
			expect(typed.trace).toMatchObject({ content: '', description: null, kindId: kind.id });
			expect(fact.assessments.map((row) => [row.outcome, row.open])).toEqual([
				['completed', null],
				[null, false]
			]);
			await sync.acked(0);

			const traceIds = [a.trace.id, b.trace.id, fact.trace.id, typed.trace.id, supplement.trace.id];
			const linkIds = [
				...fact.links.map((link) => link.id),
				...supplement.links.map((link) => link.id),
				`${fact.trace.id}:${scope.id}:belongs_to`
			];
			const assessmentIds = fact.assessments.map((row) => row.id);
			for (const id of traceIds)
				await expect.poll(() => sync.has(1, 'traces', id), { timeout: 10000 }).toBe(true);
			for (const id of assessmentIds)
				await expect
					.poll(() => sync.has(1, 'intentionAssessments', id), { timeout: 10000 })
					.toBe(true);
			await expect
				.poll(
					async () =>
						(await second.listIntersections(true)).filter(
							(row) => row.fromId === fact.trace.id || row.fromId === supplement.trace.id
						).length,
					{ timeout: 10000 }
				)
				.toBe(4);

			// Same identities and values on the other replica.
			const traces = async (repo: typeof first) => pick(await repo.listTraces(true), traceIds);
			const links = async (repo: typeof first) =>
				canonical(
					(await repo.listIntersections(true))
						.filter(
							(row: Intersection) =>
								row.fromId === fact.trace.id || row.fromId === supplement.trace.id
						)
						.toSorted((x, y) => x.id.localeCompare(y.id))
				);
			const assessments = async (repo: typeof first) =>
				pick(await repo.listIntentionAssessments(true), assessmentIds);
			expect(await traces(second)).toBe(await traces(first));
			expect(await links(second)).toBe(await links(first));
			expect(await assessments(second)).toBe(await assessments(first));
			const secondLinks = await links(second);
			expect(linkIds.every((id) => secondLinks.includes(`"id":"${id}"`))).toBe(true);
			const replicated = (await second.listTraces(true)).find(
				(row: Trace) => row.id === fact.trace.id
			)!;
			expect(traceRecordText(replicated)).toEqual({
				title: 'Sync walk',
				description: 'through the park'
			});
			expect(
				(await second.listIntentionAssessments()).map((row) => [
					row.intentionId,
					row.outcome,
					row.open,
					row.outcomeRevision ?? row.openRevision
				])
			).toEqual(
				expect.arrayContaining([
					[a.trace.id, 'completed', null, fact.operation.id],
					[b.trace.id, null, false, fact.operation.id]
				])
			);
			// The replicated supplement is valid on the other replica: a no-op save passes its check.
			await second.saveTraceRecord({ id: supplement.trace.id, fields: {} });

			// Edit and clear the description from the other side, then set it again.
			await second.saveTraceRecord({ id: fact.trace.id, fields: { description: '  ' } });
			await sync.acked(1);
			await expect
				.poll(async () => (await sync.raw(0, 'traces', fact.trace.id))?.description ?? null, {
					timeout: 10000
				})
				.toBeNull();
			await second.saveTraceRecord({ id: fact.trace.id, fields: { description: 'again' } });
			await sync.acked(1);
			await expect
				.poll(async () => (await sync.raw(0, 'traces', fact.trace.id))?.description, {
					timeout: 10000
				})
				.toBe('again');
			await first.saveTraceRecord({ id: typed.trace.id, fields: { description: 'after sleep' } });
			await sync.acked(0);
			await expect
				.poll(async () => (await sync.raw(1, 'traces', typed.trace.id))?.content, {
					timeout: 10000
				})
				.toBe('after sleep');
			expect(
				(await second.listTraces(true)).find((row: Trace) => row.id === typed.trace.id)
			).toMatchObject({
				content: 'after sleep',
				description: null,
				data: { weight: 74 }
			});
			expect(sync.errors).toEqual([]);
		} finally {
			await sync.dispose();
		}
	},
	45000
);
