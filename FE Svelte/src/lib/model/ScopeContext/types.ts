import type { MarkTime, TimeRange } from '$lib/model/Projection/types';
import type { ExplorerScope, ExplorerTrace } from '$lib/model/Snapshot/types';

export type ScopeContext = Readonly<{
	record: ExplorerScope;
	parent: ExplorerScope | null;
	children: readonly ExplorerScope[];
	traces: readonly Readonly<{ record: ExplorerTrace; time: MarkTime | null }>[];
	range: TimeRange | null;
}>;
