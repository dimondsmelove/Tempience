import { expect, test } from '@playwright/test';
import { instrumentBoundary, prepareBoundary, refuse } from './boundary.helpers';
import { editor, title } from './draft.helpers';
import { loadTime } from './helpers';
import { REPOSITORY, SKIP } from './locale-dev.helpers';
import { ARTIFACTS, switchTo } from './locale.helpers';
import { panel, startCapture } from './results.helpers';

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });
test.beforeEach(({ page }) => prepareBoundary(page));

test('a refused save and a committed record that could not be opened are worded in both languages; the retry opens without a second write', async ({
	page
}) => {
	test.setTimeout(120_000);
	await loadTime(page, { manifest: null });
	test.skip(!(await instrumentBoundary(page)), SKIP);
	await startCapture(page);
	await title(page).fill('Запись с отказом');
	await refuse(page, 'saveTraceRecord', 'title_required');
	await editor(page).getByTestId('capture-save').click();
	const saveError = editor(page).getByTestId('save-error');
	await expect(saveError).toHaveText('Не удалось сохранить: Укажите название записи.');
	await expect(title(page)).toHaveValue('Запись с отказом');
	await switchTo(page, 'en');
	await expect(saveError).toHaveText("Could not save: Enter the record's title.");
	await expect(editor(page).getByLabel('Title', { exact: true })).toHaveValue('Запись с отказом');
	await page.screenshot({ path: `${ARTIFACTS}/locale-dev-save-error-en.png` });

	// The retry writes the record; the reload that opens it refuses.
	await refuse(page, 'saveTraceRecord', false);
	await refuse(page, 'listTraceKinds', 'repository_unreadable');
	await editor(page).getByTestId('capture-save').click();
	const openError = editor(page).getByTestId('open-error');
	await expect(openError).toHaveText(
		'The record was saved, but could not be opened: Could not read the data.'
	);
	await switchTo(page, 'ru');
	await expect(openError).toHaveText(
		'Запись сохранена, но не удалось её открыть: Не удалось прочитать данные.'
	);
	await expect(editor(page).getByTestId('retry-open')).toHaveText('Открыть снова');
	await page.screenshot({ path: `${ARTIFACTS}/locale-dev-open-error-ru.png` });
	await refuse(page, 'listTraceKinds', false);
	await editor(page).getByTestId('retry-open').click();
	await expect(panel(page).getByTestId('selected-title')).toHaveText('Запись с отказом');
	expect(
		await page.evaluate(async (path) => {
			const { tempienceRepository } = await import(/* @vite-ignore */ window.__appModule!(path));
			return (await tempienceRepository.listTraces(true)).filter(
				(trace) => trace.content === 'Запись с отказом'
			).length;
		}, REPOSITORY)
	).toBe(1);
});

test('an Undo that became stale is refused in the language of the moment and rewords on a switch', async ({
	page
}) => {
	test.setTimeout(120_000);
	await loadTime(page, { manifest: null });
	test.skip(!(await instrumentBoundary(page)), SKIP);
	await startCapture(page);
	await title(page).fill('Запись С');
	await editor(page).getByTestId('capture-save').click();
	await expect(panel(page).getByTestId('selected-title')).toHaveText('Запись С');
	await panel(page).getByTestId('delete-trace').click();
	const toast = page.getByTestId('undo-toast');
	await expect(toast).toBeVisible();
	// The record comes back behind the offer's back: the offer is now about a changed record.
	await page.evaluate(async (path) => {
		const { tempienceRepository } = await import(/* @vite-ignore */ window.__appModule!(path));
		const deleted = (await tempienceRepository.listTraces(true)).find(
			(trace) => trace.content === 'Запись С' && trace.isDeleted
		);
		if (!deleted) throw new Error('The deleted record was not found.');
		await tempienceRepository.setTraceDeleted(deleted.id, false);
	}, REPOSITORY);
	await toast.getByTestId('undo').click();
	const refusal = toast.getByTestId('undo-error');
	await expect(refusal).toHaveText(
		'Не удалось отменить: Отмена невозможна: запись изменилась после этого действия.'
	);
	await switchTo(page, 'en');
	await expect(refusal).toHaveText(
		'Could not undo: Cannot undo: the record changed after this action.'
	);
	await expect(toast.getByTestId('undo')).toHaveText('Undo');
	await page.screenshot({ path: `${ARTIFACTS}/locale-dev-undo-stale-en.png` });
	await switchTo(page, 'ru');
	await expect(refusal).toHaveText(
		'Не удалось отменить: Отмена невозможна: запись изменилась после этого действия.'
	);
});

test('a restored record that could not be shown says so in both languages; the retry shows it', async ({
	page
}) => {
	test.setTimeout(120_000);
	await loadTime(page, { manifest: null });
	test.skip(!(await instrumentBoundary(page)), SKIP);
	await startCapture(page);
	await title(page).fill('Запись В');
	await editor(page).getByTestId('capture-save').click();
	await expect(panel(page).getByTestId('selected-title')).toHaveText('Запись В');
	await panel(page).getByTestId('delete-trace').click();
	await expect(page.getByTestId('undo-toast')).toBeVisible();
	await panel(page).getByTestId('deleted-open').click();
	await panel(page).getByTestId('deleted-records').getByTestId('deleted-record').first().click();
	await expect(panel(page).getByTestId('deleted-trace')).toBeVisible();
	// The restore commits; the reading after it refuses until asked again.
	await refuse(page, 'listTraceKinds', 'repository_unreadable');
	await panel(page).getByTestId('restore-trace').click();
	const notShown = panel(page).getByTestId('restore-not-shown');
	await expect(notShown).toContainText(
		'Запись восстановлена, но не удалось показать результат: Не удалось прочитать данные.'
	);
	await switchTo(page, 'en');
	await expect(notShown).toContainText(
		'The record was restored, but the result could not be shown: Could not read the data.'
	);
	await expect(notShown.getByTestId('restore-retry')).toHaveText('Retry reading');
	await page.screenshot({ path: `${ARTIFACTS}/locale-dev-restore-not-shown-en.png` });
	await refuse(page, 'listTraceKinds', false);
	await notShown.getByTestId('restore-retry').click();
	await expect(notShown).toHaveCount(0);
	await expect(panel(page).getByTestId('selected-title')).toHaveText('Запись В');
	await expect(panel(page).getByTestId('context-overview')).toBeVisible();
	await switchTo(page, 'ru');
});
