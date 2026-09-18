import {
	candidateValidationError,
	initialCandidateReviews,
	parseCalibrationManifest,
	type CalibrationCandidate,
	type CalibrationManifest,
	type CandidateReview
} from './calibration-manifest';
import {
	SCENARIO_IMPORT_BATCH_VERSION,
	type ScenarioImportBatch,
	type ScenarioImportPreview,
	type ScenarioImportRepository
} from '$lib/state/triplit/scenario-import-repository';
import {
	BELGRADE_SCENARIO_DATA_SPACE_ID,
	type DataSpace,
	type ScenarioDataSpaceId
} from '$lib/state/triplit/data-space';
import type { TraceAboutTime } from '$lib/state/triplit/types';

export const SCENARIO_IMPORT_MANIFEST_VERSION = SCENARIO_IMPORT_BATCH_VERSION;
export const SCENARIO_IMPORT_TARGET = BELGRADE_SCENARIO_DATA_SPACE_ID;

export type ScenarioImportReview = {
	candidates: CalibrationCandidate[];
	reviews: Record<string, CandidateReview>;
};

export type ScenarioImportInput = {
	manifest: CalibrationManifest;
	review?: ScenarioImportReview | null;
	target: DataSpace;
	capturedAt?: string;
};

const effectiveCalibrationCandidates = ({
	manifest,
	review
}: Pick<ScenarioImportInput, 'manifest' | 'review'>): CalibrationCandidate[] => {
	const workingCandidates = parseCalibrationManifest({
		...manifest,
		candidates: review?.candidates ?? manifest.candidates
	}).candidates;
	const reviews = review?.reviews ?? initialCandidateReviews(manifest);
	const retained = workingCandidates.filter(
		(candidate) => reviews[candidate.candidateId]?.decision !== 'excluded'
	);
	const retainedIds = new Set(retained.map((candidate) => candidate.candidateId));

	return retained.filter((candidate) => {
		if (candidate.role === 'intersection') {
			return retainedIds.has(candidate.proposed.fromId) && retainedIds.has(candidate.proposed.toId);
		}
		if (candidate.role === 'scopeSegment') {
			return retainedIds.has(candidate.proposed.scopeId);
		}
		return true;
	});
};

export type ScenarioImportCreateInput = ScenarioImportInput & {
	repository: ScenarioImportRepository;
};

export type ScenarioImportCreateResult = {
	batch: ScenarioImportBatch;
	preview: ScenarioImportPreview;
};

type PreparedEntry = {
	type: CalibrationCandidate['role'];
	id: string;
	candidateId: string;
	draft: Record<string, unknown>;
};

type SkippedRecord = {
	candidateId: string;
	reason: string;
};

const encoded = (value: string): string => encodeURIComponent(value);

export const stableEntityId = (manifestId: string, candidateId: string): string =>
	`scenario:${encoded(manifestId)}:${encoded(candidateId)}`;

const isoNow = (): string => new Date().toISOString();

const assertCapturedAt = (capturedAt: string): string => {
	if (!Number.isFinite(Date.parse(capturedAt))) {
		throw new Error(`capturedAt must be an ISO timestamp: ${capturedAt}`);
	}
	return capturedAt;
};

const errorMessage = (candidateId: string, reason: unknown): string =>
	`${candidateId}: ${reason instanceof Error ? reason.message : String(reason)}`;

const deepFreeze = <T>(value: T): T => {
	if (value && typeof value === 'object' && !Object.isFrozen(value)) {
		Object.freeze(value);
		for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
	}
	return value;
};

const candidateIdFromError = (
	error: unknown,
	candidates: CalibrationCandidate[]
): string | null => {
	const message = error instanceof Error ? error.message : String(error);
	return (
		candidates.find((candidate) => message.includes(candidate.candidateId))?.candidateId ?? null
	);
};

const traceReferenceId = (candidate: CalibrationCandidate): string | null => {
	if (candidate.role !== 'trace' || candidate.proposed.aboutKind !== 'trace_ref') return null;
	const proposal = candidate.proposed as unknown as { aboutTraceId?: unknown };
	return typeof proposal.aboutTraceId === 'string' && proposal.aboutTraceId.length > 0
		? proposal.aboutTraceId
		: null;
};

const remapAboutTime = (
	aboutTime: TraceAboutTime | null,
	mapping: ReadonlyMap<string, string>
): TraceAboutTime | null => {
	if (aboutTime?.basis !== 'relative') return aboutTime;
	const anchorId = mapping.get(aboutTime.anchorTraceId);
	if (!anchorId)
		throw new Error(`relative trace anchor ${aboutTime.anchorTraceId} is not retained`);
	return { ...aboutTime, anchorTraceId: anchorId };
};

const typedEntry = (
	candidate: CalibrationCandidate,
	id: string,
	draft: Record<string, unknown>
): PreparedEntry => ({ type: candidate.role, id, candidateId: candidate.candidateId, draft });

const recordsForCandidates = (
	manifest: CalibrationManifest,
	candidates: CalibrationCandidate[],
	deferredByReview: ReadonlySet<string>,
	initialSkipped: readonly SkippedRecord[] = []
): {
	entries: PreparedEntry[];
	candidateToRecord: Record<string, string>;
	skippedRecords: SkippedRecord[];
} => {
	const skippedRecords: SkippedRecord[] = [...initialSkipped];
	const retainedIds = new Set(candidates.map((candidate) => candidate.candidateId));
	const candidateToRecord: Record<string, string> = Object.fromEntries(
		candidates.map((candidate) => [
			candidate.candidateId,
			stableEntityId(manifest.manifestId, candidate.candidateId)
		])
	);
	const entries: PreparedEntry[] = [];

	const skip = (candidate: CalibrationCandidate, reason: string): void => {
		retainedIds.delete(candidate.candidateId);
		delete candidateToRecord[candidate.candidateId];
		const message = errorMessage(candidate.candidateId, reason);
		skippedRecords.push({ candidateId: candidate.candidateId, reason: message });
	};

	for (const candidate of candidates) {
		if (candidate.gate === 'deferred') {
			skip(candidate, 'mapping gate is deferred');
			continue;
		}
		if (deferredByReview.has(candidate.candidateId)) {
			skip(candidate, 'review decision is deferred');
		}
	}

	for (const candidate of candidates) {
		if (!retainedIds.has(candidate.candidateId)) continue;
		if (candidate.role === 'intersection') {
			if (
				!retainedIds.has(candidate.proposed.fromId) ||
				!retainedIds.has(candidate.proposed.toId)
			) {
				skip(candidate, 'endpoint was not retained');
			}
		} else if (candidate.role === 'scopeSegment' && !retainedIds.has(candidate.proposed.scopeId)) {
			skip(candidate, 'scope endpoint was not retained');
		}
	}

	for (const candidate of candidates) {
		if (!retainedIds.has(candidate.candidateId)) continue;
		try {
			const id = candidateToRecord[candidate.candidateId];
			if (candidate.role === 'scope') {
				entries.push(
					typedEntry(candidate, id, {
						name: candidate.proposed.name,
						note: candidate.proposed.note,
						startedAt: candidate.proposed.startedAt,
						endedAt: candidate.proposed.endedAt
					})
				);
			} else if (candidate.role === 'trace') {
				const aboutTraceId = traceReferenceId(candidate);
				if (candidate.proposed.aboutKind === 'trace_ref' && !aboutTraceId) {
					throw new Error('trace_ref placement requires canonical aboutTraceId');
				}
				const remappedAboutTraceId = aboutTraceId ? candidateToRecord[aboutTraceId] : null;
				if (aboutTraceId && !remappedAboutTraceId) {
					throw new Error(`aboutTraceId ${aboutTraceId} was not retained`);
				}
				const aboutTime = remapAboutTime(
					candidate.proposed.aboutTime,
					new Map(Object.entries(candidateToRecord))
				);
				entries.push(
					typedEntry(candidate, id, {
						content: candidate.proposed.content,
						timezone: candidate.proposed.timezone,
						aboutKind: candidate.proposed.aboutKind,
						aboutTime,
						aboutTraceId: remappedAboutTraceId,
						relation: candidate.proposed.relation,
						kindId: null,
						kindVId: null,
						data: null
					})
				);
			} else if (candidate.role === 'period') {
				entries.push(
					typedEntry(candidate, id, {
						name: candidate.proposed.name,
						time: { ...candidate.proposed.time },
						timezone: candidate.proposed.timezone,
						note: candidate.proposed.note
					})
				);
			} else if (candidate.role === 'intersection') {
				let fromId = candidateToRecord[candidate.proposed.fromId];
				let toId = candidateToRecord[candidate.proposed.toId];
				if (candidate.proposed.kind === 'related_to' && fromId.localeCompare(toId) > 0) {
					[fromId, toId] = [toId, fromId];
				}
				const mappingKey = `${fromId}:${toId}:${candidate.proposed.kind}`;
				candidateToRecord[candidate.candidateId] = mappingKey;
				entries.push(
					typedEntry(candidate, mappingKey, {
						fromId,
						toId,
						kind: candidate.proposed.kind,
						context: candidate.proposed.context
					})
				);
			} else {
				entries.push(
					typedEntry(candidate, id, {
						scopeId: candidateToRecord[candidate.proposed.scopeId],
						startAt: candidate.proposed.startAt,
						endAt: candidate.proposed.endAt,
						label: candidate.proposed.label,
						position: candidate.proposed.position
					})
				);
			}
		} catch (cause: unknown) {
			throw new Error(errorMessage(candidate.candidateId, cause), { cause });
		}
	}

	return { entries, candidateToRecord, skippedRecords };
};

export const prepareScenarioImport = (input: ScenarioImportInput): ScenarioImportBatch => {
	if (input.target.kind !== 'scenario' || input.target.syncEnabled) {
		throw new Error('Scenario import target must be an isolated scenario data space.');
	}
	const capturedAt = assertCapturedAt(input.capturedAt ?? isoNow());
	let candidates: CalibrationCandidate[];
	try {
		const sourceCandidates = input.review?.candidates ?? input.manifest.candidates;
		const reviews = input.review?.reviews ?? {};
		candidates = effectiveCalibrationCandidates({
			manifest: input.manifest,
			review: input.review ?? null
		});
		const effectiveIds = new Set(candidates.map((candidate) => candidate.candidateId));
		const initialSkipped: SkippedRecord[] = sourceCandidates.flatMap((candidate) => {
			if (effectiveIds.has(candidate.candidateId)) return [];
			if (reviews[candidate.candidateId]?.decision === 'excluded') {
				return [
					{
						candidateId: candidate.candidateId,
						reason: errorMessage(candidate.candidateId, 'review decision is excluded')
					}
				];
			}
			if (candidate.role === 'intersection') {
				return [
					{
						candidateId: candidate.candidateId,
						reason: errorMessage(candidate.candidateId, 'endpoint was not retained')
					}
				];
			}
			if (candidate.role === 'scopeSegment') {
				return [
					{
						candidateId: candidate.candidateId,
						reason: errorMessage(candidate.candidateId, 'scope endpoint was not retained')
					}
				];
			}
			return [
				{
					candidateId: candidate.candidateId,
					reason: errorMessage(candidate.candidateId, 'candidate was not retained')
				}
			];
		});
		const deferredByReview = new Set(
			candidates
				.filter((candidate) => reviews[candidate.candidateId]?.decision === 'deferred')
				.map((candidate) => candidate.candidateId)
		);
		const result = recordsForCandidates(
			input.manifest,
			candidates,
			deferredByReview,
			initialSkipped
		);
		const batch = {
			schemaVersion: SCENARIO_IMPORT_MANIFEST_VERSION,
			manifestId: input.manifest.manifestId,
			manifestVersion: input.manifest.schemaVersion,
			targetDataSpaceId: input.target.id as ScenarioDataSpaceId,
			capturedAt,
			mapping: result.candidateToRecord,
			entries: result.entries,
			skipped: result.skippedRecords
		};
		return deepFreeze(batch as unknown as ScenarioImportBatch);
	} catch (cause: unknown) {
		const rawCandidates = input.review?.candidates ?? input.manifest.candidates;
		const candidateId =
			candidateIdFromError(cause, rawCandidates) ??
			rawCandidates.find((candidate) => candidateValidationError(candidate) !== null)
				?.candidateId ??
			rawCandidates[0]?.candidateId ??
			'unknown-candidate';
		if (cause instanceof Error && cause.message.startsWith(`${candidateId}: `)) throw cause;
		throw new Error(errorMessage(candidateId, cause), { cause });
	}
};

export const planScenarioImport = prepareScenarioImport;

export const previewScenarioImport = async ({
	repository,
	...input
}: ScenarioImportCreateInput): Promise<ScenarioImportPreview> =>
	repository.inspect(prepareScenarioImport({ ...input }));

export const createScenarioImport = async ({
	repository,
	...input
}: ScenarioImportCreateInput): Promise<ScenarioImportCreateResult> => {
	const batch = prepareScenarioImport({ ...input });
	const preview = await repository.inspect(batch);
	return { batch, preview };
};
