import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { exportBackup } from './helpers';

test.skip(process.env.PUBLIC_BUILD !== '1', 'Requires the public build.');
test.use({
	viewport: { width: 390, height: 844 },
	isMobile: true,
	hasTouch: true,
	acceptDownloads: true
});

const switchSpace = async (page: Page, id: string) => {
	await Promise.all([
		page.waitForEvent('framenavigated', { predicate: (frame) => frame === page.mainFrame() }),
		page.getByTestId('data-space-switcher').selectOption(id)
	]);
	await expect(page.getByTestId('time-workbench')).toHaveAttribute('data-status', 'ready');
};

test('imports a file into its own database and preserves both copies offline', async ({
	page,
	context,
	baseURL
}) => {
	const errors: string[] = [];
	const unexpected: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	page.on('websocket', (socket) => unexpected.push(socket.url()));
	context.on('request', (request) => {
		const url = new URL(request.url());
		if (
			['http:', 'https:'].includes(url.protocol) &&
			(url.origin !== new URL(baseURL!).origin || /^\/(api|packs)(\/|$)/.test(url.pathname))
		)
			unexpected.push(request.url());
	});
	await page.goto('/');
	await page.getByRole('button', { name: 'Начать', exact: true }).click();
	await page.getByRole('textbox', { name: 'Название группы' }).fill('Моя группа до импорта');
	await page.getByRole('button', { name: 'Создать группу', exact: true }).click();
	const capture = page.getByTestId('context-capture');
	await expect(capture).toBeVisible();
	await capture
		.getByRole('textbox', { name: 'Название', exact: true })
		.fill('Моя запись до импорта');
	await capture.getByRole('button', { name: 'Сохранить', exact: true }).click();
	await expect(capture).toHaveCount(0);
	const personal = await exportBackup(page);
	const suppliedFile = process.env.TEMPIENCE_BACKUP_FILE;
	const input = suppliedFile
		? JSON.parse(await readFile(suppliedFile, 'utf8'))
		: {
				...personal,
				dataSpace: { id: personal.dataSpace.id, label: 'Данные из файла' }
			};

	await page.getByRole('button', { name: /Синхронизация:/ }).click();
	const picker = page.getByLabel('JSON-файл с данными');
	await picker.setInputFiles({
		name: 'broken.json',
		mimeType: 'application/json',
		buffer: Buffer.from('{')
	});
	await expect(page.getByRole('alert')).toContainText('Не удалось прочитать JSON');
	expect(
		await page.evaluate(
			() =>
				Object.keys(localStorage).filter((key) => key.startsWith('tempience.data-space.imported.'))
					.length
		)
	).toBe(0);

	await picker.setInputFiles({
		name: 'backup.json',
		mimeType: 'application/json',
		buffer: Buffer.from(JSON.stringify(input))
	});
	const preview = page.getByTestId('backup-import-preview');
	await expect(preview).toContainText(input.dataSpace.label);
	// One record, one group — in the plural forms one takes (the counts have them since #32).
	expect(input.collections.traces).toHaveLength(1);
	expect(input.collections.scopes).toHaveLength(1);
	await expect(preview).toContainText('1 запись · 1 группа');
	await expect(preview).toContainText('Текущие записи сохранятся');
	await preview.scrollIntoViewIfNeeded();
	const importButton = page.getByRole('button', { name: 'Создать базу из файла', exact: true });
	const colors = await importButton.evaluate((element) => {
		const style = getComputedStyle(element);
		return { text: style.color, background: style.backgroundColor };
	});
	expect(colors.text).not.toBe(colors.background);
	await page.screenshot({ path: 'e2e/artifacts/backup-import-preview-mobile.png' });
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.screenshot({ path: 'e2e/artifacts/backup-import-preview-desktop.png' });
	await page.setViewportSize({ width: 390, height: 844 });
	await Promise.all([
		page.waitForEvent('framenavigated', { predicate: (frame) => frame === page.mainFrame() }),
		page.getByRole('button', { name: 'Создать базу из файла', exact: true }).click()
	]);
	await expect(page.getByTestId('time-workbench')).toHaveAttribute('data-status', 'ready');
	const importedId = await page.getByTestId('data-space-switcher').inputValue();
	expect(importedId).toMatch(/^imported-/);
	expect(importedId).not.toBe(input.dataSpace.id);
	expect((await exportBackup(page)).collections).toEqual(input.collections);
	await page.screenshot({ path: 'e2e/artifacts/backup-import-result-mobile.png' });

	await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
	await context.setOffline(true);
	await page.reload();
	await expect(page.getByTestId('time-workbench')).toHaveAttribute('data-status', 'ready');
	expect((await exportBackup(page)).collections).toEqual(input.collections);
	await switchSpace(page, 'canonical');
	expect((await exportBackup(page)).collections).toEqual(personal.collections);
	await switchSpace(page, importedId);
	expect((await exportBackup(page)).collections).toEqual(input.collections);
	expect(errors).toEqual([]);
	expect(unexpected).toEqual([]);
});
