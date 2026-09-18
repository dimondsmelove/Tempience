import type { MessageKey } from '$lib/state/Locale/types';
import type { TraceFieldDraft } from './types';
/** The kinds a field can be; each is named by the interface where it is offered. */
export const FIELD_KINDS: { value: TraceFieldDraft['kind']; label: MessageKey }[] = [
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
