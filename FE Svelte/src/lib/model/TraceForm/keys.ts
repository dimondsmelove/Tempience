import { CodedError } from '$lib/model/Errors/CodedError';
const CYRILLIC_TO_LATIN: Record<string, string> = {
	а: 'a',
	б: 'b',
	в: 'v',
	г: 'g',
	д: 'd',
	е: 'e',
	ё: 'e',
	ж: 'zh',
	з: 'z',
	и: 'i',
	й: 'i',
	к: 'k',
	л: 'l',
	м: 'm',
	н: 'n',
	о: 'o',
	п: 'p',
	р: 'r',
	с: 's',
	т: 't',
	у: 'u',
	ф: 'f',
	х: 'h',
	ц: 'ts',
	ч: 'ch',
	ш: 'sh',
	щ: 'sch',
	ъ: '',
	ы: 'y',
	ь: '',
	э: 'e',
	ю: 'yu',
	я: 'ya'
};

const transliterate = (value: string): string =>
	[...value.toLocaleLowerCase('ru-RU')]
		.map((character) => CYRILLIC_TO_LATIN[character] ?? character)
		.join('');

export const machineKeyFromLabel = (label: string, fallback = 'field'): string => {
	const normalized = transliterate(label)
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '')
		.slice(0, 64);
	const candidate = normalized.length > 0 ? normalized : fallback;
	const safe = /^[a-z_]/.test(candidate) ? candidate : `field_${candidate}`;
	return ['__proto__', 'constructor', 'prototype'].includes(safe) ? `field_${safe}` : safe;
};

export const uniqueMachineKey = (label: string, used: Set<string>, fallback: string): string => {
	const base = machineKeyFromLabel(label, fallback);
	let candidate = base;
	let suffix = 2;
	while (used.has(candidate)) {
		candidate = `${base}_${suffix}`;
		suffix += 1;
	}
	used.add(candidate);
	return candidate;
};

/** What a required label names, for the refusal's copy; an option names its field too. */
export type LabelContext = 'field' | 'kind' | 'option';

export const requiredLabel = (label: string, context: LabelContext, field?: string): string => {
	const normalized = label.trim();
	if (normalized.length === 0)
		throw new CodedError('form_label_required', `${context}: a name is required`, {
			reason: context,
			field
		});
	return normalized;
};
