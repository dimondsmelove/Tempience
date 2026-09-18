import { versionSummaries, type VersionSummary } from '$lib/model/TraceForm/summary-fields';
import { neighbourIds } from '$lib/state/Records/links';
import { displayedTrace } from '$lib/state/Workbench/display';
import { buildRepositoryExplorerSnapshot } from '$lib/state/Workbench/snapshot';
import type { TempienceTriplitClient } from '../../client';
import { fetchReplica } from '../../replica-fetch';
import type { TempienceRepository } from '../../repository';
import {
	groupHeadIds,
	mergeTraceHeads,
	summaryGroups,
	traceHeadsQuery,
	traceLeavesQuery
} from '../../Traces/heads';
import { byNewestCaptured } from '../../Traces/read';
import type { HistoryFixture } from '../history.fixture';
import { bytes, measured, memory, timed, type Measured } from './tools';

type Paths = readonly VersionSummary[];

/**
 * Boot: the timeline snapshot as read before I6 (whole rows, whole links) and as read now,
 * the records' and the links' reads timed apart inside it.
 */
export const measureBoot = async (repository: TempienceRepository, paths: Paths) => {
	const whole = await timed(() =>
		buildRepositoryExplorerSnapshot(
			{ ...repository, listTraceHeads: undefined, listLinkHeads: undefined },
			'i6'
		)
	);
	const parts: Record<string, number> = {};
	const thin = await timed(() =>
		buildRepositoryExplorerSnapshot(repository, 'i6', paths, async (step, run) => {
			const { value, ms } = await timed(run);
			parts[step] = ms;
			return value;
		})
	);
	const withNote = (snapshot: typeof whole.value) =>
		snapshot.traces.filter((trace) => typeof trace.data?.note === 'string').length;
	// The display of every row through its version, as the boot maps the snapshot.
	const catalog = {
		kinds: await repository.listTraceKinds(),
		versions: await repository.listTraceKindVersions()
	};
	const display = await timed(async () =>
		thin.value.traces.map((trace) => displayedTrace(trace, catalog))
	);
	return {
		display: { ms: display.ms, rows: display.value.length },
		whole: {
			ms: whole.ms,
			traces: whole.value.traces.length,
			jsonBytes: bytes(whole.value),
			rowsWithNote: withNote(whole.value),
			memoryMiB: memory()
		},
		thin: {
			ms: thin.ms,
			parts,
			traces: thin.value.traces.length,
			jsonBytes: bytes(thin.value),
			rowsWithNote: withNote(thin.value),
			memoryMiB: memory()
		}
	};
};

/**
 * The phases of the thin read of every active record, one by one: the heads' scan, each
 * group's scan of its versions' leaves, the merge into records, the order. What the read's
 * time is made of, beside the SDK's projection of every selected path.
 */
export const measureHeadsPhases = async (client: TempienceTriplitClient, paths: Paths) => {
	const request = { deleted: 'active' as const, summaries: paths };
	const groups = summaryGroups(paths);
	const heads = await timed(() => fetchReplica(client, traceHeadsQuery(client, request, 'read')));
	const scans: { group: string; ms: number; rows: number }[] = [];
	const leaves = new Map<string, readonly unknown[]>();
	for (const group of groups) {
		const scan = await timed(() =>
			fetchReplica(client, traceLeavesQuery(client, request, group, 'read'))
		);
		scans.push({
			group: group.paths.map((path) => path.join('.')).join(','),
			ms: scan.ms,
			rows: scan.value.length
		});
		leaves.set(group.key, scan.value);
	}
	const grouping = await timed(async () => groupHeadIds(heads.value, groups));
	const merge = await timed(async () => mergeTraceHeads(heads.value, leaves, groups));
	const order = await timed(async () => merge.value.toSorted(byNewestCaptured));
	return {
		headsScan: { ms: heads.ms, rows: heads.value.length },
		leafScans: scans,
		groupingMs: grouping.ms,
		mergeMs: merge.ms,
		orderMs: order.ms,
		rows: order.value.length
	};
};

/** A form opening: what its result picker reads, before I6 and now. */
export const measureFormOpen = async (repository: TempienceRepository, paths: Paths) => ({
	before: {
		links: await measured(() => repository.listIntersections()),
		traces: await measured(() => repository.listTraces(true))
	},
	now: {
		linkHeads: await measured(() => repository.listLinkHeads({ deleted: 'active' })),
		kindLinks: await measured(() => repository.listKindMemberships({ deleted: 'active' })),
		heads: await measured(() => repository.listTraceHeads({ deleted: 'all', summaries: paths })),
		assessments: await measured(() => repository.listIntentionAssessments(true))
	}
});

/**
 * The Context on one record — the first of the candidates that belongs somewhere, so the
 * bounded reads have something to follow: the whole-space reads of before, and the reads
 * bounded by the record.
 */
export const measureContextOpen = async (
	repository: TempienceRepository,
	candidates: readonly string[],
	paths: Paths
) => {
	let id = candidates[0];
	for (const candidate of candidates) {
		if ((await repository.listIntersectionsTouching(candidate)).length > 0) {
			id = candidate;
			break;
		}
	}
	const before = await timed(async () => {
		const [traces, links, assessments] = await Promise.all([
			repository.listTraces(true),
			repository.listIntersections(true),
			repository.listIntentionAssessments(true)
		]);
		return { traces: bytes(traces), links: bytes(links), assessments: bytes(assessments) };
	});
	const now = await timed(async () => {
		const [record, links, assessments] = await Promise.all([
			repository.readTraceRow(id),
			repository.listIntersectionsTouching(id),
			repository.listIntentionAssessmentsFor(id)
		]);
		const ids = neighbourIds(id, record, links, assessments);
		const others = await repository.listTraceHeads({ ids, deleted: 'all', summaries: paths });
		return {
			record: bytes(record),
			links: bytes(links),
			touching: links.length,
			assessments: bytes(assessments),
			neighbours: ids.length,
			others: bytes(others)
		};
	});
	return { id, before: { ms: before.ms, ...before.value }, now: { ms: now.ms, ...now.value } };
};

/** The lists of deleted records and deleted Scopes, and the Scope panel's Kinds. */
export const measureLists = async (repository: TempienceRepository, fixture: HistoryFixture) => {
	const paths = versionSummaries(await repository.listTraceKindVersions());
	const scope = fixture.scopes[0];
	const deletedRecords = {
		before: await measured(() => repository.listTraces(true)),
		now: await measured(() => repository.listTraceHeads({ deleted: 'deleted', summaries: paths }))
	};
	const scopeKinds = {
		before: await measured(() => repository.listIntersections()),
		now: await measured(() =>
			repository.listKindMemberships({ scopeIds: [scope.id], deleted: 'active' })
		)
	};
	const builderMemberships: Measured = await measured(() =>
		repository.listKindMemberships({ kindId: fixture.kinds.measure.id, deleted: 'active' })
	);
	// One Scope is deleted for the measurement and brought back after it.
	await repository.setScopeDeleted(scope.id, true, 'user');
	const deletedScopes = {
		before: {
			scopes: await measured(() => repository.listScopes(true)),
			links: await measured(() => repository.listIntersections(true)),
			traces: await measured(() => repository.listTraces(true))
		},
		now: {
			scopes: await measured(() => repository.listScopes(true)),
			kindLinks: await measured(() =>
				repository.listKindMemberships({ scopeIds: [scope.id], deleted: 'all' })
			),
			memberIds: await measured(() => repository.listMemberIds(scope.id))
		}
	};
	await repository.setScopeDeleted(scope.id, false, 'user');
	return { deletedRecords, scopeKinds, builderMemberships, deletedScopes };
};
