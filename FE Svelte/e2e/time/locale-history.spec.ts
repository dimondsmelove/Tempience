import { expect, test } from '@playwright/test';
import { datedRows, openHistorySpace, openKindHistory } from './kind-history.helpers';
import { ARTIFACTS, switchTo, versionTableIn, WORDS } from './locale.helpers';

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

test('a Kind history keeps its page and its Scope filter across a switch; the table, the menus and the catalog reword', async ({
	page
}) => {
	test.setTimeout(120_000);
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await openHistorySpace(page);
	await openKindHistory(page, 'Замер');
	const surface = page.getByTestId('kind-data-surface');
	await expect(surface).toBeVisible();
	// The second page of the newest version, in Russian.
	const v2ru = versionTableIn(page, 2, 'ru');
	await v2ru.getByRole('button', { name: WORDS.ru.next, exact: true }).click();
	await expect(v2ru).toContainText(WORDS.ru.page);
	await expect(datedRows(v2ru)).toHaveCount(33);
	const firstRow = await datedRows(v2ru).first().getAttribute('data-trace-id');

	await switchTo(page, 'en');
	// The same page and the same rows, under English headings. (What a switch asks of the
	// repository is proved at the boundary by locale-reads.spec.ts on the dev server.)
	const v2en = versionTableIn(page, 2, 'en');
	await expect(v2en).toContainText(WORDS.en.page);
	await expect(datedRows(v2en)).toHaveCount(33);
	expect(await datedRows(v2en).first().getAttribute('data-trace-id')).toBe(firstRow);
	await expect(
		v2en.getByRole('columnheader', { name: 'Date and time', exact: true })
	).toBeVisible();
	await expect(v2en.getByRole('columnheader', { name: 'Пульс', exact: true })).toBeVisible();
	await expect(surface.getByRole('button', { name: WORDS.en.record, exact: true })).toBeVisible();
	await expect(surface.getByTestId('history-active')).toContainText('Active filters:');
	// The catalog stays in the Context beside the table: its Kind's actions reword too.
	await expect(page.getByTestId('kind-data')).toHaveText('Data');
	// A Scope filter chosen in English: the user's Scope name stays its own.
	await surface.getByText(WORDS.en.filters, { exact: true }).click();
	await surface
		.getByRole('combobox', { name: 'Scope', exact: true })
		.selectOption({ label: 'Здоровье' });
	await expect(surface.getByTestId('history-active')).toContainText('Scope: Здоровье');
	const filtered = await datedRows(v2en).count();
	expect(filtered).toBeGreaterThan(0);
	await page.screenshot({ path: `${ARTIFACTS}/locale-complete-history-en.png`, fullPage: true });

	// The backup menu and the data-space controls in English.
	await page.getByRole('button', { name: WORDS.en.sync }).click();
	await expect(page.getByRole('button', { name: WORDS.en.export, exact: true })).toBeVisible();
	await expect(page.getByLabel(WORDS.en.file)).toBeVisible();
	await expect(page.getByRole('button', { name: 'Check for updates', exact: true })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Create a database from the file' })).toHaveCount(
		0
	);
	await expect(page.getByLabel('Data space')).toBeVisible();
	await page.screenshot({ path: `${ARTIFACTS}/locale-complete-backup-en.png` });
	await page.getByRole('button', { name: WORDS.en.sync }).click();

	// Back to Russian: the filter and its rows are as they were, worded again.
	await switchTo(page, 'ru');
	await expect(surface.getByTestId('history-active')).toContainText('Scope: Здоровье');
	await expect(datedRows(versionTableIn(page, 2, 'ru'))).toHaveCount(filtered);
	// The summary carries the count of active filters beside its words.
	await expect(surface.getByText(WORDS.ru.filters)).toBeVisible();
	await expect(surface.getByTestId('history-filters-count')).toHaveText('1');
	await expect(page.getByTestId('kind-data')).toHaveText('Данные');
	expect(errors).toEqual([]);
});
