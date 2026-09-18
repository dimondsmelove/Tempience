import { describe, expect, it } from 'vitest';
import { LocaleState, translate } from './Locale.svelte';
import { LOCALE_STORAGE_KEY } from './constants';
import { ru } from './messages/ru';
import { en } from './messages/en';

describe('Locale', () => {
	it('restores and persists an explicit language without changing user data', () => {
		const stored = new Map([
			[LOCALE_STORAGE_KEY, 'en'],
			['user-content', 'Моя запись']
		]);
		const state = new LocaleState();
		state.init({
			getItem: (key) => stored.get(key) ?? null,
			setItem: (key, value) => {
				stored.set(key, value);
			}
		});
		expect(state.t('shell.appearance')).toBe('Appearance');
		state.set('ru');
		expect(state.t('shell.appearance')).toBe('Внешний вид');
		expect(stored.get(LOCALE_STORAGE_KEY)).toBe('ru');
		expect(stored.get('user-content')).toBe('Моя запись');
	});

	it('keeps Russian for unsupported preferences and works without storage permission', () => {
		const state = new LocaleState();
		state.init({
			getItem: () => 'unsupported',
			setItem: () => {
				throw new Error('Storage denied');
			}
		});
		expect(state.current).toBe('ru');
		state.set('en');
		expect(state.t('shell.appearance')).toBe('Appearance');
		state.set('unsupported');
		expect(state.current).toBe('en');
	});

	it('survives a storage that throws on read and still switches for the session', () => {
		const state = new LocaleState();
		state.init({
			getItem: () => {
				throw new Error('Storage denied');
			},
			setItem: () => {
				throw new Error('Storage denied');
			}
		});
		expect(state.current).toBe('ru');
		state.set('en');
		expect(state.current).toBe('en');
	});

	it('uses locale-specific plural rules and interpolates complete messages', () => {
		const state = new LocaleState();
		expect([1, 2, 5, 21].map((count) => state.t('common.records', { count }))).toEqual([
			'1 запись',
			'2 записи',
			'5 записей',
			'21 запись'
		]);
		state.set('en');
		expect([1, 2, 5, 21].map((count) => state.t('common.records', { count }))).toEqual([
			'1 record',
			'2 records',
			'5 records',
			'21 records'
		]);
		expect(state.t('shell.prepareFailed', { message: 'A & B' })).toBe(
			'Could not prepare data: A & B'
		);
		// An explicit language for adapters that format outside a component.
		expect(translate('ru', 'shell.update')).toBe('Обновить');
		expect(translate('en', 'shell.update')).toBe('Update');
	});

	it('ships both offline catalogs with matching keys and interpolation parameters', () => {
		expect(Object.keys(en).sort()).toEqual(Object.keys(ru).sort());
		// One flat key space: no area file repeats a key of another.
		const files = import.meta.glob('./messages/ru/*.json', { eager: true }) as Record<
			string,
			{ default: Record<string, string> }
		>;
		const declared = Object.values(files).flatMap((file) => Object.keys(file.default));
		expect(declared.length).toBe(new Set(declared).size);
		expect(declared.length).toBe(Object.keys(ru).length);
		for (const key of Object.keys(ru) as (keyof typeof ru)[]) {
			const parameters = (text: string) =>
				[...text.matchAll(/\{\{\s*([^}, ]+)/g)].map((match) => match[1]).sort();
			expect(parameters(en[key]), key).toEqual(parameters(ru[key]));
		}
	});
});
