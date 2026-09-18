import { expect, test, type Page } from '@playwright/test';
import { loadTime, resetFilters } from './helpers';

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

const context = (page: Page) => page.getByRole('complementary', { name: 'Context' });
const title = (page: Page) => context(page).getByTestId('selected-title');
/** The DOM twin is the keyboard path onto the ribbon; a dispatched click bypasses the Scope panel overlay. */
const pickRecord = async (page: Page, index = 3): Promise<string> => {
	await page.getByTestId('ribbon-twin').getByRole('button').nth(index).dispatchEvent('click');
	await expect(title(page)).not.toBeEmpty();
	return title(page).innerText();
};

test('the Overview leads with the title, one mono line of time, then live actions', async ({
	page
}) => {
	await loadTime(page, { manifest: 'dense' });
	await pickRecord(page);
	const panel = context(page);
	await expect(panel.getByRole('tab')).toHaveCount(0);
	const overview = panel.getByTestId('context-overview');
	// Time alone: kind, relation and precision live in «Технические данные» (owner 2026-09-15).
	await expect(overview.getByTestId('selected-time')).toHaveText(/\d{4}/);
	await expect(overview.getByTestId('selected-time')).not.toContainText(' · ');
	const titleBox = (await title(page).boundingBox())!;
	const timeBox = (await overview.getByTestId('selected-time').boundingBox())!;
	expect(timeBox.y).toBeGreaterThan(titleBox.y);
	await expect(panel.getByTestId('edit-trace')).toBeEnabled();
	await expect(panel.getByTestId('delete-trace')).toBeEnabled();
	await expect(panel.getByTestId('belonging').first()).toBeVisible();
	await panel.getByTestId('only-these-scopes').click();
	await expect(page.getByTestId('filters-count')).toHaveText('1');
	await resetFilters(page);
	await panel.getByText('Технические данные').click();
	await expect(panel.getByText('origin')).toBeVisible();
});

test('the Links section lists explicit links and offers «Найти и связать…»', async ({ page }) => {
	await loadTime(page, { manifest: 'dense' });
	const before = await pickRecord(page);
	const panel = context(page);
	const links = panel.getByTestId('context-links');
	await expect(links).toBeVisible();
	await expect(links.getByTestId('link-search-open')).toBeEnabled();
	const targets = links.getByTestId('link-target');
	const count = await targets.count();
	await expect(panel.getByTestId('context-section-links')).toContainText(`Связи · ${count}`);
	if (count === 0) {
		await expect(links).toContainText('Явных связей нет');
		return;
	}
	await targets.first().click();
	await expect(title(page)).not.toHaveText(before);
	await expect(page.getByTestId('history-position')).toHaveText('2 / 2');
});

test('the Neighborhood explains every neighbour and re-anchors on click', async ({ page }) => {
	await loadTime(page, { manifest: 'dense' });
	const before = await pickRecord(page);
	const panel = context(page);
	await expect(panel.getByTestId('context-section-neighborhood')).toContainText(
		'Окрестность · 5 + 5'
	);
	const list = panel.getByTestId('context-neighborhood');
	await expect(list.locator('[aria-current="true"]')).toContainText(before);
	const neighbors = list.getByTestId('neighbor');
	await expect(neighbors.first()).toBeVisible();
	await expect(neighbors.first()).toContainText(/\d+ дн|тот же день|общий источник/);
	await list.getByRole('button', { name: 'Во всех' }).click();
	await expect(list.getByRole('button', { name: 'Во всех' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	// Titles repeat in the dense corpus, so the date of the clicked neighbour identifies the new anchor.
	const [nextDate] = (await neighbors.first().innerText()).split('\n');
	await neighbors.first().click();
	await expect(page.getByTestId('history-position')).toHaveText('2 / 2');
	await expect(list.locator('[aria-current="true"]')).toContainText(nextDate);
});

test('desktop sections fold, remember it across records, and turn into tabs when compact', async ({
	page
}) => {
	await loadTime(page, { manifest: 'dense' });
	await pickRecord(page);
	const panel = context(page);
	for (const id of ['overview', 'links', 'neighborhood'])
		await expect(panel.getByTestId(`context-${id}`)).toBeVisible();
	await panel.getByTestId('section-toggle-links').click();
	await expect(panel.getByTestId('context-links')).toHaveCount(0);
	await expect(panel.getByTestId('section-toggle-links')).toHaveAttribute('aria-expanded', 'false');
	expect(
		await page.evaluate(() => localStorage.getItem('tempience.context.sections.v1'))
	).toContain('"links":true');
	await pickRecord(page, 5);
	await expect(panel.getByTestId('context-links')).toHaveCount(0);
	await expect(panel.getByTestId('context-neighborhood')).toBeVisible();
	await panel.getByRole('button', { name: 'Связанная запись…', exact: true }).click();
	await expect(panel.getByTestId('context-links')).toBeVisible();
	await page.setViewportSize({ width: 800, height: 900 });
	await page.getByRole('button', { name: 'Context', exact: true }).click();
	await expect(panel.getByRole('tab', { name: 'Обзор' })).toHaveAttribute('aria-selected', 'true');
	await panel.getByRole('tab', { name: 'Связи' }).click();
	await expect(panel.getByTestId('context-links')).toBeVisible();
	await expect(panel.getByTestId('context-overview')).toHaveCount(0);
});

test('«Записать» keeps time independent of text, allows no Scope and selects the new record in place', async ({
	page
}) => {
	await loadTime(page, { manifest: 'dense' });
	const range = page.getByTestId('window-dates');
	const window = await range.innerText();
	await page.getByTestId('capture').click();
	const capture = context(page).getByTestId('context-capture');
	await expect(capture.getByTestId('capture-save')).toBeDisabled();
	const initialTime = await capture.getByTestId('trace-time').innerText();
	await capture.getByLabel('Название', { exact: true }).fill('Созвон по ядру вчера 14:30');
	await expect(capture.getByTestId('trace-time')).toHaveText(initialTime, { useInnerText: true });
	await expect(capture.getByRole('list', { name: 'Выбранные Scope' })).toHaveCount(0);
	await expect(capture.getByTestId('capture-save')).toBeEnabled();
	const modes = capture.getByTestId('draft-mode');
	await modes.locator('[data-mode="intend"]').click();
	await expect(modes.locator('[data-mode="intend"]')).toHaveAttribute('aria-pressed', 'true');
	await modes.locator('[data-mode="actual"]').click();
	await capture.getByTestId('trace-time').click();
	await expect(capture.getByLabel('Дата приблизительная')).not.toBeVisible();
	await capture.getByText('Уточнить дату…', { exact: true }).click();
	await expect(
		capture.getByRole('button', { name: 'Взять дату из текста', exact: true })
	).toHaveCount(0);
	await capture.getByRole('button', { name: 'Дата неизвестна', exact: true }).click();
	await capture.getByRole('button', { name: 'Применить время', exact: true }).click();
	await expect(capture.getByTestId('trace-time')).toContainText('время неизвестно');
	await capture
		.getByLabel('Название', { exact: true })
		.fill('Созвон по ядру 11 сентября 2001 08:15');
	await expect(capture.getByTestId('trace-time')).toContainText('время неизвестно');
	await expect(capture.getByTestId('capture-save')).toBeEnabled();
	await capture.getByTestId('capture-save').click();
	await expect(title(page)).toHaveText('Созвон по ядру 11 сентября 2001 08:15');
	await expect(context(page).getByTestId('context-overview')).toContainText('время неизвестно');
	await expect(range).toHaveText(window);
	await expect(page.getByTestId('capture')).toBeVisible();
});
