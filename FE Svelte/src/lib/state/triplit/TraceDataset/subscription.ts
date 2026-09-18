import type { TempienceTriplitClient } from '../client';
import { normalizeKindVersions, traceDatasetCompatibilityIssues } from './compatibility';
import { errorMessage, idsKey, noop } from './helpers';
import { subscribeScope } from './scopes';
import type {
	KindRowsSnapshot,
	StoredTraceKindV,
	TraceDatasetRequest,
	TraceDatasetSnapshotBase,
	Unsubscribe
} from './types';

/** One live query of a Kind's rows: what is read, how it is projected, what it must agree with. */
export type KindRowsSpec<Row> = {
	kindId: string;
	scope?: TraceDatasetRequest['scope'];
	/** The versions whose schemas the read must agree with: one version's, or every one. */
	kindVId?: string;
	/** The columns and filters the versions are checked against. */
	compatibility: TraceDatasetRequest;
	query: (
		resolvedScopeIds: readonly string[] | null
	) => Parameters<TempienceTriplitClient['subscribe']>[0];
	project: (values: readonly unknown[], knownKindVIds: ReadonlySet<string>) => Row[];
};

/**
 * Follows the Kind's versions, the Scope it is restricted to, and the rows: the rows are
 * subscribed once the Scope has resolved, renewed when its resolution changes, and answered
 * projected once both the versions and the rows are known. A read that disagrees with a
 * version's schema is answered as incompatible, never with wrong values.
 */
export const subscribeKindRows = <Row>(
	client: TempienceTriplitClient,
	spec: KindRowsSpec<Row>,
	callback: (snapshot: KindRowsSnapshot<Row>) => void
): Unsubscribe => {
	let disposed = false;
	let unsubscribeKindVersions: Unsubscribe = noop;
	let unsubscribeScope: Unsubscribe = noop;
	let unsubscribeRows: Unsubscribe = noop;
	let kindVersionsReady = false;
	let scopeReady = spec.scope === undefined;
	let rowsReady = false;
	let kindVersions: StoredTraceKindV[] = [];
	let values: readonly unknown[] = [];
	let resolvedScopeIds: string[] | null | undefined = spec.scope ? undefined : null;
	let rowsQueryKey: string | null = null;

	const snapshotBase = (): TraceDatasetSnapshotBase => ({
		kindId: spec.kindId,
		resolvedScopeIds: resolvedScopeIds ?? (spec.scope ? [] : null)
	});

	const publishError = (cause: unknown): void => {
		if (disposed) return;
		callback({ ...snapshotBase(), status: 'error', message: errorMessage(cause) });
	};

	const stopRows = (): void => {
		unsubscribeRows();
		unsubscribeRows = noop;
		rowsQueryKey = null;
		rowsReady = false;
		values = [];
	};

	const reconcile = (): void => {
		if (disposed) return;
		if (!kindVersionsReady || !scopeReady || resolvedScopeIds === undefined) {
			callback({ ...snapshotBase(), status: 'loading' });
			return;
		}
		if (spec.scope) {
			if (resolvedScopeIds === null) {
				stopRows();
				publishError('Scoped Trace dataset resolved without Scope ids');
				return;
			}
			if (resolvedScopeIds.length === 0) {
				stopRows();
				callback({ ...snapshotBase(), status: 'ready', rows: [] });
				return;
			}
		}
		const versions =
			spec.kindVId === undefined
				? kindVersions
				: kindVersions.filter((kindV) => kindV.id === spec.kindVId);
		if (versions.length === 0) {
			stopRows();
			publishError(
				spec.kindVId === undefined
					? `TraceKind ${spec.kindId} has no versions`
					: `TraceKindV ${spec.kindVId} is not a version of TraceKind ${spec.kindId}`
			);
			return;
		}

		const compatibilityIssues = traceDatasetCompatibilityIssues(versions, spec.compatibility);
		if (compatibilityIssues.length > 0) {
			stopRows();
			callback({ ...snapshotBase(), status: 'incompatible', issues: compatibilityIssues });
			return;
		}

		const nextKey = resolvedScopeIds === null ? '*' : idsKey(resolvedScopeIds);
		if (rowsQueryKey !== nextKey) {
			stopRows();
			rowsQueryKey = nextKey;
			unsubscribeRows = client.subscribe(
				spec.query(resolvedScopeIds),
				(rows) => {
					if (disposed || rowsQueryKey !== nextKey) return;
					values = rows;
					rowsReady = true;
					reconcile();
				},
				publishError
			);
		}
		if (!rowsReady) {
			callback({ ...snapshotBase(), status: 'loading' });
			return;
		}

		try {
			callback({
				...snapshotBase(),
				status: 'ready',
				rows: spec.project(values, new Set(versions.map((kindV) => kindV.id)))
			});
		} catch (cause: unknown) {
			publishError(cause);
		}
	};

	callback({ ...snapshotBase(), status: 'loading' });

	const kindVersionsQuery = client
		.query('traceKindVersions')
		.Where('kindId', '=', spec.kindId)
		.Select(['id', 'generation', 'dataSchema']);
	unsubscribeKindVersions = client.subscribe(
		kindVersionsQuery,
		(rows) => {
			if (disposed) return;
			kindVersions = normalizeKindVersions(rows);
			kindVersionsReady = true;
			reconcile();
		},
		publishError
	);

	if (spec.scope) {
		unsubscribeScope = subscribeScope(
			client,
			spec.scope,
			(ids) => {
				if (disposed) return;
				resolvedScopeIds = ids;
				scopeReady = true;
				reconcile();
			},
			publishError
		);
	}

	return () => {
		disposed = true;
		unsubscribeKindVersions();
		unsubscribeScope();
		unsubscribeRows();
	};
};
