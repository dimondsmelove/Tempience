// Public surface of the Trace dataset reader; the implementation lives in TraceDataset/.
export type {
	KindIndexRequest,
	KindIndexRow,
	KindIndexSnapshot,
	KindRowsSnapshot,
	TraceDatasetCell,
	TraceDatasetColumn,
	TraceDatasetCompatibilityIssue,
	TraceDatasetCoreField,
	TraceDatasetDataFilter,
	TraceDatasetFilterOperator,
	TraceDatasetReader,
	TraceDatasetRepeat,
	TraceDatasetRequest,
	TraceDatasetRow,
	TraceDatasetScalarType,
	TraceDatasetScopeMode,
	TraceDatasetSnapshot,
	TraceDatasetStoredCoreField,
	TraceDatasetTimeRange,
	TraceDatasetValueType
} from './TraceDataset/types';
export { traceDatasetCompatibilityIssues } from './TraceDataset/compatibility';
export { createTraceDatasetReader } from './TraceDataset/TraceDataset';
