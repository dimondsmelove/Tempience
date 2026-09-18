import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

test.skip(process.env.PUBLIC_BUILD === '1', 'Belgrade is available only in the owner build.');

const exportCollections = async (page: Page) => {
	await page.getByRole('button', { name: /Синхронизация:/ }).click();
	const [download] = await Promise.all([
		page.waitForEvent('download'),
		page.getByRole('button', { name: 'Экспортировать данные', exact: true }).click()
	]);
	const path = await download.path();
	if (!path) throw new Error('No export downloaded.');
	const backup = JSON.parse(await readFile(path, 'utf8'));
	await page.getByRole('button', { name: /Синхронизация:/ }).click();
	return backup.collections;
};

const switchSpace = async (page: Page, id: string): Promise<void> => {
	await Promise.all([
		page.waitForEvent('framenavigated', { predicate: (frame) => frame === page.mainFrame() }),
		page.getByTestId('data-space-switcher').selectOption(id)
	]);
	await expect(page.getByTestId('data-space-switcher')).toHaveValue(id);
};

test('loads a pack once on selection, keeps it offline and leaves personal data empty', async ({
	page,
	context
}) => {
	const packs: string[] = [];
	const errors: string[] = [];
	context.on('request', (request) => {
		if (new URL(request.url()).pathname.startsWith('/packs/')) packs.push(request.url());
	});
	page.on('pageerror', (error) => errors.push(error.message));
	await page.goto('/time');
	const workbench = page.getByTestId('time-workbench');
	await expect(workbench).toHaveAttribute('data-status', 'ready');
	await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
	const cachedPacks = await page.evaluate(async () => {
		const keys = await caches.keys();
		const requests = await Promise.all(keys.map(async (key) => (await caches.open(key)).keys()));
		return requests
			.flat()
			.filter((request) => new URL(request.url).pathname.startsWith('/packs/'))
			.map((request) => request.url);
	});
	expect(cachedPacks).toEqual([]);
	expect(packs).toEqual([]);

	await switchSpace(page, 'belgrade-what-if-v1');
	await expect(workbench).toHaveAttribute('data-status', 'ready');
	await expect
		.poll(() => page.evaluate(() => localStorage.getItem('tempience.belgrade.seed.v1')))
		.toBe('belgrade-life-source-first-v2');
	const installed = await exportCollections(page);
	expect(installed.traces).toHaveLength(177);
	expect(installed.scopes).toHaveLength(38);
	expect(packs).toHaveLength(1);

	await context.setOffline(true);
	await page.reload();
	await expect(workbench).toHaveAttribute('data-status', 'ready');
	expect(await exportCollections(page)).toEqual(installed);
	expect(packs).toHaveLength(1);

	await switchSpace(page, 'canonical');
	await expect(workbench).toHaveAttribute('data-status', 'ready');
	const personal = await exportCollections(page);
	expect(Object.values(personal).every((rows) => Array.isArray(rows) && rows.length === 0)).toBe(
		true
	);
	expect(errors).toEqual([]);
});
