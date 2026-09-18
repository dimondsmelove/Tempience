import { expect, test, type Page } from '@playwright/test';
import { loadTime } from './helpers';
import {
	ARTIFACTS,
	badInput,
	cleanConsole,
	createKind,
	dialog,
	editor,
	kinds,
	save
} from './draft.helpers';
import { exportBackup } from '../public/helpers';

cleanConsole(test, 'i4b-console-nested.log');

const nested = (page: Page) => page.getByTestId('nested-editor');
/** The form's own description by its test id: the nested Scope editor has a «Описание» too. */
const description = (page: Page) => page.getByTestId('draft-description');
const chip = (page: Page, name: string) =>
	editor(page).getByRole('button', { name: 'Убрать Scope ' + name, exact: true });

for (const width of [390, 1440]) {
	test.describe('Nested Scope and Kind inside the open form at ' + width, () => {
		test.use({
			viewport: { width, height: 900 },
			isMobile: width === 390,
			hasTouch: width === 390
		});

		test('a Scope and a Kind saved inside the form return to the same input; cancel changes nothing', async ({
			page
		}) => {
			test.setTimeout(120000);
			await loadTime(page, { manifest: 'dense' });
			await createKind(page, 'Наблюдение', 'Число', { required: false });
			await page.goto('/time');
			await expect(page.getByTestId('time-workbench')).toHaveAttribute('data-status', 'ready');
			await page.getByTestId('capture').click();
			await kinds(page).selectOption({ label: 'Наблюдение' });
			const number = editor(page).getByRole('spinbutton', { name: /Число/ });
			await number.focus();
			await number.pressSequentially('-');
			await description(page).fill('Черновик с незавершённым числом');
			// A missing Scope: created here, selected here, the form's input untouched underneath.
			await page.getByTestId('draft-scope-new').click();
			await expect(nested(page)).toBeVisible();
			await expect(description(page)).toBeHidden();
			await page.screenshot({ path: `${ARTIFACTS}/i4b-nested-scope-${width}.png` });
			await nested(page).getByLabel('Название Scope').fill('Новый контекст');
			await nested(page).getByRole('button', { name: 'Сохранить Scope', exact: true }).click();
			await expect(nested(page)).toHaveCount(0);
			await expect(page.getByTestId('draft-scope-new')).toBeFocused();
			await expect(chip(page, 'Новый контекст')).toBeVisible();
			await expect(description(page)).toHaveValue('Черновик с незавершённым числом');
			expect(await badInput(number)).toBe(true);
			await expect(save(page)).toBeDisabled();
			await page.getByTestId('draft-scope-new').click();
			await nested(page).getByLabel('Название Scope').fill('Отменённый Scope');
			await nested(page).getByRole('button', { name: 'Отмена', exact: true }).click();
			await expect(nested(page)).toHaveCount(0);
			await expect(dialog(page)).toHaveCount(0);
			await expect(editor(page).getByLabel('Выбрать Scope').locator('option')).not.toContainText([
				'Отменённый Scope'
			]);
			await expect(description(page)).toHaveValue('Черновик с незавершённым числом');
			expect(await badInput(number)).toBe(true);
			// A missing Kind: the Builder in the Context; saving only makes it selectable.
			await page.getByTestId('draft-kind-new').click();
			await expect(page.getByTestId('nested-kind')).toBeVisible();
			await page.getByLabel('Название Trace Kind').fill('Пульс');
			await page.getByLabel('Название поля', { exact: true }).fill('Удары');
			await page.getByRole('combobox', { name: 'Тип поля', exact: true }).selectOption('number');
			await expect(
				page
					.getByTestId('kind-scopes')
					.getByRole('button', { name: 'Убрать Scope Новый контекст', exact: true })
			).toBeVisible();
			await page.screenshot({ path: `${ARTIFACTS}/i4b-nested-kind-${width}.png` });
			await page.getByRole('button', { name: 'Создать Trace Kind', exact: true }).click();
			await expect(page.getByTestId('nested-kind')).toHaveCount(0);
			await expect(page.getByTestId('kind-created')).toContainText('«Пульс» создан');
			await expect(kinds(page)).toHaveValue(/.+/);
			await expect(kinds(page).locator('option:checked')).toHaveText('Наблюдение');
			await expect(description(page)).toHaveValue('Черновик с незавершённым числом');
			expect(await badInput(number)).toBe(true);
			// Cancelling the Builder leaves no Kind behind.
			await page.getByTestId('draft-kind-new').click();
			await page.getByLabel('Название Trace Kind').fill('Брошенный вид');
			await page.getByTestId('nested-cancel').click();
			await expect(page.getByTestId('draft-kind-new')).toBeFocused();
			await expect(kinds(page).locator('option')).not.toContainText(['Брошенный вид']);
			await expect(description(page)).toHaveValue('Черновик с незавершённым числом');
			// An explicit choice of the created Kind applies the ordinary reset and its Scopes.
			await kinds(page).selectOption({ label: 'Пульс' });
			await expect(editor(page).getByRole('spinbutton', { name: /Удары/ })).toHaveValue('');
			await expect(editor(page).getByRole('spinbutton', { name: /Число/ })).toHaveCount(0);
			await expect(chip(page, 'Новый контекст')).toBeVisible();
			await expect(page.getByTestId('kind-created')).toHaveCount(0);
			await expect(
				kinds(page).locator('optgroup[label="Trace Kind выбранных Scope"] option')
			).toHaveText(['Пульс']);
			// Discarding the form keeps what was saved inside it.
			await page.getByTestId('context-collapse').click();
			await dialog(page).getByTestId('discard-confirm').click();
			await page.getByTestId('capture').click();
			await expect(editor(page).getByLabel('Выбрать Scope').locator('option')).toContainText([
				'Новый контекст'
			]);
			await expect(kinds(page).locator('option')).toContainText(['Пульс']);
		});
	});
}

for (const width of [390, 1440]) {
	test.describe('Nested input and the form’s exit at ' + width, () => {
		test.use({
			viewport: { width, height: 900 },
			isMobile: width === 390,
			hasTouch: width === 390
		});

		test('a pristine form with edited nested input asks before it closes; Keep stays on the nested step', async ({
			page
		}) => {
			await loadTime(page, { manifest: 'dense' });
			await page.getByTestId('capture').click();
			// Opening the nested editor alone is not a change: the empty step closes without a question.
			await page.getByTestId('draft-scope-new').click();
			await page.getByTestId('context-collapse').click();
			await expect(dialog(page)).toHaveCount(0);
			await expect(page.getByTestId('context-capture')).toHaveCount(0);
			await page.getByTestId('capture').click();
			await page.getByTestId('draft-scope-new').click();
			await nested(page).getByLabel('Название Scope').fill('Незавершённый Scope');
			await page.getByTestId('context-collapse').click();
			await expect(dialog(page)).toBeVisible();
			await page.screenshot({ path: `${ARTIFACTS}/i4b-nested-dirty-exit-${width}.png` });
			await dialog(page).getByTestId('discard-keep').click();
			await expect(nested(page).getByLabel('Название Scope')).toHaveValue('Незавершённый Scope');
			// The nested Cancel is an internal return: no question, the pristine form stays open.
			await nested(page).getByRole('button', { name: 'Отмена', exact: true }).click();
			await expect(dialog(page)).toHaveCount(0);
			await expect(page.getByTestId('context-capture')).toBeVisible();
			await page.getByTestId('draft-kind-new').click();
			await page.getByLabel('Название Trace Kind').fill('Незавершённый вид');
			await page.getByTestId('context-collapse').click();
			await expect(dialog(page)).toBeVisible();
			await dialog(page).getByTestId('discard-confirm').click();
			await expect(page.getByTestId('context-capture')).toHaveCount(0);
			await page.getByTestId('capture').click();
			await expect(kinds(page).locator('option')).not.toContainText(['Незавершённый вид']);
		});
	});
}

test.describe('Kind memberships as intent', () => {
	test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

	test('zero or many Scopes on a Kind; a rename leaves memberships alone, «Без Scope» is sent', async ({
		page
	}) => {
		test.setTimeout(120000);
		await loadTime(page, { manifest: 'dense' });
		await page.goto('/forms');
		await page.getByRole('button', { name: 'Новый Trace Kind', exact: true }).click();
		await page.getByLabel('Название Trace Kind').fill('Многоскоуп');
		await page.getByLabel('Название поля', { exact: true }).fill('Значение');
		const memberOf = page.getByRole('combobox', { name: 'Scope Trace Kind', exact: true });
		await memberOf.selectOption({ label: 'Работа' });
		await memberOf.selectOption({ label: 'Здоровье' });
		await page.getByRole('button', { name: 'Создать Trace Kind', exact: true }).click();
		await expect(page).toHaveURL(new RegExp('/forms/[^/]+$'));
		const formUrl = page.url();
		let backup = await exportBackup(page);
		const kind = backup.collections.traceKinds.find(
			(row: { name: string }) => row.name === 'Многоскоуп'
		);
		const memberships = (rows: typeof backup) =>
			rows.collections.intersections
				.filter(
					(row: { fromId: string; isDeleted: boolean }) => row.fromId === kind.id && !row.isDeleted
				)
				.map((row: { toId: string }) => row.toId)
				.toSorted();
		expect(memberships(backup)).toHaveLength(2);
		// A rename only: the untouched memberships are not sent.
		await page.getByRole('button', { name: 'Настроить форму', exact: true }).click();
		await page.getByLabel('Название Trace Kind').fill('Многоскоуп переименован');
		await page.getByRole('button', { name: 'Сохранить изменения', exact: true }).click();
		await expect(page.getByRole('status')).toContainText('Название Trace Kind сохранено');
		const renamed = await exportBackup(page);
		expect(
			renamed.collections.traceKindVersions.filter(
				(row: { kindId: string }) => row.kindId === kind.id
			)
		).toHaveLength(1);
		const renameLogs = renamed.collections.logs.filter(
			(log: { id: string }) =>
				!backup.collections.logs.some((old: { id: string }) => old.id === log.id)
		);
		expect(
			renameLogs.map(
				(log: { entityType: string; action: string }) => `${log.entityType}:${log.action}`
			)
		).toEqual(['traceKind:updated']);
		expect(memberships(renamed)).toEqual(memberships(backup));
		backup = renamed;
		// An explicit «Без Scope»: sent as a choice of its own, in the same save as nothing else.
		await page.goto(formUrl);
		await page.getByRole('button', { name: 'Настроить форму', exact: true }).click();
		await page.getByTestId('kind-no-scope').click();
		await expect(page.getByTestId('kind-no-scope')).toHaveAttribute('aria-pressed', 'true');
		await page.screenshot({ path: `${ARTIFACTS}/i4b-kind-no-scope.png` });
		await page.getByRole('button', { name: 'Сохранить изменения', exact: true }).click();
		await expect(page.getByRole('status')).toContainText('Trace Kind сохранён');
		const unscoped = await exportBackup(page);
		expect(memberships(unscoped)).toEqual([]);
		const noScopeLogs = unscoped.collections.logs.filter(
			(log: { id: string }) =>
				!backup.collections.logs.some((old: { id: string }) => old.id === log.id)
		);
		expect(new Set(noScopeLogs.map((log: { operationId: string }) => log.operationId)).size).toBe(
			1
		);
		expect(noScopeLogs.map((log: { entityType: string }) => log.entityType)).toEqual([
			'intersection',
			'intersection'
		]);
	});
});
