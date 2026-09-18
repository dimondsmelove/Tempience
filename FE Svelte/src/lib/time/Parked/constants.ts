import type { ParkedReason } from '$lib/model/Projection/types';
import type { MessageKey } from '$lib/state/Locale/types';

export const PARKED_REASON_KEYS: Readonly<Record<ParkedReason, MessageKey>> = {
	relative: 'parked.relative',
	unknown: 'parked.unknown',
	trace_ref: 'parked.traceRef'
};

/** The last row of the ribbon: records without a place on the axis (C9a-2, D3). */
export const PARKED_ROW_KEY = 'parked.row' as const;
/** Whether the row shows its chips; open unless the user folded it. */
export const PARKED_STORAGE_KEY = 'tempience.parked.open.v1';
