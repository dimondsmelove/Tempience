import { expect, test } from '@playwright/test';
import { loadTime } from './helpers';
import {
	ARTIFACTS,
	cleanConsole,
	createKind,
	description,
	dialog,
	editor,
	kinds as kindSelect,
	record,
	title,
	mode
} from './draft.helpers';
import { exportBackup } from '../public/helpers';

cleanConsole(test, 'i4a-console.log');

for (const width of [390, 1440]) {
	test.describe('Trace draft at ' + width, () => {
		test.use({
			viewport: { width, height: 900 },
			isMobile: width === 390,
			hasTouch: width === 390
		});

		test('plain create: blur validation, relation time rules, description shown after save', async ({
			page
		}) => {
			await loadTime(page, { manifest: 'dense' });
			const window = await page.getByTestId('window-dates').innerText();
			await page.getByTestId('capture').click();
			await expect(editor(page).getByTestId('capture-save')).toBeDisabled();
			// Untouched fields carry no error; the first one shows after blur and leaves on input.
			await expect(editor(page).getByRole('alert')).toHaveCount(0);
			await title(page).focus();
			await description(page).focus();
			await expect(editor(page).getByRole('alert')).toHaveText('Введите название');
			await title(page).fill('Прогулка у реки');
			await expect(editor(page).getByRole('alert')).toHaveCount(0);
			await expect(editor(page).getByTestId('capture-save')).toBeEnabled();
			await description(page).fill('Полчаса после обеда');
			const initialTime = await editor(page).getByTestId('trace-time').innerText();
			await mode(page, 'intend').click();
			await expect(editor(page).getByTestId('trace-time')).toContainText('время неизвестно');
			await mode(page, 'actual').click();
			await expect(editor(page).getByTestId('trace-time')).toHaveText(initialTime, {
				useInnerText: true
			});
			await page.screenshot({ path: `${ARTIFACTS}/i4a-plain-create-${width}.png` });
			await editor(page).getByTestId('capture-save').click();
			await expect(page.getByTestId('selected-title')).toHaveText('Прогулка у реки');
			await expect(page.getByTestId('selected-description')).toHaveText('Полчаса после обеда');
			await expect(page.getByTestId('window-dates')).toHaveText(window);
			const backup = await exportBackup(page);
			const saved = backup.collections.traces.find(
				(row: { content: string }) => row.content === 'Прогулка у реки'
			);
			expect(saved.description).toBe('Полчаса после обеда');
			expect(saved.relation).toBe('actual');
		});

		test('edit: semantic dirty, discard question on cancel, description survives an unrelated edit', async ({
			page
		}) => {
			await loadTime(page, { manifest: 'dense' });
			await record(page, 3).dispatchEvent('click');
			const panel = page.getByTestId('context-body');
			const original = await panel.getByTestId('selected-title').innerText();
			await panel.getByTestId('edit-trace').click();
			await expect(title(page)).toHaveValue(original);
			await expect(editor(page).getByTestId('edit-save')).toBeDisabled();
			await title(page).fill(original + ' (правка)');
			await expect(editor(page).getByTestId('edit-save')).toBeEnabled();
			await title(page).fill(original);
			await expect(editor(page).getByTestId('edit-save')).toBeDisabled();
			await description(page).fill('Отдельное описание');
			await editor(page).getByRole('button', { name: 'Отмена', exact: true }).click();
			await expect(dialog(page)).toBeVisible();
			await page.screenshot({ path: `${ARTIFACTS}/i4a-discard-dialog-${width}.png` });
			await dialog(page).getByTestId('discard-keep').click();
			await expect(dialog(page)).toHaveCount(0);
			await expect(description(page)).toHaveValue('Отдельное описание');
			await editor(page).getByTestId('edit-save').click();
			await expect(panel.getByTestId('selected-description')).toHaveText('Отдельное описание');
			await expect(panel.getByTestId('selected-title')).toHaveText(original);
			// An unrelated edit keeps the description the projection used to drop.
			await panel.getByTestId('edit-trace').click();
			await title(page).fill(original + ' 2');
			await editor(page).getByTestId('edit-save').click();
			await expect(panel.getByTestId('selected-title')).toHaveText(original + ' 2');
			await expect(panel.getByTestId('selected-description')).toHaveText('Отдельное описание');
			await panel.getByTestId('edit-trace').click();
			await title(page).fill('Брошенная правка');
			await editor(page).getByRole('button', { name: 'Отмена', exact: true }).click();
			await dialog(page).getByTestId('discard-confirm').click();
			await expect(panel.getByTestId('selected-title')).toHaveText(original + ' 2');
			await expect(panel.getByTestId('edit-trace-form')).toHaveCount(0);
		});

		test('typed input keeps intermediate values through the time picker and resets on Kind changes', async ({
			page
		}) => {
			test.setTimeout(60000);
			await loadTime(page, { manifest: 'dense' });
			await createKind(page, 'Затраты времени', 'Минуты');
			await page.goto('/time');
			await expect(page.getByTestId('time-workbench')).toHaveAttribute('data-status', 'ready');
			await page.getByTestId('capture').click();
			await title(page).fill('Обычный текст');
			const kinds = kindSelect(page);
			await kinds.selectOption({ label: 'Затраты времени' });
			await expect(title(page)).toHaveCount(0);
			// A record by a Trace Kind keeps the switch, with «Намерение» out of reach (TRACE_FORMS 2026-09-15).
			await expect(mode(page, 'intend')).toBeDisabled();
			await expect(description(page)).toHaveValue('');
			const minutes = editor(page).getByRole('spinbutton', { name: /Минуты/ });
			await expect(minutes).toBeVisible();
			await expect(editor(page).getByTestId('capture-save')).toBeDisabled();
			await minutes.focus();
			await minutes.pressSequentially('-');
			await expect(editor(page).getByTestId('capture-save')).toBeDisabled();
			await expect(editor(page).getByRole('alert')).toHaveCount(0);
			// The time picker is a subview of the same form: the invalid partial input survives it.
			await editor(page).getByTestId('trace-time').click();
			await expect(page.getByTestId('trace-time-editor')).toBeVisible();
			await page.screenshot({ path: `${ARTIFACTS}/i4a-typed-time-subview-${width}.png` });
			await page.getByRole('button', { name: 'Отменить изменение времени', exact: true }).click();
			await expect(page.getByTestId('trace-time-editor')).toHaveCount(0);
			expect(await minutes.evaluate((input) => (input as HTMLInputElement).validity.badInput)).toBe(
				true
			);
			await expect(editor(page).getByTestId('capture-save')).toBeDisabled();
			await minutes.fill('45');
			await expect(editor(page).getByTestId('capture-save')).toBeEnabled();
			await editor(page).getByTestId('trace-time').click();
			await page.getByRole('button', { name: 'Применить время', exact: true }).click();
			await expect(minutes).toHaveValue('45');
			await page.screenshot({ path: `${ARTIFACTS}/i4a-typed-form-${width}.png` });
			// Plain ↔ Kind resets the previous content; A → B → A restores nothing.
			await kinds.selectOption({ label: 'Обычная запись' });
			await expect(title(page)).toHaveValue('');
			await kinds.selectOption({ label: 'Затраты времени' });
			await expect(editor(page).getByRole('spinbutton', { name: /Минуты/ })).not.toHaveValue('45');
			await editor(page)
				.getByRole('spinbutton', { name: /Минуты/ })
				.fill('30');
			await description(page).fill('после созвона');
			await editor(page).getByTestId('capture-save').click();
			await expect(page.getByTestId('context-overview')).toBeVisible();
			await expect(page.getByTestId('selected-description')).toHaveText('после созвона');
			const backup = await exportBackup(page);
			const trace = backup.collections.traces.find(
				(row: { content: string; kindId: string | null }) =>
					row.kindId && row.content === 'после созвона'
			);
			expect(trace).toBeTruthy();
			expect(Object.values(trace.data)).toContain(30);
			expect(trace.description ?? null).toBeNull();
		});

		test('dirty exits ask once: Context close, another selection, a route change', async ({
			page
		}) => {
			await loadTime(page, { manifest: 'dense' });
			await page.getByTestId('capture').click();
			await title(page).fill('Незавершённый ввод');
			await page.getByTestId('context-collapse').click();
			await expect(dialog(page)).toBeVisible();
			await dialog(page).getByTestId('discard-keep').click();
			await expect(title(page)).toHaveValue('Незавершённый ввод');
			if (width === 390) {
				// The full sheet covers the ribbon on a phone: Escape closes the sheet, an exit too.
				await title(page).blur();
				await page.keyboard.press('Escape');
			} else {
				await record(page, 3).dispatchEvent('click');
			}
			await expect(dialog(page)).toBeVisible();
			await page.screenshot({ path: `${ARTIFACTS}/i4a-exit-selection-${width}.png` });
			await dialog(page).getByTestId('discard-confirm').click();
			if (width === 390) await expect(page.getByTestId('bottom-sheet')).toHaveCount(0);
			else await expect(page.getByTestId('context-overview')).toBeVisible();
			await expect(page.getByTestId('context-capture')).toHaveCount(0);
			// The catalog replaces the form in the Context: the same question, then the catalog.
			await page.getByTestId('capture').click();
			await title(page).fill('Ввод перед каталогом');
			await page.getByTestId('kinds-open').click();
			await expect(dialog(page)).toBeVisible();
			await dialog(page).getByTestId('discard-keep').click();
			await expect(title(page)).toHaveValue('Ввод перед каталогом');
			await page.getByTestId('kinds-open').click();
			await dialog(page).getByTestId('discard-confirm').click();
			await expect(page.getByTestId('trace-forms')).toBeVisible();
			await expect(page.getByTestId('context-capture')).toHaveCount(0);
		});

		test('a route change from the form opened by the catalog asks first and then moves once', async ({
			page
		}) => {
			test.setTimeout(60000);
			await loadTime(page, { manifest: 'dense' });
			await createKind(page, 'Шаги', 'Количество');
			// «Заполнить» opens the one form in the workbench, beside the Kind's table.
			await page.getByRole('button', { name: 'Заполнить', exact: true }).click();
			await expect(page.getByTestId('kind-data-surface')).toBeVisible();
			const steps = editor(page).getByRole('spinbutton', { name: /Количество/ });
			await steps.fill('8000');
			// Back is a route change like any other: it asks first, and Keep leaves the page as it is.
			await page.goBack();
			await expect(dialog(page)).toBeVisible();
			await dialog(page).getByTestId('discard-keep').click();
			await expect(page).not.toHaveURL(/\/forms\//);
			await expect(steps).toHaveValue('8000');
			await page.goBack();
			await dialog(page).getByTestId('discard-confirm').click();
			await expect(page).toHaveURL(new RegExp('/forms/[^/]+$'));
			await expect(page.getByRole('button', { name: 'Заполнить', exact: true })).toBeVisible();
		});
	});
}

test.describe('Trace draft desktop exits', () => {
	test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

	test('a DataSpace switch asks first and keeps the current space when editing continues', async ({
		page
	}) => {
		await loadTime(page, { manifest: 'dense' });
		await page.getByTestId('capture').click();
		await title(page).fill('Ввод перед сменой данных');
		const switcher = page.getByTestId('data-space-switcher');
		const current = await switcher.inputValue();
		const other = await switcher
			.locator('option')
			.evaluateAll(
				(options, active) =>
					(options as HTMLOptionElement[]).map((option) => option.value).find((v) => v !== active),
				current
			);
		expect(other).toBeTruthy();
		await switcher.selectOption(other!);
		await expect(dialog(page)).toBeVisible();
		await dialog(page).getByTestId('discard-keep').click();
		await expect(switcher).toHaveValue(current);
		await expect(title(page)).toHaveValue('Ввод перед сменой данных');
		await expect(page.getByTestId('time-workbench')).toHaveAttribute('data-status', 'ready');
	});
});
