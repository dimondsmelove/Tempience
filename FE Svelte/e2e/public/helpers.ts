import { readFile } from 'node:fs/promises';
import { expect, type Page } from '@playwright/test';

export const exportBackup = async (page: Page) => {
	await page.getByRole('button', { name: /Синхронизация:/ }).click();
	const [download] = await Promise.all([
		page.waitForEvent('download'),
		page.getByRole('button', { name: 'Экспортировать данные', exact: true }).click()
	]);
	const file = await download.path();
	if (!file) throw new Error('The backup download did not produce a file.');
	const backup = JSON.parse(await readFile(file, 'utf8'));
	await expect(page.getByRole('alert')).toHaveCount(0);
	await page.getByRole('button', { name: /Синхронизация:/ }).click();
	return backup;
};
