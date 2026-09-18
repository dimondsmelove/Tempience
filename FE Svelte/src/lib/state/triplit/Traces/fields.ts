import { RepositoryError } from '../Repository/errors';
import type { Trace } from '../types';

/**
 * Text of a record as the accepted form shows it. A plain Trace keeps its required title in
 * `content` and its optional description in `description`; a typed Trace has no title, its
 * optional description lives in `content` (blank allowed) and `description` stays null. Legacy
 * rows are read whole: nothing is split, moved or invented on read.
 */
export type TraceRecordText = { title: string | null; description: string | null };

export type TraceRecordTextInput = { title?: string | null; description?: string | null };

export const isTypedTrace = (trace: Pick<Trace, 'kindId'>): boolean => trace.kindId !== null;

export const traceRecordText = (
	trace: Pick<Trace, 'kindId' | 'content' | 'description'>
): TraceRecordText =>
	isTypedTrace(trace)
		? { title: null, description: trace.content.length > 0 ? trace.content : null }
		: { title: trace.content, description: trace.description };

const blank = (value: string | null | undefined): boolean => (value ?? '').trim().length === 0;

/**
 * Maps form text to storage for a create (every field) or an edit (only present keys).
 * The plain title is required; a typed record must not carry a title.
 */
export const storedTraceText = (
	typed: boolean,
	input: TraceRecordTextInput,
	complete: boolean
): { content?: string; description?: string | null } => {
	const stored: { content?: string; description?: string | null } = {};
	if (typed) {
		if (input.title != null && !blank(input.title)) {
			throw new RepositoryError('typed_title', 'У записи по Kind нет отдельного названия.');
		}
		if (complete || Object.hasOwn(input, 'description')) {
			stored.content = (input.description ?? '').trim();
			stored.description = null;
		}
		return stored;
	}
	if (complete || Object.hasOwn(input, 'title')) {
		if (blank(input.title)) {
			throw new RepositoryError('title_required', 'Укажите название записи.');
		}
		stored.content = (input.title ?? '').trim();
	}
	if (complete || Object.hasOwn(input, 'description')) {
		stored.description = blank(input.description) ? null : (input.description ?? '').trim();
	}
	return stored;
};
