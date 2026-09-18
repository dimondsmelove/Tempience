import { expect, test, type Page } from '@playwright/test';
import { chooseScale, loadTime, settleCamera } from './helpers';

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });
const DAY = 86_400_000;
const windowOf = (page: Page) =>
	page.getByTestId('time-workbench').evaluate((element) => ({
		start: Number(element.getAttribute('data-window-start')),
		end: Number(element.getAttribute('data-window-end'))
	}));

test('zoom travels through intermediate frames and rapid presses accumulate', async ({ page }) => {
	await loadTime(page, { manifest: 'dense' });
	const before = await windowOf(page);
	const frames = await page.evaluate(async () => {
		const workbench = document.querySelector('[data-testid="time-workbench"]')!;
		const plus = document.querySelector<HTMLButtonElement>('[aria-label="Приблизить"]')!;
		const spans: number[] = [];
		plus.click();
		plus.click();
		const started = performance.now();
		while (performance.now() - started < 650) {
			await new Promise(requestAnimationFrame);
			spans.push(
				Number(workbench.getAttribute('data-window-end')) -
					Number(workbench.getAttribute('data-window-start'))
			);
		}
		return spans;
	});
	await settleCamera(page);
	const after = await windowOf(page);
	expect(new Set(frames.map(Math.round)).size).toBeGreaterThan(5);
	expect(after.end - after.start).toBeCloseTo((before.end - before.start) * 0.7 ** 2, 0);
	expect(
		frames.every((span) => span <= before.end - before.start && span >= after.end - after.start - 1)
	).toBe(true);
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('Scope and Context navigation fit full durations; points zoom in and history travels back', async ({
	page
}) => {
	await loadTime(page);
	await page.getByRole('button', { name: 'Выбрать Scope Работа', exact: true }).click();
	await settleCamera(page);
	const scope = await windowOf(page);
	expect(scope.start).toBeLessThan(Date.parse('2025-09-06'));
	expect(scope.end).toBeGreaterThan(Date.parse('2025-10-02'));
	await page.getByTestId('scope-record').filter({ hasText: 'Начал проект' }).click();
	await settleCamera(page);
	const point = await windowOf(page);
	expect((point.end - point.start) / DAY).toBeCloseTo(2, 1);
	expect(point.start).toBeLessThan(Date.parse('2025-09-06T08:00:00Z'));
	expect(point.end).toBeGreaterThan(Date.parse('2025-09-06T08:00:00Z'));
	await page.getByTestId('history-back').click();
	await settleCamera(page);
	expect(await windowOf(page)).toEqual(scope);
	await page.getByTestId('scope-record').filter({ hasText: 'Работал над первой фазой' }).click();
	await settleCamera(page);
	const interval = await windowOf(page);
	expect(interval.start).toBeLessThan(Date.parse('2025-09-06'));
	expect(interval.end).toBeGreaterThan(Date.parse('2025-09-30'));
	expect((interval.end - interval.start) / DAY).toBeLessThan(32);
	await page.screenshot({ path: 'test-results/c9a-camera-interval.png' });
});

test('wheel zoom settles at its pointer anchor and a drag interrupts camera travel', async ({
	page
}) => {
	await loadTime(page, { manifest: 'dense' });
	await chooseScale(page, 'год');
	const lanes = (await page.getByTestId('ribbon-canvas').boundingBox())!;
	const before = await windowOf(page);
	await page.mouse.move(lanes.x + lanes.width * 0.3, lanes.y + 20);
	await page.mouse.wheel(0, -200);
	await settleCamera(page);
	const zoomed = await windowOf(page);
	expect(zoomed.end - zoomed.start).toBeLessThan(before.end - before.start);
	// Browser pointer coordinates and clientWidth round to CSS pixels.
	const anchorDrift = Math.abs(
		zoomed.start +
			(zoomed.end - zoomed.start) * 0.3 -
			(before.start + (before.end - before.start) * 0.3)
	);
	expect(anchorDrift).toBeLessThan((before.end - before.start) / lanes.width);
	await page.getByRole('button', { name: 'Приблизить', exact: true }).click();
	await page.mouse.move(lanes.x + lanes.width * 0.5, lanes.y + 20);
	await page.mouse.down();
	await page.mouse.move(lanes.x + lanes.width * 0.6, lanes.y + 20, { steps: 3 });
	await page.mouse.up();
	await expect(page.getByTestId('time-workbench')).toHaveAttribute('data-camera-moving', 'false');
	const stopped = await windowOf(page);
	await page.waitForTimeout(500);
	expect(await windowOf(page)).toEqual(stopped);
});

test('reduced motion reaches the destination without animation', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await loadTime(page);
	const before = await windowOf(page);
	await page.getByRole('button', { name: 'Приблизить', exact: true }).click();
	await expect(page.getByTestId('time-workbench')).toHaveAttribute('data-camera-moving', 'false');
	const after = await windowOf(page);
	expect(after.end - after.start).toBeCloseTo((before.end - before.start) * 0.7, 0);
});

test('left drag scrolls rows vertically and diagonally without changing selection or scale', async ({
	page
}) => {
	await page.setViewportSize({ width: 1440, height: 600 });
	await loadTime(page, { manifest: 'dense' });
	await page.getByRole('button', { name: 'Раскрыть Scope Работа', exact: true }).click();
	await page.getByRole('button', { name: 'Раскрыть Scope Дом', exact: true }).click();
	await page.getByTestId('appearance-open').click();
	await page.getByRole('button', { name: 'Это устройство', exact: true }).click();
	await page.getByRole('button', { name: 'Увеличить высоту строк' }).click();
	await page.getByRole('button', { name: 'Увеличить высоту строк' }).click();
	await page.getByRole('button', { name: 'Применить', exact: true }).click();
	const axis = page.getByRole('group', { name: 'Подписи оси', exact: true });
	await axis.locator('[data-row="major"]').nth(1).click();
	await settleCamera(page);
	const selected = await page.getByTestId('selected-title').innerText();
	const before = await windowOf(page);
	const scroller = page.locator('section[aria-label="Time"] > div.overflow-auto');
	const scrollTop = () => scroller.evaluate((element) => element.scrollTop);
	await expect
		.poll(() => scroller.evaluate((el) => el.scrollHeight - el.clientHeight))
		.toBeGreaterThan(200);
	const canvas = (await page.getByTestId('ribbon-canvas').boundingBox())!;
	const axisBox = (await axis.boundingBox())!;
	const x = canvas.x + canvas.width / 2;
	const y = axisBox.y + axisBox.height + 240;
	await page.mouse.move(x, y);
	await page.mouse.down();
	await page.mouse.move(x, y - 120, { steps: 12 });
	await expect.poll(scrollTop).toBeCloseTo(120, 0);
	expect(await windowOf(page)).toEqual(before);
	await page.mouse.move(x + 80, y - 180, { steps: 8 });
	await expect.poll(scrollTop).toBeCloseTo(180, 0);
	const diagonal = await windowOf(page);
	expect(diagonal.start).toBeLessThan(before.start);
	expect(diagonal.end - diagonal.start).toBeCloseTo(before.end - before.start, 0);
	await page.mouse.move(x + 80, y - 80, { steps: 10 });
	await expect.poll(scrollTop).toBeCloseTo(80, 0);
	await page.mouse.up();
	expect(await windowOf(page)).toEqual(diagonal);
	await expect(page.getByTestId('selected-title')).toHaveText(selected);
	const rail = (await page.getByTestId('scope-rail-rows').boundingBox())!;
	const movedCanvas = (await page.getByTestId('ribbon-canvas').boundingBox())!;
	expect(movedCanvas.y).toBeCloseTo(rail.y, 0);
	await page.screenshot({ path: 'test-results/drag-both-axes.png' });

	// Reversing at the top edge takes effect immediately, including within one drag.
	await page.mouse.down();
	await page.mouse.move(x + 80, y + 40, { steps: 12 });
	await expect.poll(scrollTop).toBe(0);
	await page.mouse.move(x + 80, y, { steps: 4 });
	await expect.poll(scrollTop).toBeCloseTo(40, 0);
	await page.mouse.up();
	await page.mouse.move(x + 80, y - 40);
	expect(await scrollTop()).toBeCloseTo(40, 0);
	expect(await windowOf(page)).toEqual(diagonal);
	await expect(page.getByTestId('selected-title')).toHaveText(selected);
});
