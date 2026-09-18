import { expect, test, type Page } from '@playwright/test';
import { exportBackup } from '../public/helpers';
import { ARTIFACTS, cleanConsole } from './draft.helpers';
import { loadTime } from './helpers';
import { closeContext, panel } from './results.helpers';

cleanConsole(test, 'i5b-console-scope-lifecycle.log');

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

type Row = {
	id: string;
	name?: string;
	fromId?: string;
	toId?: string;
	kind?: string;
	fromEntityType?: string | null;
	isDeleted?: boolean;
};
type Backup = {
	collections: Record<string, Row[]> & {
		scopes: Row[];
		traceKinds: Row[];
		intersections: (Row & { scopeDeletionOperationId?: string | null })[];
	};
};

/** A Kind with one field, bound to the named Scopes, through the real form; its own page. */
const createKindIn = async (page: Page, name: string, scopes: string[]): Promise<string> => {
	await page.goto('/forms');
	await page.getByRole('button', { name: 'Новый Trace Kind', exact: true }).click();
	await page.getByLabel('Название Trace Kind').fill(name);
	await page.getByLabel('Название поля', { exact: true }).fill('Значение');
	for (const scope of scopes)
		await page
			.getByRole('combobox', { name: 'Scope Trace Kind', exact: true })
			.selectOption({ label: scope });
	await page.getByRole('button', { name: 'Создать Trace Kind', exact: true }).click();
	await expect(page).toHaveURL(new RegExp('/forms/[^/]+$'));
	return page.url();
};

const selectScope = async (page: Page, name: string): Promise<void> => {
	await closeContext(page);
	await page.getByRole('button', { name: `Выбрать Scope ${name}`, exact: true }).click();
	await expect(panel(page).getByTestId('selected-title')).toHaveText(name);
};

/** The active memberships of one Kind, by Scope name. */
const scopesOf = (backup: Backup, kindName: string): string[] => {
	const kind = backup.collections.traceKinds.find((row) => row.name === kindName)!;
	const names = new Map(backup.collections.scopes.map((row) => [row.id, row.name]));
	return backup.collections.intersections
		.filter((row) => row.fromId === kind.id && !row.isDeleted)
		.map((row) => names.get(row.toId) ?? row.toId!)
		.toSorted();
};

/** The records that belong to the named Scope directly: what its return brings back with it. */
const directRecords = (backup: Backup, scopeName: string): number => {
	const scope = backup.collections.scopes.find((row) => row.name === scopeName)!;
	const gone = new Set(
		backup.collections.traces.filter((row) => row.isDeleted).map((row) => row.id)
	);
	return backup.collections.intersections.filter(
		(row) =>
			row.kind === 'belongs_to' &&
			row.fromEntityType !== 'traceKind' &&
			row.toId === scope.id &&
			!row.isDeleted &&
			!gone.has(row.fromId!)
	).length;
};

const untouched = (backup: Backup) =>
	JSON.stringify({
		traces: backup.collections.traces,
		assessments: backup.collections.intentionAssessments
	});

test('S16: a Scope is deleted, other memberships change, the Scope returns — only what is due comes back', async ({
	page
}) => {
	test.setTimeout(240_000);
	await loadTime(page, { manifest: 'dense' });
	// Two Kinds bound to «Работа» and «Здоровье»: one will only be renamed while the Scope is
	// gone, the other will leave every Scope explicitly.
	const renamedUrl = await createKindIn(page, 'Вид С16 А', ['Работа', 'Здоровье']);
	const unscopedUrl = await createKindIn(page, 'Вид С16 Б', ['Работа', 'Здоровье']);
	await page.goto('/time');
	await expect(page.getByTestId('time-workbench')).toHaveAttribute('data-status', 'ready', {
		timeout: 20_000
	});
	await selectScope(page, 'Работа');
	const before = (await exportBackup(page)) as unknown as Backup;
	const records = await panel(page).getByTestId('scope-record').count();
	expect(records).toBeGreaterThan(0);
	await expect(panel(page).getByTestId('scope-kind')).toHaveCount(2);
	await expect(panel(page).getByTestId('context-section-kinds')).toContainText('2');

	// Deleted, and taken back at once: the Scope, its memberships and its records are as before.
	await panel(page).getByTestId('delete-scope').click();
	await expect(page.getByTestId('undo-toast')).toContainText('Scope удалён');
	await expect(panel(page).getByTestId('deleted-scope')).toBeVisible();
	await expect(panel(page).getByTestId('scope-returning-kind')).toHaveCount(2);
	await page.screenshot({
		path: `${ARTIFACTS}/i5b-closure-scope-deleted-1440.png`,
		fullPage: true
	});
	await page.getByTestId('undo-toast').getByTestId('undo').click();
	await expect(page.getByTestId('undo-toast')).toHaveCount(0);
	await expect(panel(page).getByTestId('context-scope')).toBeVisible();
	await expect(panel(page).getByTestId('scope-record')).toHaveCount(records);
	expect(scopesOf((await exportBackup(page)) as unknown as Backup, 'Вид С16 А')).toEqual([
		'Здоровье',
		'Работа'
	]);

	// Deleted again, and this time it stays gone while other things change.
	await panel(page).getByTestId('delete-scope').click();
	await expect(panel(page).getByTestId('deleted-scope')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Выбрать Scope Работа', exact: true })).toHaveCount(
		0
	);
	const gone = (await exportBackup(page)) as unknown as Backup;
	expect(gone.collections.scopes.find((row) => row.name === 'Работа')?.isDeleted).toBe(true);
	// Records are not touched by a Scope deletion: not one row of them changed.
	expect(untouched(gone)).toBe(untouched(before));

	// A rename only: the memberships of this Kind are not sent, hidden or not.
	await page.goto(renamedUrl);
	await page.getByRole('button', { name: 'Настроить форму', exact: true }).click();
	await page.getByLabel('Название Trace Kind').fill('Вид С16 А переименован');
	await page.getByRole('button', { name: 'Сохранить изменения', exact: true }).click();
	await expect(page.getByRole('status')).toContainText('Название Trace Kind сохранено');
	// An explicit «Без Scope»: the hidden membership of the deleted Scope is withdrawn with the rest.
	await page.goto(unscopedUrl);
	await page.getByRole('button', { name: 'Настроить форму', exact: true }).click();
	await page.getByTestId('kind-no-scope').click();
	await page.getByRole('button', { name: 'Сохранить изменения', exact: true }).click();
	await expect(page.getByRole('status')).toContainText('Trace Kind сохранён');
	// A Scope renamed while the other is gone: a name, not a membership.
	await page.goto('/time');
	await expect(page.getByTestId('time-workbench')).toHaveAttribute('data-status', 'ready', {
		timeout: 20_000
	});
	await selectScope(page, 'Здоровье');
	await panel(page).getByRole('button', { name: 'Редактировать Scope' }).click();
	await panel(page).getByTestId('scope-editor').getByLabel('Название Scope').fill('Здоровье П');
	await panel(page).getByRole('button', { name: 'Сохранить Scope' }).click();
	await expect(panel(page).getByTestId('selected-title')).toHaveText('Здоровье П');

	// The deleted Scope is listed, says what its return brings back, and is brought back.
	await page.getByTestId('context-rest').click();
	await page.getByTestId('deleted-open').click();
	await page.getByTestId('deleted-scope-item').filter({ hasText: 'Работа' }).click();
	await expect(panel(page).getByTestId('deleted-scope')).toBeVisible();
	await expect(panel(page).getByTestId('scope-returning-kind')).toHaveText([
		'Вид С16 А переименован'
	]);
	await expect(panel(page).getByTestId('scope-records-inside')).toContainText(
		String(directRecords(before, 'Работа'))
	);
	await page.screenshot({
		path: `${ARTIFACTS}/i5b-closure-scope-returning-1440.png`,
		fullPage: true
	});
	await panel(page).getByTestId('restore-scope').click();
	await expect(panel(page).getByTestId('context-scope')).toBeVisible();
	await expect(panel(page).getByTestId('selected-title')).toHaveText('Работа');
	await expect(panel(page).getByTestId('scope-record')).toHaveCount(records);
	await expect(panel(page).getByTestId('scope-kind')).toHaveText(['Вид С16 А переименован']);
	await expect(page.getByRole('button', { name: 'Выбрать Scope Работа', exact: true })).toHaveCount(
		1
	);
	await page.screenshot({
		path: `${ARTIFACTS}/i5b-closure-scope-restored-1440.png`,
		fullPage: true
	});

	// Exactly the due memberships came back; the explicit «Без Scope» stands; nothing else moved.
	const after = (await exportBackup(page)) as unknown as Backup;
	expect(scopesOf(after, 'Вид С16 А переименован')).toEqual(['Здоровье П', 'Работа']);
	expect(scopesOf(after, 'Вид С16 Б')).toEqual([]);
	expect(untouched(after)).toBe(untouched(before));
	const restored = after.collections.scopes.find((row) => row.name === 'Работа')!;
	expect(restored.isDeleted).toBe(false);
	// The membership withdrawn explicitly carries no deletion stamp any more: it was not due.
	const unscopedKind = after.collections.traceKinds.find((row) => row.name === 'Вид С16 Б')!;
	const withdrawn = after.collections.intersections.filter(
		(row) => row.fromId === unscopedKind.id && row.toId === restored.id
	);
	expect(withdrawn).toHaveLength(1);
	expect([withdrawn[0].isDeleted, withdrawn[0].scopeDeletionOperationId ?? null]).toEqual([
		true,
		null
	]);
});
