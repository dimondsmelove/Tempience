import { expect, test, type Page } from '@playwright/test';
import { ARTIFACTS, cleanConsole } from './draft.helpers';
import { loadTime } from './helpers';
import { panel, showOverview } from './results.helpers';

cleanConsole(test, 'i5b-console-membership.log');

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

const belongings = (page: Page) => panel(page).getByTestId('belongings');
const history = (page: Page) => panel(page).getByTestId('context-history');

test.describe('A record, its Scopes and what its own history says about them', () => {
	test('renaming a Scope is not the record own history; leaving one is', async ({ page }) => {
		test.setTimeout(180_000);
		await loadTime(page, { manifest: 'dense' });
		// The Scope is renamed: the membership itself is untouched by that.
		await page.getByRole('button', { name: 'Выбрать Scope Работа', exact: true }).click();
		await panel(page).getByRole('button', { name: 'Редактировать Scope' }).click();
		const editor = panel(page).getByTestId('scope-editor');
		await editor.getByLabel('Название Scope').fill('Работа П');
		await editor.getByRole('button', { name: 'Сохранить Scope' }).click();
		await expect(panel(page).getByTestId('selected-title')).toHaveText('Работа П');
		await panel(page).getByTestId('scope-record').first().click();
		await showOverview(page);
		const name = await panel(page).getByTestId('selected-title').textContent();
		// The record still belongs where it belonged, under the name the Scope has now.
		const rows = belongings(page).getByTestId('belonging');
		const before = await rows.count();
		await expect(rows.filter({ hasText: 'Работа П' })).toHaveCount(1);
		// A membership is to one Scope; the row shows the path down to it, renamed root first.
		const path = (await rows.first().textContent()) ?? '';
		const scope = path.split('›').at(-1)!.trim();
		const entries = history(page).getByTestId('history-operation');
		const told = await entries.count();
		await expect(entries.getByText('Работа П')).toHaveCount(0);
		// Leaving the Scope is this record's own action, and its history says so by name.
		await belongings(page).getByTestId('belonging-remove').first().click();
		await expect(rows).toHaveCount(before - 1);
		await expect(entries).toHaveCount(told + 1);
		await expect(history(page).getByTestId('history-subject').first()).toContainText(scope);
		await page.screenshot({ path: `${ARTIFACTS}/i5b-rev-membership-1440.png`, fullPage: true });
		// And it can be taken back, as the action it was.
		await page.getByTestId('undo-toast').getByTestId('undo').click();
		await expect(page.getByTestId('undo-toast')).toHaveCount(0);
		await expect(rows).toHaveCount(before);
		await expect(rows.filter({ hasText: 'Работа П' })).toHaveCount(1);
		// Leaving the last Scope is said outright: the record is somewhere, and it says where.
		for (let left = before; left > 0; left--) {
			await belongings(page).getByTestId('belonging-remove').first().click();
			await expect(rows).toHaveCount(left - 1);
		}
		await expect(belongings(page)).toContainText('Запись теперь без Scope');
		expect(name).toBeTruthy();
	});
});
