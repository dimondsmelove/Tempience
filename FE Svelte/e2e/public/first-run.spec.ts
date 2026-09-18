import { expect, test } from '@playwright/test';
import { exportBackup } from './helpers';

test.skip(process.env.PUBLIC_BUILD !== '1', 'Requires the isolated public build.');
test.use({
	viewport: { width: 390, height: 844 },
	isMobile: true,
	hasTouch: true,
	acceptDownloads: true
});

test('starts with empty personal data, creates the first record and preserves it offline', async ({
	page,
	context,
	baseURL
}) => {
	const errors: string[] = [];
	const unexpectedRequests: string[] = [];
	const sockets: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	context.on('request', (request) => {
		const url = new URL(request.url());
		if (
			['http:', 'https:'].includes(url.protocol) &&
			(url.origin !== new URL(baseURL!).origin || url.pathname.startsWith('/api/'))
		) {
			unexpectedRequests.push(request.url());
		}
	});
	page.on('websocket', (socket) => sockets.push(socket.url()));

	await page.goto('/time?from=bookmark');
	await expect(page).toHaveURL(/\/\?from=bookmark$/);
	await expect(page.getByRole('region', { name: 'Первый запуск', exact: true })).toBeVisible();
	await page.screenshot({ path: 'e2e/artifacts/public-first-run.png' });
	await expect(page.getByRole('navigation', { name: 'Поверхности' })).toHaveCount(0);
	await expect(page.getByRole('link', { name: 'Pair', exact: true })).toHaveCount(0);
	await page.getByRole('button', { name: /Синхронизация:/ }).click();
	await page.getByRole('status').getByRole('link', { name: 'Pair', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Синхронизация не настроена' })).toBeVisible();
	await page.goto('/');
	await expect(page.getByRole('region', { name: 'Первый запуск', exact: true })).toBeVisible();
	const empty = await exportBackup(page);
	expect(
		Object.values(empty.collections).every((rows) => Array.isArray(rows) && rows.length === 0)
	).toBe(true);

	await page.getByRole('button', { name: 'Начать', exact: true }).click();
	await page.getByRole('textbox', { name: 'Название группы' }).fill('Первый проект');
	await page.getByRole('button', { name: 'Создать группу', exact: true }).click();
	const capture = page.getByTestId('context-capture');
	await expect(capture).toBeVisible();
	// The created group is the entry Scope of the form: selected, shown as a chip, removable.
	await expect(capture.getByRole('list', { name: 'Выбранные Scope' })).toHaveText(/Первый проект/);
	await capture
		.getByRole('textbox', { name: 'Название', exact: true })
		.fill('Сегодня прогулка с друзьями');
	await capture.getByRole('button', { name: 'Сохранить', exact: true }).click();
	await expect(capture).toHaveCount(0);

	const backup = await exportBackup(page);
	expect(backup.format).toBe('tempience.data-space.v1');
	expect(backup.collections.scopes).toHaveLength(1);
	expect(backup.collections.scopes[0].name).toBe('Первый проект');
	expect(backup.collections.traces).toHaveLength(1);
	expect(backup.collections.traces[0].content).toContain('прогулка с друзьями');
	expect(backup.collections.intersections).toContainEqual(
		expect.objectContaining({
			fromId: backup.collections.traces[0].id,
			toId: backup.collections.scopes[0].id
		})
	);

	await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
	await context.setOffline(true);
	await page.reload();
	await expect(page.getByRole('region', { name: 'Первый запуск', exact: true })).toHaveCount(0);
	await expect(page.getByRole('region', { name: 'Time', exact: true })).toBeVisible();
	const restored = await exportBackup(page);
	expect(restored.collections).toEqual(backup.collections);
	expect(errors).toEqual([]);
	expect(unexpectedRequests).toEqual([]);
	expect(sockets).toEqual([]);
});
