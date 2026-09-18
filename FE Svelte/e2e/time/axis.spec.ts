import { expect, test, type Locator, type Page } from '@playwright/test';
import { chooseScale, loadTime, toggleLegend } from './helpers';

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

const MONTH = '(янв|фев|мар|апр|май|июн|июл|авг|сен|окт|ноя|дек)';
const WEEKDAY = '(пн|вт|ср|чт|пт|сб|вс)';
const MAJOR = { year: /^\d{4}$/, month: new RegExp(`^${MONTH}( \\d{4})?$`) };
const MINOR = {
	month: new RegExp(`^${MONTH}$`),
	week: /^н\d{1,2}( · \d{1,2})?$/,
	day: /^\d{1,2}$/,
	weekday: new RegExp(`^${WEEKDAY} \\d{1,2}$`)
};
const WEEK = /^н\d{1,2}$/;
const STICKY = new RegExp(`^${MONTH} \\d{4} · н\\d{1,2}$`);
const SCALES = [
	['3 года', 1095],
	['год', 365],
	['квартал', 91],
	['месяц', 30],
	['неделя', 7],
	['день', 2]
] as const;

/** DESIGN.md §6: which rows the axis shows for a given px/day. */
const rowsFor = (ppd: number) =>
	ppd < 1.6
		? { major: 'year', middle: null, minor: 'month' }
		: ppd < 7
			? { major: 'month', middle: null, minor: 'week' }
			: { major: 'month', middle: 'week', minor: ppd >= 40 ? 'weekday' : 'day' };

type Rect = { x0: number; x1: number; y0: number; y1: number; text: string; name: string };

const axisCanvas = (page: Page): Locator => page.getByLabel(/^Ось времени/);
const labels = (page: Page, row: 'major' | 'week' | 'minor' | 'sticky'): Locator =>
	page.getByRole('group', { name: 'Подписи оси' }).locator(`button[data-row="${row}"]`);
const rects = (row: Locator): Promise<Rect[]> =>
	row.evaluateAll((buttons) =>
		buttons.map((button) => {
			const style = (button as HTMLElement).style;
			const x0 = parseFloat(style.left);
			const y0 = parseFloat(style.top);
			return {
				x0,
				x1: x0 + parseFloat(style.width),
				y0,
				y1: y0 + parseFloat(style.height),
				text: button.textContent ?? '',
				name: button.getAttribute('aria-label') ?? ''
			};
		})
	);
const setScale = async (page: Page, label: string, days: number): Promise<number> => {
	await chooseScale(page, label);
	await expect(page.getByTestId('window-span')).toHaveAttribute('data-days', String(days));
	const width = await axisCanvas(page).evaluate((canvas) => canvas.clientWidth);
	return width / days;
};
const pixels = (canvas: Locator, points: [number, number][]): Promise<number[][]> =>
	canvas.evaluate((element, points) => {
		const g = (element as HTMLCanvasElement).getContext('2d')!;
		const dpr = devicePixelRatio || 1;
		return points.map(([x, y]) => [
			...g.getImageData(Math.round(x * dpr), Math.round(y * dpr), 1, 1).data
		]);
	}, points);

test('axis rows follow the §6 scale table for every toolbar scale', async ({ page }) => {
	await loadTime(page, { manifest: 'dense' });

	for (const [label, days] of SCALES) {
		const ppd = await setScale(page, label, days);
		const expected = rowsFor(ppd);
		const minorUnit = expected.minor === 'weekday' ? 'day' : expected.minor;
		await expect(labels(page, 'major').first()).toHaveAttribute('data-unit', expected.major);
		await expect(labels(page, 'minor').first()).toHaveAttribute('data-unit', minorUnit);
		if (expected.middle) {
			await expect(labels(page, 'week').first()).toHaveAttribute('data-unit', 'week');
		} else await expect(labels(page, 'week')).toHaveCount(0);

		const major = await labels(page, 'major').allTextContents();
		const minor = await labels(page, 'minor').allTextContents();
		expect(major.length, `${label}: major row`).toBeGreaterThan(0);
		expect(minor.length, `${label}: minor row`).toBeGreaterThan(0);
		for (const text of major) expect(text, `${label}: major`).toMatch(MAJOR[expected.major]);
		for (const text of minor) expect(text, `${label}: minor`).toMatch(MINOR[expected.minor]);
		for (const text of await labels(page, 'week').allTextContents()) {
			expect(text, `${label}: week`).toMatch(WEEK);
		}
		if (expected.major === 'month') {
			// January is the only month label that carries the year; the rest never repeat it.
			expect(
				major.filter((text) => /\d{4}/.test(text)).every((text) => text.startsWith('янв'))
			).toBe(true);
		}
		if (expected.minor === 'day' && ppd < 22) {
			for (const text of minor) expect([1, 5, 10, 15, 20, 25]).toContain(Number(text));
		}
	}
});

test('a sticky plate names the period under the left edge', async ({ page }) => {
	await loadTime(page);
	await setScale(page, 'неделя', 7);

	const sticky = labels(page, 'sticky');
	await expect(sticky).toHaveCount(1);
	await expect(sticky).toHaveCSS('left', '4px');
	await expect(sticky).toHaveAttribute('data-unit', 'month');
	await expect(sticky).toHaveText(STICKY);

	const [plate] = await rects(sticky);
	const [firstMajor] = await rects(labels(page, 'major'));
	expect(firstMajor.x0).toBe(0);
	expect(plate.name).toBe(firstMajor.name);
	expect(plate.y0).toBe(firstMajor.y0);

	// Panning keeps the plate pinned to the left edge.
	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('ArrowRight');
	await expect(sticky).toHaveCSS('left', '4px');
	await expect(sticky).toHaveText(STICKY);
});

test('week zebra is drawn on the axis and nowhere on the canvas', async ({ page }) => {
	await loadTime(page, { manifest: 'dense' });
	const ppd = await setScale(page, 'квартал', 91);
	expect(ppd).toBeGreaterThanOrEqual(7);

	const canvas = axisCanvas(page);
	const width = await canvas.evaluate((element) => element.clientWidth);
	const weeks = (await rects(labels(page, 'week'))).filter((w) => w.x0 >= 0 && w.x1 <= width);
	expect(weeks.length).toBeGreaterThanOrEqual(3);
	const parity = (week: Rect) => Number(week.text.slice(1)) % 2;
	const odd = weeks.find((week) => parity(week) === 1)!;
	const even = weeks.find((week) => parity(week) === 0)!;
	// Sample the right end of the week band, away from the label glyphs and boundary lines.
	const at = (week: Rect): [number, number] => [week.x1 - 4, week.y0 + (week.y1 - week.y0) * 0.8];
	const [oddPixel, evenPixel] = await pixels(canvas, [at(odd), at(even)]);
	expect(oddPixel[3], 'odd ISO week is tinted').toBeGreaterThan(0);
	expect(evenPixel[3], 'even ISO week stays clear').toBe(0);

	const ribbon = page.getByLabel(/^Лента/);
	await expect(ribbon).toBeVisible();
	await expect(ribbon).toHaveCSS('background-image', 'none');
	// Scope ranges are a separate tint; sample the clear strip above the first track.
	await toggleLegend(page, 'scopeRange');
	const ribbonCanvas = page.getByTestId('ribbon-canvas');
	await expect(ribbonCanvas).toBeVisible();
	await expect
		.poll(async () =>
			(
				await pixels(ribbonCanvas, [
					[odd.x1 - 3, 2],
					[even.x1 - 3, 2]
				])
			).map((rgba) => rgba[3])
		)
		.toEqual([0, 0]);
});

test('clicking a period label selects that period in Context', async ({ page }) => {
	await loadTime(page);
	await setScale(page, 'квартал', 91);

	const context = page.getByRole('complementary', { name: 'Context' });
	const heading = context.getByRole('heading', { level: 2 });
	const goTo = page.getByRole('button', { name: 'К выбранному' });
	await expect(goTo).toBeDisabled();

	const months = labels(page, 'major');
	const monthRects = await rects(months);
	const visibleMonth = monthRects.findIndex((month) => month.x0 > 0);
	await months.nth(visibleMonth).click();
	await expect(context).toContainText('Месяц ·');
	await expect(heading).toHaveText(monthRects[visibleMonth].name);
	await expect(months.nth(visibleMonth)).toHaveAttribute('aria-pressed', 'true');
	await expect(goTo).toBeEnabled();

	const week = labels(page, 'week').nth(2);
	await week.click();
	await expect(context).toContainText('Неделя ·');
	await expect(heading).toHaveText((await week.getAttribute('aria-label')) ?? '');

	// The twin is real: a day label reached from the keyboard selects the same way.
	const day = labels(page, 'minor').nth(3);
	await day.focus();
	await page.keyboard.press('Enter');
	await expect(context).toContainText('День ·');
	await expect(heading).toHaveText((await day.getAttribute('aria-label')) ?? '');
	await expect(day).toHaveAttribute('aria-pressed', 'true');
	await expect(months.nth(visibleMonth)).toHaveAttribute('aria-pressed', 'false');
});

for (const manifest of [null, 'dense'] as const) {
	test(`zoom keeps the ${manifest ?? 'empty'} ribbon and period hit areas inside the viewport`, async ({
		page
	}) => {
		await loadTime(page, { manifest });
		const scroller = page.locator('section[aria-label="Time"] > .overflow-auto');
		const checkWidth = async () => {
			await expect
				.poll(() => scroller.evaluate((node) => node.scrollWidth - node.clientWidth))
				.toBeLessThanOrEqual(1);
			const outside = await page.getByRole('group', { name: 'Подписи оси' }).evaluate((node) => {
				const axis = node.getBoundingClientRect();
				return [...node.querySelectorAll('button')].filter((button) => {
					const hit = button.getBoundingClientRect();
					return hit.left < axis.left - 0.1 || hit.right > axis.right + 0.1;
				}).length;
			});
			expect(outside).toBe(0);
			expect(await scroller.evaluate((node) => node.scrollLeft)).toBe(0);
		};
		await checkWidth();
		for (const scale of ['3 года', 'год', 'день', 'месяц']) {
			await chooseScale(page, scale);
			await checkWidth();
		}
		const canvas = (await page.getByTestId('ribbon-canvas').boundingBox())!;
		await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + 80);
		for (const delta of [280, -400]) {
			const span = await page.getByTestId('window-span').getAttribute('data-days');
			await page.mouse.wheel(0, delta);
			await expect(page.getByTestId('window-span')).not.toHaveAttribute('data-days', span!);
			await checkWidth();
		}
		const last = labels(page, 'major').last();
		await last.focus();
		await last.press('Enter');
		await expect(
			page.getByRole('complementary', { name: 'Context', exact: true }).locator('h2')
		).toBeVisible();
		await checkWidth();
		await page.screenshot({ path: `test-results/c9a-zoom-${manifest ?? 'empty'}.png` });
	});
}
