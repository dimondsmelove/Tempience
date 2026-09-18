import { readFile } from 'node:fs/promises';
import { expect, type Locator, type Page } from '@playwright/test';

export const ARTIFACTS = 'e2e/artifacts';
/** U+2063, the separator the validation envelope is built with. */
export const MARK = '⁣';
export type Language = 'ru' | 'en';

/** The two wordings of the controls the locale scenarios drive, one per language. */
export const WORDS = {
	ru: {
		sync: /^Синхронизация:/,
		export: 'Экспортировать данные',
		file: 'JSON-файл с данными',
		version: 'Версия',
		next: 'Следующая',
		page: 'Страница 2 из 2',
		filters: 'Фильтры истории',
		record: 'Записать',
		kinds: 'Trace Kind',
		save: 'Сохранить',
		cancelTime: 'Отменить изменение времени',
		when: 'Когда',
		appearance: 'Внешний вид',
		preview: 'Проверка формы',
		check: 'Проверить значения',
		refine: 'Уточнить дату…',
		precision: 'Точность даты',
		month: 'Месяц',
		overview: 'Обзор',
		links: 'Связи'
	},
	en: {
		sync: /^Sync:/,
		export: 'Export data',
		file: 'JSON file with data',
		version: 'Version',
		next: 'Next',
		page: 'Page 2 of 2',
		filters: 'History filters',
		record: 'Record',
		kinds: 'Kinds',
		save: 'Save',
		cancelTime: 'Cancel the time change',
		when: 'When',
		appearance: 'Appearance',
		preview: 'Form check',
		check: 'Check the values',
		refine: 'Refine the date…',
		precision: 'Date precision',
		month: 'Month',
		overview: 'Overview',
		links: 'Links'
	}
} as const;

export const switchTo = async (page: Page, language: Language): Promise<void> => {
	await page.getByTestId('locale-picker').selectOption(language);
	await expect(page.locator('html')).toHaveAttribute('lang', language);
};

/** The table of one version of the open history, under the heading of the language shown. */
export const versionTableIn = (page: Page, generation: number, language: Language): Locator =>
	page.getByTestId('version-table').filter({
		has: page.getByRole('heading', { name: `${WORDS[language].version} ${generation}` })
	});

/**
 * Every row of every collection of the export, canonical — each collection sorted by id —
 * with only the export's own envelope (its time, its format) left out: the user's values,
 * their times and the journal included, exactly as stored.
 */
export const exportRows = async (
	page: Page,
	language: Language
): Promise<Record<string, unknown[]>> => {
	await page.getByRole('button', { name: WORDS[language].sync }).click();
	const [download] = await Promise.all([
		page.waitForEvent('download'),
		page.getByRole('button', { name: WORDS[language].export, exact: true }).click()
	]);
	const file = await download.path();
	if (!file) throw new Error('The backup download did not produce a file.');
	const backup = JSON.parse(await readFile(file, 'utf8')) as {
		collections: Record<string, { id?: string }[]>;
	};
	await page.getByRole('button', { name: WORDS[language].sync }).click();
	expect(Object.keys(backup.collections).length).toBeGreaterThanOrEqual(17);
	return Object.fromEntries(
		Object.entries(backup.collections).map(([name, rows]) => [
			name,
			[...rows].toSorted((a, b) => String(a.id).localeCompare(String(b.id)))
		])
	);
};

/** The words of a validation message in the errors lists of `root`. */
export const said = (root: Locator, text: string | RegExp): Locator =>
	root.locator('.sjsf-errors-list').getByText(text);
