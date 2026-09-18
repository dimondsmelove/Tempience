import { expect, test } from '@playwright/test';
import { loadTime, settleCamera } from './helpers';

test('one finger pans time and scrolls rows; pinch zoom does not scroll rows or zoom the page', async ({
	page
}) => {
	await loadTime(page, { manifest: 'dense' });
	await page.getByRole('button', { name: 'Scope', exact: true }).click();
	await page
		.getByTestId('scope-rail-rows')
		.getByRole('button', { name: 'Раскрыть Scope Работа', exact: true })
		.click();
	await page
		.getByTestId('scope-rail-rows')
		.getByRole('button', { name: 'Раскрыть Scope Дом', exact: true })
		.click();
	await page.getByTestId('scope-menu-toggle').click();
	await page.getByRole('button', { name: 'Строки выше' }).click();
	await page.getByRole('button', { name: 'Строки выше' }).click();
	await page.getByRole('button', { name: 'Строки выше' }).click();
	await page.keyboard.press('Escape');
	await page.getByTestId('scope-close').click();
	const scroller = page.locator('section[aria-label="Time"] > div.overflow-auto');
	const scrollTop = () => scroller.evaluate((el) => el.scrollTop);
	await expect
		.poll(() => scroller.evaluate((el) => el.scrollHeight - el.clientHeight))
		.toBeGreaterThan(120);
	const windowOf = () =>
		page.getByTestId('time-workbench').evaluate((el) => ({
			start: Number(el.getAttribute('data-window-start')),
			end: Number(el.getAttribute('data-window-end'))
		}));
	const axis = (await page.getByRole('group', { name: 'Подписи оси', exact: true }).boundingBox())!;
	const x = 280,
		y = axis.y + axis.height + 220;
	const session = await page.context().newCDPSession(page);
	const touch = (
		type: 'touchStart' | 'touchMove' | 'touchEnd',
		points: { x: number; y: number }[]
	) =>
		session.send('Input.dispatchTouchEvent', {
			type,
			touchPoints: points.map((point, id) => ({ id, ...point }))
		});
	const before = await windowOf();
	await touch('touchStart', [{ x, y }]);
	for (let i = 1; i <= 12; i++) await touch('touchMove', [{ x, y: y - i * 10 }]);
	await touch('touchEnd', []);
	await expect.poll(scrollTop).toBeCloseTo(120, 0);
	expect(await windowOf()).toEqual(before);
	await touch('touchStart', [{ x, y }]);
	for (let i = 1; i <= 6; i++) await touch('touchMove', [{ x: x + i * 10, y }]);
	await touch('touchEnd', []);
	const panned = await windowOf();
	expect(panned.start).toBeLessThan(before.start);
	expect(panned.end - panned.start).toBeCloseTo(before.end - before.start, 0);
	expect(await scrollTop()).toBeCloseTo(120, 0);
	await touch('touchStart', [
		{ x: 210, y },
		{ x: 290, y }
	]);
	for (let i = 1; i <= 6; i++)
		await touch('touchMove', [
			{ x: 210 - i * 10, y },
			{ x: 290 + i * 10, y }
		]);
	await touch('touchEnd', []);
	await settleCamera(page);
	const zoomed = await windowOf();
	expect(zoomed.end - zoomed.start).toBeLessThan(panned.end - panned.start);
	expect(await scrollTop()).toBeCloseTo(120, 0);
	expect(await page.evaluate(() => visualViewport?.scale)).toBe(1);
	await page.screenshot({ path: 'test-results/mobile-touch-input.png' });
	await session.detach();
});
