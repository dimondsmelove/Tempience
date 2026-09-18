import { expect, test, type Page } from '@playwright/test';
import { trackConsoleErrors } from './helpers';

const CANONICAL_DATA_SPACE_ID = 'canonical';
const SCENARIO_DATA_SPACE_ID = 'belgrade-what-if-v1';

test.use({
	viewport: { width: 1100, height: 900 },
	isMobile: false,
	hasTouch: false
});

const switchDataSpace = async (page: Page, id: string): Promise<void> => {
	const navigation = page.waitForEvent('framenavigated', {
		predicate: (frame) => frame === page.mainFrame()
	});
	await Promise.all([page.getByTestId('data-space-switcher').selectOption(id), navigation]);
	await expect(page.getByTestId('data-space-switcher')).toHaveValue(id);
};

const openTraceKinds = async (page: Page): Promise<void> => {
	await page.goto('/forms');
	await expect(page.getByTestId('trace-forms')).toBeVisible();
};

const createTraceKind = async (page: Page, name: string): Promise<void> => {
	const forms = page.getByTestId('trace-forms');
	await forms.getByRole('button', { name: 'Новый Trace Kind', exact: true }).click();
	await forms.getByLabel('Название Trace Kind').fill(name);
	await forms.getByLabel('Название поля', { exact: true }).fill('Значение');
	await forms.getByRole('button', { name: 'Создать Trace Kind', exact: true }).click();
	await expect(page).toHaveURL(/\/forms\/[^/]+$/);
};

test('canonical and scenario data stay isolated', async ({ page }) => {
	const consoleErrors = trackConsoleErrors(page);
	const canonicalKind = 'Canonical isolation marker';
	const scenarioKind = 'Scenario isolation marker';

	await openTraceKinds(page);
	await expect(page.getByTestId('data-space-switcher')).toHaveValue(CANONICAL_DATA_SPACE_ID);
	await createTraceKind(page, canonicalKind);
	await openTraceKinds(page);

	await switchDataSpace(page, SCENARIO_DATA_SPACE_ID);
	await expect(page.getByText(canonicalKind, { exact: true })).toHaveCount(0);
	await expect(page.getByText('Trace Kind пока нет.')).toBeVisible();
	await createTraceKind(page, scenarioKind);
	await openTraceKinds(page);

	await switchDataSpace(page, CANONICAL_DATA_SPACE_ID);
	await expect(page.getByText(canonicalKind, { exact: true })).toBeVisible();
	await expect(page.getByText(scenarioKind, { exact: true })).toHaveCount(0);

	await switchDataSpace(page, SCENARIO_DATA_SPACE_ID);
	await expect(page.getByText(scenarioKind, { exact: true })).toBeVisible();
	expect(consoleErrors, `console errors:\n${consoleErrors.join('\n')}`).toEqual([]);
});

// The scenario's own menu («⋯» → «Сбросить сценарий», DataSpaceNotice) has not been rendered
// since c5ab937 hid it from the identity bar, which time/shell.spec.ts asserts on purpose;
// the reset itself (`resetScenarioDataSpace`) has no other way in. Where it belongs is a
// product decision, not this check's. The bound itself — one scenario's own client cleared,
// the canonical data refused — is `data-space.test.ts` «clears only a scenario…»; what waits
// here is the rendered walk of that entry, with the markers and the bounds it had, unverified
// until the entry exists again.
test.fixme('scenario reset is bounded to the scenario space', async ({ page }) => {
	const consoleErrors = trackConsoleErrors(page);
	const canonicalKind = 'Canonical reset marker';
	const scenarioKind = 'Scenario reset marker';
	await openTraceKinds(page);
	await createTraceKind(page, canonicalKind);
	await openTraceKinds(page);
	await switchDataSpace(page, SCENARIO_DATA_SPACE_ID);
	await expect(page.getByTestId('scenario-data-space-menu')).toBeVisible();
	await createTraceKind(page, scenarioKind);
	await openTraceKinds(page);
	await expect(page.getByText(scenarioKind, { exact: true })).toBeVisible();

	await page.getByTestId('scenario-data-space-menu').locator('summary').click();
	await page.getByTestId('scenario-reset').click();
	await expect(page.getByText('Удалить все данные этого сценария на устройстве?')).toBeVisible();
	const resetNavigation = page.waitForEvent('framenavigated', {
		predicate: (frame) => frame === page.mainFrame()
	});
	await Promise.all([page.getByTestId('confirm-scenario-reset').click(), resetNavigation]);
	// The scenario is empty and still the open space; the canonical marker is untouched.
	await expect(page.getByTestId('data-space-switcher')).toHaveValue(SCENARIO_DATA_SPACE_ID);
	await openTraceKinds(page);
	await expect(page.getByText('Trace Kind пока нет.')).toBeVisible();
	await expect(page.getByText(scenarioKind, { exact: true })).toHaveCount(0);
	await switchDataSpace(page, CANONICAL_DATA_SPACE_ID);
	await expect(page.getByText(canonicalKind, { exact: true })).toBeVisible();
	expect(consoleErrors, `console errors:\n${consoleErrors.join('\n')}`).toEqual([]);
});

test('scenario opens only its IndexedDB and starts no websocket', async ({ page }) => {
	await page.addInitScript((id: string) => {
		localStorage.setItem('tempience.data-space.active', id);
	}, SCENARIO_DATA_SPACE_ID);
	const websocketUrls: string[] = [];
	page.on('websocket', (socket) => websocketUrls.push(socket.url()));

	await page.goto('/');
	await expect(page.getByTestId('data-space-switcher')).toHaveValue(SCENARIO_DATA_SPACE_ID);
	await expect(page.getByText('Только локально')).toBeVisible();
	await openTraceKinds(page);
	await createTraceKind(page, 'Scenario local-only write');

	await expect
		.poll(async () =>
			page.evaluate(async () => (await indexedDB.databases()).map((database) => database.name))
		)
		.toContain('tempience-triplit-belgrade-what-if-v1');
	const databaseNames = await page.evaluate(async () =>
		(await indexedDB.databases()).map((database) => database.name)
	);
	expect(databaseNames).not.toContain('tempience-triplit');
	expect(websocketUrls).toEqual([]);
});
