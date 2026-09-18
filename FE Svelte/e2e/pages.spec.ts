import { expect, test } from '@playwright/test';
import { loadTime } from './time/helpers';

for (const width of [1440, 390]) {
	test(`direct pages share the compact header and Pair opens from local data at ${width}px`, async ({
		page
	}) => {
		await page.setViewportSize({ width, height: 900 });
		await loadTime(page, { manifest: 'dense' });
		const header = page.getByTestId('identity-bar');
		await expect(header.getByRole('navigation', { name: 'Поверхности' })).toHaveCount(0);
		for (const name of ['Time', 'Life', 'Types', 'Pair'])
			await expect(header.getByRole('link', { name, exact: true })).toHaveCount(0);
		const headerClass = await header.getAttribute('class');
		const headerHeight = (await header.boundingBox())!.height;
		await header.getByRole('button', { name: /Синхронизация:/ }).click();
		await page.screenshot({ path: `e2e/artifacts/pages-local-data-${width}.png` });
		await page.getByRole('status').getByRole('link', { name: 'Pair', exact: true }).click();
		await expect(page.getByRole('heading', { name: 'Подключить устройство' })).toBeVisible();
		await expect(header).toHaveClass(headerClass!);
		expect((await header.boundingBox())!.height).toBe(headerHeight);
		await expect(header.getByTestId('appearance-open')).toBeVisible();
		await page.screenshot({ path: `e2e/artifacts/pages-pair-${width}.png` });

		await page.goto('/life');
		await expect(page.getByRole('heading', { name: 'Life', exact: true })).toBeVisible();
		await expect(header).toHaveClass(headerClass!);
		expect((await header.boundingBox())!.height).toBe(headerHeight);
		await expect(page.locator('#life-from')).toBeVisible();
		await page.getByRole('button', { name: 'Месяцы', exact: true }).click();
		await expect(page.getByRole('button', { name: 'Месяцы', exact: true })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		const scopes = page.getByLabel('Scope focus', { exact: true });
		await expect(scopes.locator('option')).not.toHaveCount(1);
		await scopes.selectOption({ index: 1 });
		await page.getByRole('checkbox', { name: 'Scope в будущее' }).check();
		await page.getByRole('button', { name: 'Сбросить', exact: true }).click();
		await expect(scopes).toHaveValue('');
		await header.getByTestId('appearance-open').click();
		await page.getByRole('button', { name: 'Светлая', exact: true }).click();
		await page
			.getByRole('dialog', { name: 'Внешний вид' })
			.getByRole('button', { name: 'Применить', exact: true })
			.click();
		await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
			true
		);
		await page.screenshot({ path: `e2e/artifacts/pages-life-${width}.png` });

		await page.goto('/forms');
		await expect(page.getByTestId('trace-forms')).toBeVisible();
		await expect(header).toHaveClass(headerClass!);
		await page.goto('/');
		await expect(page.getByTestId('time-workbench')).toHaveAttribute('data-status', 'ready');
	});
}
