import { expect, test, type Page } from '@playwright/test';
import { exportBackup } from '../public/helpers';
import { ARTIFACTS } from './draft.helpers';
import { captureIntention, panel, selectParked, showOverview } from './results.helpers';

/**
 * Two devices of one space, paired to the isolated synthetic server this build was made for:
 * opt-in through `TEMPIENCE_E2E_SYNC_URL`, which must also be the `PUBLIC_TRIPLIT_SERVER_URL`
 * the app was built with, and the server's pairing code must be `context-sync-test`. One
 * device holds a record open in its Context; the other edits, assesses and deletes it — twice,
 * with a return here in between. The Context follows without anyone on the first device
 * reloading anything, and each deletion has a way back of its own.
 */
const SERVER = process.env.TEMPIENCE_E2E_SYNC_URL;

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

const openResult = async (page: Page) => {
	const tab = panel(page).getByRole('tab', { name: 'Результат' });
	if (await tab.count()) await tab.click();
	return panel(page).getByTestId('intention-result');
};

/**
 * The record the other device made reaches this one through sync; the ribbon is a snapshot
 * read at load, so the first opening of the app is repeated until the record is there. That
 * is the arrival of the record, not the Context following it: nothing is reloaded afterwards.
 */
const openOnce = async (page: Page, name: RegExp): Promise<void> => {
	for (let attempt = 0; attempt < 8; attempt++) {
		await page.goto('/time');
		await expect(page.getByTestId('time-workbench')).toHaveAttribute('data-status', 'ready', {
			timeout: 20_000
		});
		const parked = page.getByRole('button', { name: /Без даты/ }).first();
		if (await parked.count()) await parked.click();
		if ((await page.getByTestId('parked-chip').filter({ hasText: name }).count()) > 0) {
			await selectParked(page, name);
			return;
		}
		await page.waitForTimeout(1000);
	}
	throw new Error(`«${name}» never reached this device.`);
};

test('the Context of one device follows what another device does to the selected record', async ({
	browser,
	request
}) => {
	test.skip(!SERVER, 'needs the synthetic sync server and a build made for it');
	test.setTimeout(240_000);
	const errors: string[] = [];
	const contexts = [];
	for (const label of ['here', 'there']) {
		const response = await request.post(`${SERVER}/pair`, {
			data: { code: 'context-sync-test', deviceId: crypto.randomUUID(), deviceLabel: label }
		});
		expect(response.ok()).toBe(true);
		const auth = await response.json();
		const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
		await context.addInitScript(
			(value) => localStorage.setItem('tempience.triplit.auth', JSON.stringify(value)),
			auth
		);
		contexts.push(context);
	}
	const [here, there] = await Promise.all(contexts.map((context) => context.newPage()));
	// The synthetic space keeps the rows of earlier runs: this run's record has a name of its own.
	const name = `План Син ${Date.now().toString(36)}`;
	const edited = `${name} · правка`;
	const named = new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
	for (const [page, label] of [
		[here, 'here'],
		[there, 'there']
	] as const) {
		page.on('pageerror', (error) => errors.push(`${label} pageerror: ${error.message}`));
		page.on('console', (message) => {
			if (message.type() === 'error') errors.push(`${label} console.error: ${message.text()}`);
		});
	}
	try {
		// The other device makes the record; this device opens it and keeps it open.
		await there.goto('/time');
		await expect(there.getByTestId('time-workbench')).toHaveAttribute('data-status', 'ready', {
			timeout: 20_000
		});
		await captureIntention(there, name);
		await openOnce(here, named);
		await showOverview(here);
		await expect(panel(here).getByTestId('selected-title')).toHaveText(name);
		await expect(panel(here).getByTestId('delete-trace')).toBeVisible();

		// Edited there: the title here is the record as it is now.
		await panel(there).getByTestId('edit-trace').click();
		await panel(there).getByLabel('Название', { exact: true }).fill(edited);
		await panel(there).getByTestId('edit-save').click();
		await expect(panel(there).getByTestId('selected-title')).toHaveText(edited);
		await expect(panel(here).getByTestId('selected-title')).toHaveText(edited, {
			timeout: 20_000
		});

		// Assessed there: the result and the history here are current.
		await panel(there).getByTestId('add-result').click();
		await there
			.getByTestId('trace-editor')
			.getByLabel('Название', { exact: true })
			.fill('Факт Син');
		await there
			.getByTestId('trace-editor')
			.getByTestId('result-target')
			.filter({ hasText: name })
			.getByTestId('target-outcome')
			.selectOption('completed');
		await there.getByTestId('trace-editor').getByTestId('capture-save').click();
		await expect(panel(there).getByTestId('selected-title')).toHaveText('Факт Син');
		const result = await openResult(here);
		await expect(result.getByTestId('result-outcome')).toContainText('Выполнено', {
			timeout: 20_000
		});
		await expect(result.getByTestId('result-source')).toHaveCount(1);
		const history = panel(here).getByTestId('context-history');
		await expect(history.getByTestId('history-operation')).not.toHaveCount(0);
		await here.screenshot({
			path: `${ARTIFACTS}/i5b-closure-sync-assessed-1440.png`,
			fullPage: true
		});

		// Deleted there: here the record is read as deleted, and no command of an ordinary
		// record is offered for it — only the way back.
		await selectParked(there, named);
		await showOverview(there);
		await panel(there).getByTestId('delete-trace').click();
		await expect(there.getByTestId('undo-toast')).toBeVisible();
		await expect(panel(here).getByTestId('deleted-trace')).toBeVisible({ timeout: 20_000 });
		await expect(panel(here).getByTestId('deleted-state')).toHaveAttribute('data-state', 'deleted');
		await expect(panel(here).getByTestId('delete-trace')).toHaveCount(0);
		await expect(panel(here).getByTestId('edit-trace')).toHaveCount(0);
		await expect(panel(here).getByTestId('restore-trace')).toBeVisible();
		await here.screenshot({
			path: `${ARTIFACTS}/i5b-closure-sync-deleted-1440.png`,
			fullPage: true
		});

		// Brought back here, by the ordinary way back: the ordinary Context is back.
		await panel(here).getByTestId('restore-trace').click();
		await expect(panel(here).getByTestId('delete-trace')).toBeVisible({ timeout: 20_000 });
		await expect(panel(here).getByTestId('deleted-trace')).toHaveCount(0);
		await expect(panel(here).getByTestId('selected-title')).toHaveText(edited);
		await here.screenshot({
			path: `${ARTIFACTS}/i5b-closure-sync-restored-1440.png`,
			fullPage: true
		});

		// Deleted there a second time — its offer to take the first deletion back is stale, and
		// its timeline is a snapshot, so the other device opens the app again to find the record.
		// A new deletion is a new episode: here, still on the same selection with nothing
		// reloaded, the way back must be a way back again, not the one already taken.
		await there.goto('/time');
		await expect(there.getByTestId('time-workbench')).toHaveAttribute('data-status', 'ready', {
			timeout: 20_000
		});
		await selectParked(there, named);
		await showOverview(there);
		await panel(there).getByTestId('delete-trace').click();
		await expect(there.getByTestId('undo-toast')).toBeVisible();
		await expect(panel(here).getByTestId('deleted-trace')).toBeVisible({ timeout: 20_000 });
		await expect(panel(here).getByTestId('restore-trace')).toBeEnabled();
		await panel(here).getByTestId('restore-trace').click();
		await expect(panel(here).getByTestId('delete-trace')).toBeVisible({ timeout: 20_000 });
		await expect(panel(here).getByTestId('deleted-trace')).toHaveCount(0);
		await expect(panel(here).getByTestId('selected-title')).toHaveText(edited);
		await here.screenshot({
			path: `${ARTIFACTS}/i5b-final-sync-restored-again-1440.png`,
			fullPage: true
		});
		// Two deletions and two returns of the record, each an operation of its own cause.
		const backup = (await exportBackup(here)) as unknown as {
			collections: {
				traces: { id: string; content: string; isDeleted: boolean }[];
				logs: { entityType: string; entityId: string; action: string; cause: string }[];
			};
		};
		const trace = backup.collections.traces.find((row) => row.content === edited)!;
		expect(trace.isDeleted).toBe(false);
		const lifecycle = backup.collections.logs
			.filter((log) => log.entityType === 'trace' && log.entityId === trace.id)
			.filter((log) => log.action === 'deleted' || log.action === 'restored')
			.map((log) => `${log.action}:${log.cause}`)
			.toSorted();
		expect(lifecycle).toEqual([
			'deleted:normal',
			'deleted:normal',
			'restored:restore',
			'restored:restore'
		]);
		expect(errors).toEqual([]);
	} finally {
		for (const context of contexts) await context.close();
	}
});
