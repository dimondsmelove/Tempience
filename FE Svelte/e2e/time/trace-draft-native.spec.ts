import { expect, test } from '@playwright/test';
import { loadTime } from './helpers';
import {
	ARTIFACTS,
	badInput,
	cleanConsole,
	createKind,
	description,
	dialog,
	editor,
	kinds,
	save
} from './draft.helpers';
import { exportBackup } from '../public/helpers';

cleanConsole(test, 'i4a-console-native.log');

for (const width of [390, 1440]) {
	test.describe('Optional typed input at ' + width, () => {
		test.use({
			viewport: { width, height: 900 },
			isMobile: width === 390,
			hasTouch: width === 390
		});

		test('an optional number: unparsable text blocks and counts as unsaved, a cleared field is valid', async ({
			page
		}) => {
			test.setTimeout(90000);
			await loadTime(page, { manifest: 'dense' });
			await createKind(page, 'Наблюдение', 'Число', { required: false });
			await page.goto('/time');
			await expect(page.getByTestId('time-workbench')).toHaveAttribute('data-status', 'ready');
			await page.getByTestId('capture').click();
			await kinds(page).selectOption({ label: 'Наблюдение' });
			const number = editor(page).getByRole('spinbutton', { name: /Число/ });
			// An empty optional document is a valid record.
			await expect(save(page)).toBeEnabled();
			await number.focus();
			await number.pressSequentially('-');
			expect(await badInput(number)).toBe(true);
			await expect(save(page)).toBeDisabled();
			await expect(editor(page).getByRole('alert')).toHaveCount(0);
			await description(page).focus();
			await expect(editor(page).getByRole('alert')).toHaveText('Завершите ввод числа в поле формы');
			// The time subview and the interface language leave the raw text alone.
			await editor(page).getByTestId('trace-time').click();
			await page.getByRole('button', { name: 'Отменить изменение времени', exact: true }).click();
			await page.getByTestId('locale-picker').selectOption('en');
			await expect(editor(page).getByRole('alert')).toHaveText(
				'Finish the number in the form field'
			);
			await page.getByTestId('locale-picker').selectOption('ru');
			expect(await badInput(number)).toBe(true);
			await number.focus();
			await number.pressSequentially('5');
			await expect(number).toHaveValue('-5');
			await expect(save(page)).toBeEnabled();
			await expect(editor(page).getByRole('alert')).toHaveCount(0);
			// An incomplete exponent is unfinished too; clearing returns to the valid empty field.
			await number.press('Control+a');
			await number.pressSequentially('1e');
			expect(await badInput(number)).toBe(true);
			await expect(save(page)).toBeDisabled();
			await number.press('Control+a');
			await number.press('Backspace');
			await expect(number).toHaveValue('');
			expect(await badInput(number)).toBe(false);
			await expect(save(page)).toBeEnabled();
			await expect(editor(page).getByRole('alert')).toHaveCount(0);
			await page.screenshot({ path: `${ARTIFACTS}/i4a-review-optional-cleared-${width}.png` });
			// The typed description is stored as written, even when it equals the Kind name.
			await description(page).fill('Наблюдение');
			await save(page).click();
			await expect(page.getByTestId('context-overview')).toBeVisible();
			await expect(page.getByTestId('selected-description')).toHaveText('Наблюдение');
			const backup = await exportBackup(page);
			const saved = backup.collections.traces.find(
				(row: { kindId: string | null; content: string }) =>
					row.kindId && row.content === 'Наблюдение'
			);
			expect(saved.data).toEqual({});
			// Editing the same record: unparsable text is unsaved input for the exit question.
			await page.getByTestId('edit-trace').click();
			const editNumber = editor(page).getByRole('spinbutton', { name: /Число/ });
			await expect(editor(page).getByTestId('edit-save')).toBeDisabled();
			await editNumber.focus();
			await editNumber.pressSequentially('-');
			await page.getByTestId('context-collapse').click();
			await expect(dialog(page)).toBeVisible();
			await dialog(page).getByTestId('discard-keep').click();
			expect(await badInput(editNumber)).toBe(true);
			await editNumber.press('Control+a');
			await editNumber.press('Backspace');
			expect(await badInput(editNumber)).toBe(false);
			await expect(editor(page).getByTestId('edit-save')).toBeDisabled();
			// Back at the original empty input there is nothing to ask about.
			await editNumber.press('Control+a');
			await editNumber.pressSequentially('7');
			await editor(page).getByTestId('edit-save').click();
			await expect(page.getByTestId('selected-description')).toHaveText('Наблюдение');
			await page.getByTestId('edit-trace').click();
			await expect(editor(page).getByRole('spinbutton', { name: /Число/ })).toHaveValue('7');
			await editor(page).getByRole('button', { name: 'Отмена', exact: true }).click();
			await expect(dialog(page)).toHaveCount(0);
			await expect(page.getByTestId('selected-description')).toHaveText('Наблюдение');
		});
	});
}
