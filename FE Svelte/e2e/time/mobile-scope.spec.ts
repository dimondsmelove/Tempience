import { expect, test } from '@playwright/test';
import { loadTime } from './helpers';

for (const width of [360, 390]) {
	test(`Scope ${width}: a long list keeps the complete search header at every sheet height`, async ({
		page
	}) => {
		await page.setViewportSize({ width, height: 844 });
		await loadTime(page, { manifest: 'dense' });
		const open = page.getByRole('button', { name: 'Scope', exact: true });
		await open.tap();
		await page.getByTestId('scope-menu-toggle').click();
		await page.getByRole('button', { name: 'Строки выше', exact: true }).click();
		await page.keyboard.press('Escape');
		for (const name of ['Работа', 'Дом'])
			await page
				.getByTestId('scope-rail-rows')
				.getByRole('button', { name: `Раскрыть Scope ${name}`, exact: true })
				.click();
		await page.keyboard.press('Escape');
		await expect(page.getByTestId('bottom-sheet')).toHaveCount(0);
		await open.tap();
		const sheet = page.getByTestId('bottom-sheet');
		const content = sheet.locator('.sheet-content');
		const search = page.getByRole('searchbox', { name: 'Поиск Scope' });
		const checkHeader = async () => {
			for (const control of [
				search,
				page.getByTestId('scope-menu-toggle'),
				page.getByTestId('scope-close')
			])
				await expect(control).toBeInViewport({ ratio: 1 });
			// Measure in one frame while the sheet animates after viewport/height changes.
			const relativeTop = await search.evaluate(
				(el) =>
					el.getBoundingClientRect().top - el.closest('.sheet-content')!.getBoundingClientRect().top
			);
			expect(relativeTop).toBeGreaterThanOrEqual(0);
			await expect(page.getByTestId('appearance-open')).toBeInViewport({ ratio: 1 });
		};
		await page.screenshot({ path: `test-results/mobile-scope-${width}.png` });
		await checkHeader();
		const body = (await content.boundingBox())!;
		await page.mouse.move(body.x + body.width / 2, body.y + body.height - 20);
		await page.mouse.wheel(0, 300);
		await expect.poll(() => content.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
		await checkHeader();
		await page.setViewportSize({ width, height: 480 });
		await checkHeader();
		await sheet.locator('.sheet-grip').press('ArrowDown');
		await expect(sheet).toHaveAttribute('data-position', 'peek');
		await checkHeader();
		await page.getByTestId('scope-close').tap();
		await expect(sheet).toHaveCount(0);
	});
}
