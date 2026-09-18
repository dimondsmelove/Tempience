import { RepositoryError } from '../Repository/errors';
import { tupleId } from '../Repository/transaction';
import { assertIsoTimestamp, compareCalendarValues } from '../trace-time';
import type {
	IntentionAssessment,
	IntentionOutcome,
	StoredAssessmentCandidate,
	StoredAssessmentOverride,
	StoredAssessmentPlacement,
	StoredIntentionAssessment
} from './types';

export const INTENTION_OUTCOMES: readonly IntentionOutcome[] = [
	'completed',
	'partial',
	'not_completed',
	'alternative'
];

export const ASSESSMENT_FEATURES = ['outcome', 'open'] as const;

export type AssessmentFeature = (typeof ASSESSMENT_FEATURES)[number];

/** One logical first source per evidence activation: concurrent first creations share this id. */
export const assessmentIdFor = (activationId: string): string =>
	tupleId('assessment', [activationId]);

export const isIntentionOutcome = (value: unknown): value is IntentionOutcome =>
	INTENTION_OUTCOMES.includes(value as IntentionOutcome);

export const isAssessmentFeature = (value: unknown): value is AssessmentFeature =>
	ASSESSMENT_FEATURES.includes(value as AssessmentFeature);

const record = (value: unknown): value is Record<string, unknown> =>
	value !== null && typeof value === 'object' && !Array.isArray(value);

const isId = (value: unknown): value is string =>
	typeof value === 'string' && value.length > 0 && value.trim() === value;

const corrupt: (id: unknown, detail: string) => never = (id, detail) => {
	throw new RepositoryError(
		'assessment_corrupt',
		`Некорректная запись оценки ${String(id)}: ${detail}.`
	);
};

const assertFeatureValues = (value: unknown, id: unknown, label: string): void => {
	if (!record(value)) corrupt(id, `${label} не объект`);
	for (const key of Object.keys(value)) {
		if (!isAssessmentFeature(key)) corrupt(id, `${label} содержит неизвестный признак ${key}`);
	}
	if (value.outcome != null && !isIntentionOutcome(value.outcome)) {
		corrupt(id, `${label}: недопустимый итог`);
	}
	if (value.open != null && typeof value.open !== 'boolean') {
		corrupt(id, `${label}: открытость не boolean`);
	}
};

const placementKeys = ['intentionId', 'evidenceId', 'activationId'];

/** The origin address is immutable; a transferred placement also names the operation that moved it. */
const assertPlacement: (
	value: unknown,
	id: unknown,
	label: string,
	withRevision?: boolean
) => asserts value is StoredAssessmentPlacement = (value, id, label, withRevision = false) => {
	if (
		!record(value) ||
		!isId(value.intentionId) ||
		!isId(value.evidenceId) ||
		!isId(value.activationId)
	) {
		corrupt(id, `${label}: неполный адрес связи`);
	}
	for (const key of Object.keys(value)) {
		if (withRevision && key === 'operationId') {
			if (!isId(value.operationId)) corrupt(id, `${label}: некорректная операция переноса`);
			continue;
		}
		if (!placementKeys.includes(key)) corrupt(id, `${label}: неизвестное поле ${key}`);
	}
};

const assertTimestamp = (value: unknown, id: unknown, label: string): void => {
	if (typeof value !== 'string') corrupt(id, `${label} не задано`);
	try {
		assertIsoTimestamp(value, label);
	} catch {
		corrupt(id, `${label} не является временем`);
	}
};

/** Strict shape check for stored rows; corruption is reported, never silently normalized. */
export const parseStoredAssessment = (row: Record<string, unknown>): StoredIntentionAssessment => {
	const id = row.id;
	if (!isId(id)) corrupt(id, 'нет ID');
	if (row.source !== 'evidence' && row.source !== 'direct') corrupt(id, 'неизвестный источник');
	if (!record(row.origin)) corrupt(id, 'нет происхождения');
	if (row.source === 'direct') {
		if (!isId(row.origin.intentionId) || Object.keys(row.origin).length !== 1) {
			corrupt(id, 'происхождение самостоятельной оценки содержит только намерение');
		}
		if (row.placement != null) corrupt(id, 'у самостоятельной оценки нет адреса связи');
	} else {
		const { factId, ...placement } = row.origin;
		if (!isId(factId)) corrupt(id, 'нет факта');
		assertPlacement(placement, id, 'происхождение');
		if (id !== assessmentIdFor(placement.activationId)) {
			corrupt(id, 'ID не соответствует активации связи');
		}
		if (row.placement != null) assertPlacement(row.placement, id, 'адрес', true);
	}
	if (!record(row.initial) || Object.keys(row.initial).length === 0) {
		corrupt(id, 'нет первоначальных значений');
	}
	for (const [operationId, candidate] of Object.entries(row.initial)) {
		if (!isId(operationId) || !record(candidate)) {
			corrupt(id, `первоначальная запись ${operationId} неполна`);
		}
		const { at, withdrawn, ...values } = candidate;
		assertTimestamp(at, id, `время первоначальной записи ${operationId}`);
		if (withdrawn !== undefined && !isId(withdrawn)) {
			corrupt(id, `первоначальная запись ${operationId}: некорректная отмена`);
		}
		assertFeatureValues(values, id, `первоначальная запись ${operationId}`);
		if (values.outcome == null && values.open == null) {
			corrupt(id, `первоначальная запись ${operationId} без явного значения`);
		}
	}
	if (row.values != null) {
		if (!record(row.values)) corrupt(id, 'исправления не объект');
		for (const [feature, override] of Object.entries(row.values)) {
			if (!isAssessmentFeature(feature))
				corrupt(id, `исправление неизвестного признака ${feature}`);
			if (
				!record(override) ||
				!Object.hasOwn(override, 'value') ||
				!isId(override.operationId) ||
				Object.keys(override).some((key) => !['value', 'operationId', 'statement'].includes(key)) ||
				(override.statement !== undefined &&
					override.statement !== null &&
					!isId(override.statement))
			) {
				corrupt(id, `исправление ${feature} неполно`);
			}
			assertFeatureValues({ [feature]: override.value }, id, `исправление ${feature}`);
		}
	}
	if (row.isDeleted != null && typeof row.isDeleted !== 'boolean') corrupt(id, 'lifecycle');
	if (row.lifecycleId != null && !isId(row.lifecycleId)) corrupt(id, 'lifecycle');
	assertTimestamp(row.updatedAt, id, 'updatedAt');
	return row as unknown as StoredIntentionAssessment;
};

type Candidate = [operationId: string, candidate: StoredAssessmentCandidate];

/** Accepted timestamps may carry offsets or fractions: order them as instants, never as text. */
/** The order every reader of the statements shows them in: the earliest first time last. */
export const byNewestAssessed = (a: IntentionAssessment, b: IntentionAssessment): number =>
	compareAssessmentInstants(b.firstAssessedAt, a.firstAssessedAt) ||
	compareAssessmentIdentity(a.id, b.id);

export const compareAssessmentInstants = (a: string, b: string): number =>
	compareCalendarValues(a, b, 'minute');

/** Code-unit order is identical on every runtime, unlike locale collation. */
export const compareAssessmentIdentity = (a: string, b: string): number =>
	a < b ? -1 : a > b ? 1 : 0;

/** Canonical UTC spelling of an accepted timestamp for consumers that order or compare. */
export const canonicalInstant = (value: string): string =>
	new Date(Date.parse(value)).toISOString();

/**
 * Stable on every replica: by first instant, then by operationId code units. A withdrawn
 * first creation is left out unless every creation is asked for.
 */
export const sortedAssessmentCandidates = (
	stored: StoredIntentionAssessment,
	includeWithdrawn = false
): Candidate[] =>
	Object.entries(stored.initial)
		.filter(([, candidate]) => includeWithdrawn || candidate.withdrawn === undefined)
		.toSorted(
			([aId, a], [bId, b]) =>
				compareAssessmentInstants(a.at, b.at) || compareAssessmentIdentity(aId, bId)
		);

/** The operation whose statement a slot expresses; rows from before the key read as genuine. */
export const overrideStatement = (override: StoredAssessmentOverride<unknown>): string | null =>
	override.statement === undefined ? override.operationId : override.statement;

/** A correction that stands: the operation's own, or an inverse re-expressing an earlier one. */
export const isLiveOverride = (
	override: StoredAssessmentOverride<unknown> | undefined
): override is StoredAssessmentOverride<unknown> =>
	override !== undefined && overrideStatement(override) !== null;

/**
 * A source exists while a statement stands for it: an active first creation or a live
 * correction, also one that arrived after the creation it corrected was taken back.
 */
export const hasLiveStatement = (stored: StoredIntentionAssessment): boolean =>
	sortedAssessmentCandidates(stored).length > 0 ||
	isLiveOverride(stored.values?.outcome) ||
	isLiveOverride(stored.values?.open);

/**
 * The latest first creation that set a feature gives its value; a live correction in
 * `values` replaces it. The earliest first creation keeps the place in the chronology.
 */
export const resolveAssessmentValues = (
	stored: StoredIntentionAssessment
): Pick<IntentionAssessment, 'outcome' | 'open' | 'outcomeRevision' | 'openRevision'> => {
	let outcome: IntentionOutcome | null = null;
	let open: boolean | null = null;
	let outcomeRevision: string | null = null;
	let openRevision: string | null = null;
	for (const [operationId, candidate] of sortedAssessmentCandidates(stored)) {
		if (candidate.outcome != null) {
			outcome = candidate.outcome;
			outcomeRevision = operationId;
		}
		if (candidate.open != null) {
			open = candidate.open;
			openRevision = operationId;
		}
	}
	if (isLiveOverride(stored.values?.outcome)) {
		outcome = stored.values!.outcome!.value;
		outcomeRevision = stored.values!.outcome!.operationId;
	}
	if (isLiveOverride(stored.values?.open)) {
		open = stored.values!.open!.value;
		openRevision = stored.values!.open!.operationId;
	}
	return { outcome, open, outcomeRevision, openRevision };
};

export const normalizeIntentionAssessment = (
	value: Record<string, unknown>
): IntentionAssessment => {
	const stored = parseStoredAssessment(value);
	const active = sortedAssessmentCandidates(stored);
	// Without any standing statement the source reads as withdrawn; its chronology place
	// stays the earliest creation of this identity so history remains readable.
	const [[, earliest]] = active.length > 0 ? active : sortedAssessmentCandidates(stored, true);
	const address = stored.placement ?? stored.origin;
	return {
		id: stored.id,
		source: stored.source,
		intentionId: address.intentionId,
		originIntentionId: stored.origin.intentionId,
		factId: 'factId' in stored.origin ? stored.origin.factId : null,
		evidenceId: 'evidenceId' in address ? address.evidenceId : null,
		activationId: 'activationId' in address ? address.activationId : null,
		placementRevision: stored.placement?.operationId ?? null,
		...resolveAssessmentValues(stored),
		firstAssessedAt: canonicalInstant(earliest.at),
		isDeleted: stored.isDeleted === true || !hasLiveStatement(stored),
		lifecycleId: stored.lifecycleId ?? stored.id,
		createdAt: canonicalInstant(earliest.at),
		updatedAt: stored.updatedAt
	};
};
