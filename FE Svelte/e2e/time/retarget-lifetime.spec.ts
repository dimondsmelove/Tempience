import { expect, test, type Page } from '@playwright/test';
import { instrumentBoundary, prepareBoundary } from './boundary.helpers';
import { editor, title, mode } from './draft.helpers';
import { loadTime } from './helpers';
import {
	captureIntention,
	closeBox,
	openLinks,
	outcome,
	panel,
	selectRecord,
	showOverview,
	startCapture,
	openSources
} from './results.helpers';

declare global {
	interface Window {
		__candidateReads?: { candidates: number };
	}
}

/**
 * Counts the reads of the candidates of a correction — the one thin read of the intentions
 * (`relation: 'intend'`), which nothing else asks for — on the app's own repository object,
 * the one every reader holds, by the module URL the page itself loaded (the boundary
 * helper resolves a dev server's `?t=` stamp). A production preview serves no such URL:
 * the check is a dev-harness one.
 */
const instrument = async (page: Page): Promise<boolean> =>
	(await instrumentBoundary(page)) &&
	page.evaluate(async () => {
		try {
			const { tempienceRepository } = await import(
				/* @vite-ignore */ window.__appModule!('/src/lib/state/triplit/index.ts')
			);
			const reads = { candidates: 0 };
			window.__candidateReads = reads;
			const repository = tempienceRepository as unknown as {
				listTraceHeads: (request: { relation?: string }) => unknown;
			};
			const original = repository.listTraceHeads;
			repository.listTraceHeads = (request) => {
				if (request.relation === 'intend') reads.candidates += 1;
				return original.call(tempienceRepository, request);
			};
			return true;
		} catch {
			return false;
		}
	});

const reads = (page: Page) => page.evaluate(() => window.__candidateReads ?? null);

const openResult = async (page: Page) => {
	const tab = panel(page).getByRole('tab', { name: 'Результат' });
	if (await tab.count()) await tab.click();
	return panel(page).getByTestId('intention-result');
};

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });
test.beforeEach(({ page }) => prepareBoundary(page));

test('the candidates of a correction are read once per open link; the query only filters them', async ({
	page
}) => {
	test.setTimeout(120_000);
	await loadTime(page, { manifest: null });
	test.skip(!(await instrument(page)), 'The app’s modules are reachable on a dev server only.');
	await captureIntention(page, 'План А');
	await captureIntention(page, 'План Б');
	await captureIntention(page, 'План В');
	await startCapture(page);
	await title(page).fill('Факт Р');
	for (const name of ['План А', 'План Б']) {
		await mode(page, 'evidence').click();
		await editor(page).getByTestId('result-pick').click();
		await editor(page).getByTestId('result-picker').getByTestId('result-search').fill(name);
		await editor(page).getByTestId('result-candidate').click();
		await editor(page).getByTestId('result-picker-close').click();
	}
	await outcome(page, 'План А').selectOption('completed');
	await closeBox(page, 'План Б').check();
	await editor(page).getByTestId('capture-save').click();
	await expect(panel(page).getByTestId('selected-title')).toHaveText('Факт Р');
	expect(await reads(page)).toEqual({ candidates: 0 });

	// The correction opens for the link of «План А»: one read of the intentions, itself left out.
	const links = await openLinks(page);
	await links.getByTestId('link-target').filter({ hasText: 'План А' }).click();
	await showOverview(page);
	let result = await openResult(page);
	await openSources(result);
	await result.getByTestId('source-retarget').click();
	const candidates = () => result.getByTestId('retarget-candidate');
	const shown = async () =>
		(await candidates().allInnerTexts()).map((text) => text.trim()).toSorted();
	await expect(candidates()).toHaveCount(2);
	expect(await shown()).toEqual(['План Б', 'План В']);
	expect(await reads(page)).toEqual({ candidates: 1 });

	// Every keystroke replaces the step: what is shown follows the query, nothing is read again.
	const search = result.getByTestId('retarget-search');
	await search.fill('План Б');
	await expect(candidates()).toHaveCount(1);
	expect(await shown()).toEqual(['План Б']);
	await search.fill('План');
	await expect(candidates()).toHaveCount(2);
	await search.fill('ничего такого');
	await expect(result.getByTestId('retarget-empty')).toBeVisible();
	await search.fill('в');
	await expect(candidates()).toHaveCount(1);
	expect(await shown()).toEqual(['План В']);
	await search.fill('');
	await expect(candidates()).toHaveCount(2);
	expect(await reads(page)).toEqual({ candidates: 1 });

	// Closed and opened again for the same link: read again.
	await result.getByTestId('retarget-close').click();
	await expect(result.getByTestId('retarget')).toHaveCount(0);
	await openSources(result);
	await result.getByTestId('source-retarget').click();
	await expect(candidates()).toHaveCount(2);
	expect(await reads(page)).toEqual({ candidates: 2 });

	// Another record's link — reached through the fact, as an undated plan is off the ribbon:
	// read for that one, that record left out.
	await selectRecord(page, /Факт Р/);
	const linksAgain = await openLinks(page);
	await linksAgain.getByTestId('link-target').filter({ hasText: 'План Б' }).click();
	await showOverview(page);
	await expect(panel(page).getByTestId('selected-title')).toHaveText('План Б');
	result = await openResult(page);
	// The views on the way — the fact, then this plan — read for the step still open for
	// «План А» whenever they mounted it or the selected record changed; that is a change of
	// the effect's inputs, not a keystroke. Opening the step for this link is one more read.
	const before = (await reads(page))?.candidates ?? 0;
	await openSources(result);
	await result.getByTestId('source-retarget').click();
	await expect(candidates()).toHaveCount(2);
	expect(await shown()).toEqual(['План А', 'План В']);
	expect((await reads(page))?.candidates).toBe(before + 1);
});
