import { expect, test } from '@playwright/test';
import { exportBackup } from '../public/helpers';
import { ARTIFACTS, cleanConsole, dialog, editor, title, mode } from './draft.helpers';
import { loadTime } from './helpers';
import {
	candidate,
	captureIntention,
	closeBox,
	openLinks,
	outcome,
	panel,
	picker,
	resultsOf,
	startCapture,
	target
} from './results.helpers';

cleanConsole(test, 'i4c-console-results.log');

for (const width of [390, 1440]) {
	test.describe('«Результат для» at ' + width, () => {
		test.use({
			viewport: { width, height: 900 },
			isMobile: width === 390,
			hasTouch: width === 390
		});

		test('links a fact to several intentions with separate statements; filters never narrow the choice', async ({
			page
		}) => {
			test.setTimeout(120_000);
			await loadTime(page, { manifest: 'small' });
			await captureIntention(page, 'План А');
			await captureIntention(page, 'План Б');
			await captureIntention(page, 'План В');
			// A first fact closes В with no outcome: closure is a statement of its own.
			await startCapture(page);
			await title(page).fill('Итог В');
			await mode(page, 'evidence').click();
			await editor(page).getByTestId('result-pick').click();
			await candidate(page, 'План В').click();
			await closeBox(page, 'План В').check();
			await editor(page).getByTestId('capture-save').click();
			await expect(panel(page).getByTestId('selected-title')).toHaveText('Итог В');
			await startCapture(page);
			await title(page).fill('Отчёт');
			await mode(page, 'evidence').click();
			await editor(page).getByTestId('result-pick').click();
			// Open intentions by the open projection; the closed one waits behind «Все».
			await expect(picker(page).getByTestId('result-candidate')).toHaveText([/План А/, /План Б/]);
			await expect(candidate(page, 'План А').getByTestId('candidate-state')).toHaveText(
				'Итог не оценён · открыто'
			);
			await picker(page).getByTestId('result-search').fill('Б');
			await expect(picker(page).getByTestId('result-candidate')).toHaveCount(1);
			await candidate(page, 'План Б').click();
			await expect(target(page, 'План Б')).toBeVisible();
			await picker(page).getByTestId('result-search').fill('');
			await expect(candidate(page, 'План Б')).toHaveAttribute('aria-pressed', 'true');
			// Keyboard: Space chooses, the arrow walks the list.
			await candidate(page, 'План А').focus();
			await page.keyboard.press('Space');
			await expect(target(page, 'План А')).toBeVisible();
			await page.keyboard.press('ArrowDown');
			await expect(candidate(page, 'План Б')).toBeFocused();
			await picker(page).getByTestId('result-all').click();
			await expect(candidate(page, 'План В').getByTestId('candidate-state')).toHaveText(
				'Итог не оценён · закрыто'
			);
			await candidate(page, 'План В').click();
			// A Scope filter works without text and narrows nothing that is chosen.
			await picker(page).getByTestId('result-scope').selectOption({ index: 1 });
			await expect(picker(page).getByTestId('result-empty')).toBeVisible();
			await expect(editor(page).getByTestId('result-target')).toHaveCount(3);
			await picker(page).getByTestId('result-picker-close').click();
			await outcome(page, 'План А').selectOption('completed');
			await closeBox(page, 'План А').check();
			await expect(target(page, 'План В').getByTestId('target-state')).toHaveText(
				'Сейчас: Итог не оценён · закрыто'
			);
			await page.screenshot({ path: `${ARTIFACTS}/i4c-results-${width}.png`, fullPage: true });
			await editor(page).getByTestId('capture-save').click();
			await expect(panel(page).getByTestId('selected-title')).toHaveText('Отчёт');
			await expect((await openLinks(page)).getByTestId('link-target')).toHaveCount(3);
			// The derived states after the save: А closed by its outcome, Б untouched, В as it was.
			await startCapture(page);
			await mode(page, 'evidence').click();
			await editor(page).getByTestId('result-pick').click();
			await expect(picker(page).getByTestId('result-candidate')).toHaveText([/План Б/]);
			await picker(page).getByTestId('result-all').click();
			await expect(candidate(page, 'План А').getByTestId('candidate-state')).toHaveText(
				'Выполнено · закрыто'
			);
			await expect(candidate(page, 'План В').getByTestId('candidate-state')).toHaveText(
				'Итог не оценён · закрыто'
			);
			await page.getByRole('button', { name: 'Закрыть Context', exact: true }).click();
			const saved = resultsOf(await exportBackup(page), 'Отчёт');
			expect(saved.links).toEqual([
				['План А', false],
				['План Б', false],
				['План В', false]
			]);
			expect(saved.assessments).toEqual(['План А']);
			expect(saved.operation).toEqual([
				'intentionAssessment:created',
				'intersection:linked',
				'intersection:linked',
				'intersection:linked',
				'trace:created'
			]);
		});
	});
}

test.describe('Undated facts and the relation switch at 1440', () => {
	test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

	test('an undated fact links without a statement; a statement needs the date; a choice asks before closing', async ({
		page
	}) => {
		test.setTimeout(90_000);
		await loadTime(page, { manifest: 'small' });
		await captureIntention(page, 'План Г');
		await startCapture(page);
		await title(page).fill('Без даты');
		await editor(page).getByTestId('trace-time').click();
		await editor(page).getByText('Уточнить дату…', { exact: true }).click();
		await editor(page).getByRole('button', { name: 'Дата неизвестна', exact: true }).click();
		await editor(page).getByRole('button', { name: 'Применить время', exact: true }).click();
		await expect(editor(page).getByTestId('trace-time')).toContainText('время неизвестно');
		await mode(page, 'evidence').click();
		await editor(page).getByTestId('result-pick').click();
		await candidate(page, 'План Г').click();
		await picker(page).getByTestId('result-picker-close').click();
		await expect(editor(page).getByTestId('capture-save')).toBeEnabled();
		// A statement through an undated fact says why it cannot be saved yet; the input stays.
		await outcome(page, 'План Г').selectOption('partial');
		await expect(target(page, 'План Г').getByTestId('target-problem')).toHaveText(
			'Для оценки нужна дата события факта'
		);
		await expect(editor(page).getByTestId('capture-save')).toBeDisabled();
		await editor(page).getByTestId('trace-time').click();
		await editor(page).getByRole('button', { name: 'Сегодня', exact: true }).click();
		await editor(page).getByRole('button', { name: 'Применить время', exact: true }).click();
		await expect(target(page, 'План Г').getByTestId('target-problem')).toHaveCount(0);
		await expect(outcome(page, 'План Г')).toHaveValue('partial');
		await expect(editor(page).getByTestId('capture-save')).toBeEnabled();
		// «Факт → Намерение» drops the choice; back to a fact brings nothing back.
		await mode(page, 'intend').click();
		await expect(editor(page).getByTestId('result-fields')).toHaveCount(0);
		await mode(page, 'actual').click();
		await expect(editor(page).getByTestId('result-target')).toHaveCount(0);
		await mode(page, 'evidence').click();
		await editor(page).getByTestId('result-pick').click();
		await candidate(page, 'План Г').click();
		await page.getByRole('button', { name: 'Закрыть Context', exact: true }).click();
		await expect(dialog(page)).toBeVisible();
		await dialog(page).getByTestId('discard-keep').click();
		await expect(target(page, 'План Г')).toBeVisible();
		await page.getByRole('button', { name: 'Закрыть Context', exact: true }).click();
		await dialog(page).getByTestId('discard-confirm').click();
		await expect(editor(page)).toHaveCount(0);
		// The undated link itself is saved without any assessment.
		await startCapture(page);
		await title(page).fill('Без даты');
		await editor(page).getByTestId('trace-time').click();
		await editor(page).getByText('Уточнить дату…', { exact: true }).click();
		await editor(page).getByRole('button', { name: 'Дата неизвестна', exact: true }).click();
		await editor(page).getByRole('button', { name: 'Применить время', exact: true }).click();
		await mode(page, 'evidence').click();
		await editor(page).getByTestId('result-pick').click();
		await candidate(page, 'План Г').click();
		await editor(page).getByTestId('capture-save').click();
		await expect(panel(page).getByTestId('selected-title')).toHaveText('Без даты');
		await page.getByRole('button', { name: 'Закрыть Context', exact: true }).click();
		const saved = resultsOf(await exportBackup(page), 'Без даты');
		expect(saved.links).toEqual([['План Г', false]]);
		expect(saved.assessments).toEqual([]);
		expect(saved.operation).toEqual(['intersection:linked', 'trace:created']);
	});
});
