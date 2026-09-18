import { expect, test, type Page, type Locator } from '@playwright/test';
import { loadTime, settleCamera } from './helpers';

const selectTrace = async (page: Page) => {
	await loadTime(page);
	await page
		.getByTestId('scope-canvas-names')
		.getByRole('button', { name: 'Выбрать Scope Работа', exact: true })
		.click();
	await page.getByTestId('scope-record').filter({ hasText: 'Начал проект' }).click();
	await settleCamera(page);
	await expect(page.getByTestId('selected-title')).toHaveText('Начал проект');
};

const grip = (page: Page) => page.getByTestId('bottom-sheet').locator('.sheet-grip');
const stop = async (page: Page, position: string) => {
	const sheet = page.getByTestId('bottom-sheet');
	await expect(sheet).toHaveAttribute('data-position', position);
	await expect
		.poll(() =>
			sheet.evaluate((el) =>
				Math.abs(
					el.getBoundingClientRect().height - Number.parseFloat((el as HTMLElement).style.height)
				)
			)
		)
		.toBeLessThan(1);
};

const swipe = async (page: Page, target: Locator, dy: number, cancelled = false) => {
	const box = (await target.boundingBox())!;
	const x = box.x + box.width / 2,
		y = box.y + box.height / 2;
	const session = await page.context().newCDPSession(page);
	// Keep the intended swipe speed independent of CDP round-trip scheduling.
	const started = Date.now() / 1000;
	await session.send('Input.dispatchTouchEvent', {
		type: 'touchStart',
		timestamp: started,
		touchPoints: [{ id: 0, x, y }]
	});
	for (let i = 1; i <= 6; i++) {
		await session.send('Input.dispatchTouchEvent', {
			type: 'touchMove',
			timestamp: started + i * 0.02,
			touchPoints: [{ id: 0, x, y: y + (dy * i) / 6 }]
		});
	}
	await session.send('Input.dispatchTouchEvent', {
		type: cancelled ? 'touchCancel' : 'touchEnd',
		timestamp: started + 0.13,
		touchPoints: []
	});
	await session.detach();
};

test('all sheet heights keep the full Context and an unfinished edit', async ({ page }) => {
	await selectTrace(page);
	await stop(page, 'half');
	await expect(page.getByTestId('selected-title')).toBeInViewport();
	await expect(page.getByTestId('edit-trace')).toBeInViewport();
	await page.screenshot({ path: 'test-results/mobile-sheet-initial.png' });
	await page.getByTestId('edit-trace').click();
	const text = page.getByLabel('Название', { exact: true });
	await text.fill('Несохранённая правка');
	await grip(page).press('ArrowDown');
	await stop(page, 'peek');
	await expect(text).toBeVisible();
	await expect(page.getByTestId('context-peek')).toHaveCount(0);
	await text.scrollIntoViewIfNeeded();
	await expect(text).toHaveValue('Несохранённая правка');
	await grip(page).press('ArrowUp');
	await grip(page).press('ArrowUp');
	await stop(page, 'full');
	await expect(text).toHaveValue('Несохранённая правка');
	await page.screenshot({ path: 'test-results/mobile-sheet-full-edit.png' });
});

test('header flicks expand and dismiss without changing selection or firing history', async ({
	page
}) => {
	await selectTrace(page);
	await stop(page, 'half');
	const scrollTop = () =>
		page.locator('section[aria-label="Time"] > div').evaluate((el) => el.scrollTop);
	const before = await scrollTop();
	// Start on a real header button: a swipe must not also activate history-back.
	await swipe(page, page.getByTestId('history-back'), -110);
	await stop(page, 'full');
	expect(await scrollTop()).toBe(before);
	await expect(page.getByTestId('selected-title')).toHaveText('Начал проект');
	await expect(page.getByTestId('history-position')).toHaveText('2 / 2');
	await page.getByTestId('history-back').tap();
	await expect(page.getByTestId('selected-title')).toHaveText('Работа');
	await page.getByTestId('history-forward').tap();
	await expect(page.getByTestId('selected-title')).toHaveText('Начал проект');
	await grip(page).press('ArrowDown');
	await stop(page, 'half');
	await swipe(page, page.getByTestId('history-position'), 170);
	await expect(page.getByTestId('bottom-sheet')).toHaveCount(0);
	await expect(page.getByTestId('ribbon-twin').locator('[aria-current="true"]')).not.toHaveCount(0);
});

test('body scrolling and a cancelled header drag keep the current sheet stop', async ({ page }) => {
	await selectTrace(page);
	await stop(page, 'half');
	await grip(page).press('ArrowDown');
	await stop(page, 'peek');
	const body = page.getByTestId('context-body');
	await swipe(page, body, -90);
	await expect.poll(() => body.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
	await expect(page.getByTestId('bottom-sheet')).toHaveAttribute('data-position', 'peek');
	await grip(page).press('ArrowUp');
	await stop(page, 'half');
	await swipe(page, grip(page), -100, true);
	await stop(page, 'half');
	await expect(page.getByTestId('selected-title')).toHaveText('Начал проект');
	await grip(page).press('Enter');
	await stop(page, 'full');
});

for (const dismiss of ['empty canvas', 'close button']) {
	test(`${dismiss} dismisses Context and keeps selection until the clear button is used`, async ({
		page
	}) => {
		await selectTrace(page);
		await stop(page, 'half');
		const canvas = page.getByTestId('ribbon-canvas');
		const current = page.getByTestId('ribbon-twin').locator('[aria-current="true"]').first();
		const traceId = await current.getAttribute('data-trace-id');
		const windowOf = () =>
			page
				.getByTestId('time-workbench')
				.evaluate((el) => [
					el.getAttribute('data-window-start'),
					el.getAttribute('data-window-end')
				]);
		const before = await windowOf();
		if (dismiss === 'empty canvas') {
			const box = (await canvas.boundingBox())!;
			const empty = { x: box.x + box.width - 24, y: box.y + 150 };
			await page.touchscreen.tap(empty.x, empty.y);
			await expect(page.getByTestId('bottom-sheet')).toHaveCount(0);
			// Another single tap at a different empty point, outside the double-tap distance.
			await page.touchscreen.tap(empty.x - 60, empty.y + 20);
		} else {
			await page.screenshot({ path: 'test-results/mobile-context-close.png' });
			await page.getByRole('button', { name: 'Закрыть Context', exact: true }).tap();
		}
		await expect(page.getByTestId('bottom-sheet')).toHaveCount(0);
		await expect(current).toHaveAttribute('data-trace-id', traceId!);
		expect(await windowOf()).toEqual(before);
		const box = (await canvas.boundingBox())!;
		const x = Number(await current.getAttribute('data-x'));
		const y = Number(await current.getAttribute('data-y'));
		await page.touchscreen.tap(box.x + x, box.y + y);
		await stop(page, 'half');
		await expect(page.getByTestId('selected-title')).toHaveText('Начал проект');
		await expect(page.getByTestId('history-position')).toHaveText('2 / 2');
		await page.getByRole('button', { name: 'Снять выбор', exact: true }).tap();
		await expect(current).toHaveCount(0);
		await expect(page.getByTestId('history-position')).toHaveText('— / 2');
		await expect(page.getByText('Выбери запись или период', { exact: true })).toBeVisible();
	});
}
