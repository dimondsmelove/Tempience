import type { ParkedTrace } from '$lib/model/Projection/types';

export type ParkedProps = Readonly<{
	traces: readonly ParkedTrace[];
	selectedTraceId: string | null;
	/** The Scope rail shares the grid: the name cell sits in its column; otherwise the name goes inline. */
	railOpen: boolean;
	list?: boolean;
	onselect: (traceId: string) => void;
}>;
