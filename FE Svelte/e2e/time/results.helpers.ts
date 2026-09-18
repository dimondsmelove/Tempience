import { expect, type Locator, type Page } from '@playwright/test';
import { editor, title, mode } from './draft.helpers';

export const panel = (page: Page): Locator => page.getByTestId('context-body');
export const picker = (page: Page): Locator => editor(page).getByTestId('result-picker');
export const candidate = (page: Page, name: string): Locator =>
	picker(page).getByTestId('result-candidate').filter({ hasText: name });
export const target = (page: Page, name: string): Locator =>
	editor(page).getByTestId('result-target').filter({ hasText: name });
export const outcome = (page: Page, name: string): Locator =>
	target(page, name).getByTestId('target-outcome');
export const closeBox = (page: Page, name: string): Locator =>
	target(page, name).getByTestId('target-close');
export const reopenBox = (page: Page, name: string): Locator =>
	target(page, name).getByTestId('target-reopen');
export const openClear = (page: Page, name: string): Locator =>
	target(page, name).getByTestId('target-open-clear');
/** What the block says about a target; `data-blocking` marks the states this save refuses. */
export const targetNote = (page: Page, name: string): Locator =>
	target(page, name).getByTestId('target-problem');

/** Selects a record through the ribbon's DOM twin, which is present but visually hidden. */
export async function selectRecord(page: Page, name: string | RegExp): Promise<void> {
	// The ribbon is what is being used, so an open Context gives it the room first.
	await closeContext(page);
	await page
		.getByTestId('ribbon-twin')
		.getByRole('button', { name })
		.first()
		.dispatchEvent('click');
	await expect(panel(page).getByTestId('selected-title')).toBeVisible();
}

/** Gives the ribbon the room it needs; a Context that is already closing is fine. */
export async function closeContext(page: Page): Promise<void> {
	const close = page.getByRole('button', { name: 'Закрыть Context', exact: true });
	await close.click({ timeout: 2000 }).catch(() => {});
}

/** «Записать» from the toolbar; an open Context (a shown record, a sheet) is closed first. */
export async function startCapture(page: Page): Promise<void> {
	await closeContext(page);
	await page.getByTestId('capture').click();
	await expect(editor(page)).toBeVisible();
}

/** A plain intention without a date through «Записать»; the Context then shows it. */
export async function captureIntention(page: Page, name: string): Promise<void> {
	await startCapture(page);
	await title(page).fill(name);
	await mode(page, 'intend').click();
	await editor(page).getByTestId('capture-save').click();
	await expect(panel(page).getByTestId('selected-title')).toHaveText(name);
}

/** The Links section of the shown record: a tab in compact layouts, a section on the desktop. */
export async function openLinks(page: Page): Promise<Locator> {
	const tab = panel(page).getByRole('tab', { name: 'Связи' });
	if (await tab.count()) await tab.click();
	return panel(page).getByTestId('context-links');
}

/**
 * Selects a record that has no place on the axis through «Без даты» — an undated intention,
 * for one. On a phone that row is a panel opened from the toolbar.
 */
export async function selectParked(page: Page, name: string | RegExp): Promise<void> {
	await closeContext(page);
	const chip = page.getByTestId('parked-chip').filter({ hasText: name });
	if ((await chip.count()) === 0) {
		await page
			.getByRole('button', { name: /Без даты/ })
			.first()
			.click();
	}
	await chip.first().click();
	await expect(panel(page).getByTestId('selected-title')).toBeVisible();
}

/** «История оценок» stays folded until asked (owner 2026-09-15): opened before a source is touched. */
export async function openSources(result: Locator): Promise<Locator> {
	const history = result.getByTestId('result-sources');
	if (!(await history.evaluate((element) => (element as HTMLDetailsElement).open)))
		await history.locator('summary').click();
	return history.getByTestId('result-source-list');
}

/** A direct statement's own controls sit behind its pencil in the folded history: opened as needed. */
export async function editSource(result: Locator): Promise<Locator> {
	await openSources(result);
	const toggle = result.getByTestId('source-edit-toggle');
	if ((await toggle.getAttribute('aria-pressed')) !== 'true') await toggle.click();
	return result.getByTestId('source-edit');
}

/** The Overview of the shown record: the tab in compact layouts, always there on the desktop. */
export async function showOverview(page: Page): Promise<void> {
	const tab = panel(page).getByRole('tab', { name: 'Обзор' });
	if (await tab.count()) await tab.click();
}

/** One stored assessment row of the export, in the shape these tests read. */
export type StoredSource = {
	id: string;
	origin: { intentionId: string; factId?: string };
	placement?: { intentionId: string };
	/** First creations by operation: `at` is the first time of this source. */
	initial: Record<string, { at: string; outcome?: string; open?: boolean }>;
	/** Corrections by feature; an absent feature was never written. */
	values?: { outcome?: { value: string | null }; open?: { value: boolean | null } };
	isDeleted?: boolean;
};

export type Backup = {
	collections: {
		traces: { id: string; content: string }[];
		intersections: { id: string; fromId: string; toId: string; kind: string; isDeleted: boolean }[];
		intentionAssessments: StoredSource[];
		logs: { operationId: string; entityType: string; action: string; entityId: string }[];
	};
};

/** The one stored source a fact wrote, as saved: its first creations and its corrections. */
export const sourceOf = (backup: Backup, content: string): StoredSource => {
	const trace = backup.collections.traces.find((row) => row.content === content);
	if (!trace) throw new Error(`No saved record «${content}».`);
	const rows = backup.collections.intentionAssessments.filter(
		(row) => row.origin.factId === trace.id
	);
	if (rows.length !== 1)
		throw new Error(`Expected one source of «${content}», got ${rows.length}.`);
	return rows[0];
};

/** Persisted rows for one saved record: its evidence links and their assessments. */
export const resultsOf = (backup: Backup, content: string) => {
	const trace = backup.collections.traces.find((row) => row.content === content);
	if (!trace) throw new Error(`No saved record «${content}».`);
	const byId = new Map(backup.collections.traces.map((row) => [row.id, row.content]));
	const links = backup.collections.intersections
		.filter((link) => link.kind === 'evidence_for' && link.fromId === trace.id)
		.map((link) => [byId.get(link.toId), link.isDeleted] as const)
		.toSorted((a, b) => String(a[0]).localeCompare(String(b[0])));
	const assessments = backup.collections.intentionAssessments
		.filter((row) => row.origin.factId === trace.id && !row.isDeleted)
		.map((row) => byId.get((row.placement ?? row.origin).intentionId))
		.toSorted();
	const created = backup.collections.logs.find(
		(log) => log.entityType === 'trace' && log.action === 'created' && log.entityId === trace.id
	);
	const operation = backup.collections.logs
		.filter((log) => log.operationId === created?.operationId)
		.map((log) => `${log.entityType}:${log.action}`)
		.toSorted();
	return { id: trace.id, links, assessments, operation };
};
