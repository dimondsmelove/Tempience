import type { ErrorObject } from 'ajv';
import { addFormComponents, createFormValidator } from '@sjsf/ajv8-validator';
import { afterEach, describe, expect, it } from 'vitest';
import { locale } from '$lib/state/Locale/Locale.svelte';
import { createTraceAjv } from '$lib/state/triplit/trace-kind-v-validation';
import {
	encodeValidation,
	formTranslation,
	localizeValidation,
	validationText,
	type ValidationField
} from './validation';

afterEach(() => locale.set('ru'));

const MARK = '⁣';

/** The installed validator with the app's AJV and the localizing hook, exactly as the runtime wires them. */
const validatorFor = (schema: Record<string, unknown>) =>
	createFormValidator({
		schema,
		ajv: addFormComponents(createTraceAjv()),
		localize: localizeValidation
	});

/** The messages of the form's own validation of `value` against `schema`. */
const formMessages = (schema: Record<string, unknown>, value: object = {}): string[] => {
	const result = validatorFor(schema).validateFormValue(schema as never, value as never);
	return (result.errors ?? []).map((entry) => entry.message);
};

/** The messages of one field's own validation, as the form asks for them. */
const fieldMessages = (
	schema: Record<string, unknown>,
	config: { path: string[]; title: string; required: boolean },
	value: unknown
): string[] => {
	const update = validatorFor(schema).validateFieldValue(
		{ ...config, schema, uiSchema: {} } as never,
		value as never
	);
	return typeof update === 'function' ? update([]) : update;
};

const error = (
	keyword: string,
	params: Record<string, unknown>,
	parentSchema?: object
): ErrorObject =>
	({
		keyword,
		params,
		instancePath: '',
		schemaPath: '',
		message: 'must …',
		parentSchema
	}) as ErrorObject;

/** Keys the installed validator's own rewrite can match, and titles that could break an envelope. */
const KEYS = [
	'field',
	'validation',
	'key',
	'required',
	'k',
	'x',
	'',
	MARK,
	`a${MARK}b`,
	'field_uuid'
];
const TITLES = [
	'Вес',
	'Вес "кг"',
	'a=b',
	'{"key":1}',
	`Вес${MARK}context=other`,
	`${MARK}⁤x`,
	"$' $& $$"
];

describe('validation messages in the interface language', () => {
	it('keeps a message as key and parameters, and reads it in the language of the moment', () => {
		const [limit, pattern, choice, other] = localizeValidation([
			error('minLength', { limit: 3 }),
			error('pattern', { pattern: '^[A-Z]{3}$' }),
			error('oneOf', {}),
			error('dependencies', {})
		]).map((entry) => entry.message ?? '');
		expect(validationText(limit)).toBe('Не короче 3 символов');
		expect(validationText(pattern)).toBe('Значение должно соответствовать шаблону ^[A-Z]{3}$');
		expect(validationText(choice)).toBe('Выберите один из вариантов');
		expect(validationText(other)).toBe('Недопустимое значение (dependencies)');
		locale.set('en');
		expect(validationText(limit)).toBe('At least 3 characters');
		expect(validationText(pattern)).toBe('Must match the pattern ^[A-Z]{3}$');
		// AJV's own English never reaches the list; text that is not a key stays as it is.
		expect(pattern).not.toContain('must');
		expect(validationText('Custom text')).toBe('Custom text');
	});

	it('names the type and the format as variants', () => {
		expect(validationText(encodeValidation('validation.type', { context: 'integer' }))).toBe(
			'Введите целое число'
		);
		expect(
			validationText(encodeValidation('validation.format', { format: 'date', context: 'date' }))
		).toBe('Введите корректную дату');
		expect(
			validationText(encodeValidation('validation.format', { format: 'uri', context: 'uri' }))
		).toBe('Недопустимый формат: uri');
	});

	it("names a missing field by the title of the list that shows it, whatever the key or the title (the form's validation)", () => {
		// The validator replaces the first occurrence of the raw key with the title after the
		// hook ran: the message starts with the key as a decoy, so the replacement lands there.
		for (const key of KEYS)
			for (const title of TITLES) {
				const schema = {
					type: 'object',
					required: [key],
					properties: { [key]: { type: 'number', title } },
					additionalProperties: false
				};
				const [message, ...rest] = formMessages(schema);
				expect(rest, `${key} / ${title}`).toEqual([]);
				const field: ValidationField = { path: [key], title, schema: schema.properties[key] };
				locale.set('ru');
				expect(validationText(message, field), `${key} / ${title}`).toBe(
					`Заполните поле «${title}»`
				);
				locale.set('en');
				expect(validationText(message, field), `${key} / ${title}`).toBe(`Fill in “${title}”`);
				expect(message).not.toContain('must');
			}
	});

	it("names a missing child of an object from the object's own list, by the form's label first (a field's validation)", () => {
		for (const key of KEYS) {
			const schema = {
				type: 'object',
				required: [key],
				properties: { [key]: { type: 'string', title: 'Текст' } }
			};
			const [message, ...rest] = fieldMessages(
				schema,
				{ path: ['group'], title: 'Группа', required: true },
				{}
			);
			expect(rest, key).toEqual([]);
			const object: ValidationField = { path: ['group'], title: 'Группа', schema };
			locale.set('ru');
			expect(validationText(message, object), key).toBe('Заполните поле «Текст»');
			expect(
				validationText(message, {
					...object,
					uiSchema: { [key]: { 'ui:options': { title: 'Текст, шт' } } }
				}),
				key
			).toBe('Заполните поле «Текст, шт»');
			// Without a title anywhere the child's key is its name, as the validator itself would say.
			expect(
				validationText(message, { path: ['group'], title: 'Группа', schema: { properties: {} } }),
				key
			).toBe(`Заполните поле «${key}»`);
			locale.set('en');
			expect(validationText(message, object), key).toBe('Fill in “Текст”');
		}
	});

	it("keeps a user's pattern with quotes and the marks inside its envelope", () => {
		const pattern = `^"${MARK}=[A-Z]"$`;
		const schema = { type: 'object', properties: { code: { type: 'string', pattern } } };
		const [message, ...rest] = formMessages(schema, { code: 'ab' });
		expect(rest).toEqual([]);
		expect(validationText(message)).toBe(`Значение должно соответствовать шаблону ${pattern}`);
	});

	it("gives SJSF its own words per language, the submit's included", () => {
		const words = (language: 'ru' | 'en', submit?: string) => (label: string) =>
			(formTranslation(language, submit) as (label: string, params: object) => unknown)(label, {});
		expect(words('ru')('add-array-item')).toBe('Добавить элемент');
		expect(words('en')('add-array-item')).toBe('Add item');
		expect(words('en', 'Check values')('submit')).toBe('Check values');
	});
});
