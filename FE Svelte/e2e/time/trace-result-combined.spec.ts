import { expect, test } from '@playwright/test';
import { exportBackup } from '../public/helpers';
import { ARTIFACTS, cleanConsole, editor, mode, title } from './draft.helpers';
import { loadTime } from './helpers';
import {
	candidate,
	captureIntention,
	closeBox,
	openLinks,
	outcome,
	panel,
	picker,
	selectRecord,
	showOverview,
	startCapture
} from './results.helpers';

cleanConsole(test, 'i5a-console-combined.log');

const openResult = async (page: import('@playwright/test').Page) => {
	const tab = panel(page).getByRole('tab', { name: 'Результат' });
	if (await tab.count()) await tab.click();
	return panel(page).getByTestId('intention-result');
};

test.describe('Several statements about one intention at 1440', () => {
	test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

	test('closes it from one fact, keeps the other outcome, and a later direct assessment decides', async ({
		page
	}) => {
		test.setTimeout(180_000);
		await loadTime(page, { manifest: null });
		await captureIntention(page, 'План К');
		// One fact states «partly»; a later one closes the intention without stating an outcome.
		// Both happened today, so the statements are ordered by when they were first made.
		await showOverview(page);
		await panel(page).getByTestId('add-result').click();
		await title(page).fill('Ранний факт');
		await outcome(page, 'План К').selectOption('partial');
		await editor(page).getByTestId('capture-save').click();
		await expect(panel(page).getByTestId('selected-title')).toHaveText('Ранний факт');
		let links = await openLinks(page);
		await links.getByTestId('link-target').click();
		await showOverview(page);
		await panel(page).getByTestId('add-result').click();
		await title(page).fill('Поздний факт');
		await closeBox(page, 'План К').check();
		await editor(page).getByTestId('capture-save').click();
		await expect(panel(page).getByTestId('selected-title')).toHaveText('Поздний факт');
		links = await openLinks(page);
		await links.getByTestId('link-target').click();
		await showOverview(page);
		await expect(panel(page).getByTestId('selected-title')).toHaveText('План К');
		// Two statements, two features: the outcome is the earlier one's, the closure the later one's.
		let result = await openResult(page);
		await expect(result.getByTestId('result-outcome')).toContainText('Частично выполнено');
		await expect(result.getByTestId('result-decided')).toContainText('через факт «Ранний факт»');
		await expect(result.getByTestId('result-open')).toHaveAttribute('data-open', 'closed');
		await expect(
			result.getByTestId('result-source').filter({ hasText: 'Поздний факт' })
		).toHaveCount(1);
		await expect(result.getByTestId('result-source')).toHaveCount(2);
		await page.screenshot({ path: `${ARTIFACTS}/i5a-two-sources-1440.png`, fullPage: true });
		// A direct assessment made now is the latest statement of the outcome, and only of it.
		await result.getByTestId('result-assess').click();
		await result.getByTestId('direct-outcome').selectOption('not_completed');
		await result.getByTestId('direct-save').click();
		await expect(result.getByTestId('result-outcome')).toContainText('Не выполнено');
		await expect(result.getByTestId('result-decided')).toContainText('прямая оценка');
		await expect(result.getByTestId('result-open')).toHaveAttribute('data-open', 'closed');
		await expect(
			result.getByTestId('result-source').filter({ hasText: 'Поздний факт' })
		).toHaveCount(1);
		await expect(result.getByTestId('result-source')).toHaveCount(3);
		// Withdrawing the later link takes its closure out of the result; the rest stands.
		links = await openLinks(page);
		await links
			.getByTestId('link-target')
			.filter({ hasText: 'Поздний факт' })
			.locator('xpath=..')
			.getByTestId('link-remove')
			.click();
		result = await openResult(page);
		await expect(result.getByTestId('result-open')).toHaveAttribute('data-open', 'open');
		await expect(result.getByTestId('result-outcome')).toContainText('Не выполнено');
		const withdrawn = result.getByTestId('result-source').filter({ hasText: 'Поздний факт' });
		await expect(withdrawn).toHaveAttribute('data-effective', 'false');
		await expect(withdrawn.getByTestId('source-inactive')).toHaveText('связь снята');
		const backup = await exportBackup(page);
		// Nothing was rewritten to make that happen: the statement itself is untouched.
		const rows = backup.collections.intentionAssessments as { isDeleted?: boolean }[];
		expect(rows).toHaveLength(3);
		expect(rows.every((row) => row.isDeleted !== true)).toBe(true);
	});
});

test.describe('Role guards of the generic link picker at 1440', () => {
	test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

	test('refuses a result link with the wrong roles and blocks a relation an active link needs', async ({
		page
	}) => {
		test.setTimeout(150_000);
		await loadTime(page, { manifest: null });
		await captureIntention(page, 'План Л');
		await startCapture(page);
		await title(page).fill('Факт Л');
		await mode(page, 'evidence').click();
		await editor(page).getByTestId('result-pick').click();
		await picker(page).getByTestId('result-search').fill('План Л');
		await candidate(page, 'План Л').click();
		await picker(page).getByTestId('result-picker-close').click();
		await editor(page).getByTestId('capture-save').click();
		await expect(panel(page).getByTestId('selected-title')).toHaveText('Факт Л');
		// The fact is a result of an intention, so it cannot become an intention itself.
		await panel(page).getByTestId('edit-trace').click();
		await expect(mode(page, 'intend')).toBeDisabled();
		await expect(mode(page, 'intend')).toHaveAttribute('title', /План Л/);
		await expect(mode(page, 'intend')).toBeDisabled();
		await editor(page).getByRole('button', { name: 'Отмена', exact: true }).click();
		// The generic picker cannot make a second fact the target of a result either.
		await startCapture(page);
		await title(page).fill('Факт М');
		await editor(page).getByTestId('capture-save').click();
		let links = await openLinks(page);
		await links.getByTestId('link-search-open').click();
		await links.getByTestId('link-kind').selectOption('evidence_for');
		await links.getByTestId('link-search').fill('Факт Л');
		await links.getByTestId('link-candidate').click();
		await expect(links.getByTestId('link-refused')).toContainText('намерение');
		await expect(links.getByTestId('link-target')).toHaveCount(0);
		await page.screenshot({ path: `${ARTIFACTS}/i5a-role-refusal-1440.png`, fullPage: true });
		// After the link is taken off, the same record may change its role.
		await selectRecord(page, /Факт Л/);
		await showOverview(page);
		links = await openLinks(page);
		await links.getByTestId('link-remove').click();
		await expect(links.getByTestId('link-target')).toHaveCount(0);
		await showOverview(page);
		await panel(page).getByTestId('edit-trace').click();
		await expect(mode(page, 'intend')).toBeEnabled();
		await mode(page, 'intend').click();
		await editor(page).getByTestId('edit-save').click();
		// The relation reads in «Технические данные», not in the time line (owner 2026-09-15).
		await panel(page).getByText('Технические данные').click();
		await expect(panel(page).getByTestId('tech-data')).toContainText('намерение');
	});
});
