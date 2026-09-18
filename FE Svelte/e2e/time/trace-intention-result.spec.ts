import { expect, test } from '@playwright/test';
import { exportBackup } from '../public/helpers';
import { ARTIFACTS, cleanConsole, editor, title, mode } from './draft.helpers';
import { loadTime } from './helpers';
import {
	captureIntention,
	closeBox,
	openLinks,
	outcome,
	panel,
	selectRecord,
	showOverview,
	startCapture,
	target,
	openSources
} from './results.helpers';

cleanConsole(test, 'i5a-console-intention.log');

/** The «Результат» part of the shown intention: a tab when compact, a section on the desktop. */
const openResult = async (page: import('@playwright/test').Page) => {
	const tab = panel(page).getByRole('tab', { name: 'Результат' });
	if (await tab.count()) await tab.click();
	return panel(page).getByTestId('intention-result');
};

for (const width of [390, 1440]) {
	test.describe('An intention result at ' + width, () => {
		test.use({
			viewport: { width, height: 900 },
			isMobile: width === 390,
			hasTouch: width === 390
		});

		test('shows outcome and openness apart, names what decided each, and takes a direct assessment', async ({
			page
		}) => {
			test.setTimeout(150_000);
			await loadTime(page, { manifest: null });
			await captureIntention(page, 'План И');
			let result = await openResult(page);
			await expect(result.getByTestId('result-outcome')).toHaveAttribute(
				'data-outcome',
				'unassessed'
			);
			await expect(result.getByTestId('result-open')).toHaveAttribute('data-open', 'open');
			await expect(result.getByTestId('result-decided')).toHaveText('оценок нет');
			// A fact states «completed»; the intention stays open, because completing never closes.
			await showOverview(page);
			await panel(page).getByTestId('add-result').click();
			await title(page).fill('Итог И');
			await outcome(page, 'План И').selectOption('completed');
			await editor(page).getByTestId('capture-save').click();
			await expect(panel(page).getByTestId('selected-title')).toHaveText('Итог И');
			const links = await openLinks(page);
			await links.getByTestId('link-target').click();
			await showOverview(page);
			await expect(panel(page).getByTestId('selected-title')).toHaveText('План И');
			result = await openResult(page);
			await expect(result.getByTestId('result-outcome')).toContainText('Выполнено');
			await expect(result.getByTestId('result-decided')).toContainText('через факт «Итог И»');
			await expect(result.getByTestId('result-open')).toHaveAttribute('data-open', 'open');
			await expect(result.getByTestId('result-open')).toHaveText('Открыто');
			await expect(result.getByTestId('result-source')).toHaveCount(1);
			await expect(result.getByTestId('source-decides')).toHaveText('действует');
			// A direct assessment is a decision about the intention itself: it closes it alone.
			await result.getByTestId('result-assess').click();
			await result.getByTestId('direct-close').check();
			await result.getByTestId('direct-save').click();
			await expect(result.getByTestId('result-open')).toHaveAttribute('data-open', 'closed');
			await expect(
				result.getByTestId('result-source').filter({ hasText: 'прямая оценка' })
			).toHaveCount(1);
			// The outcome is still the fact's: the two features were decided independently.
			await expect(result.getByTestId('result-outcome')).toContainText('Выполнено');
			await expect(result.getByTestId('result-source')).toHaveCount(2);
			await page.screenshot({
				path: `${ARTIFACTS}/i5a-intention-result-${width}.png`,
				fullPage: true
			});
			const backup = await exportBackup(page);
			const rows = backup.collections.intentionAssessments as {
				source: string;
				initial: Record<string, { outcome?: string; open?: boolean }>;
			}[];
			expect(rows).toHaveLength(2);
			const direct = rows.find((row) => row.source === 'direct')!;
			// Only what was entered is written: the derived outcome was not resubmitted.
			expect(Object.values(direct.initial)[0]).toEqual({
				at: expect.any(String),
				open: false
			});
		});
	});
}

test.describe('Correcting the address of one assessment at 1440', () => {
	test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

	test('moves the statement to another intention and refuses one the fact already stands for', async ({
		page
	}) => {
		test.setTimeout(150_000);
		await loadTime(page, { manifest: null });
		await captureIntention(page, 'План А');
		await captureIntention(page, 'План Б');
		await captureIntention(page, 'План В');
		await startCapture(page);
		await title(page).fill('Факт Р');
		await mode(page, 'evidence').click();
		await editor(page).getByTestId('result-pick').click();
		await editor(page).getByTestId('result-picker').getByTestId('result-search').fill('План А');
		await editor(page).getByTestId('result-candidate').click();
		await outcome(page, 'План А').selectOption('completed');
		await editor(page).getByTestId('result-picker-close').click();
		// The same fact also stands for Б, which is what makes the refusal below real.
		await mode(page, 'evidence').click();
		await editor(page).getByTestId('result-pick').click();
		await editor(page).getByTestId('result-picker').getByTestId('result-search').fill('План Б');
		await editor(page).getByTestId('result-candidate').click();
		await editor(page).getByTestId('result-picker-close').click();
		await closeBox(page, 'План Б').check();
		await expect(target(page, 'План А')).toBeVisible();
		await editor(page).getByTestId('capture-save').click();
		await expect(panel(page).getByTestId('selected-title')).toHaveText('Факт Р');
		const links = await openLinks(page);
		await links.getByTestId('link-target').filter({ hasText: 'План А' }).click();
		await showOverview(page);
		await expect(panel(page).getByTestId('selected-title')).toHaveText('План А');
		const result = await openResult(page);
		await expect(result.getByTestId('result-outcome')).toContainText('Выполнено');
		await openSources(result);
		await result.getByTestId('source-retarget').click();
		// Б already stands for this fact: the correction refuses whole, changing neither side.
		await result.getByTestId('retarget-search').fill('План Б');
		await result.getByTestId('retarget-candidate').click();
		await expect(result.getByTestId('retarget-error')).toContainText('уже есть действующая связь');
		await expect(result.getByTestId('result-outcome')).toContainText('Выполнено');
		await page.screenshot({ path: `${ARTIFACTS}/i5a-retarget-refused-1440.png`, fullPage: true });
		// В is free: the statement moves there and А keeps no statement of its own.
		await result.getByTestId('retarget-search').fill('План В');
		await result.getByTestId('retarget-candidate').click();
		await expect(result.getByTestId('retarget')).toHaveCount(0);
		await expect(result.getByTestId('result-outcome')).toContainText('Итог не оценён');
		await expect(result.getByTestId('result-source')).toHaveCount(0);
		// The fact carries the moved link now; its Context is how the new target is reached.
		await selectRecord(page, /Факт Р/);
		await showOverview(page);
		const factLinks = await openLinks(page);
		await expect(factLinks.getByTestId('link-target')).toHaveCount(2);
		await factLinks.getByTestId('link-target').filter({ hasText: 'План В' }).click();
		await showOverview(page);
		const moved = await openResult(page);
		await expect(moved.getByTestId('result-outcome')).toContainText('Выполнено');
		await expect(moved.getByTestId('result-source')).toHaveCount(1);
		await expect(moved.getByTestId('source-fact')).toContainText('Факт Р');
	});
});
