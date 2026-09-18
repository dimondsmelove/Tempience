import type { LabelBox, MarkBox } from '$lib/model/Labels/types';
import type { TimeRange } from '$lib/model/Projection/types';

export type Hit =
	| Readonly<{ type: 'mark'; rowId: string; boxes: readonly MarkBox[] }>
	| Readonly<{ type: 'label'; rowId: string; label: LabelBox }>
	| Readonly<{ type: 'row'; rowId: string }>;

/** Several records under one point: the click zooms to their range instead of choosing blindly. */
export type Cluster = Readonly<{ traceIds: readonly string[]; range: TimeRange }>;
