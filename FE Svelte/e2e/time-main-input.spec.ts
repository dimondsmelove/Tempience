import { expect, test, type Page } from '@playwright/test';
import { loadTime, settleCamera } from './time/helpers';

test.use({ locale: 'ru-RU', timezoneId: 'Europe/Belgrade', actionTimeout: 5000 });
const windowOf = (page: Page) =>
	page
		.getByTestId('time-workbench')
		.evaluate((e) => [e.getAttribute('data-window-start'), e.getAttribute('data-window-end')]);
async function exactTime(page: Page, hour: string) {
	await page.getByTestId('clock-open').click();
	await page.getByRole('option', { name: `Часы: ${hour}`, exact: true }).click();
	await page.getByRole('option', { name: 'Минуты: 00', exact: true }).click();
	await page.locator('.clock-panel').getByRole('button', { name: 'Готово', exact: true }).click();
}
for (const width of [1280, 390]) {
	test(`main canvas round trip preserves form and browsing camera at ${width}`, async ({
		page
	}) => {
		await page.setViewportSize({ width, height: 900 });
		await loadTime(page, { manifest: 'dense', now: new Date('2026-09-09T10:00:00+02:00') });
		await page.goto('/experiments/time-input');
		await expect(page.getByTestId('time-workbench')).toHaveAttribute('data-status', 'ready');
		await page.getByLabel('Что произошло?').fill('Период через полночь');
		const before = await windowOf(page);
		await page.getByTestId('when-field').click();
		await page.getByTestId('choose-timeline').click();
		await expect(page.getByTestId('time-input-actions')).toBeVisible();
		await expect(page.getByTestId('time-input-rail')).toHaveCount(1);
		expect(
			await page.getByTestId('ribbon-canvas').evaluate((e) => Boolean(e.closest('[inert]')))
		).toBe(true);
		if (width === 390) {
			await expect(page.getByTestId('bottom-sheet')).toHaveAttribute('data-position', 'peek');
			await expect(page.getByTestId('prototype-form')).toBeVisible();
		}
		await page.getByRole('button', { name: 'Указать время', exact: false }).click();
		await exactTime(page, '10');
		await page.getByTestId('extend-end').click();
		await page.getByRole('button', { name: 'К дням', exact: false }).click();
		await page.getByRole('button', { name: 'Выбрать 10 сентября', exact: true }).click();
		await page.getByRole('button', { name: 'К часам', exact: false }).click();
		await exactTime(page, '11');
		await settleCamera(page);
		const draft = page.getByTestId('time-prototype');
		await expect(draft).toHaveAttribute(
			'data-start',
			String(new Date('2026-09-09T10:00:00+02:00').getTime())
		);
		await expect(draft).toHaveAttribute(
			'data-end',
			String(new Date('2026-09-10T11:00:00+02:00').getTime())
		);

		if (width === 1280) {
			const row = (await page.getByTestId('scope-rail-rows').locator('li').first().boundingBox())!;
			const canvas = (await page.getByTestId('ribbon-canvas').boundingBox())!;
			expect(Math.abs(row.y - canvas.y)).toBeLessThan(2);
		}
		await page.screenshot({ path: `e2e/artifacts/time-main-range-${width}.png` });

		await page.getByRole('button', { name: 'Применить', exact: true }).click();
		await expect(page.getByTestId('time-input-rail')).toHaveCount(0);
		expect(await windowOf(page)).toEqual(before);
		await expect(page.getByLabel('Что произошло?')).toHaveValue('Период через полночь');
		await expect(page.getByTestId('when-field')).toContainText(
			'9 сентября, 10:00 → 10 сентября, 11:00'
		);
		await expect(page.getByTestId('when-field')).toBeFocused();
		await page.getByTestId('when-field').click();
		await page.getByTestId('choose-timeline').click();
		await page.getByRole('button', { name: 'К дням', exact: false }).click();
		await page.getByRole('button', { name: 'Выбрать 8 сентября', exact: true }).click();
		await page.getByRole('button', { name: 'Отмена', exact: true }).click();
		expect(await windowOf(page)).toEqual(before);
		await expect(page.getByTestId('when-field')).toContainText(
			'9 сентября, 10:00 → 10 сентября, 11:00'
		);
		await expect(page.getByTestId('when-field')).toBeFocused();
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
			true
		);
	});
}

test('day and hour zoom renders intermediate frames without changing the draft', async ({
	page
}) => {
	await page.setViewportSize({ width: 1280, height: 900 });
	await loadTime(page, { manifest: 'dense' });
	await page.goto('/experiments/time-input');
	await page.getByTestId('when-field').click();
	await page.getByTestId('choose-timeline').click();
	const draft = page.getByTestId('time-prototype');
	for (const mode of ['day', 'minute']) {
		if (mode === 'minute')
			await page.getByRole('button', { name: 'Указать время', exact: false }).click();
		await settleCamera(page);
		const before = await draft.getAttribute('data-start');
		const frames = await page.evaluate(async () => {
			const rail = document.querySelector('[data-testid="time-input-rail"]')!;
			document.querySelector<HTMLButtonElement>('[aria-label="Приблизить шкалу"]')!.click();
			const spans: number[] = [];
			const started = performance.now();
			while (performance.now() - started < 400) {
				await new Promise(requestAnimationFrame);
				spans.push(
					Number(rail.getAttribute('data-window-end')) -
						Number(rail.getAttribute('data-window-start'))
				);
			}
			return spans;
		});
		expect(new Set(frames.map(Math.round)).size).toBeGreaterThan(4);
		await expect(draft).toHaveAttribute('data-start', before!);
	}

	const rail = page.getByTestId('time-input-rail');
	const box = (await rail.boundingBox())!;
	const beforePinch = await windowOf(page);
	const value = await draft.getAttribute('data-start');
	const cdp = await page.context().newCDPSession(page);
	await cdp.send('Input.dispatchTouchEvent', {
		type: 'touchStart',
		touchPoints: [
			{ id: 1, x: box.x + box.width * 0.4, y: box.y + 100 },
			{ id: 2, x: box.x + box.width * 0.6, y: box.y + 100 }
		]
	});
	await cdp.send('Input.dispatchTouchEvent', {
		type: 'touchMove',
		touchPoints: [
			{ id: 1, x: box.x + box.width * 0.2, y: box.y + 100 },
			{ id: 2, x: box.x + box.width * 0.8, y: box.y + 100 }
		]
	});
	await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
	expect(await windowOf(page)).not.toEqual(beforePinch);
	await expect(draft).toHaveAttribute('data-start', value!);
	await cdp.detach();
	await page.getByTestId('clock-open').click();
	await page.keyboard.press('Escape');
	await expect(draft).toHaveAttribute('data-picking', 'true');
	await page.keyboard.press('Escape');
	await expect(page.getByTestId('when-field')).toBeEnabled();
	await expect(page.getByTestId('when-field')).toBeFocused();
});
