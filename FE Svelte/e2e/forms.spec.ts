import { expect, test } from '@playwright/test';
import { datedRows, versionTable } from './time/kind-history.helpers';
import { digits } from './trace-time-input.helpers';

test.use({ actionTimeout: 5000 });

test('builds a versioned numeric form, opens its data surface, and creates and edits a typed trace', async ({
	page
}) => {
	test.setTimeout(60_000);
	await page.addInitScript(() =>
		localStorage.setItem('tempience.data-space.active', 'belgrade-what-if-v1')
	);
	const errors: string[] = [];
	const sockets: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	page.on('websocket', (socket) => sockets.push(socket.url()));
	await page.goto('/forms');
	await expect(page.getByTestId('identity-bar')).toHaveCount(1);
	await page.getByRole('button', { name: 'Новый Trace Kind', exact: true }).click();
	await page.getByLabel('Название Trace Kind').fill('Замер веса');
	await page.getByLabel('Название поля', { exact: true }).fill('Вес');
	await page.getByRole('combobox', { name: 'Тип поля', exact: true }).selectOption('number');
	await page.getByLabel('Единица измерения').fill('кг');
	await page.screenshot({ path: 'e2e/artifacts/c10-builder-mobile.png', fullPage: true });
	const createStarted = performance.now();
	await page.getByRole('button', { name: 'Создать Trace Kind', exact: true }).click();
	await expect(page).toHaveURL(/\/forms\/[^/]+$/);
	await expect(page.getByRole('button', { name: 'Заполнить', exact: true })).toBeEnabled();
	const createToFillMs = performance.now() - createStarted;
	expect(createToFillMs).toBeLessThan(1000);
	const formUrl = page.url();
	// «Заполнить» opens the one form in the workbench beside the Kind's table (TRACE_FORMS «результат сохранения»).
	await page.getByRole('button', { name: 'Заполнить', exact: true }).click();
	await expect(page.getByTestId('kind-data-surface')).toBeVisible();
	await expect(page.getByRole('spinbutton', { name: /Вес/ })).toBeVisible();
	await page.getByRole('button', { name: 'Закрыть Context', exact: true }).click();
	await page.goto('/time');
	await page.getByTestId('capture').click();
	await page.getByRole('button', { name: 'Новый Scope', exact: true }).click();
	await page.getByLabel('Название Scope').fill('Вес C10');
	await page.getByRole('button', { name: 'Сохранить Scope', exact: true }).click();
	await expect(page.getByTestId('scope-editor')).toHaveCount(0);
	// Every Kind is offered in the form; the record's Scopes are its own memberships.
	await page
		.getByRole('combobox', { name: 'Trace Kind', exact: true })
		.selectOption({ label: 'Замер веса' });
	await page.getByRole('spinbutton', { name: /Вес/ }).fill('74.5');
	await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
	await expect(page.getByTestId('selected-title')).toContainText('74,5 кг');
	await page.getByTestId('edit-trace').click();
	await page.getByRole('spinbutton', { name: /Вес/ }).fill('73.8');
	await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
	await expect(page.getByTestId('context-overview')).toBeVisible();
	await expect(page.getByTestId('selected-title')).toContainText('73,8 кг');
	await page.getByTestId('belonging').click();
	await page.getByRole('button', { name: 'Редактировать Scope', exact: true }).click();
	await page.getByLabel('Название Scope').fill('Вес утром');
	await page.getByLabel('Описание', { exact: true }).fill('Ежедневный замер');
	await page.getByRole('button', { name: 'Сохранить Scope', exact: true }).click();
	await expect(page.getByTestId('selected-title')).toHaveText('Вес утром');
	// The Scope lists the Kinds directly bound to it; the binding itself belongs to the Kind.
	await expect(page.getByTestId('scope-kinds')).toContainText('Trace Kind с этим Scope пока нет');
	await page.getByRole('button', { name: 'Закрыть Context', exact: true }).click();
	await page.getByTestId('capture').click();
	await expect(
		page.getByRole('combobox', { name: 'Trace Kind', exact: true }).locator('option')
	).toContainText(['Замер веса']);
	await page.goto(formUrl);
	await page.getByRole('button', { name: 'Настроить форму', exact: true }).click();
	await page
		.getByRole('combobox', { name: 'Scope Trace Kind', exact: true })
		.selectOption({ label: 'Вес утром' });
	await page.getByRole('button', { name: 'Сохранить изменения', exact: true }).click();
	await expect(page.getByRole('status')).toContainText('Trace Kind сохранён');
	await page.goto('/time');
	await page.getByTestId('capture').click();
	await page.getByLabel('Выбрать Scope', { exact: true }).selectOption({ label: 'Вес утром' });
	await expect(page.locator('optgroup[label="Trace Kind выбранных Scope"] option')).toHaveText([
		'Замер веса'
	]);
	// The chosen Scope is a change of the open form: closing it asks, and this input goes.
	await page.getByRole('button', { name: 'Закрыть Context', exact: true }).click();
	await page.getByTestId('discard-confirm').click();
	const rail = page.getByRole('button', { name: 'Scope', exact: true });
	if (await rail.isVisible()) await rail.click();
	await page.getByRole('button', { name: 'Выбрать Scope Вес утром', exact: true }).click();
	await expect(page.getByTestId('scope-kind')).toHaveText(['Замер веса']);
	await page.goto(formUrl);
	await page.getByRole('button', { name: 'Таблица', exact: true }).click();
	await expect(page.getByTestId('dataset-row')).toHaveCount(1);
	await expect(page.getByTestId('dataset-row')).toContainText('73,8 кг');
	await page.getByRole('button', { name: 'Настроить форму', exact: true }).click();
	await expect(page.getByRole('combobox', { name: 'Тип поля', exact: true })).toBeDisabled();
	await expect(page.getByLabel('Единица измерения')).toBeDisabled();
	await page.getByLabel('Название Trace Kind').fill('Масса тела');
	await page.getByLabel('Название поля', { exact: true }).fill('Масса');
	await page.getByRole('combobox', { name: 'Новое поле', exact: true }).selectOption('text');
	await page.getByRole('button', { name: 'Добавить поле', exact: true }).click();
	await page.getByLabel('Название поля', { exact: true }).nth(1).fill('Заметка');
	await page.getByRole('button', { name: 'Сохранить изменения', exact: true }).click();
	await expect(page.getByRole('status')).toContainText('Новая версия сохранена');
	await expect(page.getByRole('heading', { name: 'Масса тела', exact: true })).toBeVisible();
	await page.getByRole('button', { name: 'Таблица', exact: true }).click();
	// The record stays in the table of the version it was written with, its value readable
	// as it was; the new version's table names its own field and has no record yet.
	await expect(page.getByTestId('version-table')).toHaveCount(2);
	await expect(datedRows(versionTable(page, 1))).toHaveCount(1);
	await expect(datedRows(versionTable(page, 1))).toContainText('73,8 кг');
	await expect(
		versionTable(page, 2).getByRole('columnheader', { name: 'Заметка', exact: true })
	).toBeVisible();
	await expect(datedRows(versionTable(page, 2))).toHaveCount(0);
	// A table row becomes the Context in the workbench; the table stays in the centre.
	const editStarted = performance.now();
	await page.getByRole('button', { name: 'Открыть запись', exact: true }).click();
	await expect(page.getByTestId('selected-title')).toContainText('73,8 кг');
	await expect(page.getByTestId('kind-data-surface')).toBeVisible();
	const openToEditMs = performance.now() - editStarted;
	expect(openToEditMs).toBeLessThan(3000);
	console.info('Form interaction timings (ms)', { createToFillMs, openToEditMs });
	await page.getByTestId('edit-trace').click();
	await expect(page.getByRole('spinbutton', { name: /Вес/ })).toHaveValue('73.8');
	await expect(page.getByRole('textbox', { name: /^Заметка/ })).toHaveCount(0);
	await page.getByRole('button', { name: 'Отмена', exact: true }).click();
	await expect(page.getByTestId('edit-trace-form')).toHaveCount(0);
	await page.screenshot({ path: 'e2e/artifacts/c10-table-mobile.png', fullPage: true });
	await page
		.getByTestId('kind-data-surface')
		.getByRole('button', { name: 'Записать', exact: true })
		.click();
	// The Kind's own Scope is the new record's initial membership (TRACE_FORMS «начальные Scope»).
	await expect(
		page.getByRole('button', { name: 'Убрать Scope Вес утром', exact: true })
	).toBeVisible();
	await expect(page.getByRole('combobox', { name: 'Trace Kind', exact: true })).toHaveCount(0);
	await page.getByRole('spinbutton', { name: /^Масса/ }).fill('72.9');
	await page.getByRole('textbox', { name: /^Заметка/ }).fill('После прогулки');
	await page.getByTestId('trace-time').click();
	await page.getByRole('button', { name: 'Сегодня', exact: true }).click();
	await page.getByTestId('detail-duration').click();
	await digits(page, 'Часы', '2');
	await digits(page, 'Минуты', '30');
	await page.getByRole('button', { name: 'Применить время', exact: true }).click();
	await expect(page.getByTestId('trace-time')).toContainText('2 ч 30 мин');
	await expect(page.getByRole('spinbutton', { name: /^Масса/ })).toHaveValue('72.9');
	await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
	// The saved record is the Context; the table in the centre shows it by its own settings.
	await expect(page.getByTestId('selected-title')).toContainText('72,9 кг');
	await expect(page.getByTestId('dataset-row')).toHaveCount(2);
	await expect(page.getByTestId('dataset-row').first()).toContainText('72,9 кг');
	await expect(page.getByTestId('dataset-row').first()).toContainText('После прогулки');
	await page.setViewportSize({ width: 1440, height: 900 });
	await expect(page.getByTestId('dataset-row').first()).toBeVisible();
	await page.screenshot({ path: 'e2e/artifacts/c10-table-desktop.png', fullPage: true });
	expect(errors).toEqual([]);
	expect(sockets).toEqual([]);
});
