import { evaluateIntention, type IntentionResult } from '../IntentionAssessments/result';
import type { TempienceRepository } from '../repository';
import type { Intersection, Trace } from '../types';

export {
	dayTime,
	markerFields,
	minuteTime,
	openRecordFixture,
	outcome,
	plainDraft,
	plainFields,
	snapshotOf,
	supplementOf,
	type RecordFixture
} from '../Traces/record.fixture';

/** The pure result of an intention from the repository's current rows. */
export const evaluate = async (
	repository: TempienceRepository,
	intentionId: string
): Promise<IntentionResult> =>
	evaluateIntention(intentionId, await repository.listIntentionAssessments(true), {
		tracesById: new Map<string, Trace>(
			(await repository.listTraces(true)).map((row) => [row.id, row])
		),
		intersectionsById: new Map<string, Intersection>(
			(await repository.listIntersections(true)).map((row) => [row.id, row])
		)
	});

/** Journal rows of one operation as `entityType:action:cause`, sorted. */
export const journalOf = async (repository: TempienceRepository, operationId: string) =>
	(await repository.listLogs())
		.filter((log) => log.operationId === operationId)
		.map((log) => `${log.entityType}:${log.action}:${log.cause}`)
		.toSorted();
