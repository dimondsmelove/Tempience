import { expect, test, type Page } from '@playwright/test';
import { exportBackup } from '../public/helpers';
import { dialog } from './draft.helpers';
import { loadTime } from './helpers';
import { closeContext, panel } from './results.helpers';

type Backup = { collections: { traceKinds: unknown[]; traces: unknown[] } };

/** The Scope panel of the named Scope, through the rail — a sheet on a phone. */
const selectScope = async (page: Page, name: string): Promise<void> => {
	await closeContext(page);
	const rail = page.getByRole('button', { name: 'Scope', exact: true });
	if (await rail.isVisible()) await rail.click();
	await page.getByRole('button', { name: `Выбрать Scope ${name}`, exact: true }).click();
	await expect(panel(page).getByTestId('selected-title')).toHaveText(name);
};

const counts = (backup: Backup) => ({
	kinds: backup.collections.traceKinds.length,
	traces: backup.collections.traces.length
});

for (const width of [390, 1440]) {
	test.describe('Kind from the Scope panel at ' + width, () => {
		test.use({
			actionTimeout: 5000,
			viewport: { width, height: 900 },
			isMobile: width === 390,
			hasTouch: width === 390
		});
		/**
		 * TRACE_FORMS «навигация к Kind и истории»: the Scope panel makes a Kind with that Scope
		 * shown as its membership — visible, changeable, «Без Scope» still a choice. Publishing
		 * opens the same history and the same form; cancelling leaves no Kind and no record.
		 */
		test('starts a Kind in the Scope shown, publishes into its history, and leaves nothing when cancelled', async ({
			page
		}) => {
			test.setTimeout(90_000);
			const errors: string[] = [];
			page.on('pageerror', (error) => errors.push(error.message));
			await loadTime(page, { manifest: 'dense' });
			const before = counts(await exportBackup(page));
			await selectScope(page, 'Работа');
			const scope = panel(page).getByTestId('context-scope');
			const forms = page.getByTestId('trace-forms');
			const scopes = forms.getByTestId('kind-scopes');
			const inScope = scopes.getByRole('button', { name: 'Убрать Scope Работа', exact: true });

			// Cancelled: the constructor opened with the Scope shown; the return keeps nothing.
			await scope.getByTestId('scope-new-kind').click();
			await expect(forms).toBeVisible();
			await expect(inScope).toBeVisible();
			await expect(
				scopes.getByRole('button', { name: 'Убрать Scope Здоровье', exact: true })
			).toHaveCount(0);
			await expect(scopes.getByTestId('kind-no-scope')).toBeVisible();
			await forms.getByLabel('Название Trace Kind').fill('Черновик');
			// Leaving the catalog is leaving the Context (no «Вернуться к Context», TRACE_FORMS 2026-09-15).
			await page.getByTestId('context-collapse').click();
			await dialog(page)
				.getByTestId('discard-confirm')
				.click({ timeout: 2000 })
				.catch(() => {});
			await expect(forms).toHaveCount(0);
			await selectScope(page, 'Работа');
			expect(counts(await exportBackup(page))).toEqual(before);

			// Published: the Scope stays its membership; the history and the form are the shared ones.
			await selectScope(page, 'Работа');
			await scope.getByTestId('scope-new-kind').click();
			await expect(inScope).toBeVisible();
			await page.screenshot({ path: `e2e/artifacts/scope-kind-new-${width}.png`, fullPage: true });
			await forms.getByLabel('Название Trace Kind').fill('Планёрка');
			await forms.getByLabel('Название поля', { exact: true }).fill('Длительность');
			await forms.getByRole('combobox', { name: 'Тип поля', exact: true }).selectOption('number');
			await forms.getByRole('button', { name: 'Создать Trace Kind', exact: true }).click();
			await expect(forms.getByRole('status')).toContainText('Trace Kind создан');
			await forms.getByTestId('kind-data').click();
			const data = page.getByTestId('kind-data-surface');
			await expect(data).toBeVisible();
			await expect(data.getByRole('heading', { name: 'Планёрка', exact: true })).toBeVisible();
			await expect(
				data.getByRole('columnheader', { name: 'Длительность', exact: true })
			).toBeVisible();
			await expect(data.getByTestId('dataset-row')).toHaveCount(0);
			await expect(data.getByTestId('history-active')).toContainText('Фильтров нет');
			await data.getByRole('button', { name: 'Записать', exact: true }).click();
			const editor = page.getByTestId('trace-editor');
			await expect(editor.getByRole('spinbutton', { name: /Длительность/ })).toBeVisible();
			await expect(editor.getByRole('button', { name: 'Сохранить', exact: true })).toBeDisabled();
			await page.screenshot({ path: `e2e/artifacts/scope-kind-${width}.png`, fullPage: true });

			// The Scope names its new Kind; no record came out of any of this.
			await selectScope(page, 'Работа');
			await expect(scope.getByTestId('scope-kind').filter({ hasText: 'Планёрка' })).toHaveCount(1);
			const after = counts(await exportBackup(page));
			expect(after).toEqual({ kinds: before.kinds + 1, traces: before.traces });
			expect(errors).toEqual([]);
		});
	});
}
