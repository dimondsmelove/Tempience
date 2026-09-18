import { expect, test } from '@playwright/test';
import { exportBackup } from '../public/helpers';
import { ARTIFACTS, cleanConsole, editor, title } from './draft.helpers';
import { loadTime } from './helpers';
import {
	captureIntention,
	openLinks,
	panel,
	selectRecord,
	showOverview,
	startCapture
} from './results.helpers';

cleanConsole(test, 'i5a-console-supplement.log');

for (const width of [390, 1440]) {
	test.describe('A saved supplement at ' + width, () => {
		test.use({
			viewport: { width, height: 900 },
			isMobile: width === 390,
			hasTouch: width === 390
		});

		test('keeps its marker and its original when it is opened again, and is reachable from both sides', async ({
			page
		}) => {
			test.setTimeout(120_000);
			await loadTime(page, { manifest: null });
			await startCapture(page);
			await title(page).fill('Оригинал С');
			await editor(page).getByTestId('capture-save').click();
			await expect(panel(page).getByTestId('selected-title')).toHaveText('Оригинал С');
			await panel(page).getByTestId('add-supplement').click();
			await title(page).fill('Уточнение С');
			await editor(page).getByTestId('capture-save').click();
			await expect(panel(page).getByTestId('selected-title')).toHaveText('Уточнение С');
			await expect(panel(page).getByTestId('supplement-status')).toHaveAttribute(
				'data-status',
				'valid'
			);
			// Opened again, the record's own marker decides: no relation control, no date of its own.
			await panel(page).getByTestId('edit-trace').click();
			await expect(editor(page).getByTestId('supplement-fields')).toHaveAttribute(
				'data-status',
				'valid'
			);
			await expect(editor(page).getByTestId('draft-preset')).toContainText('Оригинал С');
			await expect(editor(page).getByTestId('trace-time')).toHaveCount(0);
			await expect(editor(page).getByTestId('draft-mode')).toHaveCount(0);
			await editor(page).getByTestId('draft-description').fill('Что именно уточняется');
			await page.screenshot({
				path: `${ARTIFACTS}/i5a-supplement-edit-${width}.png`,
				fullPage: true
			});
			await editor(page).getByTestId('edit-save').click();
			await expect(panel(page).getByTestId('selected-description')).toHaveText(
				'Что именно уточняется'
			);
			await expect(panel(page).getByTestId('selected-time')).toContainText('ссылка на запись');
			// Both sides reach each other, and the original stays an ordinary record on the ribbon.
			let links = await openLinks(page);
			await expect(links).toContainText('К чему возвращается');
			await links.getByTestId('link-target').click();
			await showOverview(page);
			await expect(panel(page).getByTestId('selected-title')).toHaveText('Оригинал С');
			links = await openLinks(page);
			await expect(links).toContainText('Возвращаются к этой');
			await expect(links.getByTestId('link-target')).toHaveCount(1);
			const backup = await exportBackup(page);
			const rows = backup.collections.traces as { content: string; aboutKind: string }[];
			expect(rows.find((row) => row.content === 'Уточнение С')).toMatchObject({
				aboutKind: 'trace_ref',
				relation: 'actual'
			});
		});
	});
}

test.describe('A link whose record was deleted at 1440', () => {
	test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

	test('stays a row of its own, says the record is deleted, and is counted where it is shown', async ({
		page
	}) => {
		test.setTimeout(120_000);
		await loadTime(page, { manifest: null });
		await captureIntention(page, 'План Д');
		await panel(page).getByTestId('add-result').click();
		await title(page).fill('Итог Д');
		await editor(page).getByTestId('capture-save').click();
		await expect(panel(page).getByTestId('selected-title')).toHaveText('Итог Д');
		await expect(panel(page).getByTestId('context-section-links')).toContainText('Связи · 1');
		let links = await openLinks(page);
		await links.getByTestId('link-target').click();
		await showOverview(page);
		await expect(panel(page).getByTestId('selected-title')).toHaveText('План Д');
		await panel(page).getByTestId('delete-trace').click();
		// The fact keeps its place on the ribbon, so it is walked back to; the plan does not.
		await selectRecord(page, /Итог Д/);
		await showOverview(page);
		await expect(panel(page).getByTestId('selected-title')).toHaveText('Итог Д');
		// The link is still listed, says what became of the other record, and is still counted.
		await expect(panel(page).getByTestId('context-section-links')).toContainText('Связи · 1');
		links = await openLinks(page);
		await expect(links.getByTestId('link-target')).toHaveCount(1);
		await expect(links.getByTestId('link-target')).toHaveAttribute('data-state', 'deleted');
		await expect(links.getByTestId('link-endpoint-state')).toHaveText('запись удалена');
		await expect(links.getByTestId('link-target')).toContainText('План Д');
		await page.screenshot({ path: `${ARTIFACTS}/i5a-deleted-endpoint-1440.png`, fullPage: true });
		// Its own text is still editable while the other record is deleted.
		await showOverview(page);
		await panel(page).getByTestId('edit-trace').click();
		await editor(page).getByTestId('draft-description').fill('Намерение удалено');
		await editor(page).getByTestId('edit-save').click();
		await expect(panel(page).getByTestId('selected-description')).toHaveText('Намерение удалено');
	});
});
