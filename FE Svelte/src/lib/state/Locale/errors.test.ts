import { afterEach, describe, expect, it } from 'vitest';
import { CodedError } from '$lib/model/Errors/CodedError';
import { REPOSITORY_ERROR_CODES, RepositoryError } from '$lib/state/triplit/Repository/errors';
import { errorText } from './errors';
import { hasMessage, locale } from './Locale.svelte';

afterEach(() => locale.set('ru'));

describe('the error boundary', () => {
	it('names every repository code in both languages', () => {
		for (const code of REPOSITORY_ERROR_CODES) expect(hasMessage(`error.${code}`), code).toBe(true);
	});

	it('reads a coded refusal as the interface copy, its details as parameters, in the current language', () => {
		const stale = new RepositoryError('storage_schema', 'log text', {
			reason: 'missing',
			path: 'traces.encoding'
		});
		expect(errorText(stale)).toBe(
			'Хранилище не обновлено до текущей схемы Tempience: в нём нет traces.encoding. Новые операции остановлены; сохранённые данные не изменены.'
		);
		const drifted = new RepositoryError('storage_schema', 'log text', {
			reason: 'type',
			path: 'traces.data',
			actual: 'number',
			expected: 'string'
		});
		expect(errorText(drifted)).toBe(
			'Хранилище не обновлено до текущей схемы Tempience: traces.data хранится как number вместо string. Новые операции остановлены; сохранённые данные не изменены.'
		);
		locale.set('en');
		expect(errorText(stale)).toBe(
			'The storage is not updated to the current Tempience schema: it has no traces.encoding. New operations are stopped; the stored data is unchanged.'
		);
		expect(errorText(drifted)).toBe(
			'The storage is not updated to the current Tempience schema: traces.data is stored as number instead of string. New operations are stopped; the stored data is unchanged.'
		);
	});

	it('picks the variant a reason names and falls back to the code without one', () => {
		expect(
			errorText(
				new RepositoryError('evidence_endpoint', 'log', { reason: 'deleted', deletedId: 'x' })
			)
		).toBe('Связанная запись удалена.');
		expect(errorText(new RepositoryError('evidence_endpoint', 'log', { reason: 'other' }))).toBe(
			'Связанная запись недоступна.'
		);
		expect(
			errorText(new RepositoryError('undo_stale', 'log', { step: 'value', reason: 'lifecycle' }))
		).toBe('Отмена невозможна: запись изменилась после этого действия.');
	});

	it('never shows a log message as copy: an unknown code or a plain failure is named as unexpected', () => {
		expect(errorText(new CodedError('no_such_code', 'internal words'))).toBe(
			'Непредвиденная ошибка: internal words'
		);
		expect(errorText(new Error('IndexedDB is closing'))).toBe(
			'Непредвиденная ошибка: IndexedDB is closing'
		);
		expect(errorText('quota')).toBe('Непредвиденная ошибка: quota');
		expect(errorText(undefined)).toBe('Непредвиденная ошибка.');
		locale.set('en');
		expect(errorText(null)).toBe('Unexpected error.');
	});
});
