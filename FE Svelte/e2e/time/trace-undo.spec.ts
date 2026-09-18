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
	startCapture
} from './results.helpers';

cleanConsole(test, 'i5b-console-undo.log');

const toast = (page: Page) => page.getByTestId('undo-toast');

const openResult = async (page: Page) => {
	const tab = panel(page).getByRole('tab', { name: 'Результат' });
	if (await tab.count()) await tab.click();
	return panel(page).getByTestId('intention-result');
};

test.describe('Taking back a deletion at 1440', () => {
	test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

	test('gives the record back and with it the statement it carried', async ({ page }) => {
		test.setTimeout(180_000);
		await loadTime(page, { manifest: null });
		await captureIntention(page, 'План У1');
		// Two facts state an outcome; the later one decides it while both stand.
		for (const [name, value] of [
			['Ранний У', 'partial'],
			['Поздний У', 'completed']
		] as const) {
			await showOverview(page);
			await selectParked(page, /План У1/);
			await showOverview(page);
			await panel(page).getByTestId('add-result').click();
			await title(page).fill(name);
			await outcome(page, 'План У1').selectOption(value);
			await editor(page).getByTestId('capture-save').click();
			await expect(panel(page).getByTestId('selected-title')).toHaveText(name);
		}
		await selectParked(page, /План У1/);
		await showOverview(page);
		let result = await openResult(page);
		await expect(result.getByTestId('result-outcome')).toContainText('Выполнено');
		// Deleting the later fact hands the outcome back to the earlier statement.
		await selectRecord(page, /Поздний У/);
		await showOverview(page);
		await expect(panel(page).getByTestId('selected-title')).toHaveText('Поздний У');
		await panel(page).getByTestId('delete-trace').click();
		await expect(toast(page)).toBeVisible();
		await selectParked(page, /План У1/);
		await showOverview(page);
		result = await openResult(page);
		await expect(result.getByTestId('result-outcome')).toContainText('Частично выполнено');
		await page.screenshot({ path: `${ARTIFACTS}/i5b-undo-offer-1440.png`, fullPage: true });
		// Taking the deletion back makes the same statement effective again, not a new one.
		await toast(page).getByTestId('undo').click();
		await expect(toast(page)).toHaveCount(0);
		// The record that came back is shown again; the intention is where its result is read.
		await expect(panel(page).getByTestId('selected-title')).toHaveText('Поздний У');
		await selectParked(page, /План У1/);
		await showOverview(page);
		result = await openResult(page);
		await expect(result.getByTestId('result-outcome')).toContainText('Выполнено');
		await expect(result.getByTestId('result-source')).toHaveCount(2);
		const backup = await exportBackup(page);
		const rows = backup.collections.intentionAssessments as { isDeleted?: boolean }[];
		expect(rows).toHaveLength(2);
		expect(rows.every((row) => row.isDeleted !== true)).toBe(true);
		// The inverse is an operation of its own, and the journal says so.
		const logs = backup.collections.logs as { cause: string }[];
		expect(logs.some((log) => log.cause === 'undo')).toBe(true);
	});

	test('offers one action at a time and lets the offer fade', async ({ page }) => {
		test.setTimeout(180_000);
		await loadTime(page, { manifest: null });
		await startCapture(page);
		await title(page).fill('Первая У2');
		await editor(page).getByTestId('capture-save').click();
		await startCapture(page);
		await title(page).fill('Вторая У2');
		await editor(page).getByTestId('capture-save').click();
		await selectRecord(page, /Первая У2/);
		await showOverview(page);
		await panel(page).getByTestId('delete-trace').click();
		await expect(toast(page)).toContainText('Запись удалена');
		await selectRecord(page, /Вторая У2/);
		await showOverview(page);
		await panel(page).getByTestId('delete-trace').click();
		// One offer stands: the newer action replaced the older one rather than queueing.
		await expect(toast(page)).toHaveCount(1);
		// It fades on its own, and nothing is taken back by that.
		await expect(toast(page)).toHaveCount(0, { timeout: 15_000 });
		const traces = (await exportBackup(page)).collections.traces as {
			content: string;
			isDeleted: boolean;
		}[];
		expect(traces.filter((row) => row.content.endsWith('У2') && row.isDeleted)).toHaveLength(2);
	});
});

test.describe('Taking back a withdrawn link at 1440', () => {
	test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

	test('returns the same link and its statement, and says so when it cannot', async ({ page }) => {
		test.setTimeout(180_000);
		await loadTime(page, { manifest: null });
		await captureIntention(page, 'План У3');
		await showOverview(page);
		await panel(page).getByTestId('add-result').click();
		await title(page).fill('Факт У3');
		await outcome(page, 'План У3').selectOption('completed');
		await editor(page).getByTestId('capture-save').click();
		await expect(panel(page).getByTestId('selected-title')).toHaveText('Факт У3');
		let links = await openLinks(page);
		await links.getByTestId('link-remove').click();
		await expect(links.getByTestId('link-target')).toHaveCount(0);
		await expect(toast(page)).toBeVisible();
		await toast(page).getByTestId('undo').click();
		await expect(toast(page)).toHaveCount(0);
		links = await openLinks(page);
		await expect(links.getByTestId('link-target')).toHaveCount(1);
		// The statement through that link stands again, with its own first time kept.
		await links.getByTestId('link-target').click();
		await showOverview(page);
		const result = await openResult(page);
		await expect(result.getByTestId('result-outcome')).toContainText('Выполнено');
		await expect(result.getByTestId('result-source')).toHaveCount(1);
		const rows = (await exportBackup(page)).collections.intentionAssessments as {
			isDeleted?: boolean;
		}[];
		expect(rows).toHaveLength(1);
	});
});
