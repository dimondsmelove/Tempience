import { expect, test } from '@playwright/test';
import { datedRows, openHistorySpace, openKindHistory, versionTable } from './kind-history.helpers';

for (const width of [390, 1440]) {
	test.describe('Kind history value conditions at ' + width, () => {
		test.use({
			actionTimeout: 5000,
			viewport: { width, height: 900 },
			isMobile: width === 390,
			hasTouch: width === 390
		});
		test('a condition is what its control shows: nothing carried over from another field', async ({
			page
		}) => {
			test.setTimeout(90_000);
			const errors: string[] = [];
			page.on('pageerror', (error) => errors.push(error.message));
			await openHistorySpace(page);
			await openKindHistory(page, 'Сон');
			const surface = page.getByTestId('kind-data-surface');
			const table = versionTable(page, 1);
			await expect(datedRows(table)).toHaveCount(6);
			await surface.getByText('Фильтры истории', { exact: true }).click();
			const field = surface.getByRole('combobox', { name: 'Поле' });
			const value = surface.getByTestId('history-value');
			const add = surface.getByRole('button', { name: 'Добавить условие', exact: true });
			const active = surface.getByTestId('history-active');

			// A number typed for «Часы» is nothing for «Глубокий сон»: the yes/no starts unchosen.
			await field.selectOption({ label: 'Часы' });
			await value.fill('7');
			await expect(add).toBeEnabled();
			await field.selectOption({ label: 'Глубокий сон' });
			await expect(value).toHaveValue('');
			await expect(add).toBeDisabled();
			await value.selectOption({ label: 'да' });
			await add.click();
			await expect(active).toContainText('Глубокий сон = да');
			await expect(datedRows(table)).toHaveCount(3);
			await active.getByRole('button', { name: 'Убрать условие Глубокий сон = да' }).click();
			await expect(datedRows(table)).toHaveCount(6);
			// An explicit «нет» is a value of its own.
			await expect(value).toHaveValue('');
			await value.selectOption({ label: 'нет' });
			await add.click();
			await expect(active).toContainText('Глубокий сон = нет');
			await expect(datedRows(table)).toHaveCount(3);
			await active.getByRole('button', { name: 'Убрать условие Глубокий сон = нет' }).click();

			// A text typed for «Заметка» is nothing for «Качество»: the choice starts unchosen.
			await field.selectOption({ label: 'Заметка' });
			await value.fill('Ночь');
			await expect(add).toBeEnabled();
			await field.selectOption({ label: 'Качество' });
			await expect(value).toHaveValue('');
			await expect(add).toBeDisabled();
			await value.selectOption({ label: 'Хороший' });
			await add.click();
			await expect(active).toContainText('Качество = Хороший');
			await expect(datedRows(table)).toHaveCount(2);
			await page.screenshot({ path: 'e2e/artifacts/kind-history-conditions-' + width + '.png' });
			await active.getByRole('button', { name: 'Убрать условие Качество = Хороший' }).click();
			await expect(datedRows(table)).toHaveCount(6);
			// Back to the number: the value starts over there too, and a number applies as typed.
			await field.selectOption({ label: 'Часы' });
			await expect(value).toHaveValue('');
			await surface.getByRole('combobox', { name: 'Условие' }).selectOption({ label: 'не меньше' });
			await value.fill('8');
			await add.click();
			await expect(active).toContainText('Часы >= 8');
			await expect(datedRows(table)).toHaveCount(2);
			expect(errors).toEqual([]);
		});
	});
}
