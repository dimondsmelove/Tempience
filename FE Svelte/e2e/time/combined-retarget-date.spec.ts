import { expect, test, type Page } from '@playwright/test';
import { exportBackup } from '../public/helpers';
import { ARTIFACTS, cleanConsole, editor, title } from './draft.helpers';
import { loadTime } from './helpers';
import {
	captureIntention,
	openLinks,
	outcome,
	panel,
	selectParked,
	showOverview,
	sourceOf,
	type Backup
} from './results.helpers';

cleanConsole(test, 'i7-console-retarget-date.log');
test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

const openResult = async (page: Page) => {
	const tab = panel(page).getByRole('tab', { name: 'Результат' });
	if (await tab.count()) await tab.click();
	return panel(page).getByTestId('intention-result');
};

/** The selected record's time edited: the picker opened, `change` applied, the edit saved. */
const editTime = async (page: Page, change: () => Promise<void>): Promise<void> => {
	await showOverview(page);
	await panel(page).getByTestId('edit-trace').click();
	await editor(page).getByTestId('trace-time').click();
	await change();
	await page.getByRole('button', { name: 'Применить время', exact: true }).click();
	await editor(page).getByTestId('edit-save').click();
	await expect(panel(page).getByTestId('context-overview')).toBeVisible();
};

/**
 * S09 after S10: a fact loses its date, its statement is then corrected onto another
 * intention, and the date comes back. The statement is one and the same throughout — at the
 * corrected intention, with the first time it has always had — and the record's own time is
 * the record's, not the statement's.
 */
test('a statement corrected while its fact is undated stays where it was put when the date returns', async ({
	page
}) => {
	test.setTimeout(180_000);
	await loadTime(page, { manifest: null });
	await captureIntention(page, 'План Т1');
	await captureIntention(page, 'План Т2');
	await selectParked(page, /План Т1/);
	await showOverview(page);
	await panel(page).getByTestId('add-result').click();
	await title(page).fill('Факт Т');
	await outcome(page, 'План Т1').selectOption('completed');
	await editor(page).getByTestId('capture-save').click();
	await expect(panel(page).getByTestId('selected-title')).toHaveText('Факт Т');
	await expect(panel(page).getByTestId('selected-time')).not.toContainText('время неизвестно');
	// The statement as first stored: its identity, its origin and its first-time values.
	const stored = sourceOf((await exportBackup(page)) as unknown as Backup, 'Факт Т');
	expect(Object.keys(stored.initial)).toHaveLength(1);
	expect(Object.values(stored.initial)[0].outcome).toBe('completed');

	// S10: the date removed explicitly. The fact is parked; its statement stands but is
	// silenced — shown, named as such, not counted — until the fact has a date again.
	await editTime(page, async () => {
		await page.getByText('Уточнить дату…', { exact: true }).click();
		await page.getByRole('button', { name: 'Дата неизвестна', exact: true }).click();
	});
	await expect(panel(page).getByTestId('selected-time')).toContainText('время неизвестно');
	await selectParked(page, /План Т1/);
	let result = await openResult(page);
	await expect(result.getByTestId('result-outcome')).toHaveAttribute('data-outcome', 'unassessed');
	await expect(result.getByTestId('result-source')).toHaveCount(1);
	await expect(result.getByTestId('source-inactive')).toHaveText('у факта нет даты события');

	// S09: the silenced statement corrected onto the other intention, silenced there too.
	await selectParked(page, /Факт Т/);
	const links = await openLinks(page);
	const retarget = links.getByTestId('link-retarget');
	await retarget.getByTestId('source-retarget').click();
	await retarget.getByTestId('retarget-search').fill('План Т2');
	await retarget.getByTestId('retarget-candidate').first().click();
	await expect(page.getByTestId('undo-toast')).toContainText('Адресат исправлен');
	await selectParked(page, /План Т2/);
	result = await openResult(page);
	await expect(result.getByTestId('result-outcome')).toHaveAttribute('data-outcome', 'unassessed');
	await expect(result.getByTestId('source-inactive')).toHaveText('у факта нет даты события');
	await selectParked(page, /План Т1/);
	result = await openResult(page);
	await expect(result.getByTestId('result-source')).toHaveCount(0);
	await page.screenshot({ path: `${ARTIFACTS}/i7-retarget-undated-1440.png`, fullPage: true });

	// S10 again: the date restored; the same statement counts again, where it was put.
	await selectParked(page, /Факт Т/);
	await editTime(page, async () => {
		await page.getByRole('button', { name: 'Указать дату', exact: true }).click();
		await page.getByRole('gridcell', { name: 'вторник, 1 сентября 2026 г.', exact: true }).click();
	});
	await expect(panel(page).getByTestId('selected-time')).toContainText('1 сент. 2026');
	await selectParked(page, /План Т2/);
	result = await openResult(page);
	await expect(result.getByTestId('result-outcome')).toContainText('Выполнено');
	await expect(result.getByTestId('result-source')).toHaveCount(1);
	await expect(result.getByTestId('source-inactive')).toHaveCount(0);

	const backup = (await exportBackup(page)) as unknown as Backup;
	const source = sourceOf(backup, 'Факт Т');
	const rows = backup.collections.traces as { id: string; content: string; aboutTime: unknown }[];
	const target = rows.find((row) => row.content === 'План Т2')!;
	const fact = rows.find((row) => row.content === 'Факт Т')!;
	// One statement, at the corrected intention, with its first time; the fact dated again.
	expect(backup.collections.intentionAssessments).toHaveLength(1);
	expect((source.placement ?? source.origin).intentionId).toBe(target.id);
	expect(Object.values(source.initial)[0].outcome).toBe('completed');
	// The same statement throughout: its id, its origin and its first-time values unchanged;
	// only where it is placed moved, away from the origin intention.
	expect(source.id).toBe(stored.id);
	expect(source.origin).toEqual(stored.origin);
	expect(source.initial).toEqual(stored.initial);
	expect(source.origin.intentionId).not.toBe(target.id);
	expect(source.placement?.intentionId).toBe(target.id);
	expect(JSON.stringify(fact.aboutTime)).toContain('2026-09-01');
});
