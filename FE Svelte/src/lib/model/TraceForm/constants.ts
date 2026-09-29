import type { MessageKey } from '$lib/state/Locale/types';
import type { TraceScalarFieldKind } from './types';
/**
 * The kinds a single-value field can be; each is named by the interface where it is offered.
 * A list is not among them: it is added by its own button and never becomes a value field.
 */
export const FIELD_KINDS: { value: TraceScalarFieldKind; label: MessageKey }[] = [
	{ value: 'text', label: 'fieldKind.text' },
	{ value: 'textarea', label: 'fieldKind.textarea' },
	{ value: 'number', label: 'fieldKind.number' },
	{ value: 'integer', label: 'fieldKind.integer' },
	{ value: 'boolean', label: 'fieldKind.boolean' },
	{ value: 'date', label: 'fieldKind.date' },
	{ value: 'datetime', label: 'fieldKind.datetime' },
	{ value: 'choice', label: 'fieldKind.choice' },
	{ value: 'multi-choice', label: 'fieldKind.multi-choice' }
];
/** Lists inside lists stop at two levels: exercises, then their sets (loop 013, Q2). */
export const MAX_LIST_DEPTH = 2;
export const UNIT_IDS: Record<string, string> = {
	кг: 'kg',
	kg: 'kg',
	г: 'g',
	g: 'g',
	см: 'cm',
	cm: 'cm',
	м: 'm',
	m: 'm',
	км: 'km',
	km: 'km',
	мин: 'min',
	min: 'min',
	ч: 'h',
	h: 'h',
	'%': '%'
};
