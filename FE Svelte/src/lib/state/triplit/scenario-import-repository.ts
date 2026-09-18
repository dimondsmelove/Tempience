import { type DataSpace, type ScenarioDataSpaceId } from './data-space';
import { createId, getDeviceId } from './ids';
import { periodTimeBounds, parsePeriodTime, assertTimeZone } from './period-time';
import { inspectScopeHierarchyIntegrity } from './scope-hierarchy-integrity';
import {
	assertIsoTimestamp,
	assertTraceTemporalPlacement,
	exactTraceTimeProjection,
	parseTraceAboutTime
} from './trace-time';
import { assertJsonObject, assertTraceData } from './trace-kind-v-validation';
import type {
	IntersectionDraft,
	IntersectionKind,
	JsonObject,
	PeriodDraft,
	ScopeDraft,
	ScopeSegmentDraft,
	TraceDraft
} from './types';
import type { RepositoryClient } from './repository';

export const SCENARIO_IMPORT_BATCH_VERSION = 'tempience.scenario-import.v1' as const;

type Transaction = Parameters<RepositoryClient['transact']>[0] extends (
	transaction: infer T
) => Promise<unknown>
	? T
	: never;

type Collection = Parameters<Transaction['fetchById']>[0];
type Stored = Record<string, unknown> & { id: string };

export type ScenarioImportEntry =
	| {
			type: 'scope';
			id: string;
			candidateId: string;
			draft: ScopeDraft;
	  }
	| {
			type: 'trace';
			id: string;
			candidateId: string;
			draft: Omit<TraceDraft, 'capturedAt'> & { capturedAt?: string };
	  }
	| {
			type: 'period';
			id: string;
			candidateId: string;
			draft: PeriodDraft;
	  }
	| {
			type: 'intersection';
			id: string;
			candidateId: string;
			draft: IntersectionDraft;
	  }
	| {
			type: 'scopeSegment';
			id: string;
			candidateId: string;
			draft: ScopeSegmentDraft & { scopeId: string };
	  };

export type ScenarioImportSkip = {
	candidateId: string;
	reason: string;
};

export type ScenarioImportBatch = {
	schemaVersion: typeof SCENARIO_IMPORT_BATCH_VERSION;
	manifestId: string;
	manifestVersion: string | number;
	targetDataSpaceId: ScenarioDataSpaceId;
	capturedAt: string;
	mapping: Readonly<Record<string, string>>;
	/** Compatibility names used by the calibration planner boundary. */
	candidateToRecord?: Readonly<Record<string, string>>;
	entries: readonly ScenarioImportEntry[];
	skipped: readonly ScenarioImportSkip[];
	skippedRecords?: readonly ScenarioImportSkip[];
};

export type ScenarioImportCounts = {
	created: number;
	reused: number;
	skipped: number;
};

export type ScenarioImportIssue = {
	candidateId?: string;
	id?: string;
	reason: string;
	kind?: 'validation' | 'drift';
};

export type ScenarioImportPreview = {
	targetDataSpaceId: ScenarioDataSpaceId;
	manifestId: string;
	manifestVersion: string | number;
	capturedAt: string;
	mapping: Readonly<Record<string, string>>;
	planned: ScenarioImportCounts;
	created: number;
	reused: number;
	skipped: number;
	drift: ScenarioImportIssue[];
	errors: ScenarioImportIssue[];
};

export type ScenarioImportReceipt = ScenarioImportCounts & {
	failures: readonly ScenarioImportIssue[];
	mapping: Readonly<Record<string, string>>;
	manifestId: string;
	manifestVersion: string | number;
	targetDataSpaceId: ScenarioDataSpaceId;
	capturedAt: string;
	appliedAt: string;
};

export type ScenarioImportRepository = {
	inspect: (batch: ScenarioImportBatch) => Promise<ScenarioImportPreview>;
	apply: (batch: ScenarioImportBatch) => Promise<ScenarioImportReceipt>;
};

export type ScenarioImportRepositoryOptions = {
	now?: () => string;
	deviceId?: string;
};

const collections: readonly Collection[] = [
	'traceKinds',
	'traceKindVersions',
	'traces',
	'periods',
	'scopes',
	'scopeSegments',
	'intersections',
	'logs'
];

const entityCollection = (type: ScenarioImportEntry['type']): Collection =>
	type === 'scope'
		? 'scopes'
		: type === 'trace'
			? 'traces'
			: type === 'period'
				? 'periods'
				: type === 'intersection'
					? 'intersections'
					: 'scopeSegments';

const entityType = (type: ScenarioImportEntry['type']) =>
	type === 'scope'
		? 'scope'
		: type === 'trace'
			? 'trace'
			: type === 'period'
				? 'period'
				: type === 'intersection'
					? 'intersection'
					: 'scopeSegment';

const own = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const text = (value: unknown, label: string): string => {
	if (typeof value !== 'string' || value.trim().length === 0 || value !== value.trim()) {
		throw new Error(`${label} must be a non-empty trimmed string`);
	}
	return value;
};

const nullableText = (value: unknown, label: string): string | null => {
	if (value === null || value === undefined) return null;
	return text(value, label);
};

const periodNote = (value: unknown): string | null => {
	if (value === null || value === undefined) return null;
	if (typeof value !== 'string') throw new Error('Period note must be a string or null');
	return value.trim().length === 0 ? null : value;
};

const isoOrNull = (value: unknown, label: string): string | null => {
	if (value === null || value === undefined) return null;
	if (typeof value !== 'string') throw new Error(`${label} must be an ISO timestamp or null`);
	assertIsoTimestamp(value, label);
	return value;
};

const stable = (value: unknown): unknown => {
	if (Array.isArray(value)) return value.map(stable);
	if (own(value)) {
		return Object.fromEntries(
			Object.keys(value)
				.sort()
				.map((key) => [key, stable(value[key])])
		);
	}
	return value;
};

const equal = (left: unknown, right: unknown): boolean =>
	JSON.stringify(stable(left)) === JSON.stringify(stable(right));

const timestampFactory = (options: ScenarioImportRepositoryOptions): (() => string) => {
	let last = 0;
	return () => {
		if (options.now) return options.now();
		const value = Math.max(Date.now(), last + 1);
		last = value;
		return new Date(value).toISOString();
	};
};

const mapById = (rows: readonly Stored[]): Map<string, Stored> =>
	new Map(rows.map((row) => [String(row.id), row]));

const resolveReference = (
	value: unknown,
	label: string,
	mapping: Readonly<Record<string, string>>,
	knownIds: ReadonlySet<string>
): string => {
	const ref = text(value, label);
	const mapped = mapping[ref];
	if (mapped && knownIds.has(mapped)) return mapped;
	if (mapped) throw new Error(`${label} maps ${ref} to an incompatible record ${mapped}`);
	if (knownIds.has(ref)) return ref;
	throw new Error(`${label} references unknown candidate or record ${ref}`);
};

const parseKind = (value: unknown): IntersectionKind => {
	if (
		typeof value !== 'string' ||
		![
			'belongs_to',
			'contains',
			'child_of',
			'part_of',
			'evidence_for',
			'revisits',
			'related_to'
		].includes(value)
	) {
		throw new Error('Intersection kind is invalid');
	}
	return value as IntersectionKind;
};

const canonicalIntersection = (
	draft: IntersectionDraft,
	mapping: Readonly<Record<string, string>>,
	ids: ReadonlySet<string>
) => {
	const kind = parseKind(draft.kind);
	let fromId = resolveReference(draft.fromId, 'Intersection fromId', mapping, ids);
	let toId = resolveReference(draft.toId, 'Intersection toId', mapping, ids);
	if (kind === 'related_to' && fromId.localeCompare(toId) > 0) [fromId, toId] = [toId, fromId];
	if (fromId === toId) throw new Error('Intersection endpoints must be different');
	return { fromId, toId, kind, context: nullableText(draft.context, 'Intersection context') };
};

const intersectionId = (fromId: string, toId: string, kind: IntersectionKind): string =>
	`${fromId}:${toId}:${kind}`;

const traceRow = (
	entry: Extract<ScenarioImportEntry, { type: 'trace' }>,
	batchCapturedAt: string,
	mapping: Readonly<Record<string, string>>,
	traceIds: ReadonlySet<string>,
	traceKindIds: ReadonlySet<string>,
	traceKindVById: ReadonlyMap<string, Stored>
): Record<string, unknown> => {
	const draft = entry.draft;
	const content = text(draft.content, 'Trace content');
	const capturedAt = draft.capturedAt ?? batchCapturedAt;
	assertIsoTimestamp(capturedAt, 'Trace capturedAt');
	const timezone = text(draft.timezone, 'Trace timezone');
	assertTimeZone(timezone, 'Trace timezone');
	const aboutKind = draft.aboutKind;
	const aboutTime = draft.aboutTime === null ? null : parseTraceAboutTime(draft.aboutTime);
	const aboutTraceId =
		draft.aboutTraceId == null
			? null
			: resolveReference(draft.aboutTraceId, 'Trace aboutTraceId', mapping, traceIds);
	if (aboutTraceId && !traceIds.has(aboutTraceId))
		throw new Error('Trace aboutTraceId must reference a Trace');
	assertTraceTemporalPlacement(aboutKind, aboutTime, aboutTraceId);
	const anchor =
		aboutTime?.basis === 'relative'
			? resolveReference(aboutTime.anchorTraceId, 'Trace relative anchorTraceId', mapping, traceIds)
			: null;
	if (anchor && !traceIds.has(anchor))
		throw new Error('Trace relative anchorTraceId must reference a Trace');
	if (anchor && anchor === entry.id)
		throw new Error('Trace temporal placement cannot reference itself');
	if (aboutTraceId && aboutTraceId === entry.id)
		throw new Error('Trace reference placement cannot reference itself');
	const resolvedTime =
		anchor && aboutTime?.basis === 'relative' ? { ...aboutTime, anchorTraceId: anchor } : aboutTime;
	const kindId =
		draft.kindId == null
			? null
			: resolveReference(draft.kindId, 'Trace kindId', mapping, traceKindIds);
	const kindVId =
		draft.kindVId == null
			? null
			: resolveReference(draft.kindVId, 'Trace kindVId', mapping, new Set(traceKindVById.keys()));
	if ((kindId === null) !== (kindVId === null))
		throw new Error('Trace kindId and kindVId must both be set or both be null');
	if (kindId && kindVId && traceKindVById.get(kindVId)?.kindId !== kindId)
		throw new Error(`TraceKindV ${kindVId} does not belong to TraceKind ${kindId}`);
	const data = draft.data ?? null;
	if (kindId === null || kindVId === null) {
		if (data !== null) assertJsonObject(data, 'Trace data');
	} else {
		const dataSchema = traceKindVById.get(kindVId)?.dataSchema;
		assertJsonObject(dataSchema, `TraceKindV ${kindVId} dataSchema`);
		assertTraceData(data, dataSchema);
	}
	const relation = draft.relation ?? null;
	if (
		relation !== null &&
		!['intend', 'actual', 'observe', 'remember', 'revisit'].includes(relation)
	) {
		throw new Error(`Trace relation is invalid: ${relation}`);
	}
	const projection = exactTraceTimeProjection(aboutKind, resolvedTime);
	return {
		id: entry.id,
		capturedAt,
		timezone,
		aboutKind,
		aboutTime: resolvedTime,
		...projection,
		aboutTraceId,
		content,
		relation,
		kindId,
		kindVId,
		data: data as JsonObject | null,
		isDeleted: false
	};
};

type Plan = {
	rows: Array<{
		entry: ScenarioImportEntry;
		collection: Collection;
		row: Record<string, unknown>;
		existing?: Stored;
	}>;
	firstCapturedAt: string;
};

const validateBatch = async (
	transaction: Transaction,
	batch: ScenarioImportBatch,
	activeDataSpace: DataSpace
): Promise<Plan> => {
	const fail = (
		reason: string,
		entry?: ScenarioImportEntry,
		kind: ScenarioImportIssue['kind'] = 'validation'
	): never => {
		throw Object.assign(new Error(reason), {
			issue: { candidateId: entry?.candidateId, id: entry?.id, reason, kind }
		});
	};
	if (activeDataSpace.id === 'canonical')
		fail('Scenario import cannot target canonical data space');
	if (activeDataSpace.kind !== 'scenario' || activeDataSpace.syncEnabled) {
		fail(`Scenario import requires an isolated scenario data space, got ${activeDataSpace.id}`);
	}
	if (batch.targetDataSpaceId !== activeDataSpace.id)
		fail('Batch targetDataSpaceId is not the active scenario data space');
	if (batch.schemaVersion !== SCENARIO_IMPORT_BATCH_VERSION) {
		fail(`schemaVersion must be ${SCENARIO_IMPORT_BATCH_VERSION}`);
	}
	text(batch.manifestId, 'manifestId');
	if (
		(typeof batch.manifestVersion !== 'string' && typeof batch.manifestVersion !== 'number') ||
		String(batch.manifestVersion).trim() === ''
	)
		fail('manifestVersion is required');
	assertIsoTimestamp(batch.capturedAt, 'Batch capturedAt');
	const entries = [...(batch.entries ?? [])];
	const skipped = [...(batch.skipped ?? [])];
	const mapping = batch.mapping ?? {};
	if (!own(mapping)) fail('mapping must be an object');
	const entryByCandidate = new Map<string, ScenarioImportEntry>();
	const entryById = new Map<string, ScenarioImportEntry>();
	for (const entry of entries) {
		if (
			!entry ||
			!['scope', 'trace', 'period', 'intersection', 'scopeSegment'].includes(entry.type)
		)
			fail('Entry type is invalid', entry);
		try {
			text(entry.id, 'Entry id');
			text(entry.candidateId, 'Entry candidateId');
		} catch (error) {
			fail(error instanceof Error ? error.message : String(error), entry);
		}
		if (entryByCandidate.has(entry.candidateId))
			fail(`Duplicate candidateId ${entry.candidateId}`, entry);
		if (entryById.has(entry.id)) fail(`Duplicate entry id ${entry.id}`, entry);
		entryByCandidate.set(entry.candidateId, entry);
		entryById.set(entry.id, entry);
	}
	const mapValues = new Set<string>();
	for (const [candidateId, id] of Object.entries(mapping)) {
		text(candidateId, 'mapping candidateId');
		text(id, `mapping[${candidateId}]`);
		if (mapValues.has(id)) fail(`Duplicate mapped id ${id}`);
		mapValues.add(id);
		if (entryByCandidate.get(candidateId)?.id !== id)
			fail(`Mapping does not match entry ${candidateId}`);
	}
	for (const entry of entries)
		if (mapping[entry.candidateId] !== entry.id)
			fail(`Missing mapping for ${entry.candidateId}`, entry);
	const skippedIds = new Set<string>();
	for (const item of skipped) {
		text(item.candidateId, 'skipped candidateId');
		text(item.reason, 'skipped reason');
		if (skippedIds.has(item.candidateId) || entryByCandidate.has(item.candidateId))
			fail(`Duplicate skipped candidateId ${item.candidateId}`);
		skippedIds.add(item.candidateId);
		if (Object.hasOwn(mapping, item.candidateId))
			fail(`Skipped candidate ${item.candidateId} cannot be mapped`);
	}
	const stored = new Map<Collection, Stored[]>();
	for (const collection of collections) stored.set(collection, await transaction.fetch(collection));
	const rowsByCollection = new Map<Collection, Map<string, Stored>>(
		[...stored].map(([key, rows]) => [key, mapById(rows)])
	);
	const allIds = new Set<string>();
	for (const collection of collections)
		for (const row of stored.get(collection) ?? []) allIds.add(String(row.id));
	for (const id of entryById.keys()) allIds.add(id);
	const traceKinds = rowsByCollection.get('traceKinds') ?? new Map();
	const traceKindVersions = rowsByCollection.get('traceKindVersions') ?? new Map();
	const traceIds = new Set([
		...(stored.get('traces') ?? []).map((row) => String(row.id)),
		...entries.filter((candidate) => candidate.type === 'trace').map((candidate) => candidate.id)
	]);
	const firstCapturedAt = (await firstImportCapturedAt(transaction, batch)) ?? batch.capturedAt;
	const rows: Plan['rows'] = [];
	for (const entry of entries) {
		try {
			let row: Record<string, unknown>;
			if (entry.type === 'scope') {
				const draft = entry.draft;
				const name = text(draft.name, 'Scope name');
				const startedAt = isoOrNull(draft.startedAt, 'Scope startedAt');
				const endedAt = isoOrNull(draft.endedAt, 'Scope endedAt');
				if (startedAt && endedAt && Date.parse(endedAt) < Date.parse(startedAt))
					throw new Error('Scope endedAt must not be before startedAt');
				if (draft.parentScopeId != null)
					resolveReference(draft.parentScopeId, 'Scope parentScopeId', mapping, allIds);
				row = {
					id: entry.id,
					name,
					note: nullableText(draft.note, 'Scope note'),
					parentScopeId: null,
					startedAt,
					endedAt,
					isDeleted: false
				};
			} else if (entry.type === 'trace') {
				row = traceRow(
					entry,
					firstCapturedAt,
					mapping,
					traceIds,
					new Set(traceKinds.keys()),
					traceKindVersions
				);
			} else if (entry.type === 'period') {
				const name = text(entry.draft.name, 'Period name');
				const time = parsePeriodTime(entry.draft.time);
				assertTimeZone(entry.draft.timezone, 'Period timezone');
				periodTimeBounds(time, entry.draft.timezone);
				row = {
					id: entry.id,
					name,
					time,
					timezone: entry.draft.timezone,
					note: periodNote(entry.draft.note),
					isDeleted: false
				};
			} else if (entry.type === 'scopeSegment') {
				const scopeId = resolveReference(
					entry.draft.scopeId,
					'ScopeSegment scopeId',
					mapping,
					allIds
				);
				if (
					!(stored.get('scopes') ?? []).some((scope) => String(scope.id) === scopeId) &&
					!entries.some((candidate) => candidate.type === 'scope' && candidate.id === scopeId)
				)
					throw new Error('ScopeSegment scopeId must reference a Scope');
				const startAt = isoOrNull(entry.draft.startAt, 'ScopeSegment startAt');
				const endAt = isoOrNull(entry.draft.endAt, 'ScopeSegment endAt');
				if (startAt && endAt && Date.parse(endAt) < Date.parse(startAt))
					throw new Error('ScopeSegment endAt must not be before startAt');
				const position = entry.draft.position;
				if (typeof position !== 'number' || !Number.isInteger(position) || position < 0)
					throw new Error('ScopeSegment position must be a non-negative integer');
				row = {
					id: entry.id,
					scopeId,
					startAt,
					endAt,
					label: nullableText(entry.draft.label, 'ScopeSegment label'),
					position
				};
			} else {
				const draft = canonicalIntersection(entry.draft, mapping, allIds);
				const traceIds = new Set([
					...(stored.get('traces') ?? []).map((row) => String(row.id)),
					...entries
						.filter((candidate) => candidate.type === 'trace')
						.map((candidate) => candidate.id)
				]);
				const scopeIds = new Set([
					...(stored.get('scopes') ?? []).map((row) => String(row.id)),
					...entries
						.filter((candidate) => candidate.type === 'scope')
						.map((candidate) => candidate.id)
				]);
				const endpointType = (id: string): 'trace' | 'scope' | 'unknown' =>
					traceIds.has(id) ? 'trace' : scopeIds.has(id) ? 'scope' : 'unknown';
				const from = endpointType(draft.fromId);
				const to = endpointType(draft.toId);
				if (
					['belongs_to', 'child_of', 'part_of', 'evidence_for', 'revisits', 'related_to'].includes(
						draft.kind
					)
				) {
					if (draft.kind === 'belongs_to' && (from !== 'trace' || to !== 'scope'))
						throw new Error('belongs_to requires Trace → Scope endpoints');
					if (draft.kind === 'child_of' && (from !== 'scope' || to !== 'scope'))
						throw new Error('child_of requires Scope → Scope endpoints');
					if (
						['part_of', 'evidence_for', 'revisits'].includes(draft.kind) &&
						(from !== 'trace' || to !== 'trace')
					)
						throw new Error(`${draft.kind} requires Trace → Trace endpoints`);
					if (draft.kind === 'related_to' && (from !== 'scope' || to !== 'scope'))
						throw new Error('related_to requires Scope → Scope endpoints');
				}
				const expectedId = intersectionId(draft.fromId, draft.toId, draft.kind);
				if (entry.id !== expectedId) throw new Error(`Intersection id must be ${expectedId}`);
				row = { id: entry.id, ...draft, isDeleted: false };
			}
			rows.push({
				entry,
				collection: entityCollection(entry.type),
				row,
				existing: rowsByCollection.get(entityCollection(entry.type))?.get(entry.id)
			});
		} catch (error) {
			const issue =
				error && typeof error === 'object' && 'issue' in error
					? (error as { issue: ScenarioImportIssue }).issue
					: undefined;
			fail(issue?.reason ?? (error instanceof Error ? error.message : String(error)), entry);
		}
	}
	// A deferred/skipped candidate must never be an endpoint of an active entry.
	for (const entry of entries) {
		const draft = entry.draft as Record<string, unknown>;
		for (const key of ['fromId', 'toId', 'scopeId', 'aboutTraceId'])
			if (typeof draft[key] === 'string' && skippedIds.has(draft[key]))
				fail(`Entry references skipped candidate ${draft[key]}`, entry);
		const aboutTime = draft.aboutTime;
		if (
			own(aboutTime) &&
			aboutTime.basis === 'relative' &&
			typeof aboutTime.anchorTraceId === 'string' &&
			skippedIds.has(aboutTime.anchorTraceId)
		)
			fail(`Entry references skipped candidate ${aboutTime.anchorTraceId}`, entry);
	}
	const scopeGraph = [
		...(stored.get('intersections') ?? []).map((row) => ({
			id: String(row.id),
			fromId: String(row.fromId),
			toId: String(row.toId),
			kind: String(row.kind),
			isDeleted: Boolean(row.isDeleted)
		})),
		...rows
			.filter((item) => item.entry.type === 'intersection')
			.map((item) => ({
				id: item.entry.id,
				fromId: String(item.row.fromId),
				toId: String(item.row.toId),
				kind: String(item.row.kind),
				isDeleted: false
			}))
	];
	const scopeIds = [
		...(stored.get('scopes') ?? []).map((row) => ({ id: String(row.id) })),
		...rows.filter((item) => item.entry.type === 'scope').map((item) => ({ id: item.entry.id }))
	];
	const hierarchy = inspectScopeHierarchyIntegrity(scopeIds, scopeGraph);
	if (!hierarchy.ok)
		fail(
			`Scope hierarchy integrity conflict: ${hierarchy.issues.map((issue) => issue.kind).join(', ')}`
		);
	const partEdges = scopeGraph.filter((edge) => edge.kind === 'part_of' && !edge.isDeleted);
	const partParents = new Map<string, string[]>();
	for (const edge of partEdges)
		partParents.set(edge.fromId, [...(partParents.get(edge.fromId) ?? []), edge.toId]);
	const visiting = new Set<string>();
	const visited = new Set<string>();
	const visit = (id: string): void => {
		if (visiting.has(id)) throw new Error('Trace composition cannot contain a cycle');
		if (visited.has(id)) return;
		visiting.add(id);
		for (const parent of partParents.get(id) ?? []) visit(parent);
		visiting.delete(id);
		visited.add(id);
	};
	try {
		for (const id of partParents.keys()) visit(id);
	} catch (error) {
		fail(error instanceof Error ? error.message : String(error));
	}
	for (const item of rows) {
		const current = item.existing;
		if (!current) continue;
		if (current.isDeleted) fail('Existing row is deleted', item.entry, 'drift');
		const expected = { ...item.row };
		if (item.entry.type === 'trace')
			expected.capturedAt = String(current.capturedAt ?? firstCapturedAt);
		const comparableCurrent = { ...current };
		for (const key of ['createdAt', 'updatedAt', 'capturedAt']) delete comparableCurrent[key];
		if (item.entry.type === 'period') comparableCurrent.note = periodNote(comparableCurrent.note);
		const comparableExpected = { ...expected };
		for (const key of ['createdAt', 'updatedAt', 'capturedAt']) delete comparableExpected[key];
		if (!equal(comparableCurrent, comparableExpected))
			fail('Existing row differs from canonical draft', item.entry, 'drift');
	}
	return { rows, firstCapturedAt };
};

const firstImportCapturedAt = async (
	transaction: Transaction,
	batch: ScenarioImportBatch
): Promise<string | null> => {
	for (const row of await transaction.fetch('logs')) {
		if (row.cause !== 'import') continue;
		try {
			const patch = JSON.parse(String(row.patchJson)) as Record<string, unknown>;
			const imported = own(patch.import) ? patch.import : null;
			if (
				own(imported) &&
				imported.manifestId === batch.manifestId &&
				typeof imported.capturedAt === 'string'
			)
				return imported.capturedAt;
		} catch {
			/* A malformed unrelated log must not affect import validation. */
		}
	}
	return null;
};

const previewFromError = (batch: ScenarioImportBatch, error: unknown): ScenarioImportPreview => {
	const issue =
		error && typeof error === 'object' && 'issue' in error
			? (error as { issue: ScenarioImportIssue }).issue
			: {
					reason: error instanceof Error ? error.message : String(error),
					kind: 'validation' as const
				};
	return {
		targetDataSpaceId: batch.targetDataSpaceId,
		manifestId: batch.manifestId,
		manifestVersion: batch.manifestVersion,
		capturedAt: batch.capturedAt,
		mapping: batch.mapping,
		planned: { created: 0, reused: 0, skipped: batch.skipped?.length ?? 0 },
		created: 0,
		reused: 0,
		skipped: batch.skipped?.length ?? 0,
		drift: issue.kind === 'drift' ? [issue] : [],
		errors: issue.kind === 'drift' ? [] : [issue]
	};
};

export const createScenarioImportRepository = (
	client: RepositoryClient,
	activeDataSpace: DataSpace,
	options: ScenarioImportRepositoryOptions = {}
): ScenarioImportRepository => {
	const now = timestampFactory(options);
	const deviceId = options.deviceId ?? getDeviceId();
	const inspect = async (batch: ScenarioImportBatch): Promise<ScenarioImportPreview> => {
		try {
			const plan = await client.transact((transaction) =>
				validateBatch(transaction, batch, activeDataSpace)
			);
			const counts = {
				created: plan.rows.filter((item) => !item.existing).length,
				reused: plan.rows.filter((item) => Boolean(item.existing)).length,
				skipped: batch.skipped.length
			};
			return {
				targetDataSpaceId: batch.targetDataSpaceId,
				manifestId: batch.manifestId,
				manifestVersion: batch.manifestVersion,
				capturedAt: plan.firstCapturedAt,
				mapping: batch.mapping,
				planned: counts,
				...counts,
				drift: [],
				errors: []
			};
		} catch (error) {
			return previewFromError(batch, error);
		}
	};
	const apply = async (batch: ScenarioImportBatch): Promise<ScenarioImportReceipt> => {
		return client.transact(async (transaction) => {
			let plan: Plan;
			try {
				plan = await validateBatch(transaction, batch, activeDataSpace);
			} catch (error) {
				const issue =
					error && typeof error === 'object' && 'issue' in error
						? (error as { issue: ScenarioImportIssue }).issue
						: null;
				throw new Error(
					`Scenario import rejected${issue?.candidateId ? ` for ${issue.candidateId}` : ''}: ${issue?.reason ?? (error instanceof Error ? error.message : String(error))}`,
					{ cause: error }
				);
			}
			const appliedAt = now();
			const operationId = createId();
			for (const item of plan.rows) {
				if (item.existing) continue;
				const timestamp = now();
				const row = { ...item.row, createdAt: timestamp, updatedAt: timestamp };
				await transaction.insert(item.collection, row);
				await transaction.insert('logs', {
					id: createId(),
					operationId,
					entityType: entityType(item.entry.type),
					entityId: item.entry.id,
					action: item.entry.type === 'intersection' ? 'linked' : 'created',
					patchJson: JSON.stringify({
						snapshot: row,
						import: {
							manifestId: batch.manifestId,
							manifestVersion: batch.manifestVersion,
							capturedAt: plan.firstCapturedAt
						}
					}),
					occurredAt: now(),
					deviceId,
					actor: 'system',
					cause: 'import'
				});
			}
			const counts = {
				created: plan.rows.filter((item) => !item.existing).length,
				reused: plan.rows.filter((item) => Boolean(item.existing)).length,
				skipped: batch.skipped.length
			};
			return {
				...counts,
				failures: [],
				mapping: batch.mapping,
				manifestId: batch.manifestId,
				manifestVersion: batch.manifestVersion,
				targetDataSpaceId: batch.targetDataSpaceId,
				capturedAt: plan.firstCapturedAt,
				appliedAt
			};
		});
	};
	return { inspect, apply };
};
