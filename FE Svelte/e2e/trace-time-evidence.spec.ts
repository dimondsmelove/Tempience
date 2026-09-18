import { expect, test } from '@playwright/test';
import { exportBackup } from './public/helpers';
import { decoded, digits, openCapture, revealTrace, settle } from './trace-time-input.helpers';

test.use({ locale: 'ru-RU', timezoneId: 'Europe/Belgrade', actionTimeout: 5000 });
test('possible start and stated calendar days survive save, file transfer, reload and editing', async ({
	page
}) => {
	test.setTimeout(60000);
	await page.setViewportSize({ width: 390, height: 844 });
	const errors: string[] = [];
	page.on('pageerror', (e) => errors.push(e.message));
	await openCapture(page, 'Сегодня путешествие C10');
	await page.getByTestId('picker-calendar').click();
	await page.getByRole('gridcell', { name: 'вторник, 1 сентября 2026 г.', exact: true }).click();
	await page.getByTestId('detail-duration').click();
	await page.getByLabel('Единица длительности', { exact: true }).selectOption('day');
	await digits(page, 'Длительность', '4');
	await page.getByText('Уточнить дату…', { exact: true }).click();
	await page.getByLabel('Дата приблизительная').check();
	await page.getByRole('button', { name: 'Указать позднюю дату начала', exact: true }).click();
	await page.getByTestId('picker-calendar').click();
	await page.getByRole('gridcell', { name: 'четверг, 10 сентября 2026 г.', exact: true }).click();
	await expect(page.getByTestId('picker-end')).toContainText('Не позднее');
	await expect(page.getByTestId('picker-end')).toContainText('10 сентября');
	await page.getByTestId('choose-timeline').click();
	await settle(page);
	await expect(page.getByTestId('extend-end')).toHaveCount(0);
	await expect(page.getByTestId('handle-end')).toHaveAttribute('aria-label', /Не позднее/);
	await page.getByTestId('choose-picker').click();
	await settle(page);
	await page.screenshot({ path: 'e2e/artifacts/trace-start-window-mobile.png' });
	await page.getByRole('button', { name: 'Применить время', exact: true }).click();
	await page.getByTestId('capture-save').click();
	const backup = await exportBackup(page);
	const saved = backup.collections.traces.find(
		(trace: { content: string }) => trace.content === 'Сегодня путешествие C10'
	);
	expect(decoded(saved)).toMatchObject({
		aboutKind: 'interval',
		aboutTime: {
			basis: 'absolute',
			precision: 'day',
			certainty: 'approximate',
			start: '2026-09-01',
			end: '2026-09-10'
		},
		statedDuration: { amount: 4, unit: 'day' },
		aboutAt: null,
		aboutEnd: null
	});
	await page.getByRole('button', { name: /Синхронизация:/ }).click();
	await page.getByLabel('JSON-файл с данными').setInputFiles({
		name: 'time-backup.json',
		mimeType: 'application/json',
		buffer: Buffer.from(JSON.stringify(backup))
	});
	await expect(page.getByTestId('backup-import-preview')).toBeVisible();
	await Promise.all([
		page.waitForEvent('framenavigated', { predicate: (f) => f === page.mainFrame() }),
		page.getByRole('button', { name: 'Создать базу из файла', exact: true }).click()
	]);
	await expect(page.getByTestId('time-workbench')).toHaveAttribute('data-status', 'ready');
	expect(await page.evaluate(() => localStorage.getItem('tempience.data-space.active'))).toMatch(
		/^imported-/
	);
	expect((await exportBackup(page)).collections).toEqual(backup.collections);
	await page.reload();
	await revealTrace(page, saved.id);
	await page.getByTestId('edit-trace').click();
	await page.getByTestId('trace-time').click();
	await expect(page.getByTestId('picker-start')).toContainText('Не ранее');
	await expect(page.getByTestId('picker-end')).toContainText('10 сентября');
	await digits(page, 'Длительность', '5');
	await page.getByRole('button', { name: 'Применить время', exact: true }).click();
	await page.getByTestId('edit-save').click();
	const after = await exportBackup(page);
	expect(
		decoded(after.collections.traces.find((trace: { id: string }) => trace.id === saved.id))
	).toMatchObject({
		aboutTime: decoded(saved).aboutTime,
		statedDuration: { amount: 5, unit: 'day' },
		aboutAt: null,
		aboutEnd: null
	});
	expect(errors).toEqual([]);
});

test('coarse month stays coarse until a day is chosen in the calendar', async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await openCapture(page, 'Сегодня месяц C10');
	await page.getByText('Уточнить дату…', { exact: true }).click();
	await page.getByLabel('Точность даты', { exact: true }).selectOption('month');
	await expect(page.getByRole('listbox', { name: 'Месяц', exact: true })).toBeVisible();
	await expect(page.getByRole('listbox', { name: 'Часы', exact: true })).toHaveCount(0);
	await page
		.getByRole('listbox', { name: 'Месяц', exact: true })
		.locator('[aria-selected=true]')
		.focus();
	await page.keyboard.press('ArrowDown');
	await page.getByTestId('detail-duration').click();
	await digits(page, 'Часы', '2');
	await page.getByRole('button', { name: 'Применить время', exact: true }).click();
	await page.getByTestId('capture-save').click();
	let backup = await exportBackup(page);
	let saved = backup.collections.traces.find(
		(trace: { content: string }) => trace.content === 'Сегодня месяц C10'
	);
	expect(decoded(saved)).toMatchObject({
		aboutTime: { precision: 'month', start: '2026-10', end: null },
		statedDuration: { amount: 120, unit: 'minute' }
	});
	await page.getByTestId('edit-trace').click();
	await page.getByTestId('trace-time').click();
	await page.getByTestId('picker-calendar').click();
	await page.getByRole('gridcell', { name: 'пятница, 9 октября 2026 г.', exact: true }).click();
	await page.getByRole('button', { name: 'Применить время', exact: true }).click();
	await page.getByTestId('edit-save').click();
	backup = await exportBackup(page);
	saved = backup.collections.traces.find((trace: { id: string }) => trace.id === saved.id);
	expect(decoded(saved)).toMatchObject({
		aboutTime: { precision: 'day', start: '2026-10-09', end: null },
		statedDuration: { amount: 120, unit: 'minute' }
	});
});
