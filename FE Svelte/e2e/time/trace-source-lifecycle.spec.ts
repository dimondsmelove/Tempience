import { expect, test, type Page } from '@playwright/test';
import { exportBackup } from '../public/helpers';
import { ARTIFACTS, cleanConsole } from './draft.helpers';
import { loadTime } from './helpers';
import { captureIntention, editSource, panel } from './results.helpers';

cleanConsole(test, 'i5b-console-source.log');

const openResult = async (page: Page) => {
	const tab = panel(page).getByRole('tab', { name: 'Результат' });
	if (await tab.count()) await tab.click();
	return panel(page).getByTestId('intention-result');
};

const sources = (page: Page) =>
	(
		exportBackup(page) as Promise<{
			collections: {
				intentionAssessments: {
					id: string;
					initial: Record<string, { at: string; outcome?: string; open?: boolean }>;
					values?: { outcome?: { value: string | null }; open?: { value: boolean | null } };
					isDeleted?: boolean;
				}[];
			};
		}>
	).then((backup) => backup.collections.intentionAssessments);

test.describe('What can still be done with a direct statement at 1440', () => {
	test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

	test('is corrected, withdrawn and brought back, keeping its identity and its first time', async ({
		page
	}) => {
		test.setTimeout(180_000);
		await loadTime(page, { manifest: null });
		await captureIntention(page, 'План Л1');
		const result = await openResult(page);
		await result.getByTestId('result-assess').click();
		await result.getByTestId('direct-outcome').selectOption('completed');
		await result.getByTestId('direct-close').check();
		await result.getByTestId('direct-save').click();
		await expect(result.getByTestId('result-outcome')).toContainText('Выполнено');
		const [first] = await sources(page);
		expect(Object.values(first.initial)[0]).toMatchObject({ outcome: 'completed', open: false });
		// A correction of what it says: the same statement, not a second one.
		await editSource(result);
		await result.getByTestId('source-outcome').selectOption('partial');
		await result.getByTestId('source-correct').click();
		await expect(result.getByTestId('result-outcome')).toContainText('Частично выполнено');
		await expect(result.getByTestId('result-source')).toHaveCount(1);
		let rows = await sources(page);
		expect(rows).toHaveLength(1);
		expect(rows[0].id).toBe(first.id);
		expect(rows[0].initial).toEqual(first.initial);
		expect(rows[0].values?.outcome?.value).toBe('partial');
		// Its openness is cleared on its own, with the corrected outcome left alone.
		await editSource(result);
		await result.getByTestId('source-open-clear').click();
		await result.getByTestId('source-correct').click();
		await expect(result.getByTestId('result-open')).toHaveAttribute('data-open', 'open');
		await expect(result.getByTestId('result-outcome')).toContainText('Частично выполнено');
		rows = await sources(page);
		expect(rows[0].values?.open?.value).toBeNull();
		expect(rows[0].values?.outcome?.value).toBe('partial');
		await page.screenshot({ path: `${ARTIFACTS}/i5b-source-correct-1440.png`, fullPage: true });
		// Withdrawing it takes it out of the result while the row itself stays readable.
		await editSource(result);
		await result.getByTestId('source-withdraw').click();
		await expect(result.getByTestId('result-outcome')).toContainText('Итог не оценён');
		await expect(result.getByTestId('source-inactive')).toHaveText('оценка снята');
		rows = await sources(page);
		expect(rows).toHaveLength(1);
		expect(rows[0].isDeleted).toBe(true);
		// Bringing it back later is an ordinary action of its own, and it returns as it was.
		await page.getByTestId('undo-toast').getByRole('button', { name: 'Закрыть' }).click();
		await editSource(result);
		await result.getByTestId('source-restore').click();
		await expect(result.getByTestId('result-outcome')).toContainText('Частично выполнено');
		rows = await sources(page);
		expect(rows).toHaveLength(1);
		expect(rows[0].isDeleted ?? false).toBe(false);
		expect(rows[0].initial).toEqual(first.initial);
	});

	test('can be taken back right after it was withdrawn', async ({ page }) => {
		test.setTimeout(150_000);
		await loadTime(page, { manifest: null });
		await captureIntention(page, 'План Л2');
		const result = await openResult(page);
		await result.getByTestId('result-assess').click();
		await result.getByTestId('direct-outcome').selectOption('not_completed');
		await result.getByTestId('direct-save').click();
		await expect(result.getByTestId('result-outcome')).toContainText('Не выполнено');
		await editSource(result);
		await result.getByTestId('source-withdraw').click();
		await expect(result.getByTestId('result-outcome')).toContainText('Итог не оценён');
		// The one offer takes the withdrawal back through its own operation.
		await page.getByTestId('undo-toast').getByTestId('undo').click();
		await expect(page.getByTestId('undo-toast')).toHaveCount(0);
		await expect(result.getByTestId('result-outcome')).toContainText('Не выполнено');
		const rows = await sources(page);
		expect(rows).toHaveLength(1);
		expect(rows[0].isDeleted ?? false).toBe(false);
	});
});
