import { expect, test, type Page } from '@playwright/test';
import { loadTime } from './helpers';
import { exportBackup } from '../public/helpers';

async function createKind(page: Page, name: string, field: string) {
	await page.goto('/forms');
	await page.getByRole('button', { name: 'Новый Trace Kind', exact: true }).click();
	await page.getByLabel('Название Trace Kind').fill(name);
	await page.getByLabel('Название поля', { exact: true }).fill(field);
	await page.getByRole('combobox', { name: 'Тип поля', exact: true }).selectOption('number');
	await page.getByRole('button', { name: 'Создать Trace Kind', exact: true }).click();
	await expect(page).toHaveURL(new RegExp('/forms/[^/]+$'));
}

for (const width of [390, 1440]) {
	test.describe('Trace capture at ' + width, () => {
		test.use({
			viewport: { width, height: 900 },
			isMobile: width === 390,
			hasTouch: width === 390
		});

		test('saves plain records without Scope or with several explicitly selected Scopes', async ({
			page
		}) => {
			await loadTime(page, { manifest: 'dense' });
			await page.getByTestId('capture').click();
			const editor = page.getByTestId('trace-editor');
			await expect(editor.getByTestId('capture-save')).toBeDisabled();
			await editor
				.getByLabel('Название', { exact: true })
				.fill('Работа: свободная запись без Scope');
			await expect(editor.getByRole('list', { name: 'Выбранные Scope' })).toHaveCount(0);
			await editor.getByTestId('capture-save').click();
			await expect(page.getByTestId('selected-title')).toHaveText(
				'Работа: свободная запись без Scope'
			);
			let backup = await exportBackup(page);
			const first = backup.collections.traces.find(
				(row: { content: string }) => row.content === 'Работа: свободная запись без Scope'
			);
			expect(
				backup.collections.intersections.filter(
					(row: { fromId: string }) => row.fromId === first.id
				)
			).toEqual([]);
			await page.getByTestId('capture').click();
			await editor.getByLabel('Выбрать Scope').selectOption({ label: 'Работа' });
			await editor.getByLabel('Выбрать Scope').selectOption({ label: 'Здоровье' });
			await expect(
				editor.getByRole('list', { name: 'Выбранные Scope' }).getByRole('button')
			).toHaveCount(2);
			const removeWork = editor.getByRole('button', { name: 'Убрать Scope Работа', exact: true });
			await removeWork.focus();
			await page.keyboard.press('Enter');
			await expect(removeWork).toHaveCount(0);
			await editor.getByLabel('Выбрать Scope').selectOption({ label: 'Работа' });
			await editor.getByLabel('Название', { exact: true }).fill('Запись в двух контекстах');
			await editor.getByTestId('draft-mode').locator('[data-mode="intend"]').click();
			await page.screenshot({ path: 'e2e/artifacts/capture-scopes-' + width + '.png' });
			await editor.getByTestId('capture-save').click();
			await expect(page.getByTestId('selected-title')).toHaveText('Запись в двух контекстах');
			backup = await exportBackup(page);
			const second = backup.collections.traces.find(
				(row: { content: string }) => row.content === 'Запись в двух контекстах'
			);
			expect(second.relation).toBe('intend');
			const links = backup.collections.intersections.filter(
				(row: { fromId: string; kind: string }) =>
					row.fromId === second.id && row.kind === 'belongs_to'
			);
			expect(links).toHaveLength(2);
			expect(new Set(links.map((row: { toId: string }) => row.toId)).size).toBe(2);
			await page.reload();
			await expect(page.getByTestId('time-workbench')).toHaveAttribute('data-status', 'ready');
			expect(
				(await exportBackup(page)).collections.traces.some(
					(row: { id: string }) => row.id === second.id
				)
			).toBe(true);
		});

		test('offers every Kind regardless of Scope and keeps typed values through Scope changes', async ({
			page
		}) => {
			test.setTimeout(60000);
			await loadTime(page, { manifest: 'dense' });
			await createKind(page, 'Самочувствие', 'Оценка');
			await createKind(page, 'Затраты времени', 'Минуты');
			await page.goto('/time');
			await expect(page.getByTestId('time-workbench')).toHaveAttribute('data-status', 'ready');
			await page.getByTestId('capture').click();
			const editor = page.getByTestId('trace-editor');
			const kinds = editor.getByRole('combobox', { name: 'Trace Kind', exact: true });
			// Kind availability is the Kind's own membership (core/trace-scope), never a form step.
			await expect(kinds.locator('option')).toHaveText([
				'Обычная запись',
				'Затраты времени',
				'Самочувствие'
			]);
			await editor.getByLabel('Выбрать Scope').selectOption({ label: 'Работа' });
			await expect(kinds.locator('option')).toHaveCount(3);
			await kinds.selectOption({ label: 'Затраты времени' });
			await expect(editor.getByLabel('Описание', { exact: true })).toHaveValue('');
			await editor.getByRole('spinbutton', { name: /Минуты/ }).fill('45');
			await page.screenshot({ path: 'e2e/artifacts/capture-kind-' + width + '.png' });
			// An emptied required value blocks the save at once; its message waits for blur.
			const minutes = editor.getByRole('spinbutton', { name: /Минуты/ });
			await minutes.fill('');
			await expect(editor.getByRole('button', { name: 'Сохранить', exact: true })).toBeDisabled();
			await expect(editor.getByRole('alert')).toHaveCount(0);
			await minutes.blur();
			await expect(editor.getByRole('alert').first()).toBeVisible();
			await minutes.fill('45');
			await expect(editor.getByRole('alert')).toHaveCount(0);
			await editor.getByRole('button', { name: 'Убрать Scope Работа', exact: true }).click();
			await expect(minutes).toHaveValue('45');
			await expect(editor.getByRole('button', { name: 'Сохранить', exact: true })).toBeEnabled();
			await editor.getByLabel('Выбрать Scope').selectOption({ label: 'Работа' });
			await expect(minutes).toHaveValue('45');
			await editor.getByRole('button', { name: 'Сохранить', exact: true }).click();
			await expect(page.getByTestId('context-overview')).toBeVisible();
			const backup = await exportBackup(page);
			const trace = backup.collections.traces.find(
				(row: { kindId: string | null; data: Record<string, unknown> | null }) =>
					Boolean(row.kindId) && Object.values(row.data ?? {}).includes(45)
			);
			expect(trace).toBeTruthy();
			// A typed record carries no generated title: its content is the (empty) description.
			expect(trace.content).toBe('');
			expect(
				backup.collections.intersections.filter(
					(row: { fromId: string }) => row.fromId === trace.id
				)
			).toHaveLength(1);
		});
	});
}
