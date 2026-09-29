import type { BlockId } from '$lib/model/TraceForm/templates';
import type { TraceFieldDraft } from '$lib/model/TraceForm/types';

/** What «+» adds: a value field of a kind, a list, or a ready block of fields. */
export type AddKind = TraceFieldDraft['kind'] | `block:${BlockId}`;
