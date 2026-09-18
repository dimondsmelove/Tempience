import { expect, test, type Page } from '@playwright/test';
import { loadTime, settleCamera } from './helpers';

test.use({ viewport: { width: 1440, height: 600 }, isMobile: false, hasTouch: false });
const axis = (page: Page) => page.getByRole('group', { name: 'Подписи оси', exact: true });
const windowOf = (page: Page) =>
	page.getByTestId('time-workbench').evaluate((element) => ({
		start: Number(element.getAttribute('data-window-start')),
		end: Number(element.getAttribute('data-window-end'))
	}));
const scroller = (page: Page) => page.locator('section[aria-label="Time"] > div.overflow-auto');

test('axis wheel moves up into the future and down into the past without zoom or selection changes', async ({
	page
}) => {
	await loadTime(page, { manifest: 'dense' });
	const label = axis(page).locator('[data-row="major"]').nth(1);
	await label.click();
	const selected = await page.getByTestId('selected-title').innerText();
	const before = await windowOf(page);
	const scrollTop = await scroller(page).evaluate((element) => element.scrollTop);
	await label.hover();
	await page.mouse.wheel(0, -120);
	await expect.poll(async () => (await windowOf(page)).start).toBeGreaterThan(before.start);
	await settleCamera(page);
	const future = await windowOf(page);
	expect(future.end - future.start).toBeCloseTo(before.end - before.start, 0);
	await expect(page.getByTestId('selected-title')).toHaveText(selected);
	expect(await scroller(page).evaluate((element) => element.scrollTop)).toBe(scrollTop);
	await axis(page).hover({ position: { x: 80, y: 40 } });
	await page.mouse.wheel(0, 240);
	await expect.poll(async () => (await windowOf(page)).start).toBeLessThan(before.start);
	await settleCamera(page);
	const past = await windowOf(page);
	expect(past.end - past.start).toBeCloseTo(before.end - before.start, 0);
	await expect(page.getByTestId('selected-title')).toHaveText(selected);
	expect(await scroller(page).evaluate((element) => element.scrollTop)).toBe(scrollTop);
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
	await page.screenshot({ path: 'test-results/axis-wheel-past.png' });
});

test('axis wheel animates and accumulates a burst against the pending camera destination', async ({
	page
}) => {
	await loadTime(page);
	const before = await windowOf(page);
	const width = (await axis(page).boundingBox())!.width;
	const frames = await axis(page).evaluate(async (element) => {
		const workbench = document.querySelector('[data-testid="time-workbench"]')!;
		const frames: { start: number; span: number }[] = [];
		for (let i = 0; i < 3; i++)
			element.dispatchEvent(
				new WheelEvent('wheel', {
					deltaY: -40,
					bubbles: true,
					cancelable: true
				})
			);
		const started = performance.now();
		while (performance.now() - started < 350) {
			await new Promise(requestAnimationFrame);
			const start = Number(workbench.getAttribute('data-window-start'));
			frames.push({ start, span: Number(workbench.getAttribute('data-window-end')) - start });
		}
		return frames;
	});
	await settleCamera(page);
	const after = await windowOf(page);
	const span = before.end - before.start;
	expect(after.start - before.start).toBeCloseTo((120 / width) * span, 0);
	expect(new Set(frames.map((frame) => Math.round(frame.start))).size).toBeGreaterThan(2);
	expect(frames.some((frame) => frame.start > before.start && frame.start < after.start)).toBe(
		true
	);
	expect(frames.every((frame) => Math.abs(frame.span - span) < 1)).toBe(true);
});

test('line and page wheel units preserve the span and respect reduced motion', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await loadTime(page);
	const width = (await axis(page).boundingBox())!.width;
	for (const input of [
		{ deltaY: -3, deltaMode: 1, ratio: 48 / width },
		{ deltaY: 1, deltaMode: 2, ratio: -1 }
	]) {
		const before = await windowOf(page);
		await axis(page).dispatchEvent('wheel', { ...input, bubbles: true, cancelable: true });
		await expect(page.getByTestId('time-workbench')).toHaveAttribute('data-camera-moving', 'false');
		const after = await windowOf(page);
		expect(after.start - before.start).toBeCloseTo(input.ratio * (before.end - before.start), 0);
		expect(after.end - after.start).toBeCloseTo(before.end - before.start, 0);
	}
});

test('wheel on Scope scrolls rows and wheel on the ribbon still zooms', async ({ page }) => {
	await loadTime(page, { manifest: 'dense' });
	// A panel shorter than its rows: the wheel has rows to scroll whatever the fixture holds.
	await page.setViewportSize({ width: 1440, height: 400 });
	await page.getByRole('button', { name: 'Раскрыть Scope Работа', exact: true }).click();
	await page.getByRole('button', { name: 'Раскрыть Scope Дом', exact: true }).click();
	const before = await windowOf(page);
	await page.getByTestId('scope-rail-rows').hover({ position: { x: 80, y: 100 } });
	await page.mouse.wheel(0, 180);
	await expect
		.poll(() => scroller(page).evaluate((element) => element.scrollTop))
		.toBeGreaterThan(0);
	expect(await windowOf(page)).toEqual(before);
	const axisBox = (await axis(page).boundingBox())!;
	await page.mouse.move(axisBox.x + axisBox.width / 2, axisBox.y + axisBox.height + 40);
	await page.mouse.wheel(0, -120);
	await expect
		.poll(async () => {
			const window = await windowOf(page);
			return window.end - window.start;
		})
		.toBeLessThan(before.end - before.start);
	await settleCamera(page);
});
