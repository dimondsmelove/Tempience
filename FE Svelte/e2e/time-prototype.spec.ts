import { expect, test, type Page } from '@playwright/test';

test.use({ timezoneId: 'Europe/Belgrade', locale: 'ru-RU', actionTimeout: 5000 });

async function clock(page: Page, hours: string, minutes = '00') {
	await page.getByTestId('clock-open').click();
	await page.getByRole('option', { name: `Часы: ${hours}`, exact: true }).click();
	await page.getByRole('option', { name: `Минуты: ${minutes}`, exact: true }).click();
	await page.locator('.clock-panel').getByRole('button', { name: 'Готово', exact: true }).click();
}
for (const width of [1280, 390]) {
	test(`one rail, independent endpoints and draft cancellation at ${width}`, async ({ page }) => {
		await page.setViewportSize({ width, height: 900 });
		await page.clock.install({ time: new Date('2026-09-09T10:00:00+02:00') });
		await page.goto('/experiments/time-input?view=field');
		await page.getByLabel('Что произошло?').fill('Встреча и дорога домой');
		await page.getByTestId('when-field').click();
		await page.getByTestId('choose-timeline').click();
		const draft = page.getByTestId('time-prototype');
		const start = await draft.getAttribute('data-start');
		await page.getByRole('button', { name: 'Приблизить шкалу', exact: true }).click();
		await expect(draft).toHaveAttribute('data-start', start!);
		await expect(draft).toHaveAttribute('data-timed', 'false');
		await page.getByRole('button', { name: 'Указать время', exact: false }).click();
		await expect(page.getByTestId('time-input-rail')).toHaveCount(1);
		await clock(page, '10');
		await page.getByTestId('extend-end').click();
		await page.getByRole('button', { name: 'К дням', exact: false }).click();
		await page.getByRole('button', { name: 'Выбрать 10 сентября', exact: true }).click();
		await page.getByRole('button', { name: 'К часам', exact: false }).click();
		await clock(page, '11');
		await expect(draft).toHaveAttribute(
			'data-start',
			String(new Date('2026-09-09T10:00:00+02:00').getTime())
		);
		await expect(draft).toHaveAttribute(
			'data-end',
			String(new Date('2026-09-10T11:00:00+02:00').getTime())
		);
		await expect(page.locator('.input-tick:not(.major)').first()).toBeVisible();
		await expect(page.getByTestId('choose-start')).toContainText('9 сентября');
		await expect(page.getByTestId('choose-end')).toContainText('10 сентября');
		await page.screenshot({ path: `e2e/artifacts/time-prototype-range-${width}.png` });
		await page.getByRole('button', { name: 'Применить', exact: true }).click();
		await expect(page.getByTestId('when-field')).toContainText(
			'9 сентября, 10:00 → 10 сентября, 11:00'
		);
		await expect(page.getByLabel('Что произошло?')).toHaveValue('Встреча и дорога домой');
		await page.getByTestId('when-field').click();
		await page.getByTestId('choose-timeline').click();
		await page.getByRole('button', { name: 'К дням', exact: false }).click();
		await page.getByRole('button', { name: 'Выбрать 8 сентября', exact: true }).click();
		await page.getByRole('button', { name: 'Отмена', exact: true }).click();
		await expect(page.getByTestId('when-field')).toContainText(
			'9 сентября, 10:00 → 10 сентября, 11:00'
		);
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
			true
		);
	});
}

test('hour gestures stay in one day; a cancelled drag restores the value', async ({ page }) => {
	await page.clock.install({ time: new Date('2026-09-09T10:00:00+02:00') });
	await page.goto('/experiments/time-input?view=field');
	await page.getByTestId('when-field').click();
	await page.getByTestId('choose-timeline').click();
	await page.getByRole('button', { name: 'Указать время', exact: false }).click();
	const rail = page.getByTestId('time-input-rail');
	await expect(rail).toHaveAttribute(
		'data-window-start',
		String(new Date('2026-09-09T00:00:00+02:00').getTime())
	);
	const box = (await rail.boundingBox())!;
	await page.mouse.move(box.x + box.width * 0.8, box.y + box.height - 20);
	await page.mouse.down();
	await page.mouse.move(box.x + box.width * 0.2, box.y + box.height - 20, { steps: 8 });
	await page.mouse.up();
	await expect(rail).toHaveAttribute(
		'data-window-end',
		String(new Date('2026-09-10T00:00:00+02:00').getTime())
	);
	const draft = page.getByTestId('time-prototype');
	const before = await draft.getAttribute('data-start');
	const handle = (await page.getByTestId('handle-start').boundingBox())!;
	const cdp = await page.context().newCDPSession(page);
	await cdp.send('Input.dispatchTouchEvent', {
		type: 'touchStart',
		touchPoints: [{ id: 1, x: handle.x + 22, y: handle.y + 10 }]
	});
	await cdp.send('Input.dispatchTouchEvent', {
		type: 'touchMove',
		touchPoints: [{ id: 1, x: handle.x + 70, y: handle.y + 10 }]
	});
	await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
	await expect(draft).toHaveAttribute('data-start', before!);
	await cdp.detach();
});
