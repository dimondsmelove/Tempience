import { expect, test } from '@playwright/test';

test.use({ locale: 'ru-RU', timezoneId: 'Europe/Belgrade', actionTimeout: 5000 });
for (const view of ['', '?view=field']) {
	test(`native end handle supports drag and cancellation ${view || 'canvas'}`, async ({ page }) => {
		await page.clock.setFixedTime(new Date('2026-09-09T10:00:00+02:00'));
		await page.goto('/experiments/time-input' + view);
		await page.getByTestId('when-field').click();
		await page.getByTestId('choose-timeline').click();
		await page.getByRole('button', { name: 'Указать время', exact: false }).click();
		const rail = page.getByTestId('time-input-rail');
		await expect(rail).toHaveAttribute(
			'data-window-end',
			String(new Date('2026-09-10T00:00:00+02:00').getTime())
		);
		const draft = page.getByTestId('time-prototype');
		const start = await draft.getAttribute('data-start');
		const box = (await rail.boundingBox())!;
		const handle = (await page.getByTestId('extend-end').boundingBox())!;
		const cdp = await page.context().newCDPSession(page);
		await cdp.send('Input.dispatchTouchEvent', {
			type: 'touchStart',
			touchPoints: [{ id: 1, x: handle.x + 22, y: handle.y + 16 }]
		});
		await cdp.send('Input.dispatchTouchEvent', {
			type: 'touchMove',
			touchPoints: [{ id: 1, x: box.x + box.width * 0.8, y: handle.y + 16 }]
		});
		await expect(draft).not.toHaveAttribute('data-end', '');
		await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
		await expect(draft).toHaveAttribute('data-end', '');
		await expect(draft).toHaveAttribute('data-start', start!);
		await expect(rail).toHaveAttribute('data-picking-end', 'false');
		await cdp.detach();
		await page.mouse.move(handle.x + 22, handle.y + 16);
		await page.mouse.down();
		await page.mouse.move(box.x + box.width * 0.8, handle.y + 16, { steps: 10 });
		await page.mouse.up();
		await expect(draft).not.toHaveAttribute('data-end', '');
		await expect(draft).toHaveAttribute('data-start', start!);
		await expect(page.getByTestId('extend-end')).toHaveCount(0);
		await expect(page.getByTestId('handle-end')).toBeVisible();
		await page.screenshot({
			path: `e2e/artifacts/native-end-drag-${view ? 'field' : 'canvas'}.png`
		});
	});
}
test('arming the handle creates no duration; Escape cancels only that choice', async ({ page }) => {
	await page.goto('/experiments/time-input');
	await page.getByTestId('when-field').click();
	await page.getByTestId('choose-timeline').click();
	await expect(page.getByTestId('time-more')).toHaveCount(0);
	await page.getByTestId('extend-end').click();
	await expect(page.getByTestId('time-input-rail')).toHaveAttribute('data-picking-end', 'true');
	await expect(page.getByTestId('time-prototype')).toHaveAttribute('data-end', '');
	await page.keyboard.press('Escape');
	await expect(page.getByTestId('time-prototype')).toHaveAttribute('data-picking', 'true');
	await expect(page.getByTestId('time-input-rail')).toHaveAttribute('data-picking-end', 'false');
	await page.getByTestId('extend-end').focus();
	await page.keyboard.press('ArrowRight');
	await expect(page.getByTestId('time-prototype')).not.toHaveAttribute('data-end', '');
});
