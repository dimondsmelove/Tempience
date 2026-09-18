import type { MessageKey } from '$lib/state/Locale/types';
import type { RecordMode } from './types';

/** The record-mode switch below the Trace Kind, in this order (TRACE_FORMS «режим записи», 2026-09-15). */
export const MODE_ORDER: readonly RecordMode[] = ['actual', 'intend', 'evidence'];

export const MODE_LABEL_KEYS: Readonly<Record<RecordMode, MessageKey>> = {
	actual: 'draft.modeActual',
	intend: 'draft.modeIntend',
	evidence: 'draft.modeEvidence'
};
