import { expect, test, type Page } from '@playwright/test';
import { loadTime } from './helpers';
import { exportBackup } from '../public/helpers';

/** The Kind list of the filters stays folded until asked (owner 2026-09-15). */
const openKindFilters = async (page: Page): Promise<void> => {
	const details = page.getByTestId('kind-filters');
	if (!(await details.evaluate((element) => (element as HTMLDetailsElement).open)))
		await details.locator('summary').click();
};

for (const width of [390, 1440]) {
	test.describe('Kind workspace at ' + width, () => {
		test.use({
			actionTimeout: 5000,
			viewport: { width, height: 900 },
			isMobile: width === 390,
			hasTouch: width === 390
		});
		test('builds in Context, fills through Scope, reads and edits data, and filters only the timeline', async ({
			page
		}) => {
			test.setTimeout(90000);
			const errors: string[] = [];
			page.on('pageerror', (error) => errors.push(error.message));
			await loadTime(page, { manifest: 'dense' });
			const workbenchUrl = page.url();
			await page.getByTestId('kinds-open').click();
			const forms = page.getByTestId('trace-forms');
			await expect(forms).toBeVisible();
			await forms.getByRole('button', { name: 'Новый Trace Kind', exact: true }).click();
			await forms.getByLabel('Название Trace Kind').fill('Наблюдение');
			await forms.getByLabel('Название поля', { exact: true }).fill('Оценка');
			await forms.getByRole('combobox', { name: 'Тип поля', exact: true }).selectOption('number');
			await page.screenshot({ path: 'e2e/artifacts/kinds-builder-' + width + '.png' });
			await forms.getByRole('button', { name: 'Создать Trace Kind', exact: true }).click();
			await expect(forms.getByRole('status')).toContainText('Trace Kind создан');
			await expect(page).toHaveURL(workbenchUrl);
			await forms.getByTestId('kind-data').click();
			const data = page.getByTestId('kind-data-surface');
			await expect(data).toBeVisible();
			// The history: one table per version, its own fields as headers, even with no record yet.
			await expect(data).toContainText('Записей этой версии нет');
			await expect(data.getByRole('columnheader', { name: 'Оценка', exact: true })).toBeVisible();
			await expect(data.getByTestId('dataset-row')).toHaveCount(0);
			await data.getByRole('button', { name: 'Записать', exact: true }).click();
			const editor = page.getByTestId('trace-editor');
			await expect(editor.getByRole('button', { name: 'Сохранить', exact: true })).toBeDisabled();
			const valueInput = editor.getByRole('spinbutton', { name: /Оценка/ });
			await expect(valueInput).toBeEnabled();
			await valueInput.fill('7');
			await page.screenshot({ path: 'e2e/artifacts/kinds-draft-' + width + '.png' });

			// A Scope of the record is a membership choice; no Kind wiring step lives in the form.
			await editor.getByLabel('Выбрать Scope').selectOption({ label: 'Работа' });
			await expect(valueInput).toHaveValue('7');
			await editor.getByTestId('trace-time').click();
			await page.getByTestId('choose-timeline').click();
			await expect(page.getByTestId('kind-data-surface')).toHaveCount(0);
			await page.getByTestId('choose-picker').click();
			await page.getByRole('button', { name: 'Отменить изменение времени', exact: true }).click();
			await expect(editor.getByRole('spinbutton', { name: /Оценка/ })).toHaveValue('7');
			await expect(editor.getByLabel('Описание', { exact: true })).toHaveValue('');
			await editor.getByRole('button', { name: 'Сохранить', exact: true }).click();
			await expect(page.getByTestId('selected-title')).toContainText('7');
			await page.getByTestId('context-collapse').click();
			await expect(data.getByTestId('dataset-row')).toHaveCount(1);
			// An explicit Scope filter, visible while it applies; the entry itself added none.
			await expect(data.getByTestId('history-active')).toContainText('Фильтров нет');
			await data.getByText('Фильтры истории', { exact: true }).click();
			await data
				.getByRole('combobox', { name: 'Scope', exact: true })
				.selectOption({ label: 'Здоровье' });
			await expect(data.getByTestId('dataset-row')).toHaveCount(0);
			await expect(data.getByTestId('history-active')).toContainText('Scope: Здоровье');
			await data
				.getByRole('combobox', { name: 'Scope', exact: true })
				.selectOption({ label: 'Работа' });
			await expect(data.getByTestId('dataset-row')).toHaveCount(1);
			await data.getByRole('button', { name: 'Записать', exact: true }).click();
			await expect(
				editor.getByRole('button', { name: 'Убрать Scope Работа', exact: true })
			).toBeVisible();
			await editor.getByRole('spinbutton', { name: /Оценка/ }).fill('8');
			await editor.getByRole('button', { name: 'Сохранить', exact: true }).click();
			await expect(page.getByTestId('selected-title')).toContainText('8');
			await page.getByTestId('context-collapse').click();
			await expect(data.getByTestId('dataset-row')).toHaveCount(2);
			const open = data.getByRole('button', { name: 'Открыть запись', exact: true }).first();
			await open.focus();
			await page.keyboard.press('Enter');
			await expect(page.getByTestId('context-overview')).toBeVisible();
			await page.getByTestId('edit-trace').click();
			await expect(page.getByTestId('context-neighborhood')).toHaveCount(0);
			await editor.getByRole('spinbutton', { name: /Оценка/ }).fill('9');
			await editor.getByRole('button', { name: 'Сохранить', exact: true }).click();
			await expect(page.getByTestId('selected-title')).toContainText('9');
			await page.getByTestId('context-collapse').click();
			await expect(data.getByTestId('dataset-row').filter({ hasText: '9' })).not.toHaveCount(0);
			await data.getByRole('button', { name: 'Trace Kind', exact: true }).click();
			await forms.getByRole('button', { name: 'Изменить форму', exact: true }).click();
			await forms.getByRole('combobox', { name: 'Новое поле', exact: true }).selectOption('text');
			await forms.getByRole('button', { name: 'Добавить поле', exact: true }).click();
			await forms.getByLabel('Название поля', { exact: true }).nth(1).fill('Обстоятельства');
			await forms
				.getByRole('checkbox', { name: 'Обязательное поле', exact: true })
				.nth(1)
				.uncheck();
			await forms.getByRole('button', { name: 'Сохранить изменения', exact: true }).click();
			await expect(forms.getByRole('status')).toContainText('Новая версия сохранена');
			await forms.getByTestId('kind-data').click();
			// The two records stay in the table of the version they were written with; the new
			// version's table names its own fields and has no record yet.
			await expect(data.getByTestId('dataset-row')).toHaveCount(2);
			await expect(data.getByTestId('version-table')).toHaveCount(2);
			await expect(
				data.getByRole('columnheader', { name: 'Обстоятельства', exact: true })
			).toBeVisible();
			if (width === 1440) await page.getByTestId('context-collapse').click();
			await page.screenshot({ path: 'e2e/artifacts/kinds-data-' + width + '.png' });
			const backup = await exportBackup(page);
			const typed = backup.collections.traces.filter((trace: { kindId?: string }) =>
				Boolean(trace.kindId)
			);
			expect(typed).toHaveLength(2);
			expect(new Set(typed.map((trace: { kindVId: string }) => trace.kindVId)).size).toBe(1);
			expect(backup.collections.traceKindVersions).toHaveLength(2);
			await data.getByRole('button', { name: 'Лента', exact: true }).click();
			const ids = typed.map((trace: { id: string }) => trace.id);
			const marks = page.getByTestId('ribbon-twin').locator('[data-trace-id="' + ids[0] + '"]');
			// Typed records stand on the ribbon only once their Kind is ticked in the filters (owner 2026-09-15).
			await expect(marks).toHaveCount(0);
			await page.getByTestId('filters-toggle').click();
			await openKindFilters(page);
			await page
				.getByTestId('kind-filters')
				.getByRole('checkbox', { name: 'Наблюдение', exact: true })
				.check();
			await page.keyboard.press('Escape');
			await expect(marks).not.toHaveCount(0);
			const before = await page.getByTestId('ribbon-twin').getByRole('button').count();
			await page.getByTestId('filters-toggle').click();
			await openKindFilters(page);
			await page
				.getByTestId('kind-filters')
				.getByRole('checkbox', { name: 'Наблюдение', exact: true })
				.uncheck();
			await page.keyboard.press('Escape');
			await expect(marks).toHaveCount(0);
			await expect(page.getByTestId('ribbon-twin').getByRole('button')).not.toHaveCount(0);
			expect(await page.getByTestId('ribbon-twin').getByRole('button').count()).toBeLessThan(
				before
			);
			await page.getByTestId('kinds-open').click();
			await forms.getByLabel('Найти Trace Kind').fill('набл');
			await forms.getByRole('button', { name: 'Наблюдение', exact: true }).click();
			await forms.getByTestId('kind-data').click();
			await expect(data.getByTestId('dataset-row')).toHaveCount(2);
			// The history kept its Scope filter across the timeline and the catalog.
			await expect(data.getByTestId('history-active')).toContainText('Scope: Работа');
			expect(errors).toEqual([]);
			expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
				true
			);
		});
	});
}
