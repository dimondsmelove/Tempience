import {
	linkSourceId,
	sourceAgreesWithLink
} from '$lib/state/triplit/IntentionAssessments/binding';
import type { IntentionAssessment } from '$lib/state/triplit/IntentionAssessments/types';
import {
	isSupplementMarker,
	supplementState,
	type SupplementState
} from '$lib/state/triplit/Traces/supplement';
import type { LinkHead } from '$lib/state/triplit/Intersections/heads';
import type { TempienceRepository } from '$lib/state/triplit/repository';
import type { Intersection, Scope, Trace, TraceKind, TraceKindV } from '$lib/state/triplit/types';
import { versionSummaries } from '$lib/model/TraceForm/summary-fields';
import type { DraftEntry, EvidenceRole } from './types';

type LoadRepository = Pick<
	TempienceRepository,
	| 'subscribeTraceKinds'
	| 'subscribeTraceKindVersions'
	| 'subscribeScopes'
	| 'listLinkHeads'
	| 'listKindMemberships'
	| 'listIntersectionsTouching'
	| 'listTraceHeads'
	| 'listIntentionAssessments'
	| 'getTrace'
>;

export type CatalogRows = { kinds?: TraceKind[]; versions?: TraceKindV[]; scopes?: Scope[] };

export type DraftLoad = {
	/** Direct Scope memberships of every Kind: what choosing a Kind brings into the draft. */
	kindScopes: Map<string, string[]>;
	trace: Trace | null;
	/** The edited record's memberships; for a preset the parent's, as the input starts with them. */
	memberships: string[];
	evidenceRoles: EvidenceRole[];
	/** The canonical state of the edited record as a supplement, or null when it is not one. */
	supplement: SupplementState | null;
	/**
	 * Every record — read thin: its summary leaves and nothing else of its data — every active
	 * link, thin, and every assessment: what the result picker and its states read.
	 */
	traces: Trace[];
	intersections: LinkHead[];
	assessments: IntentionAssessment[];
};

/**
 * Subscribes and resolves once the first rows arrive, then keeps feeding later rows. The stop
 * is recorded the moment the subscription exists, whether its first callback comes later or
 * synchronously, so a failure or a close at any point can dispose exactly what was started.
 */
const subscribeOnce = <T>(
	subscribe: (next: (rows: T[]) => void, fail: (error: unknown) => void) => () => void,
	next: (rows: T[]) => void,
	stops: (() => void)[]
): Promise<void> =>
	new Promise((resolve, reject) => {
		let settled = false;
		const stop = subscribe(
			(rows) => {
				next(rows);
				if (!settled) {
					settled = true;
					resolve();
				}
			},
			(error) => {
				if (!settled) {
					settled = true;
					reject(error instanceof Error ? error : new Error(String(error)));
				}
			}
		);
		stops.push(stop);
	});

/**
 * What the saved record is as a supplement (P4), read from the record itself: an ordinary
 * actual marker with exactly one active original is valid; every other shape — a plan, no
 * original, several of them, itself, a missing one — is named, never repaired here.
 */
const markerState = (
	trace: Trace | null,
	intersections: readonly LinkHead[],
	byTrace: ReadonlyMap<string, Trace>
): SupplementState | null => {
	if (!trace || !isSupplementMarker(trace)) return null;
	const links = intersections.filter(
		(link) => link.kind === 'revisits' && link.fromId === trace.id && !link.isDeleted
	);
	return supplementState(trace.id, trace.relation, links, (id) => byTrace.has(id));
};

/** The record whose memberships the input starts with: the edited one or a preset's parent. */
const parentOf = (entry: DraftEntry): string | null => {
	if (entry.mode === 'edit') return entry.traceId;
	const preset = entry.preset;
	if (!preset) return null;
	return preset.kind === 'result'
		? preset.intentionId
		: preset.kind === 'part'
			? preset.wholeId
			: preset.originalId;
};

/**
 * What the link's named source is for it (the binding rules): its own current values when
 * current; withdrawn, detached from a moved source, unavailable, or none.
 */
const sourceOf = (
	link: Intersection,
	byId: ReadonlyMap<string, IntentionAssessment>
): Pick<EvidenceRole, 'source' | 'own'> => {
	const row = byId.get(linkSourceId(link));
	if (!row) return { source: link.assessmentId ? 'unavailable' : 'none', own: null };
	if (!sourceAgreesWithLink(row, link)) return { source: 'detached', own: null };
	if (row.isDeleted) return { source: 'withdrawn', own: null };
	return { source: 'current', own: { outcome: row.outcome, open: row.open } };
};

/**
 * The catalogs every form needs, the Kinds' direct Scopes, every record with the links and
 * assessments the result picker reads, and for an edit the record with its memberships and
 * the evidence links that fix its role — those read whole, through the record they touch,
 * as their source's identity is in the whole row. Every subscription started lands in
 * `stops` immediately; the caller disposes them on failure or close.
 */
export const loadEntry = async (
	entry: DraftEntry,
	repository: LoadRepository,
	onRows: (rows: CatalogRows) => void,
	stops: (() => void)[]
): Promise<DraftLoad> => {
	let known: TraceKindV[] = [];
	await Promise.all([
		subscribeOnce(repository.subscribeTraceKinds, (kinds) => onRows({ kinds }), stops),
		subscribeOnce(
			repository.subscribeTraceKindVersions,
			(versions) => {
				known = versions;
				onRows({ versions });
			},
			stops
		),
		subscribeOnce(repository.subscribeScopes, (scopes) => onRows({ scopes }), stops)
	]);
	const [intersections, kindLinks, traces, assessments] = await Promise.all([
		repository.listLinkHeads({ deleted: 'active' }),
		repository.listKindMemberships({ deleted: 'active' }),
		repository.listTraceHeads({ deleted: 'all', summaries: versionSummaries(known) }),
		repository.listIntentionAssessments(true)
	]);
	const kindScopes = new Map<string, string[]>();
	for (const link of kindLinks) {
		let scopes = kindScopes.get(link.fromId);
		if (!scopes) kindScopes.set(link.fromId, (scopes = []));
		scopes.push(link.toId);
	}
	const parentId = parentOf(entry);
	const memberships = intersections
		.filter(
			(link) =>
				link.kind === 'belongs_to' &&
				link.fromId === parentId &&
				link.fromEntityType !== 'traceKind'
		)
		.map((link) => link.toId);
	const common = { kindScopes, memberships, traces, intersections, assessments };
	if (entry.mode === 'create') {
		return { ...common, trace: null, evidenceRoles: [], supplement: null };
	}
	const [trace, touching] = await Promise.all([
		repository.getTrace(entry.traceId),
		repository.listIntersectionsTouching(entry.traceId)
	]);
	const byTrace = new Map(traces.map((row) => [row.id, row] as const));
	const titles = new Map(traces.map((row) => [row.id, row.content] as const));
	const byId = new Map(assessments.map((row) => [row.id, row] as const));
	const evidenceRoles = touching
		.filter((link) => link.kind === 'evidence_for' && !link.isDeleted)
		.map((link): EvidenceRole => {
			const outgoing = link.fromId === entry.traceId;
			const otherId = outgoing ? link.toId : link.fromId;
			return {
				linkId: link.id,
				direction: outgoing ? 'outgoing' : 'incoming',
				otherId,
				otherTitle: titles.get(otherId) ?? otherId,
				...sourceOf(link, byId)
			};
		});
	return {
		...common,
		trace,
		evidenceRoles,
		supplement: markerState(trace, intersections, byTrace)
	};
};
