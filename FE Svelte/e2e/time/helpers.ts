import { readFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';

/**
 * `/time` runs its e2e in the hidden `e2e-synthetic` DataSpace: the harness enables the space and
 * leaves a calibration manifest in localStorage before the app boots, and the `(next)/time` layout
 * imports it through the ordinary scenario import pipeline before the workbench mounts.
 */
export const E2E_DATA_SPACE_ID = 'e2e-synthetic';
/** «Сейчас» of every `/time` test; the dense fixture is generated for the two years before it. */
export const E2E_NOW = new Date('2026-09-06T12:00:00Z');

const FIXTURES = {
	small: 'time-small.synthetic.json',
	dense: 'time-dense.synthetic.json'
} as const;

export type LoadTimeOptions = {
	manifest?: keyof typeof FIXTURES | null;
	theme?: 'dark' | 'light';
	/** A manifest placed under review before the app boots, as the proposals checkpoint. */
	proposals?: keyof typeof FIXTURES;
	/** «Сейчас» of the test when it must sit inside the corpus rather than after it. */
	now?: Date;
};

export const readManifest = (manifest: keyof typeof FIXTURES): string =>
	readFileSync(new URL(`../fixtures/${FIXTURES[manifest]}`, import.meta.url), 'utf8');

export const loadTime = async (
	page: Page,
	{ manifest = 'small', theme = 'dark', proposals, now = E2E_NOW }: LoadTimeOptions = {}
): Promise<void> => {
	const manifestText = manifest ? readManifest(manifest) : '';
	const manifestId = manifestText
		? (JSON.parse(manifestText) as { manifestId: string }).manifestId
		: null;
	await page.clock.setFixedTime(now);
	const proposalsText = proposals
		? JSON.stringify({
				manifest: JSON.parse(readManifest(proposals)),
				applied: [],
				importedAt: E2E_NOW.toISOString()
			})
		: '';
	await page.addInitScript(
		([dataSpaceId, text, checkpoint]) => {
			localStorage.setItem('chronograph-theme', 'dark');
			localStorage.setItem('tempience.e2e.data-space-enabled', '1');
			localStorage.setItem('tempience.data-space.active', dataSpaceId);
			localStorage.setItem('tempience.e2e.scenario-manifest', text);
			if (checkpoint) localStorage.setItem('tempience.time.proposals.v1', checkpoint);
		},
		[E2E_DATA_SPACE_ID, manifestText, proposalsText] as [string, string, string]
	);
	await page.goto('/time');
	await expect(page.getByTestId('time-workbench')).toHaveAttribute('data-status', 'ready', {
		timeout: 20_000
	});
	if (theme === 'light') {
		await page.getByTestId('appearance-open').click();
		await page.getByRole('button', { name: 'Светлая', exact: true }).click();
		await page.getByRole('button', { name: 'Применить', exact: true }).click();
	}
	await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
	// The workbench mounts only after the seed; the marker proves the import applied cleanly.
	await expect(page.getByRole('button', { name: 'Записать', exact: true })).toBeVisible({
		timeout: 20_000
	});
	if (manifestId)
		await expect
			.poll(() => page.evaluate(() => localStorage.getItem('tempience.e2e.scenario-seed')))
			.toBe(manifestId);
};

export const toggleLegend = async (page: Page, key: string): Promise<void> => {
	await page.getByTestId('filters-toggle').click();
	await page.locator(`[data-testid="legend"] [data-legend="${key}"]`).click();
	await page.keyboard.press('Escape');
};

export const resetFilters = async (page: Page): Promise<void> => {
	await page.getByTestId('filters-toggle').click();
	await page.getByTestId('filters-reset').click();
};

export const settleCamera = async (page: Page): Promise<void> => {
	await expect(page.getByTestId('time-workbench')).toHaveAttribute('data-camera-moving', 'false');
};

export const chooseScale = async (page: Page, label: string): Promise<void> => {
	await page.getByTestId('window-readout').click();
	await page
		.getByRole('list', { name: 'Масштаб окна' })
		.getByRole('button', { name: label, exact: true })
		.click();
	await settleCamera(page);
};

export const closeScope = async (page: Page): Promise<void> => {
	await page.getByTestId('scope-close').click();
};
