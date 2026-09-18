import { expect, test } from '@playwright/test';

for (const width of [1280, 390, 320]) {
	test(`time editing stays in Context and leaves a compact timeline header at ${width}`, async ({
		page
	}) => {
		await page.setViewportSize({ width, height: width === 320 ? 568 : 900 });
		await page.goto('/experiments/time-input');
		await page.getByTestId('when-field').click();
		const picker = page.getByTestId('time-picker');
		await expect(page.locator('dialog')).toHaveCount(0);
		expect(
			await picker.evaluate((e) =>
				Boolean(e.closest('.context-panel, [data-testid="bottom-sheet"]'))
			)
		).toBe(true);
		await page.getByTestId('picker-calendar').click();
		const geometry = await picker.evaluate((e) => ({
			width: e.clientWidth,
			scrollWidth: e.scrollWidth
		}));
		expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.width + 1);
		await page.keyboard.press('Escape');
		await expect(page.getByTestId('picker-calendar-grid')).toHaveCount(0);
		await expect(picker).toBeVisible();
		await page.getByRole('option', { name: 'Часы: —', exact: true }).focus();
		await page.keyboard.type('18');
		await page.getByRole('option', { name: 'Минуты: 00', exact: true }).focus();
		await page.keyboard.type('37');
		await page.getByTestId('picker-add-end').click();
		await page.getByTestId('choose-timeline').click();
		await expect(page.getByTestId('time-input-rail')).toHaveAttribute('data-picking-end', 'true');
		await expect(page.getByTestId('time-prototype')).toHaveAttribute('data-end', '');
		if (width < 576)
			await expect(page.getByTestId('bottom-sheet')).toHaveAttribute('data-position', 'peek');
		await expect(page.getByTestId('choose-start')).toBeVisible();
		await expect(page.getByTestId('choose-picker')).toBeVisible();
		const controls = page.locator('.time-input-controls');
		await expect(controls.locator('.input-boundaries')).toHaveCount(0);
		const headerHeight = await controls.evaluate(
			(e) => e.parentElement!.getBoundingClientRect().height
		);
		expect(headerHeight).toBeLessThan(145);
		const actions = page.getByTestId('time-input-actions');
		const bottom = await actions.evaluate((e) => e.getBoundingClientRect().bottom);
		expect(bottom).toBeLessThanOrEqual((await page.viewportSize())!.height);
		await page.screenshot({ path: `e2e/artifacts/context-time-scale-${width}.png` });
		await page.getByTestId('choose-picker').click();
		if (width < 576)
			await expect(page.getByTestId('bottom-sheet')).toHaveAttribute('data-position', 'full');
		await expect(picker.getByText('Выбери день или время', { exact: true })).toBeVisible();
		await expect(page.getByRole('option', { name: 'Минуты: 37', exact: true })).toHaveAttribute(
			'aria-selected',
			'true'
		);
		await actions.getByRole('button', { name: 'Отмена', exact: true }).click();
		await expect(page.getByTestId('when-field')).toBeFocused();
	});
}
