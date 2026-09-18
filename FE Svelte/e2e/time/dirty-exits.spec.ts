import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { ARTIFACTS, dialog, editor, title } from './draft.helpers';
import { HISTORY_BACKUP } from './kind-history.helpers';

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

/**
 * S19 before a reloading exit: a form with input stands open while a backup is loaded into a
 * database of its own. Opening that database reloads the app, so it asks first; keeping the
 * input keeps the current space and the input; discarding opens the new space.
 */
test('opening a loaded backup asks about the open input first; kept, the space and the input stay', async ({
	page
}) => {
	test.setTimeout(120_000);
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	// The default space, as a user opens it: the harness's own space would be re-chosen by its
	// init script on every reload and hide where the exit lands.
	await page.addInitScript(() => localStorage.setItem('chronograph-theme', 'dark'));
	await page.goto('/time');
	await expect(page.getByTestId('time-workbench')).toHaveAttribute('data-status', 'ready', {
		timeout: 20_000
	});
	await page.getByTestId('capture').click();
	await title(page).fill('Ввод перед открытием базы');
	const switcher = page.getByTestId('data-space-switcher');
	const current = await switcher.inputValue();
	await page.getByRole('button', { name: /Синхронизация:/ }).click();
	await page.getByLabel('JSON-файл с данными').setInputFiles({
		name: 'kind-history.json',
		mimeType: 'application/json',
		buffer: readFileSync(HISTORY_BACKUP)
	});
	await expect(page.getByTestId('backup-import-preview')).toContainText('137 записей');
	await page.getByRole('button', { name: 'Создать базу из файла', exact: true }).click();
	// The database is created by a command that succeeded; opening it — the reloading exit —
	// asks first, and refusing leaves the new space saved for later, the input in place.
	await expect(dialog(page)).toBeVisible();
	// The question stands in the middle of the viewport, not in its corner.
	const box = (await dialog(page).boundingBox())!;
	expect(Math.abs(box.x + box.width / 2 - 720)).toBeLessThan(40);
	expect(Math.abs(box.y + box.height / 2 - 450)).toBeLessThan(60);
	await page.screenshot({ path: `${ARTIFACTS}/i7-dirty-exit-backup-open-1440.png` });
	await dialog(page).getByTestId('discard-keep').click();
	await expect(dialog(page)).toHaveCount(0);
	await expect(switcher).toHaveValue(current);
	await expect(title(page)).toHaveValue('Ввод перед открытием базы');
	await expect(editor(page)).toBeVisible();
	await expect(page.getByRole('button', { name: 'Открыть базу', exact: true })).toBeVisible();
	// Discarded, the exit proceeds: the new space opens, the form is gone.
	await page.getByRole('button', { name: 'Открыть базу', exact: true }).click();
	await expect(dialog(page)).toBeVisible();
	await Promise.all([
		page.waitForEvent('framenavigated', { predicate: (frame) => frame === page.mainFrame() }),
		dialog(page).getByTestId('discard-confirm').click()
	]);
	await expect(page.getByTestId('time-workbench')).toHaveAttribute('data-status', 'ready', {
		timeout: 20_000
	});
	await expect(switcher).toHaveValue(/^imported-/);
	await expect(editor(page)).toHaveCount(0);
	expect(errors).toEqual([]);
});
