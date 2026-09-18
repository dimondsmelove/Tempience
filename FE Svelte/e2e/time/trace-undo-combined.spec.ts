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
	selectRecord,
	showOverview,
	sourceOf,
	type Backup
} from './results.helpers';

cleanConsole(test, 'i5b-console-undo-combined.log');

const toast = (page: Page) => page.getByTestId('undo-toast');

const openResult = async (page: Page) => {
	const tab = panel(page).getByRole('tab', { name: 'Результат' });
	if (await tab.count()) await tab.click();
	return panel(page).getByTestId('intention-result');
};

/** A fact with an outcome for the named intention, saved through «Записать». */
const addFact = async (page: Page, plan: string, name: string, value: string) => {
	await showOverview(page);
	await panel(page).getByTestId('add-result').click();
	await title(page).fill(name);
	await outcome(page, plan).selectOption(value);
	await editor(page).getByTestId('capture-save').click();
	await expect(panel(page).getByTestId('selected-title')).toHaveText(name);
};

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

test.describe('Taking an action back among the statements that stand', () => {
	test('leaves an independent closure alone while the outcome goes back', async ({ page }) => {
		test.setTimeout(180_000);
		await loadTime(page, { manifest: null });
		await captureIntention(page, 'План К1');
		// The intention is closed by a statement of its own, about nothing but its openness.
		let result = await openResult(page);
		await result.getByTestId('result-assess').click();
		await result.getByTestId('direct-close').check();
		await result.getByTestId('direct-save').click();
		await expect(result.getByTestId('result-open')).toHaveAttribute('data-open', 'closed');
		await selectParked(page, /План К1/);
		await addFact(page, 'План К1', 'Ранний К1', 'partial');
		await selectParked(page, /План К1/);
		await addFact(page, 'План К1', 'Поздний К1', 'completed');
		await selectParked(page, /План К1/);
		result = await openResult(page);
		await expect(result.getByTestId('result-outcome')).toContainText('Выполнено');
		// Deleting the later fact hands the outcome back; the closure was never its to decide.
		await selectRecord(page, /Поздний К1/);
		await showOverview(page);
		await panel(page).getByTestId('delete-trace').click();
		await expect(toast(page)).toBeVisible();
		await selectParked(page, /План К1/);
		result = await openResult(page);
		await expect(result.getByTestId('result-outcome')).toContainText('Частично выполнено');
		await expect(result.getByTestId('result-open')).toHaveAttribute('data-open', 'closed');
		// The offer is the shell's own: it is taken from wherever the user happens to be.
		await toast(page).getByTestId('undo').click();
		await expect(toast(page)).toHaveCount(0);
		await selectParked(page, /План К1/);
		result = await openResult(page);
		await expect(result.getByTestId('result-outcome')).toContainText('Выполнено');
		await expect(result.getByTestId('result-open')).toHaveAttribute('data-open', 'closed');
		await page.screenshot({ path: `${ARTIFACTS}/i5b-rev-undo-combined-1440.png`, fullPage: true });
		const backup = (await exportBackup(page)) as unknown as Backup;
		// Three statements, none of them rewritten: the direct one still says what it said.
		expect(backup.collections.intentionAssessments).toHaveLength(3);
		const direct = backup.collections.intentionAssessments.filter((row) => !row.origin.factId);
		expect(direct).toHaveLength(1);
		expect(direct[0].values?.open?.value ?? Object.values(direct[0].initial)[0].open).toBe(false);
		expect(sourceOf(backup, 'Поздний К1').isDeleted).not.toBe(true);
	});

	test('offers a corrected address back and returns the statement to where it was', async ({
		page
	}) => {
		test.setTimeout(180_000);
		await loadTime(page, { manifest: null });
		await captureIntention(page, 'План К2 А');
		await captureIntention(page, 'План К2 Б');
		await selectParked(page, /План К2 А/);
		await addFact(page, 'План К2 А', 'Факт К2', 'completed');
		// The statement made through this link is corrected onto the other intention.
		const links = await openLinks(page);
		const retarget = links.getByTestId('link-retarget');
		await retarget.getByTestId('source-retarget').click();
		await retarget.getByTestId('retarget-search').fill('План К2 Б');
		await retarget.getByTestId('retarget-candidate').first().click();
		await expect(toast(page)).toContainText('Адресат исправлен');
		await selectParked(page, /План К2 Б/);
		let result = await openResult(page);
		await expect(result.getByTestId('result-outcome')).toContainText('Выполнено');
		// Taking the correction back returns the same statement, with what it said.
		await toast(page).getByTestId('undo').click();
		await expect(toast(page)).toHaveCount(0);
		await selectParked(page, /План К2 А/);
		result = await openResult(page);
		await expect(result.getByTestId('result-outcome')).toContainText('Выполнено');
		await expect(result.getByTestId('result-source')).toHaveCount(1);
		await selectParked(page, /План К2 Б/);
		result = await openResult(page);
		await expect(result.getByTestId('result-source')).toHaveCount(0);
		const backup = (await exportBackup(page)) as unknown as Backup;
		const source = sourceOf(backup, 'Факт К2');
		const plan = backup.collections.traces.find((row) => row.content === 'План К2 А')!;
		// One statement, at its origin again, with the first time it has always had.
		expect(backup.collections.intentionAssessments).toHaveLength(1);
		expect((source.placement ?? source.origin).intentionId).toBe(plan.id);
		expect(Object.values(source.initial)[0].outcome).toBe('completed');
	});

	test('refuses a stale inverse whole, says so, and writes no part of it', async ({ page }) => {
		test.setTimeout(180_000);
		await loadTime(page, { manifest: null });
		await captureIntention(page, 'План К3');
		await addFact(page, 'План К3', 'Факт К3', 'completed');
		const links = await openLinks(page);
		// The way back is prepared first: the offer lives for a few seconds only.
		await links.getByTestId('link-search-open').click();
		await links.getByTestId('link-search').fill('План К3');
		await links.getByTestId('link-kind').selectOption('evidence_for');
		await links.getByTestId('link-remove').click();
		await expect(toast(page)).toBeVisible();
		// The same link is made again by hand: what the withdrawal left behind is gone.
		await links.getByTestId('link-candidate').first().click();
		await expect(links.getByTestId('link-target')).toHaveCount(1);
		await toast(page).getByTestId('undo').click();
		await expect(toast(page).getByRole('alert')).toBeVisible();
		await expect(toast(page).getByTestId('undo')).toBeVisible();
		await page.screenshot({ path: `${ARTIFACTS}/i5b-rev-undo-stale-1440.png`, fullPage: true });
		// The refusal has been read; the offer is closed by hand, as the user would close it.
		await toast(page).getByRole('button', { name: 'Закрыть' }).click();
		await expect(toast(page)).toHaveCount(0);
		const backup = (await exportBackup(page)) as unknown as Backup;
		// Nothing of the inverse was written: the journal has no entry with that cause.
		const logs = backup.collections.logs as unknown as { cause: string }[];
		expect(logs.some((log) => log.cause === 'undo')).toBe(false);
		const active = backup.collections.intersections.filter(
			(link) => link.kind === 'evidence_for' && !link.isDeleted
		);
		expect(active).toHaveLength(1);
	});
});
