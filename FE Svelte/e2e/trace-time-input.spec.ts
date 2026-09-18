import { expect, test } from '@playwright/test';
import { exportBackup } from './public/helpers';
import { decoded, digits, openCapture, revealTrace, settle } from './trace-time-input.helpers';

test.use({ locale: 'ru-RU', timezoneId: 'Europe/Belgrade', actionTimeout: 5000 });
for (const width of [1440, 390]) {
	test(`real trace saves, reloads and edits one chosen time representation at ${width}`, async ({
		page
	}) => {
		test.setTimeout(60000);
		await page.setViewportSize({ width, height: 900 });
		const errors: string[] = [];
		page.on('pageerror', (e) => errors.push(e.message));
		await openCapture(page);
		const camera = await page
			.getByTestId('time-workbench')
			.evaluate((el) => [el.getAttribute('data-window-start'), el.getAttribute('data-window-end')]);
		await page.getByTestId('detail-duration').click();
		await digits(page, 'Часы', 'abc2');
		await digits(page, 'Минуты', 'abc30');
		await expect(page.getByTestId('picker-start')).toContainText('2 ч 30 мин');
		await page.getByTestId('choose-timeline').click();
		await settle(page);
		const bench = page.getByTestId('time-workbench');
		if (width < 600)
			await expect(page.getByTestId('bottom-sheet')).toHaveAttribute('data-position', 'peek');
		await page.getByRole('button', { name: 'Выбрать 10 сентября', exact: true }).click();
		await page.getByTestId('choose-picker').click();
		await settle(page);
		await page.getByRole('button', { name: 'Применить время', exact: true }).click();
		await expect(page.getByLabel('Название', { exact: true })).toHaveValue('Сегодня чтение C10');
		expect(
			await page
				.getByTestId('time-workbench')
				.evaluate((el) => [
					el.getAttribute('data-window-start'),
					el.getAttribute('data-window-end')
				])
		).toEqual(camera);
		await page.getByTestId('capture-save').click();
		await expect(page.getByTestId('context-overview')).toContainText('2 ч 30 мин');
		let backup = await exportBackup(page);
		const created = backup.collections.traces.find(
			(trace: { content: string }) => trace.content === 'Сегодня чтение C10'
		);
		expect(decoded(created)).toMatchObject({
			aboutKind: 'interval',
			aboutTime: { basis: 'absolute', precision: 'day', start: '2026-09-10', end: null },
			statedDuration: { amount: 150, unit: 'minute' }
		});
		await page.reload();
		await revealTrace(page, created.id);
		await page.getByTestId('edit-trace').click();
		await page.getByTestId('trace-time').click();
		await expect(page.getByTestId('detail-duration')).toHaveAttribute('aria-pressed', 'true');
		await page.getByTestId('detail-clock').click();
		await digits(page, 'Часы', '09');
		await page.getByTestId('picker-add-end').click();
		await page.getByTestId('choose-timeline').click();
		await settle(page);
		await expect(page.getByTestId('pending-end')).toBeVisible();
		await page.getByTestId('choose-picker').click();
		await digits(page, 'Часы', '12');
		await expect(page.getByRole('status').filter({ hasText: 'По границам' })).toContainText('3 ч');
		await page.getByRole('button', { name: 'Применить 3 ч', exact: true }).click();
		await page.getByTestId('edit-save').click();
		backup = await exportBackup(page);
		const changed = backup.collections.traces.find(
			(trace: { id: string }) => trace.id === created.id
		);
		expect(decoded(changed)).toMatchObject({
			aboutKind: 'interval',
			statedDuration: null,
			aboutTime: {
				precision: 'minute',
				start: '2026-09-10T07:00:00.000Z',
				end: '2026-09-10T10:00:00.000Z'
			}
		});
		await page.reload();
		await revealTrace(page, created.id);
		await page.getByTestId('edit-trace').click();
		await page.getByTestId('trace-time').click();
		await page.getByTestId('detail-duration').click();
		await expect(page.getByTestId('picker-start')).toContainText('3 ч');
		await page.screenshot({ path: `e2e/artifacts/trace-duration-${width}.png` });
		await page.getByRole('button', { name: 'Отменить изменение времени', exact: true }).click();
		await expect(page.getByTestId('trace-time')).toContainText('09:00');
		await page.getByTestId('trace-time').click();
		await page.getByTestId('picker-end').click();
		await page.getByTestId('picker-calendar').click();
		await page.getByRole('gridcell', { name: 'пятница, 11 сентября 2026 г.', exact: true }).click();
		await digits(page, 'Минуты', '15');
		await expect(page.getByTestId('time-picker')).toContainText('27 ч 15 мин');
		await page.getByRole('button', { name: 'Применить время', exact: true }).click();
		await page.getByTestId('edit-save').click();
		const nextDay = await exportBackup(page);
		expect(
			decoded(nextDay.collections.traces.find((trace: { id: string }) => trace.id === created.id))
		).toMatchObject({
			statedDuration: null,
			aboutTime: { start: '2026-09-10T07:00:00.000Z', end: '2026-09-11T10:15:00.000Z' }
		});
		expect(errors).toEqual([]);
		await expect(bench).toHaveAttribute('data-status', 'ready');
	});
}

test('small Context preserves text through cancellation and never invents a date for unknown duration', async ({
	page
}) => {
	await page.setViewportSize({ width: 320, height: 568 });
	await openCapture(page, 'Чтение без даты C10');
	await page.getByText('Уточнить дату…', { exact: true }).click();
	await page.getByRole('button', { name: 'Дата неизвестна', exact: true }).click();
	await page.getByTestId('detail-duration').click();
	await digits(page, 'Часы', '2');
	await digits(page, 'Минуты', '30');
	await page.getByTestId('choose-timeline').click();
	await settle(page);
	await expect(page.getByTestId('handle-start')).toHaveCount(0);
	await page.getByTestId('choose-picker').click();
	await settle(page);
	const footer = await page.getByTestId('mobile-actions').boundingBox();
	expect(footer!.y + footer!.height).toBeLessThanOrEqual(568);
	await page.screenshot({ path: 'e2e/artifacts/trace-unknown-320.png' });
	await page.getByRole('button', { name: 'Применить время', exact: true }).click();
	await page.getByTestId('capture-save').click();
	await expect(page.getByTestId('context-overview')).toContainText('время неизвестно · 2 ч 30 мин');
	const backup = await exportBackup(page);
	expect(
		decoded(
			backup.collections.traces.find(
				(trace: { content: string }) => trace.content === 'Чтение без даты C10'
			)
		)
	).toMatchObject({
		aboutTime: { basis: 'unknown' },
		statedDuration: { amount: 150, unit: 'minute' }
	});
	await page.getByTestId('edit-trace').click();
	await page.getByTestId('trace-time').click();
	await expect(page.getByTestId('picker-start')).toContainText('Дата неизвестна');
	await page.setViewportSize({ width: 320, height: 360 });
	await page.getByRole('button', { name: 'Применить время', exact: true }).click();
	// The same time applied again is no change: the save stays off and the record untouched.
	await expect(page.getByTestId('edit-save')).toBeDisabled();
	await page.getByRole('button', { name: 'Отмена', exact: true }).click();
	const after = await exportBackup(page);
	const saved = after.collections.traces.find(
		(trace: { content: string }) => trace.content === 'Чтение без даты C10'
	);
	expect(saved).toEqual({
		...backup.collections.traces.find((trace: { id: string }) => trace.id === saved.id),
		updatedAt: expect.any(String)
	});
});
