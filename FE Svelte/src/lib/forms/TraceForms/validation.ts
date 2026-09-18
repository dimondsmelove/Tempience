import type { ErrorObject } from 'ajv';
import type { TOptions } from 'i18next';
import { overrideByRecord } from '@sjsf/form/lib/resolver';
import { translation as enTranslation } from '@sjsf/form/translations/en';
import { translation as ruTranslation } from '@sjsf/form/translations/ru';
import { t } from '$lib/state/Locale/Locale.svelte';
import type { Locale, MessageKey } from '$lib/state/Locale/types';

/**
 * A validation message is kept as its key and parameters, not as words: the list that shows
 * it reads the words in the language of the moment, so a language switch changes them
 * without re-validating and without touching the input.
 *
 * The installed validator rewrites a missing field's message once more after this hook:
 * `message.replace(missingProperty, title)` — the first occurrence of the raw key, whatever
 * the key is (a word, one character, the empty string, the separator itself). No encoding of
 * the payload can keep an arbitrary key from matching, so the message does not try: it starts
 * with the key itself as a decoy. The first occurrence of the key is then at index 0 by
 * construction, and that is the one the rewrite replaces — with the title, which may contain
 * anything (`$'` patterns included; they only insert copies of the message ahead of the
 * payload). The payload comes last, after a separator it never contains (the separator is
 * JSON-escaped inside it), so it is read from the last separator and stays intact whatever
 * the key or the title did to the text before it.
 */
const SEP = '⁣';

type Envelope = {
	key: MessageKey;
	params?: Record<string, string | number>;
	/** A missing field: its key, exactly; the list that shows the message names it. */
	field?: string;
};

const envelope = (payload: Envelope): string =>
	SEP + JSON.stringify(payload).replaceAll(SEP, '\\u2063');

export const encodeValidation = (
	key: MessageKey,
	params: Record<string, string | number> = {}
): string => envelope({ key, params });

/** What the errors list knows of the field it belongs to: SJSF's `Config`, or a test's stand-in. */
export type ValidationField = Readonly<{
	path?: readonly (string | number)[];
	title: string;
	schema?: object;
	uiSchema?: object;
}>;

const record = (value: unknown): Record<string, unknown> | null =>
	value !== null && typeof value === 'object' && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;

/**
 * The name of a missing field as the list showing the message can name it: the list's own
 * title when the message was attributed to the missing field itself (the form's validation
 * puts it at the field's path, the key its last segment); for an object's own message about
 * a missing child, that child's title as the form labels it (its UI title first), else the
 * child's key, as the validator itself would say.
 */
const missingFieldName = (field: ValidationField | undefined, key: string): string => {
	if (!field) return key;
	if (!field.path || field.path.at(-1) === key) return field.title;
	const uiTitle = record(record(record(field.uiSchema)?.[key])?.['ui:options'])?.title;
	if (typeof uiTitle === 'string') return uiTitle;
	const schemaTitle = record(record(record(field.schema)?.properties)?.[key])?.title;
	return typeof schemaTitle === 'string' ? schemaTitle : key;
};

/** The words of a validation message in the current language; other text stays as it is. */
export const validationText = (message: string, field?: ValidationField): string => {
	const at = message.lastIndexOf(SEP);
	if (at < 0) return message;
	let parsed: Envelope;
	try {
		parsed = JSON.parse(message.slice(at + SEP.length)) as Envelope;
	} catch {
		return message;
	}
	if (typeof parsed?.key !== 'string') return message;
	if (typeof parsed.field === 'string')
		return t('validation.required', { field: missingFieldName(field, parsed.field) });
	const options: Record<string, string | number> = { ...parsed.params };
	if (typeof options.count === 'string') options.count = Number(options.count);
	return t(parsed.key, options as TOptions);
};

const messageOf = (error: ErrorObject): string => {
	const params = error.params as Record<string, unknown>;
	switch (error.keyword) {
		case 'required': {
			const key = String(params.missingProperty);
			return key + envelope({ key: 'validation.required', field: key });
		}
		case 'type':
			return encodeValidation('validation.type', { context: String(params.type) });
		case 'minimum':
		case 'maximum':
		case 'exclusiveMinimum':
		case 'exclusiveMaximum':
			return encodeValidation(`validation.${error.keyword}`, { limit: String(params.limit) });
		case 'multipleOf':
			return encodeValidation('validation.multipleOf', { limit: String(params.multipleOf) });
		case 'minLength':
		case 'maxLength':
		case 'minItems':
		case 'maxItems':
			return encodeValidation(`validation.${error.keyword}`, { count: Number(params.limit) });
		case 'uniqueItems':
			return encodeValidation('validation.uniqueItems');
		case 'pattern':
			return encodeValidation('validation.pattern', { pattern: String(params.pattern) });
		case 'format':
			return encodeValidation('validation.format', {
				format: String(params.format),
				context: String(params.format)
			});
		case 'enum':
		case 'const':
		case 'oneOf':
		case 'anyOf':
			return encodeValidation('validation.choice');
		case 'additionalProperties':
			return encodeValidation('validation.additionalProperties', {
				property: String(params.additionalProperty)
			});
		default:
			return encodeValidation('validation.other', { keyword: error.keyword });
	}
};

/** AJV's own English replaced by the interface's keys before SJSF reads the messages. */
export const localizeValidation = (errors: ErrorObject[]): ErrorObject[] => {
	for (const error of errors) error.message = messageOf(error);
	return errors;
};

/** SJSF's own words (array and object actions, the submit) in the interface language. */
export const formTranslation = (language: Locale, submit?: string) =>
	overrideByRecord(language === 'en' ? enTranslation : ruTranslation, submit ? { submit } : {});
