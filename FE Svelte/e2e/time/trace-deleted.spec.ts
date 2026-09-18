import { expect, test, type Page } from '@playwright/test';
import { exportBackup } from '../public/helpers';
import { ARTIFACTS, cleanConsole, editor, title } from './draft.helpers';
import { loadTime } from './helpers';
import { openLinks, panel, selectRecord, showOverview, startCapture } from './results.helpers';

cleanConsole(test, 'i5b-console-deleted.log');

/** The Context at rest offers the records that are no longer on the timeline. */
const deletedList = async (page: Page) => {
	const body = panel(page);
	await body.getByTestId('deleted-open').click();
	return body.getByTestId('deleted-records');
};

for (const width of [390, 1440]) {
	test.describe('A record that is not on the timeline any more at ' + width, () => {
		test.use({
			viewport: { width, height: 900 },
			isMobile: width === 390,
			hasTouch: width === 390
		});

		test('is listed, read as it stands, and brought back by an ordinary action', async ({
			page
		}) => {
			test.setTimeout(180_000);
			await loadTime(page, { manifest: null });
			await startCapture(page);
			await title(page).fill('Запись Х1');
			await editor(page).getByTestId('draft-description').fill('Описание до удаления');
			await editor(page).getByTestId('capture-save').click();
			await expect(panel(page).getByTestId('selected-title')).toHaveText('Запись Х1');
			await panel(page).getByTestId('delete-trace').click();
			// The ribbon shows what is; the deleted record is found where deleted records are.
			await expect(
				page.getByTestId('ribbon-twin').getByRole('button', { name: /Запись Х1/ })
			).toHaveCount(0);
			const list = await deletedList(page);
			await expect(list.getByTestId('deleted-record')).toHaveCount(1);
			await list.getByTestId('deleted-record').click();
			// Its own Context is read-only and says plainly what it is.
			await expect(panel(page).getByTestId('deleted-trace')).toBeVisible();
			await expect(panel(page).getByTestId('selected-title')).toHaveText('Запись Х1');
			await expect(panel(page).getByTestId('deleted-state')).toContainText('удалена');
			await expect(panel(page).getByTestId('selected-description')).toHaveText(
				'Описание до удаления'
			);
			await expect(panel(page).getByTestId('edit-trace')).toHaveCount(0);
			// Its own journal is there, including the deletion itself.
			await expect(panel(page).getByTestId('history-operation')).toHaveCount(2);
			await page.screenshot({ path: `${ARTIFACTS}/i5b-deleted-${width}.png`, fullPage: true });
			await panel(page).getByTestId('restore-trace').click();
			// Restoring is an ordinary later action: the record is back on the timeline and shown.
			await expect(panel(page).getByTestId('context-trace')).toBeVisible();
			await expect(panel(page).getByTestId('selected-title')).toHaveText('Запись Х1');
			if (width === 1440) {
				// The ribbon shows it again; on a phone the sheet covers the ribbon at this point.
				await expect(
					page.getByTestId('ribbon-twin').getByRole('button', { name: /Запись Х1/ })
				).toHaveCount(1);
			}
			const traces = (await exportBackup(page)).collections.traces as {
				content: string;
				isDeleted: boolean;
			}[];
			expect(traces.find((row) => row.content === 'Запись Х1')?.isDeleted).toBe(false);
		});
	});
}

test.describe('A supplement whose original was deleted at 1440', () => {
	test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

	test('is reached from the deleted original, and the original is brought back from there', async ({
		page
	}) => {
		test.setTimeout(180_000);
		await loadTime(page, { manifest: null });
		await startCapture(page);
		await title(page).fill('Оригинал Х2');
		await editor(page).getByTestId('capture-save').click();
		await panel(page).getByTestId('add-supplement').click();
		await title(page).fill('Уточнение Х2');
		await editor(page).getByTestId('capture-save').click();
		await expect(panel(page).getByTestId('selected-title')).toHaveText('Уточнение Х2');
		// The original goes; the supplement has no place of its own on the ribbon.
		await selectRecord(page, /Оригинал Х2/);
		await showOverview(page);
		await panel(page).getByTestId('delete-trace').click();
		const list = await deletedList(page);
		await list.getByTestId('deleted-record').filter({ hasText: 'Оригинал Х2' }).click();
		await expect(panel(page).getByTestId('deleted-trace')).toBeVisible();
		// From the deleted original its supplement is still reachable, without a ribbon entry.
		const links = panel(page).getByTestId('link-target');
		await expect(links.filter({ hasText: 'Уточнение Х2' })).toHaveCount(1);
		await links.filter({ hasText: 'Уточнение Х2' }).click();
		await expect(panel(page).getByTestId('selected-title')).toHaveText('Уточнение Х2');
		await expect(panel(page).getByTestId('supplement-status')).toHaveAttribute(
			'data-status',
			'valid'
		);
		await page.screenshot({ path: `${ARTIFACTS}/i5b-deleted-original-1440.png`, fullPage: true });
		// Back through its own link to the deleted original, which is restored from there.
		const supplementLinks = await openLinks(page);
		await supplementLinks.getByTestId('link-target').click();
		await expect(panel(page).getByTestId('deleted-trace')).toBeVisible();
		await panel(page).getByTestId('restore-trace').click();
		await expect(panel(page).getByTestId('context-trace')).toBeVisible();
		await expect(panel(page).getByTestId('selected-title')).toHaveText('Оригинал Х2');
	});
});
