import { assertTimeZone, parsePeriodTime, periodTimeBounds } from '$lib/state/triplit/period-time';
import {
	assertTraceTemporalPlacement,
	formatTemporalValue,
	parseTraceAboutTime,
	traceAboutTimeBounds
} from '$lib/state/triplit/trace-time';
import type {
	CanonicalTraceRelation,
	IntersectionKind,
	PeriodTime,
	ScopeSegmentDraft,
	TemporalPrecision,
	TraceAboutKind,
	TraceAboutTime
} from '$lib/state/triplit/types';

export const CALIBRATION_MANIFEST_VERSION = 'tempience.calibration-review.v2' as const;
export const CALIBRATION_REVIEW_VERSION = 'tempience.calibration-review-overlay.v1' as const;
export const CALIBRATION_CHECKPOINT_VERSION = 'tempience.calibration-review-checkpoint.v1' as const;

export type CalibrationCandidateRole =
	'scope' | 'trace' | 'period' | 'intersection' | 'scopeSegment';
export type CalibrationMappingGate = 'mapped' | 'review-required' | 'deferred';
export type CalibrationReviewDecision = 'pending' | 'accepted' | 'deferred' | 'excluded';
export type CalibrationReviewFilter = CalibrationReviewDecision | 'all';

export type ScopeProposal = {
	name: string;
	note: string | null;
	startedAt: string | null;
	endedAt: string | null;
};

export type TraceProposal = {
	content: string;
	relation: CanonicalTraceRelation;
	aboutKind: TraceAboutKind;
	aboutTime: TraceAboutTime | null;
	timezone: string;
};

export type PeriodProposal = {
	name: string;
	time: PeriodTime;
	timezone: string;
	note: string | null;
};

export type IntersectionProposal = {
	fromId: string;
	toId: string;
	kind: IntersectionKind;
	context: string | null;
};

export type ScopeSegmentProposal = ScopeSegmentDraft & {
	scopeId: string;
	startAt: string | null;
	endAt: string | null;
	label: string | null;
	position: number;
	boundaryLabel: string;
};

type CandidateBase<Role extends CalibrationCandidateRole, Proposal> = {
	candidateId: string;
	role: Role;
	proposed: Proposal;
	claimRefs: string[];
	gate: CalibrationMappingGate;
	reason: string | null;
};

export type ScopeCandidate = CandidateBase<'scope', ScopeProposal>;
export type TraceCandidate = CandidateBase<'trace', TraceProposal>;
export type PeriodCandidate = CandidateBase<'period', PeriodProposal>;
export type IntersectionCandidate = CandidateBase<'intersection', IntersectionProposal>;
export type ScopeSegmentCandidate = CandidateBase<'scopeSegment', ScopeSegmentProposal>;

export type CalibrationCandidate =
	ScopeCandidate | TraceCandidate | PeriodCandidate | IntersectionCandidate | ScopeSegmentCandidate;

export type CalibrationManifest = {
	schemaVersion: typeof CALIBRATION_MANIFEST_VERSION;
	manifestId: string;
	title: string;
	sourceIds: string[];
	claimRefs: string[];
	claimEvidence: CalibrationClaimEvidence[];
	candidates: CalibrationCandidate[];
};

export type CandidateReview = {
	decision: CalibrationReviewDecision;
	note: string;
};

export type CalibrationReviewEntry = {
	candidateId: string;
	decision: CalibrationReviewDecision;
	note?: string;
	proposed?: CalibrationCandidate['proposed'];
};

export type CalibrationReviewArtifact = {
	schemaVersion: typeof CALIBRATION_REVIEW_VERSION;
	manifestId: string;
	exportedAt: string;
	entries: CalibrationReviewEntry[];
};

export type CalibrationReviewCheckpoint = {
	schemaVersion: typeof CALIBRATION_CHECKPOINT_VERSION;
	manifestId: string;
	savedAt: string;
	selectedId: string | null;
	search: string;
	decisionFilter: CalibrationReviewFilter;
	entries: CalibrationReviewEntry[];
};

export type CalibrationReviewCheckpointState = {
	candidates: CalibrationCandidate[];
	reviews: Record<string, CandidateReview>;
	selectedId: string | null;
	search: string;
	decisionFilter: CalibrationReviewFilter;
};

export type CalibrationEvidenceSourceRef = {
	sourceId: string;
	title: string;
	locator: string;
};

export type CalibrationClaimEvidence = {
	claimRef: string;
	statement: string;
	sourceWording: string | null;
	sourceRefs: CalibrationEvidenceSourceRef[];
};

export type DerivedScopeIntervalRange = {
	start: {
		value: string;
		precision: TemporalPrecision;
		certainty: 'exact' | 'approximate';
	};
	end: {
		value: string;
		precision: TemporalPrecision;
		certainty: 'exact' | 'approximate';
	};
	traceIds: string[];
};

type UnknownRecord = Record<string, unknown>;

const candidateRoles = ['scope', 'trace', 'period', 'intersection', 'scopeSegment'] as const;
const mappingGates = ['mapped', 'review-required', 'deferred'] as const;
const reviewDecisions = ['pending', 'accepted', 'deferred', 'excluded'] as const;
const reviewFilters = ['all', ...reviewDecisions] as const;
const traceRelations = ['intend', 'actual'] as const;
const traceAboutKinds = ['instant', 'interval', 'trace_ref'] as const;
const intersectionKinds = [
	'belongs_to',
	'contains',
	'child_of',
	'part_of',
	'evidence_for',
	'revisits',
	'related_to'
] as const;

const isRecord = (value: unknown): value is UnknownRecord =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const asRecord = (value: unknown, label: string): UnknownRecord => {
	if (!isRecord(value)) throw new Error(`${label}: ожидался объект.`);
	return value;
};

const asString = (value: unknown, label: string): string => {
	if (typeof value !== 'string' || value.trim().length === 0) {
		throw new Error(`${label}: ожидалась непустая строка.`);
	}
	return value.trim();
};

const asText = (value: unknown, label: string): string => {
	if (typeof value !== 'string') throw new Error(`${label}: ожидалась строка.`);
	return value;
};

const asNullableText = (value: unknown, label: string): string | null => {
	if (value === undefined || value === null) return null;
	if (typeof value !== 'string') throw new Error(`${label}: ожидалась строка или null.`);
	return value.trim().length === 0 ? null : value;
};

const asNullableString = (value: unknown, label: string): string | null =>
	value === null ? null : asString(value, label);

const asStringArray = (value: unknown, label: string): string[] => {
	if (!Array.isArray(value)) throw new Error(`${label}: ожидался массив строк.`);
	return value.map((item, index) => asString(item, `${label}[${index}]`));
};

const parseEvidenceSourceRef = (value: unknown, label: string): CalibrationEvidenceSourceRef => {
	const sourceRef = asRecord(value, label);
	return {
		sourceId: asString(sourceRef.sourceId, `${label}.sourceId`),
		title: asString(sourceRef.title, `${label}.title`),
		locator: asString(sourceRef.locator, `${label}.locator`)
	};
};

const parseClaimEvidence = (value: unknown, index: number): CalibrationClaimEvidence => {
	const label = `claimEvidence[${index}]`;
	const evidence = asRecord(value, label);
	if (!Array.isArray(evidence.sourceRefs)) {
		throw new Error(`${label}.sourceRefs: ожидался массив.`);
	}
	return {
		claimRef: asString(evidence.claimRef, `${label}.claimRef`),
		statement: asString(evidence.statement, `${label}.statement`),
		sourceWording: asNullableString(evidence.sourceWording, `${label}.sourceWording`),
		sourceRefs: evidence.sourceRefs.map((sourceRef, sourceIndex) =>
			parseEvidenceSourceRef(sourceRef, `${label}.sourceRefs[${sourceIndex}]`)
		)
	};
};

const asEnum = <Value extends string>(
	value: unknown,
	values: readonly Value[],
	label: string
): Value => {
	if (typeof value !== 'string' || !values.includes(value as Value)) {
		throw new Error(`${label}: допустимо ${values.join(', ')}.`);
	}
	return value as Value;
};

const parseScopeProposal = (value: unknown, label: string): ScopeProposal => {
	const proposal = asRecord(value, label);
	return {
		name: asString(proposal.name, `${label}.name`),
		note: asNullableString(proposal.note, `${label}.note`),
		startedAt: asNullableString(proposal.startedAt, `${label}.startedAt`),
		endedAt: asNullableString(proposal.endedAt, `${label}.endedAt`)
	};
};

const parseTraceProposal = (value: unknown, label: string): TraceProposal => {
	const proposal = asRecord(value, label);
	const aboutKind = asEnum(proposal.aboutKind, traceAboutKinds, `${label}.aboutKind`);
	const aboutTime =
		proposal.aboutTime === null ? null : parseTraceAboutTime(proposal.aboutTime, label);
	const timezone = asString(proposal.timezone, `${label}.timezone`);
	assertTimeZone(timezone, `${label}.timezone`);
	assertTraceTemporalPlacement(aboutKind, aboutTime, null);

	return {
		content: asString(proposal.content, `${label}.content`),
		relation: asEnum(proposal.relation, traceRelations, `${label}.relation`),
		aboutKind,
		aboutTime,
		timezone
	};
};

const parsePeriodProposal = (value: unknown, label: string): PeriodProposal => {
	const proposal = asRecord(value, label);
	const timezone = asString(proposal.timezone, `${label}.timezone`);
	assertTimeZone(timezone, `${label}.timezone`);
	return {
		name: asString(proposal.name, `${label}.name`),
		time: parsePeriodTime(proposal.time, `${label}.time`),
		timezone,
		note: asNullableText(proposal.note, `${label}.note`)
	};
};

const parseIntersectionProposal = (value: unknown, label: string): IntersectionProposal => {
	const proposal = asRecord(value, label);
	return {
		fromId: asString(proposal.fromId, `${label}.fromId`),
		toId: asString(proposal.toId, `${label}.toId`),
		kind: asEnum(proposal.kind, intersectionKinds, `${label}.kind`),
		context: asNullableString(proposal.context, `${label}.context`)
	};
};

const parseScopeSegmentProposal = (value: unknown, label: string): ScopeSegmentProposal => {
	const proposal = asRecord(value, label);
	if (!Number.isInteger(proposal.position) || Number(proposal.position) < 0) {
		throw new Error(`${label}.position: ожидалось неотрицательное целое число.`);
	}
	return {
		scopeId: asString(proposal.scopeId, `${label}.scopeId`),
		startAt: asNullableString(proposal.startAt, `${label}.startAt`),
		endAt: asNullableString(proposal.endAt, `${label}.endAt`),
		label: asNullableString(proposal.label, `${label}.label`),
		position: Number(proposal.position),
		boundaryLabel: asString(proposal.boundaryLabel, `${label}.boundaryLabel`)
	};
};

const parseCandidate = (value: unknown, index: number): CalibrationCandidate => {
	const label = `candidates[${index}]`;
	const candidate = asRecord(value, label);
	const candidateId = asString(candidate.candidateId, `${label}.candidateId`);
	const role = asEnum(candidate.role, candidateRoles, `${label}.role`);
	const common = {
		candidateId,
		claimRefs: asStringArray(candidate.claimRefs, `${label}.claimRefs`),
		gate: asEnum(candidate.gate, mappingGates, `${label}.gate`),
		reason: asNullableString(candidate.reason, `${label}.reason`)
	};

	if (role === 'scope') {
		return {
			...common,
			role,
			proposed: parseScopeProposal(candidate.proposed, `${label}.proposed`)
		};
	}
	if (role === 'trace') {
		return {
			...common,
			role,
			proposed: parseTraceProposal(candidate.proposed, `${label}.proposed`)
		};
	}
	if (role === 'period') {
		return {
			...common,
			role,
			proposed: parsePeriodProposal(candidate.proposed, `${label}.proposed`)
		};
	}
	if (role === 'intersection') {
		return {
			...common,
			role,
			proposed: parseIntersectionProposal(candidate.proposed, `${label}.proposed`)
		};
	}
	return {
		...common,
		role,
		proposed: parseScopeSegmentProposal(candidate.proposed, `${label}.proposed`)
	};
};

const assertReferences = (candidates: CalibrationCandidate[]): void => {
	const candidatesById = new Map(candidates.map((candidate) => [candidate.candidateId, candidate]));
	if (candidatesById.size !== candidates.length) {
		throw new Error('candidateId должны быть уникальны.');
	}

	for (const candidate of candidates) {
		if (candidate.role === 'scopeSegment') {
			if (candidatesById.get(candidate.proposed.scopeId)?.role !== 'scope') {
				throw new Error(`${candidate.candidateId}: scopeId должен ссылаться на Scope candidate.`);
			}
			continue;
		}
		if (candidate.role !== 'intersection') continue;

		const from = candidatesById.get(candidate.proposed.fromId);
		const to = candidatesById.get(candidate.proposed.toId);
		if (!from || !to) {
			throw new Error(`${candidate.candidateId}: оба endpoint должны существовать в manifest.`);
		}
		if (
			candidate.proposed.kind === 'belongs_to' &&
			(from.role !== 'trace' || to.role !== 'scope')
		) {
			throw new Error(`${candidate.candidateId}: belongs_to должен связывать Trace со Scope.`);
		}
		if (
			['part_of', 'evidence_for', 'revisits'].includes(candidate.proposed.kind) &&
			(from.role !== 'trace' || to.role !== 'trace')
		) {
			throw new Error(`${candidate.candidateId}: ${candidate.proposed.kind} требует два Trace.`);
		}
	}
};

const assertEvidence = (
	sourceIds: string[],
	claimRefs: string[],
	claimEvidence: CalibrationClaimEvidence[],
	candidates: CalibrationCandidate[]
): void => {
	const sourceIdSet = new Set(sourceIds);
	if (sourceIdSet.size !== sourceIds.length) throw new Error('sourceIds должны быть уникальны.');

	const claimRefSet = new Set(claimRefs);
	if (claimRefSet.size !== claimRefs.length) throw new Error('claimRefs должны быть уникальны.');

	const evidenceByRef = new Map(
		claimEvidence.map((evidence) => [evidence.claimRef, evidence] as const)
	);
	if (evidenceByRef.size !== claimEvidence.length) {
		throw new Error('claimEvidence.claimRef должны быть уникальны.');
	}

	for (const claimRef of claimRefs) {
		if (!evidenceByRef.has(claimRef)) {
			throw new Error(`${claimRef}: отсутствует раскрываемое claimEvidence.`);
		}
	}

	for (const evidence of claimEvidence) {
		if (!claimRefSet.has(evidence.claimRef)) {
			throw new Error(`${evidence.claimRef}: отсутствует в manifest.claimRefs.`);
		}
		if (evidence.sourceRefs.length === 0) {
			throw new Error(`${evidence.claimRef}: нужен хотя бы один source locator.`);
		}
		for (const sourceRef of evidence.sourceRefs) {
			if (!sourceIdSet.has(sourceRef.sourceId)) {
				throw new Error(
					`${evidence.claimRef}: sourceId ${sourceRef.sourceId} отсутствует в manifest.`
				);
			}
		}
	}

	for (const candidate of candidates) {
		for (const claimRef of candidate.claimRefs) {
			if (!claimRefSet.has(claimRef)) {
				throw new Error(`${candidate.candidateId}: claimRef ${claimRef} отсутствует в manifest.`);
			}
		}
	}
};

export const parseCalibrationManifest = (value: unknown): CalibrationManifest => {
	const manifest = asRecord(value, 'manifest');
	if (manifest.schemaVersion !== CALIBRATION_MANIFEST_VERSION) {
		throw new Error(`schemaVersion должен быть ${CALIBRATION_MANIFEST_VERSION}.`);
	}
	if (!Array.isArray(manifest.candidates)) throw new Error('manifest.candidates: ожидался массив.');
	if (!Array.isArray(manifest.claimEvidence)) {
		throw new Error('manifest.claimEvidence: ожидался массив.');
	}

	const candidates = manifest.candidates.map(parseCandidate);
	const sourceIds = asStringArray(manifest.sourceIds, 'manifest.sourceIds');
	const claimRefs = asStringArray(manifest.claimRefs, 'manifest.claimRefs');
	const claimEvidence = manifest.claimEvidence.map(parseClaimEvidence);
	assertReferences(candidates);
	assertEvidence(sourceIds, claimRefs, claimEvidence, candidates);
	return {
		schemaVersion: CALIBRATION_MANIFEST_VERSION,
		manifestId: asString(manifest.manifestId, 'manifest.manifestId'),
		title: asString(manifest.title, 'manifest.title'),
		sourceIds,
		claimRefs,
		claimEvidence,
		candidates
	};
};

export const parseCalibrationManifestText = (text: string): CalibrationManifest => {
	let value: unknown;
	try {
		value = JSON.parse(text);
	} catch {
		throw new Error('Файл не является корректным JSON.');
	}
	return parseCalibrationManifest(value);
};

export const cloneManifest = (manifest: CalibrationManifest): CalibrationManifest =>
	JSON.parse(JSON.stringify(manifest)) as CalibrationManifest;

export const claimEvidenceByRef = (
	claimEvidence: CalibrationClaimEvidence[]
): Map<string, CalibrationClaimEvidence> =>
	new Map(claimEvidence.map((evidence) => [evidence.claimRef, evidence]));

export const candidateValidationError = (candidate: CalibrationCandidate): string | null => {
	try {
		parseCandidate(candidate, 0);
		return null;
	} catch (cause: unknown) {
		return cause instanceof Error ? cause.message : 'Запись содержит некорректные поля.';
	}
};

export const initialCandidateReviews = (
	manifest: CalibrationManifest
): Record<string, CandidateReview> =>
	Object.fromEntries(
		manifest.candidates.map((candidate) => [
			candidate.candidateId,
			{ decision: 'pending' as const, note: '' }
		])
	);

export const isInventoryCandidate = (candidate: CalibrationCandidate): boolean =>
	candidate.gate !== 'deferred';

export const inventoryCounts = (
	candidates: CalibrationCandidate[]
): Record<CalibrationCandidateRole, number> => ({
	scope: candidates.filter(
		(candidate) => candidate.role === 'scope' && isInventoryCandidate(candidate)
	).length,
	trace: candidates.filter(
		(candidate) => candidate.role === 'trace' && isInventoryCandidate(candidate)
	).length,
	period: candidates.filter(
		(candidate) => candidate.role === 'period' && isInventoryCandidate(candidate)
	).length,
	intersection: candidates.filter(
		(candidate) => candidate.role === 'intersection' && isInventoryCandidate(candidate)
	).length,
	scopeSegment: candidates.filter(
		(candidate) => candidate.role === 'scopeSegment' && isInventoryCandidate(candidate)
	).length
});

export const reviewProgress = (
	candidates: CalibrationCandidate[],
	reviews: Record<string, CandidateReview>
): { reviewed: number; total: number } => {
	const inventory = candidates.filter(isInventoryCandidate);
	return {
		reviewed: inventory.filter(
			(candidate) => (reviews[candidate.candidateId]?.decision ?? 'pending') !== 'pending'
		).length,
		total: inventory.length
	};
};

export const candidateById = (
	candidates: CalibrationCandidate[]
): Map<string, CalibrationCandidate> =>
	new Map(candidates.map((candidate) => [candidate.candidateId, candidate]));

export const candidateTitle = (
	candidate: CalibrationCandidate,
	candidatesById: ReadonlyMap<string, CalibrationCandidate> = new Map()
): string => {
	if (candidate.role === 'scope') return candidate.proposed.name;
	if (candidate.role === 'trace') return candidate.proposed.content;
	if (candidate.role === 'period') return candidate.proposed.name;
	if (candidate.role === 'scopeSegment') return candidate.proposed.label ?? 'Без названия';

	const from = candidatesById.get(candidate.proposed.fromId);
	const to = candidatesById.get(candidate.proposed.toId);
	return `${from ? candidateTitle(from, candidatesById) : candidate.proposed.fromId} → ${candidate.proposed.kind} → ${to ? candidateTitle(to, candidatesById) : candidate.proposed.toId}`;
};

export const candidateTimeLabel = (candidate: CalibrationCandidate): string => {
	try {
		if (candidate.role === 'scope') return 'границы Scope не заданы';
		if (candidate.role === 'period') {
			const { precision, start, end } = parsePeriodTime(candidate.proposed.time);
			const startLabel = formatTemporalValue(start, precision);
			const endLabel = formatTemporalValue(end, precision);
			return start === end ? startLabel : `${startLabel} — ${endLabel}`;
		}
		if (candidate.role === 'scopeSegment') return candidate.proposed.boundaryLabel;
		if (candidate.role === 'intersection') return 'связь';

		const { aboutKind, aboutTime } = candidate.proposed;
		if (aboutKind === 'trace_ref') return 'ссылка на Trace';
		if (!aboutTime) return 'время неизвестно';
		const validAboutTime = parseTraceAboutTime(aboutTime);
		assertTraceTemporalPlacement(aboutKind, validAboutTime, null);
		if (validAboutTime.basis === 'unknown') return 'время неизвестно';
		if (validAboutTime.basis === 'relative') {
			return `${validAboutTime.relation} ${validAboutTime.anchorTraceId}`;
		}

		const prefix = validAboutTime.certainty === 'approximate' ? '≈ ' : '';
		const start = formatTemporalValue(validAboutTime.start, validAboutTime.precision);
		if (validAboutTime.end === null) return `${prefix}${start}`;
		const end = formatTemporalValue(validAboutTime.end, validAboutTime.precision);
		return `${prefix}${start} — ${end}`;
	} catch {
		return 'время требует исправления';
	}
};

export const candidateSortValue = (candidate: CalibrationCandidate): number => {
	try {
		if (candidate.role === 'trace') {
			return (
				traceAboutTimeBounds(candidate.proposed.aboutKind, candidate.proposed.aboutTime)?.start ??
				Infinity
			);
		}
		if (candidate.role === 'period') {
			return periodTimeBounds(candidate.proposed.time, candidate.proposed.timezone).start;
		}
	} catch {
		return Infinity;
	}
	return Infinity;
};

export const relatedIntersections = (
	candidateId: string,
	candidates: CalibrationCandidate[]
): IntersectionCandidate[] =>
	candidates.filter(
		(candidate): candidate is IntersectionCandidate =>
			candidate.role === 'intersection' &&
			(candidate.proposed.fromId === candidateId || candidate.proposed.toId === candidateId)
	);

export const tracesForScope = (
	scopeId: string,
	candidates: CalibrationCandidate[]
): TraceCandidate[] => {
	const memberIds = new Set(
		candidates
			.filter(
				(candidate): candidate is IntersectionCandidate =>
					candidate.role === 'intersection' &&
					candidate.proposed.kind === 'belongs_to' &&
					candidate.proposed.toId === scopeId
			)
			.map((candidate) => candidate.proposed.fromId)
	);
	return candidates
		.filter(
			(candidate): candidate is TraceCandidate =>
				candidate.role === 'trace' && memberIds.has(candidate.candidateId)
		)
		.sort((left, right) => candidateSortValue(left) - candidateSortValue(right));
};

export const derivedScopeIntervalRange = (
	scopeId: string,
	candidates: CalibrationCandidate[]
): DerivedScopeIntervalRange | null => {
	const intervals = tracesForScope(scopeId, candidates).flatMap((trace) => {
		const { aboutKind, aboutTime } = trace.proposed;
		if (aboutKind !== 'interval' || aboutTime?.basis !== 'absolute' || aboutTime.end === null) {
			return [];
		}
		try {
			const bounds = traceAboutTimeBounds(aboutKind, aboutTime);
			return bounds ? [{ trace, aboutTime, endValue: aboutTime.end, bounds }] : [];
		} catch {
			return [];
		}
	});
	if (intervals.length === 0) return null;

	const first = intervals.reduce((earliest, interval) =>
		interval.bounds.start < earliest.bounds.start ? interval : earliest
	);
	const last = intervals.reduce((latest, interval) =>
		interval.bounds.end > latest.bounds.end ? interval : latest
	);

	return {
		start: {
			value: first.aboutTime.start,
			precision: first.aboutTime.precision,
			certainty: first.aboutTime.certainty
		},
		end: {
			value: last.endValue,
			precision: last.aboutTime.precision,
			certainty: last.aboutTime.certainty
		},
		traceIds: intervals.map(({ trace }) => trace.candidateId)
	};
};

export const derivedScopeIntervalRangeLabel = (range: DerivedScopeIntervalRange): string => {
	const startPrefix = range.start.certainty === 'approximate' ? '≈ ' : '';
	const endPrefix = range.end.certainty === 'approximate' ? '≈ ' : '';
	return `${startPrefix}${formatTemporalValue(range.start.value, range.start.precision)} — ${endPrefix}${formatTemporalValue(range.end.value, range.end.precision)}`;
};

export const unscopedTraces = (candidates: CalibrationCandidate[]): TraceCandidate[] => {
	const scopedIds = new Set(
		candidates
			.filter(
				(candidate): candidate is IntersectionCandidate =>
					candidate.role === 'intersection' && candidate.proposed.kind === 'belongs_to'
			)
			.map((candidate) => candidate.proposed.fromId)
	);
	return candidates
		.filter(
			(candidate): candidate is TraceCandidate =>
				candidate.role === 'trace' && !scopedIds.has(candidate.candidateId)
		)
		.sort((left, right) => candidateSortValue(left) - candidateSortValue(right));
};

export const tracesOverlappingPeriod = (
	period: PeriodCandidate,
	candidates: CalibrationCandidate[]
): TraceCandidate[] => {
	let periodBounds: ReturnType<typeof periodTimeBounds>;
	try {
		periodBounds = periodTimeBounds(period.proposed.time, period.proposed.timezone);
	} catch {
		return [];
	}
	return candidates
		.filter((candidate): candidate is TraceCandidate => candidate.role === 'trace')
		.filter((candidate) => {
			try {
				const bounds = traceAboutTimeBounds(
					candidate.proposed.aboutKind,
					candidate.proposed.aboutTime
				);
				return bounds ? bounds.start < periodBounds.end && bounds.end > periodBounds.start : false;
			} catch {
				return false;
			}
		})
		.sort((left, right) => candidateSortValue(left) - candidateSortValue(right));
};

export const updateCandidate = (
	candidates: CalibrationCandidate[],
	nextCandidate: CalibrationCandidate
): CalibrationCandidate[] =>
	candidates.map((candidate) =>
		candidate.candidateId === nextCandidate.candidateId ? nextCandidate : candidate
	);

const createReviewEntries = (
	baseManifest: CalibrationManifest,
	workingCandidates: CalibrationCandidate[],
	reviews: Record<string, CandidateReview>,
	preserveNoteWhitespace: boolean
): CalibrationReviewEntry[] => {
	const baseById = candidateById(baseManifest.candidates);
	return workingCandidates.flatMap((candidate): CalibrationReviewEntry[] => {
		const review = reviews[candidate.candidateId] ?? { decision: 'pending', note: '' };
		const base = baseById.get(candidate.candidateId);
		const changed = !base || JSON.stringify(base.proposed) !== JSON.stringify(candidate.proposed);
		const note = preserveNoteWhitespace ? review.note : review.note.trim();
		if (review.decision === 'pending' && note.trim().length === 0 && !changed) return [];
		return [
			{
				candidateId: candidate.candidateId,
				decision: review.decision,
				...(note.trim().length > 0 ? { note } : {}),
				...(changed ? { proposed: candidate.proposed } : {})
			}
		];
	});
};

export const createReviewArtifact = (
	baseManifest: CalibrationManifest,
	workingCandidates: CalibrationCandidate[],
	reviews: Record<string, CandidateReview>,
	exportedAt = new Date().toISOString()
): CalibrationReviewArtifact => {
	const validated = parseCalibrationManifest({ ...baseManifest, candidates: workingCandidates });
	const entries = createReviewEntries(baseManifest, validated.candidates, reviews, false);

	return {
		schemaVersion: CALIBRATION_REVIEW_VERSION,
		manifestId: baseManifest.manifestId,
		exportedAt,
		entries
	};
};

export const serializeReviewArtifact = (artifact: CalibrationReviewArtifact): string =>
	`${JSON.stringify(artifact, null, 2)}\n`;

const applyParsedReviewCheckpoint = (
	baseManifest: CalibrationManifest,
	checkpoint: CalibrationReviewCheckpoint
): CalibrationReviewCheckpointState => {
	const entryById = new Map(checkpoint.entries.map((entry) => [entry.candidateId, entry]));
	const restoredCandidates = baseManifest.candidates.map((candidate, index) => {
		const entry = entryById.get(candidate.candidateId);
		return entry?.proposed === undefined
			? candidate
			: parseCandidate({ ...candidate, proposed: entry.proposed }, index);
	});
	const validated = parseCalibrationManifest({
		...baseManifest,
		candidates: restoredCandidates
	});
	const restoredReviews = initialCandidateReviews(baseManifest);
	for (const entry of checkpoint.entries) {
		restoredReviews[entry.candidateId] = {
			decision: entry.decision,
			note: entry.note ?? ''
		};
	}

	return {
		candidates: validated.candidates,
		reviews: restoredReviews,
		selectedId: checkpoint.selectedId,
		search: checkpoint.search,
		decisionFilter: checkpoint.decisionFilter
	};
};

export const createReviewCheckpoint = (
	baseManifest: CalibrationManifest,
	workingCandidates: CalibrationCandidate[],
	reviews: Record<string, CandidateReview>,
	viewState: Pick<CalibrationReviewCheckpoint, 'selectedId' | 'search' | 'decisionFilter'>,
	savedAt = new Date().toISOString()
): CalibrationReviewCheckpoint => {
	const validated = parseCalibrationManifest({ ...baseManifest, candidates: workingCandidates });
	const candidatesById = candidateById(validated.candidates);
	if (viewState.selectedId !== null && !candidatesById.has(viewState.selectedId)) {
		throw new Error(`selectedId ${viewState.selectedId} отсутствует в manifest.`);
	}
	if (!reviewFilters.includes(viewState.decisionFilter)) {
		throw new Error(`decisionFilter: допустимо ${reviewFilters.join(', ')}.`);
	}

	return {
		schemaVersion: CALIBRATION_CHECKPOINT_VERSION,
		manifestId: baseManifest.manifestId,
		savedAt,
		selectedId: viewState.selectedId,
		search: viewState.search,
		decisionFilter: viewState.decisionFilter,
		entries: createReviewEntries(baseManifest, validated.candidates, reviews, true)
	};
};

export const parseReviewCheckpoint = (
	value: unknown,
	baseManifest: CalibrationManifest
): CalibrationReviewCheckpoint => {
	const checkpoint = asRecord(value, 'checkpoint');
	if (checkpoint.schemaVersion !== CALIBRATION_CHECKPOINT_VERSION) {
		throw new Error(`schemaVersion должен быть ${CALIBRATION_CHECKPOINT_VERSION}.`);
	}
	const manifestId = asString(checkpoint.manifestId, 'checkpoint.manifestId');
	if (manifestId !== baseManifest.manifestId) {
		throw new Error(
			`Checkpoint относится к manifest ${manifestId}, а открыт ${baseManifest.manifestId}.`
		);
	}
	if (!Array.isArray(checkpoint.entries)) {
		throw new Error('checkpoint.entries: ожидался массив.');
	}

	const baseById = candidateById(baseManifest.candidates);
	const entries = checkpoint.entries.map((value, index): CalibrationReviewEntry => {
		const label = `checkpoint.entries[${index}]`;
		const entry = asRecord(value, label);
		const candidateId = asString(entry.candidateId, `${label}.candidateId`);
		const baseCandidate = baseById.get(candidateId);
		if (!baseCandidate) {
			throw new Error(`${label}.candidateId ${candidateId} отсутствует в manifest.`);
		}
		return {
			candidateId,
			decision: asEnum(entry.decision, reviewDecisions, `${label}.decision`),
			...(entry.note === undefined ? {} : { note: asText(entry.note, `${label}.note`) }),
			...(entry.proposed === undefined
				? {}
				: {
						proposed: parseCandidate({ ...baseCandidate, proposed: entry.proposed }, index).proposed
					})
		};
	});
	if (new Set(entries.map((entry) => entry.candidateId)).size !== entries.length) {
		throw new Error('checkpoint.entries.candidateId должны быть уникальны.');
	}

	const selectedId =
		checkpoint.selectedId === null
			? null
			: asString(checkpoint.selectedId, 'checkpoint.selectedId');
	if (selectedId !== null && !baseById.has(selectedId)) {
		throw new Error(`checkpoint.selectedId ${selectedId} отсутствует в manifest.`);
	}
	const parsed: CalibrationReviewCheckpoint = {
		schemaVersion: CALIBRATION_CHECKPOINT_VERSION,
		manifestId,
		savedAt: asString(checkpoint.savedAt, 'checkpoint.savedAt'),
		selectedId,
		search: asText(checkpoint.search, 'checkpoint.search'),
		decisionFilter: asEnum(checkpoint.decisionFilter, reviewFilters, 'checkpoint.decisionFilter'),
		entries
	};
	applyParsedReviewCheckpoint(baseManifest, parsed);
	return parsed;
};

export const parseReviewCheckpointText = (
	text: string,
	baseManifest: CalibrationManifest
): CalibrationReviewCheckpoint => {
	let value: unknown;
	try {
		value = JSON.parse(text);
	} catch {
		throw new Error('Checkpoint не является корректным JSON.');
	}
	return parseReviewCheckpoint(value, baseManifest);
};

export const applyReviewCheckpoint = (
	baseManifest: CalibrationManifest,
	checkpoint: CalibrationReviewCheckpoint
): CalibrationReviewCheckpointState => applyParsedReviewCheckpoint(baseManifest, checkpoint);

export const serializeReviewCheckpoint = (checkpoint: CalibrationReviewCheckpoint): string =>
	`${JSON.stringify(checkpoint, null, 2)}\n`;

export const precisionOptions: readonly TemporalPrecision[] = [
	'minute',
	'day',
	'month',
	'season',
	'year'
];

export const intersectionKindOptions: readonly IntersectionKind[] = intersectionKinds;
