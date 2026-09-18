import { expect, test, type Page } from '@playwright/test';

test.use({ locale: 'ru-RU', timezoneId: 'Europe/Belgrade', actionTimeout: 5000 });
const moment = (day: number, hours: number, minutes: number) =>
	String(
		new Date(
			`2026-11-${String(day).padStart(2, '0')}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00+01:00`
		).getTime()
	);
async function open(page: Page, view = '') {
	await page.clock.setFixedTime(new Date('2026-09-09T10:00:00+02:00'));
	await page.goto('/experiments/time-input' + view);
	await page.getByTestId('when-field').click();
	await expect(page.getByTestId('time-picker')).toBeVisible();
}
for (const { width, view } of [
	{ width: 390, view: '' },
	{ width: 1280, view: '?view=field' }
]) {
	test(`calendar, exact time, unfinished end and timeline share one draft at ${width}`, async ({
		page
	}) => {
		await page.setViewportSize({ width, height: 844 });
		await open(page, view);
		const draft = page.getByTestId('time-prototype');
		const picker = page.getByTestId('time-picker');
		await expect(picker.locator('input')).toHaveCount(0);
		await expect(draft).toHaveAttribute('data-timed', 'false');
		await page.getByTestId('picker-calendar').click();
		const calendar = page.getByTestId('picker-calendar-grid');
		await calendar
			.getByRole('gridcell', { name: 'среда, 9 сентября 2026 г.', exact: true })
			.focus();
		await page.keyboard.press('ArrowRight');
		await page.keyboard.press('Enter');
		await expect(page.getByTestId('picker-start')).toContainText('10 сентября');
		await page.getByTestId('picker-calendar').click();
		await calendar.getByRole('button', { name: 'сентябрь 2026 г.', exact: true }).click();
		await calendar.getByRole('button', { name: 'нояб.', exact: true }).click();
		await calendar
			.getByRole('gridcell', { name: 'понедельник, 9 ноября 2026 г.', exact: true })
			.click();
		await expect(calendar).toHaveCount(0);
		await expect(draft).toHaveAttribute('data-timed', 'false');
		await expect(draft).toHaveAttribute('data-end', '');
		await page
			.getByTestId('time-input-actions')
			.getByRole('button', { name: 'Применить', exact: true })
			.click();
		await expect(page.getByTestId('when-field')).toContainText('9 ноября');
		await expect(page.getByTestId('when-field')).not.toContainText('12:00');
		await page.getByLabel('Что произошло?').fill('Встреча и дорога домой');
		await page.getByTestId('when-field').click();
		await page.getByRole('option', { name: 'Часы: —', exact: true }).focus();
		await page.keyboard.type('abc');
		await expect(draft).toHaveAttribute('data-timed', 'false');
		await page.keyboard.type('18');
		await page.getByRole('option', { name: 'Минуты: 00', exact: true }).focus();
		await page.keyboard.type('37');
		await expect(draft).toHaveAttribute('data-start', moment(9, 18, 37));
		await picker.getByRole('button', { name: 'Список', exact: true }).click();
		await expect(page.getByRole('option', { name: 'Время: 18:37', exact: true })).toHaveAttribute(
			'aria-selected',
			'true'
		);
		const beforeScroll = await draft.getAttribute('data-start');
		await page.getByRole('listbox', { name: 'Время', exact: true }).hover();
		await page.mouse.wheel(0, 400);
		await page.waitForTimeout(250);
		await expect(draft).toHaveAttribute('data-start', beforeScroll!);
		await page.getByTestId('picker-calendar').click();
		await calendar.getByRole('button', { name: 'Next month', exact: true }).click();
		await picker.getByRole('button', { name: 'Колёса', exact: true }).click();
		await expect(
			calendar.getByRole('button', { name: 'декабрь 2026 г.', exact: true })
		).toBeVisible();
		await calendar.getByRole('button', { name: 'К колесу дней', exact: true }).click();
		await page.getByTestId('picker-add-end').click();
		await expect(draft).toHaveAttribute('data-end', '');
		await page.getByTestId('choose-timeline').click();
		await expect(page.getByTestId('time-input-rail')).toHaveAttribute('data-picking-end', 'true');
		await expect(draft).toHaveAttribute('data-start', moment(9, 18, 37));
		await expect(draft).toHaveAttribute('data-end', '');
		await page.getByTestId('choose-picker').click();
		await expect(picker.getByText('Выбери день или время', { exact: true })).toBeVisible();
		await page.getByRole('option', { name: /День:.*10 нояб/ }).click();
		await picker.getByRole('button', { name: 'Список', exact: true }).click();
		await page.getByRole('option', { name: 'Время: 19:30', exact: true }).click();
		await expect(draft).toHaveAttribute('data-start', moment(9, 18, 37));
		await expect(draft).toHaveAttribute('data-end', moment(10, 19, 30));
		await page.screenshot({ path: `e2e/artifacts/hybrid-range-${width}.png` });
		await page
			.getByTestId('time-input-actions')
			.getByRole('button', { name: 'Применить', exact: true })
			.click();
		await expect(page.getByTestId('when-field')).toContainText(
			'9 ноября, 18:37 → 10 ноября, 19:30'
		);
		await expect(page.getByTestId('when-field')).toBeFocused();
		await expect(page.getByLabel('Что произошло?')).toHaveValue('Встреча и дорога домой');
		await page.getByTestId('when-field').click();
		await page.getByRole('option', { name: /День:.*, 8 нояб/ }).click();
		await picker.getByRole('button', { name: 'Отменить выбор времени', exact: true }).click();
		await expect(page.getByTestId('when-field')).toContainText(
			'9 ноября, 18:37 → 10 ноября, 19:30'
		);
	});
}

test('day wheel handles native touch scroll without adding a clock', async ({ page }) => {
	await open(page, '?view=field');
	const draft = page.getByTestId('time-prototype');
	const before = await draft.getAttribute('data-start');
	const box = (await page.getByRole('listbox', { name: 'День', exact: true }).boundingBox())!;
	const cdp = await page.context().newCDPSession(page);
	await cdp.send('Input.dispatchTouchEvent', {
		type: 'touchStart',
		touchPoints: [{ id: 1, x: box.x + box.width / 2, y: box.y + 170 }]
	});
	for (const distance of [20, 40, 60, 88]) {
		await cdp.send('Input.dispatchTouchEvent', {
			type: 'touchMove',
			touchPoints: [{ id: 1, x: box.x + box.width / 2, y: box.y + 170 - distance }]
		});
		await page.waitForTimeout(40);
	}
	await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
	await expect(draft).not.toHaveAttribute('data-start', before!);
	await expect(draft).toHaveAttribute('data-timed', 'false');
	await expect(draft).toHaveAttribute('data-end', '');
	await cdp.detach();
});

test('small viewport keeps actions reachable and unfinished end can be discarded', async ({
	page
}) => {
	await page.setViewportSize({ width: 320, height: 568 });
	await open(page, '?view=field');
	await page.getByTestId('picker-add-end').click();
	await page.getByTestId('picker-calendar').click();
	await expect(
		page.getByTestId('picker-calendar-grid').getByRole('gridcell').first()
	).toBeVisible();
	await page.setViewportSize({ width: 320, height: 360 });
	const geometry = await page.getByTestId('time-picker').evaluate((e) => ({
		width: e.getBoundingClientRect().width,
		footerBottom: e.querySelector('footer')!.getBoundingClientRect().bottom,
		viewportHeight: window.innerHeight
	}));
	expect(geometry.width).toBeLessThanOrEqual(320);
	expect(geometry.footerBottom).toBeLessThanOrEqual(geometry.viewportHeight);
	await page.getByRole('button', { name: 'Оставить без окончания', exact: true }).click();
	await expect(page.getByTestId('time-prototype')).toHaveAttribute('data-end', '');
	await expect(page.getByTestId('time-prototype')).toHaveAttribute('data-timed', 'false');
});
