import { expect, test, type Page } from '@playwright/test';
import { ARTIFACTS, cleanConsole, editor, title, mode } from './draft.helpers';
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

cleanConsole(test, 'i5b-console-history.log');

const openHistory = async (page: Page) => {
	const tab = panel(page).getByRole('tab', { name: 'История' });
	if (await tab.count()) await tab.click();
	return panel(page).getByTestId('context-history');
};

for (const width of [390, 1440]) {
	test.describe('The history of one record at ' + width, () => {
		test.use({
			viewport: { width, height: 900 },
			isMobile: width === 390,
			hasTouch: width === 390
		});

		test('shows its own changes and the relations of one operation together, with the old text readable', async ({
			page
		}) => {
			test.setTimeout(150_000);
			await loadTime(page, { manifest: null });
			await captureIntention(page, 'План Ж');
			await showOverview(page);
			await panel(page).getByTestId('add-result').click();
			await title(page).fill('Факт Ж');
			await editor(page).getByTestId('draft-description').fill('Первое описание');
			await outcome(page, 'План Ж').selectOption('partial');
			await editor(page).getByTestId('capture-save').click();
			await expect(panel(page).getByTestId('selected-title')).toHaveText('Факт Ж');
			// One save: the record, the link it made and the statement it wrote are one entry.
			let history = await openHistory(page);
			await expect(history.getByTestId('history-operation')).toHaveCount(1);
			const first = history.getByTestId('history-operation').first();
			await expect(first.getByTestId('history-item')).toHaveCount(3);
			await expect(first).toContainText('Запись');
			await expect(first).toContainText('Связь');
			await expect(first).toContainText('Оценка');
			await expect(first.getByTestId('history-cause')).toHaveText('действие пользователя');
			// An edit of its own text is a second operation, with the old text still readable.
			await showOverview(page);
			await panel(page).getByTestId('edit-trace').click();
			await editor(page).getByTestId('draft-description').fill('Второе описание');
			await editor(page).getByTestId('edit-save').click();
			await expect(panel(page).getByTestId('selected-description')).toHaveText('Второе описание');
			history = await openHistory(page);
			await expect(history.getByTestId('history-operation')).toHaveCount(2);
			const latest = history.getByTestId('history-operation').first();
			await expect(latest.getByTestId('history-before')).toHaveText('Первое описание');
			await expect(latest.getByTestId('history-after')).toHaveText('Второе описание');
			// The old text is ordinary selectable text, not an image or a control.
			const copied = await latest
				.getByTestId('history-before')
				.evaluate((node) => node.textContent);
			expect(copied).toBe('Первое описание');
			await page.screenshot({ path: `${ARTIFACTS}/i5b-history-${width}.png`, fullPage: true });
		});
	});
}

test.describe('The history of relations that are no longer there at 1440', () => {
	test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

	test('keeps a withdrawn link and a statement moved to another intention', async ({ page }) => {
		test.setTimeout(180_000);
		await loadTime(page, { manifest: null });
		await captureIntention(page, 'План З1');
		await captureIntention(page, 'План З2');
		await showOverview(page);
		await startCapture(page);
		await title(page).fill('Факт З');
		await mode(page, 'evidence').click();
		await editor(page).getByTestId('result-pick').click();
		await editor(page).getByTestId('result-picker').getByTestId('result-search').fill('План З1');
		await editor(page).getByTestId('result-candidate').click();
		await outcome(page, 'План З1').selectOption('completed');
		await editor(page).getByTestId('result-picker-close').click();
		await editor(page).getByTestId('capture-save').click();
		await expect(panel(page).getByTestId('selected-title')).toHaveText('Факт З');
		// The statement is corrected onto the other intention, from the fact's own links.
		const links = await openLinks(page);
		const row = links.getByTestId('link-row').filter({ hasText: 'План З1' });
		await row.getByTestId('source-retarget').click();
		await row.getByTestId('retarget-search').fill('План З2');
		await row.getByTestId('retarget-candidate').click();
		await expect(links.getByTestId('link-target').filter({ hasText: 'План З2' })).toHaveCount(1);
		// The fact's history keeps both: the link it no longer has and where the statement went.
		const history = await openHistory(page);
		await expect(history.getByTestId('history-operation')).toHaveCount(2);
		const correction = history.getByTestId('history-operation').first();
		await expect(correction).toContainText('Связь');
		await expect(correction).toContainText('Оценка');
		await expect(correction).toContainText('Адресат оценки');
		await page.screenshot({ path: `${ARTIFACTS}/i5b-history-retarget-1440.png`, fullPage: true });
		// A second correction moves the statement on, past the intention that held it.
		await captureIntention(page, 'План З3');
		await selectRecord(page, /Факт З/);
		await showOverview(page);
		const again = await openLinks(page);
		const moved = again.getByTestId('link-row').filter({ hasText: 'План З2' });
		await moved.getByTestId('source-retarget').click();
		await moved.getByTestId('retarget-search').fill('План З3');
		await moved.getByTestId('retarget-candidate').click();
		await expect(again.getByTestId('link-target').filter({ hasText: 'План З3' })).toHaveCount(1);
		// «План З2» held that statement for a while, and its own history says so, by name.
		await selectParked(page, /План З2/);
		const passed = await openHistory(page);
		// Its own creation, the statement's, the correction that brought it and the one that took
		// it away: the whole life of a statement that stood here is how this intention came to be.
		await expect(passed.getByTestId('history-operation')).toHaveCount(4);
		await expect(passed).toContainText('Адресат оценки');
		for (const name of ['План З1', 'План З2', 'План З3'])
			await expect(passed.getByTestId('history-change').filter({ hasText: name })).not.toHaveCount(
				0
			);
		// No identifier anyone never entered is offered as the history of anything.
		await expect(
			passed.getByTestId('history-change').filter({ hasText: /^[0-9a-f-]{20,}/ })
		).toHaveCount(0);
		await page.screenshot({ path: `${ARTIFACTS}/i5b-rev-history-passed-1440.png`, fullPage: true });
	});
});
