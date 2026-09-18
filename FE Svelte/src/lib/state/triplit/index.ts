import { activeDataSpace, triplit } from './client';
import { createBackupRepository } from './Backup/Backup';
import { asRepositoryClient, createTriplitRepository } from './repository';
import { createScenarioImportRepository } from './scenario-import-repository';

export * from './operations';
export * from './repository';
export * from './schema';
export * from './data-space';
export * from './sync-status';
export * from './sync-status-instance';
export * from './trace-dataset';
export * from './period-time';
export * from './scope-hierarchy-integrity';
export * from './scenario-import-repository';
export * from './trace-time';
export * from './types';
export * from './IntentionAssessments/eligibility';
export * from './IntentionAssessments/result';
export { linkSourceId } from './IntentionAssessments/binding';
export type { EvidenceRetarget } from './IntentionAssessments/retarget';
export { isIntentionRelation, type RelationBlock } from './Traces/roles';
export { isTypedTrace, traceRecordText, type TraceRecordText } from './Traces/fields';
export {
	plannedStartElapsed,
	samePlacement,
	validateManualIntentionTime,
	type IntentionTimeCheck
} from './Traces/intention-time';
export { isSupplementMarker, supplementState, type SupplementState } from './Traces/supplement';
export { planInverse, type InversePlan, type InverseStep } from './Undo/plan';
export type { UndoResult } from './Undo/Undo';
export type {
	TraceRecordFields,
	TraceRecordLinkInput,
	TraceRecordResult,
	TraceRecordSave
} from './Traces/record';
export { INTENTION_OUTCOMES, assessmentIdFor } from './IntentionAssessments/read';
export { RepositoryError, type RepositoryErrorCode } from './Repository/errors';

export const tempienceRepository = createTriplitRepository(triplit);
export const dataSpaceBackup = createBackupRepository(triplit, activeDataSpace);
export const scenarioImportRepository = createScenarioImportRepository(
	asRepositoryClient(triplit),
	activeDataSpace
);
