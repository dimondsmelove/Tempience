import { expect, test } from '@playwright/test';

test('mouse wheel advances one value immediately throughout a continuous sequence', async ({
	page
}) => {
	await page.goto('/experiments/time-input?view=field');
	await page.getByTestId('when-field').click();
	const hours = page.getByRole('listbox', { name: 'Часы', exact: true });
	await hours.hover();
	for (let hour = 0; hour < 8; hour++) {
		await page.mouse.wheel(0, 132);
		await page.waitForTimeout(35);
		// Read during the sequence, without retrying until a scroll debounce expires.
		expect(await hours.locator('[aria-selected=true]').innerText()).toBe(
			String(hour).padStart(2, '0')
		);
	}
	await page.mouse.wheel(0, -132);
	await expect(hours.getByRole('option', { name: 'Часы: 06', exact: true })).toHaveAttribute(
		'aria-selected',
		'true'
	);
	const minutes = page.getByRole('listbox', { name: 'Минуты', exact: true });
	await minutes.hover();
	await page.mouse.wheel(0, 132);
	await expect(minutes.getByRole('option', { name: 'Минуты: 01', exact: true })).toHaveAttribute(
		'aria-selected',
		'true'
	);
	await minutes.dispatchEvent('wheel', {
		deltaY: 3,
		deltaMode: 1,
		bubbles: true,
		cancelable: true
	});
	await expect(minutes.getByRole('option', { name: 'Минуты: 02', exact: true })).toHaveAttribute(
		'aria-selected',
		'true'
	);
});

test('small trackpad deltas accumulate without waiting for scrolling to stop', async ({ page }) => {
	await page.goto('/experiments/time-input?view=field');
	await page.getByTestId('when-field').click();
	const hours = page.getByRole('listbox', { name: 'Часы', exact: true });
	await hours.hover();
	for (let i = 0; i < 3; i++) await page.mouse.wheel(0, 11);
	await expect(hours.getByRole('option', { name: 'Часы: —', exact: true })).toHaveAttribute(
		'aria-selected',
		'true'
	);
	await page.mouse.wheel(0, 11);
	await expect(hours.getByRole('option', { name: 'Часы: 00', exact: true })).toHaveAttribute(
		'aria-selected',
		'true'
	);
});
