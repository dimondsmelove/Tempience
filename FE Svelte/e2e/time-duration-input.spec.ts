import { expect, test, type Page } from '@playwright/test';

test.use({ locale: 'ru-RU', timezoneId: 'Europe/Belgrade', actionTimeout: 5000 });
async function open(page: Page, view = '') {
	await page.clock.setFixedTime(new Date('2026-09-09T10:00:00+02:00'));
	await page.goto('/experiments/time-input' + view);
	await page.getByLabel('Что произошло?').fill('Сегодня читал');
	await page.getByTestId('when-field').click();
}
async function quantity(page: Page, digits: string) {
	await page
		.getByTestId('duration-input')
		.getByRole('listbox')
		.first()
		.locator('[aria-selected=true]')
		.focus();
	await page.keyboard.type(digits);
}
async function hour(page: Page, digits: string) {
	await page
		.getByRole('listbox', { name: 'Часы', exact: true })
		.locator('[aria-selected=true]')
		.focus();
	await page.keyboard.type(digits);
}
for (const { width, view } of [
	{ width: 390, view: '' },
	{ width: 1280, view: '?view=field' }
]) {
	test(`day plus duration stays independent of clocks and timeline at ${width}`, async ({
		page
	}) => {
		await page.setViewportSize({ width, height: 900 });
		await open(page, view);
		const draft = page.getByTestId('time-prototype');
		await page.getByTestId('detail-duration').click();
		await expect(
			page.getByTestId('duration-input').getByRole('listbox', { name: 'Минуты', exact: true })
		).toBeVisible();
		await expect(page.getByTestId('picker-add-end')).toHaveCount(0);
		await expect(draft).toHaveAttribute('data-duration', '');
		await quantity(page, 'abc2');
		await expect(draft).toHaveAttribute('data-duration', '2');
		await expect(draft).toHaveAttribute('data-duration-unit', 'hour');
		const minutes = page
			.getByTestId('duration-input')
			.getByRole('listbox', { name: 'Минуты', exact: true });
		await minutes.locator('[aria-selected=true]').focus();
		await page.keyboard.type('abc30');
		await expect(draft).toHaveAttribute('data-duration', '150');
		await expect(draft).toHaveAttribute('data-timed', 'false');
		await expect(draft).toHaveAttribute('data-end', '');
		await page.getByTestId('choose-timeline').click();
		await expect(page.getByTestId('extend-end')).toHaveCount(0);
		await expect(page.getByRole('button', { name: /Указать время/ })).toHaveCount(0);
		await page.getByRole('button', { name: 'Выбрать 10 сентября', exact: true }).click();
		await page.getByTestId('choose-picker').click();
		await expect(draft).toHaveAttribute('data-duration', '150');
		await page.screenshot({ path: `e2e/artifacts/duration-only-${width}.png` });
		await page.getByRole('button', { name: 'Применить', exact: true }).click();
		await expect(page.getByTestId('when-field')).toContainText('10 сентября · 2 ч 30 мин');
		await expect(page.getByLabel('Что произошло?')).toHaveValue('Сегодня читал');
		await page.getByTestId('when-field').click();
		await expect(page.getByTestId('detail-duration')).toHaveAttribute('aria-pressed', 'true');
		await page.getByRole('button', { name: 'Увеличить длительность', exact: true }).click();
		await expect(draft).toHaveAttribute('data-duration', '210');
		await page.getByRole('button', { name: 'Отмена', exact: true }).click();
		await expect(page.getByTestId('when-field')).toContainText('10 сентября · 2 ч 30 мин');
		await expect(page.getByTestId('when-field')).toBeFocused();
	});
}

test('clock boundaries derive duration and make a changed amount visible before apply', async ({
	page
}) => {
	await open(page);
	const draft = page.getByTestId('time-prototype');
	await page.getByTestId('detail-duration').click();
	await quantity(page, '2');
	await page.getByTestId('detail-clock').click();
	await expect(page.getByTestId('duration-input')).toHaveCount(0);
	await expect(draft).toHaveAttribute('data-timed', 'false');
	await expect(draft).toHaveAttribute('data-end', '');
	await hour(page, '09');
	await page.getByTestId('picker-add-end').click();
	await hour(page, '12');
	await expect(page.getByRole('status').filter({ hasText: 'По границам' })).toHaveText(
		'По границам — 3 ч, ранее указано 2 ч.'
	);
	await page.screenshot({ path: 'e2e/artifacts/duration-from-clocks.png' });
	await page.getByRole('button', { name: 'Применить 3 ч', exact: true }).click();
	await expect(draft).toHaveAttribute('data-duration', '');
	await expect(page.getByTestId('when-field')).toContainText(
		'9 сентября, 09:00 → 9 сентября, 12:00'
	);
	await page.getByTestId('when-field').click();
	await page.getByTestId('detail-duration').click();
	await expect(draft).toHaveAttribute('data-duration', '3');
	await expect(draft).toHaveAttribute('data-timed', 'false');
	await page.getByTestId('detail-clock').click();
	await expect(page.getByTestId('picker-start')).toContainText('09:00');
	await expect(page.getByTestId('picker-end')).toContainText('12:00');
	await page.getByTestId('detail-duration').click();
	await page.getByRole('button', { name: 'Применить', exact: true }).click();
	await expect(page.getByTestId('when-field')).toContainText('9 сентября · 3 ч');
	await expect(draft).toHaveAttribute('data-end', '');
});

test('quantity wheel keeps keyboard focus and switching hours/minutes preserves the amount', async ({
	page
}) => {
	await page.setViewportSize({ width: 320, height: 568 });
	await open(page);
	const draft = page.getByTestId('time-prototype');
	await page.getByTestId('detail-duration').click();
	await quantity(page, '1001');
	await expect(draft).toHaveAttribute('data-duration', '1001');
	await page.evaluate(async () => {
		await Promise.all(
			document.getAnimations().map((animation) => animation.finished.catch(() => {}))
		);
	});
	const units = await page.getByLabel('Единица длительности', { exact: true }).boundingBox();
	const footer = await page.getByTestId('mobile-actions').boundingBox();
	expect(units!.y + units!.height).toBeLessThanOrEqual(footer!.y);
	await page.getByLabel('Единица длительности', { exact: true }).selectOption('minute');
	await expect(draft).toHaveAttribute('data-duration', '60060');
	await expect(draft).toHaveAttribute('data-duration-unit', 'minute');
	await page.getByRole('button', { name: 'Убрать длительность', exact: true }).click();
	await expect(draft).toHaveAttribute('data-duration', '');
	await page.getByLabel('Единица длительности', { exact: true }).selectOption('day');
	await quantity(page, '4');
	await page.setViewportSize({ width: 320, height: 360 });
	await page.getByRole('button', { name: 'Применить', exact: true }).click();
	await expect(page.getByTestId('when-field')).toContainText('9 сентября · 4 дн');
	await expect(draft).toHaveAttribute('data-end', '');
});
