import { expect, test, type Page } from '@playwright/test';
import { exportBackup } from '../public/helpers';
import { ARTIFACTS, cleanConsole, dialog, editor, title, mode } from './draft.helpers';
import { loadTime } from './helpers';
import {
	captureIntention,
	openLinks,
	panel,
	picker,
	candidate,
	selectParked,
	selectRecord,
	showOverview,
	startCapture
} from './results.helpers';

cleanConsole(test, 'i5a-console-input.log');

const openResult = async (page: Page) => {
	const tab = panel(page).getByRole('tab', { name: 'Результат' });
	if (await tab.count()) await tab.click();
	return panel(page).getByTestId('intention-result');
};

const directOutcome = (page: Page) => panel(page).getByTestId('direct-outcome');

test.describe('Unsent direct input across the layouts of one session', () => {
	test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

	test('survives desktop → phone → desktop and parts of the Context, and is dropped only on request', async ({
		page
	}) => {
		test.setTimeout(180_000);
		await loadTime(page, { manifest: null });
		await captureIntention(page, 'План П');
		await openResult(page);
		await panel(page).getByTestId('result-assess').click();
		await directOutcome(page).selectOption('partial');
		await expect(directOutcome(page)).toHaveValue('partial');
		// The phone destroys and rebuilds this view; what was typed is not the view's to lose.
		await page.setViewportSize({ width: 390, height: 844 });
		await selectParked(page, /План П/);
		await openResult(page);
		await expect(directOutcome(page)).toHaveValue('partial');
		await page.screenshot({ path: `${ARTIFACTS}/i5a-input-kept-390.png`, fullPage: true });
		await page.setViewportSize({ width: 1440, height: 900 });
		await selectParked(page, /План П/);
		await openResult(page);
		await expect(directOutcome(page)).toHaveValue('partial');
		// Another part of the Context and back is an ordinary move, not a discard either.
		await showOverview(page);
		const result = await openResult(page);
		await expect(directOutcome(page)).toHaveValue('partial');
		// Nothing was written by any of that.
		let backup = await exportBackup(page);
		expect(backup.collections.intentionAssessments).toEqual([]);
		// Dropping it is the user's own action, and then it is gone.
		await result.getByTestId('direct-discard').click();
		await result.getByTestId('result-assess').click();
		await expect(directOutcome(page)).toHaveValue('');
		await expect(result.getByTestId('direct-save')).toBeDisabled();
		await directOutcome(page).selectOption('not_completed');
		await result.getByTestId('direct-save').click();
		await expect(result.getByTestId('result-outcome')).toContainText('Не выполнено');
		await expect(result.getByTestId('result-notice')).toBeVisible();
		await result.getByTestId('result-assess').click();
		await expect(directOutcome(page)).toHaveValue('');
		backup = await exportBackup(page);
		expect(backup.collections.intentionAssessments).toHaveLength(1);
	});

	test('reopens a closed intention directly, writing only that decision', async ({ page }) => {
		test.setTimeout(150_000);
		await loadTime(page, { manifest: null });
		await captureIntention(page, 'План О');
		const result = await openResult(page);
		await result.getByTestId('result-assess').click();
		await directOutcome(page).selectOption('completed');
		await result.getByTestId('direct-close').check();
		await result.getByTestId('direct-save').click();
		await expect(result.getByTestId('result-open')).toHaveAttribute('data-open', 'closed');
		await expect(result.getByTestId('result-outcome')).toContainText('Выполнено');
		// A closed intention offers the opposite decision, and nothing else changes with it.
		await result.getByTestId('result-assess').click();
		await expect(result.getByTestId('direct-close')).toHaveCount(0);
		await result.getByTestId('direct-reopen').check();
		await result.getByTestId('direct-save').click();
		await expect(result.getByTestId('result-open')).toHaveAttribute('data-open', 'open');
		await expect(result.getByTestId('result-outcome')).toContainText('Выполнено');
		await expect(result.getByTestId('result-source')).toHaveCount(2);
		await page.screenshot({ path: `${ARTIFACTS}/i5a-direct-reopen-1440.png`, fullPage: true });
		const rows = (await exportBackup(page)).collections.intentionAssessments as {
			source: string;
			initial: Record<string, { at: string; outcome?: string; open?: boolean }>;
		}[];
		expect(rows).toHaveLength(2);
		const statements = rows.map((row) => {
			const { at, ...values } = Object.values(row.initial)[0];
			void at;
			return values;
		});
		// The reopening states its one feature; the earlier statement keeps both of its own.
		expect(statements).toContainEqual({ open: true });
		expect(statements).toContainEqual({ outcome: 'completed', open: false });
	});
});

test.describe('Correcting the address of a link that carries no assessment', () => {
	test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

	test('is offered on the link itself, refuses a target already linked, and writes no assessment', async ({
		page
	}) => {
		test.setTimeout(180_000);
		await loadTime(page, { manifest: null });
		await captureIntention(page, 'План 1');
		await captureIntention(page, 'План 2');
		await captureIntention(page, 'План 3');
		await startCapture(page);
		await title(page).fill('Факт Н');
		for (const name of ['План 1', 'План 2']) {
			await mode(page, 'evidence').click();
			await editor(page).getByTestId('result-pick').click();
			await picker(page).getByTestId('result-search').fill(name);
			await candidate(page, name).click();
			await picker(page).getByTestId('result-picker-close').click();
		}
		// Neither link carries a statement: there is no source row to correct through.
		await editor(page).getByTestId('capture-save').click();
		await expect(panel(page).getByTestId('selected-title')).toHaveText('Факт Н');
		const links = await openLinks(page);
		await expect(links.getByTestId('link-retarget')).toHaveCount(2);
		// The row that names «План 1» is the one being corrected, whatever order the rows arrive in.
		const row = links.getByTestId('link-row').filter({ hasText: 'План 1' });
		await row.getByTestId('source-retarget').click();
		await row.getByTestId('retarget-search').fill('План 2');
		await row.getByTestId('retarget-candidate').click();
		// The fact already stands for «План 2»: the correction refuses and changes neither side.
		await expect(row.getByTestId('retarget-error')).toContainText('уже есть действующая связь');
		await expect(links.getByTestId('link-target')).toHaveCount(2);
		await page.screenshot({
			path: `${ARTIFACTS}/i5a-unassessed-retarget-1440.png`,
			fullPage: true
		});
		await row.getByTestId('retarget-search').fill('План 3');
		await row.getByTestId('retarget-candidate').click();
		await expect(links.getByTestId('retarget')).toHaveCount(0);
		await expect(links.getByTestId('link-target')).toHaveCount(2);
		await expect(links.getByTestId('link-target').filter({ hasText: 'План 1' })).toHaveCount(0);
		await expect(links.getByTestId('link-target').filter({ hasText: 'План 3' })).toHaveCount(1);
		const backup = await exportBackup(page);
		// The address moved; no assessment was invented to carry it.
		expect(backup.collections.intentionAssessments).toEqual([]);
		const evidence = (
			backup.collections.intersections as { kind: string; isDeleted: boolean; toId: string }[]
		).filter((link) => link.kind === 'evidence_for');
		expect(evidence.filter((link) => !link.isDeleted)).toHaveLength(2);
		expect(evidence.filter((link) => link.isDeleted)).toHaveLength(1);
		// The correction is reachable from the intention's own side as well, unchanged.
		await selectRecord(page, /Факт Н/);
		await showOverview(page);
		await expect(panel(page).getByTestId('selected-title')).toHaveText('Факт Н');
	});
});

test.describe('The lifetime of unsent direct input', () => {
	test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

	test('is asked about before a transition that would end it, and «Keep» cancels that transition', async ({
		page
	}) => {
		test.setTimeout(150_000);
		await loadTime(page, { manifest: null });
		await captureIntention(page, 'План Д2');
		await openResult(page);
		await panel(page).getByTestId('result-assess').click();
		await directOutcome(page).selectOption('partial');
		const switcher = page.getByTestId('data-space-switcher');
		const here = await switcher.inputValue();
		// Switching the space reloads the app, which would end this input: the question is the
		// existing one, and «Продолжить редактирование» cancels the switch itself.
		await switcher.selectOption('canonical');
		await expect(dialog(page)).toBeVisible();
		await page.screenshot({ path: `${ARTIFACTS}/i5a-reload-exit-keep-1440.png`, fullPage: true });
		await dialog(page).getByTestId('discard-keep').click();
		await expect(dialog(page)).toHaveCount(0);
		await expect(switcher).toHaveValue(here);
		await expect(page.getByTestId('time-workbench')).toHaveAttribute('data-status', 'ready');
		// The input is exactly where it was, in the space it was entered in.
		await expect(directOutcome(page)).toHaveValue('partial');
		expect((await exportBackup(page)).collections.intentionAssessments).toEqual([]);
	});

	test('asks nothing when no input is held', async ({ page }) => {
		await loadTime(page, { manifest: null });
		await captureIntention(page, 'План Д3');
		await openResult(page);
		await panel(page).getByTestId('result-assess').click();
		await expect(directOutcome(page)).toHaveValue('');
		// A pristine result part is not a reason to stop anything.
		await page.getByTestId('data-space-switcher').selectOption('canonical');
		await expect(dialog(page)).toHaveCount(0);
	});

	test('is this session: a reload of the app ends it, and nothing was written', async ({
		page
	}) => {
		test.setTimeout(150_000);
		await loadTime(page, { manifest: null });
		await captureIntention(page, 'План Д1');
		await openResult(page);
		await panel(page).getByTestId('result-assess').click();
		await directOutcome(page).selectOption('partial');
		await expect(directOutcome(page)).toHaveValue('partial');
		// The input is held in memory for this session; reloading the app is the end of it, as
		// switching the DataSpace is, because that reloads too.
		await page.reload();
		await expect(page.getByTestId('time-workbench')).toHaveAttribute('data-status', 'ready', {
			timeout: 20_000
		});
		await selectParked(page, /План Д1/);
		await openResult(page);
		// Nothing held: the step is closed, and opens empty.
		await panel(page).getByTestId('result-assess').click();
		await expect(directOutcome(page)).toHaveValue('');
		await page.screenshot({ path: `${ARTIFACTS}/i5a-input-lifetime-1440.png`, fullPage: true });
		const backup = await exportBackup(page);
		expect(backup.collections.intentionAssessments).toEqual([]);
	});
});
