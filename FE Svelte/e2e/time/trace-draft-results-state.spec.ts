import { expect, test } from '@playwright/test';
import { exportBackup } from '../public/helpers';
import { ARTIFACTS, cleanConsole, editor, title, mode } from './draft.helpers';
import { loadTime } from './helpers';
import {
	candidate,
	captureIntention,
	closeBox,
	openClear,
	openLinks,
	outcome,
	panel,
	picker,
	reopenBox,
	resultsOf,
	selectRecord,
	showOverview,
	sourceOf,
	startCapture,
	target,
	targetNote
} from './results.helpers';

cleanConsole(test, 'i4c-console-state.log');

for (const width of [390, 1440]) {
	test.describe('A result whose intention went away at ' + width, () => {
		test.use({
			viewport: { width, height: 900 },
			isMobile: width === 390,
			hasTouch: width === 390
		});

		test('is shown as deleted, keeps its history, and does not hold an unrelated edit hostage', async ({
			page
		}) => {
			test.setTimeout(120_000);
			// Only this scenario's own records, so the ribbon names them unambiguously.
			await loadTime(page, { manifest: null });
			await captureIntention(page, 'План У');
			await panel(page).getByTestId('add-result').click();
			await title(page).fill('Итог У');
			await outcome(page, 'План У').selectOption('completed');
			await editor(page).getByTestId('capture-save').click();
			await expect(panel(page).getByTestId('selected-title')).toHaveText('Итог У');
			// «Удалить везде» on the intention, reached through the result's own links.
			const links = await openLinks(page);
			await links.getByTestId('link-target').click();
			await showOverview(page);
			await expect(panel(page).getByTestId('selected-title')).toHaveText('План У');
			await panel(page).getByTestId('delete-trace').click();
			await expect(panel(page).getByTestId('context-overview')).toHaveCount(0);
			const before = await exportBackup(page);
			await selectRecord(page, /Итог У/);
			await showOverview(page);
			await panel(page).getByTestId('edit-trace').click();
			// The state is said beside the reference from the start and is not an error.
			await expect(targetNote(page, 'План У')).toHaveText('Запись удалена');
			await expect(targetNote(page, 'План У')).not.toHaveAttribute('data-blocking', 'true');
			// No statement can pass through it, so its controls invite none and no edit can be stranded.
			await expect(outcome(page, 'План У')).toBeDisabled();
			await expect(target(page, 'План У').getByTestId('target-cancel-edit')).toHaveCount(0);
			await editor(page).getByTestId('draft-description').fill('Правка после удаления намерения');
			await expect(editor(page).getByTestId('edit-save')).toBeEnabled();
			await page.screenshot({
				path: `${ARTIFACTS}/i4c-deleted-target-${width}.png`,
				fullPage: true
			});
			await editor(page).getByTestId('edit-save').click();
			await expect(panel(page).getByTestId('selected-description')).toHaveText(
				'Правка после удаления намерения'
			);
			const after = await exportBackup(page);
			// The reference and its assessment are exactly as they were: nothing removed, nothing resent.
			expect(resultsOf(after, 'Итог У').links).toEqual([['План У', false]]);
			expect(after.collections.intentionAssessments).toEqual(
				before.collections.intentionAssessments
			);
		});
	});
}

test.describe('Recovering a statement that cannot be made at 1440', () => {
	test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

	test('is taken back without losing the reference or the rest of the input', async ({ page }) => {
		test.setTimeout(90_000);
		await loadTime(page, { manifest: 'small' });
		await captureIntention(page, 'План Ф');
		await startCapture(page);
		await title(page).fill('Без даты Ф');
		await editor(page).getByTestId('draft-description').fill('Описание без даты');
		await editor(page).getByTestId('trace-time').click();
		await editor(page).getByText('Уточнить дату…', { exact: true }).click();
		await editor(page).getByRole('button', { name: 'Дата неизвестна', exact: true }).click();
		await editor(page).getByRole('button', { name: 'Применить время', exact: true }).click();
		await mode(page, 'evidence').click();
		await editor(page).getByTestId('result-pick').click();
		await candidate(page, 'План Ф').click();
		await picker(page).getByTestId('result-picker-close').click();
		// Known from the start, and not an error while nothing is stated through it.
		await expect(targetNote(page, 'План Ф')).toHaveText('Для оценки нужна дата события факта');
		await expect(targetNote(page, 'План Ф')).not.toHaveAttribute('data-blocking', 'true');
		await expect(editor(page).getByTestId('capture-save')).toBeEnabled();
		await outcome(page, 'План Ф').selectOption('partial');
		await expect(targetNote(page, 'План Ф')).toHaveAttribute('data-blocking', 'true');
		await expect(editor(page).getByTestId('capture-save')).toBeDisabled();
		// «Не менять» takes back only the statement: the reference and every other field stay.
		await outcome(page, 'План Ф').selectOption('');
		await expect(targetNote(page, 'План Ф')).not.toHaveAttribute('data-blocking', 'true');
		await expect(target(page, 'План Ф')).toBeVisible();
		await expect(title(page)).toHaveValue('Без даты Ф');
		await expect(editor(page).getByTestId('draft-description')).toHaveValue('Описание без даты');
		await expect(editor(page).getByTestId('capture-save')).toBeEnabled();
		await editor(page).getByTestId('capture-save').click();
		await expect(panel(page).getByTestId('selected-title')).toHaveText('Без даты Ф');
		await page.getByRole('button', { name: 'Закрыть Context', exact: true }).click();
		const saved = resultsOf(await exportBackup(page), 'Без даты Ф');
		expect(saved.links).toEqual([['План Ф', false]]);
		expect(saved.assessments).toEqual([]);
	});
});

test.describe('The own openness of a saved source at 1440', () => {
	test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

	test('is withdrawn alone, left alone when untouched, and set again by an explicit reopen', async ({
		page
	}) => {
		test.setTimeout(120_000);
		await loadTime(page, { manifest: 'small' });
		await captureIntention(page, 'План Х');
		await panel(page).getByTestId('add-result').click();
		await title(page).fill('Итог Х');
		await outcome(page, 'План Х').selectOption('partial');
		await closeBox(page, 'План Х').check();
		await editor(page).getByTestId('capture-save').click();
		await expect(panel(page).getByTestId('selected-title')).toHaveText('Итог Х');
		const first = sourceOf(await exportBackup(page), 'Итог Х');
		expect(Object.values(first.initial)[0]).toMatchObject({ outcome: 'partial', open: false });
		// Withdrawing the own openness keeps the own outcome, the source and the link.
		await panel(page).getByTestId('edit-trace').click();
		await expect(target(page, 'План Х').getByTestId('target-own')).toHaveText(
			'Своя оценка через эту связь: Частично выполнено · закрыто'
		);
		await openClear(page, 'План Х').click();
		await expect(openClear(page, 'План Х')).toHaveAttribute('aria-pressed', 'true');
		await expect(closeBox(page, 'План Х')).not.toBeChecked();
		await page.screenshot({ path: `${ARTIFACTS}/i4c-open-clear-1440.png`, fullPage: true });
		await editor(page).getByTestId('edit-save').click();
		await expect(panel(page).getByTestId('edit-trace-form')).toHaveCount(0);
		const cleared = sourceOf(await exportBackup(page), 'Итог Х');
		expect(cleared.id).toBe(first.id);
		expect(cleared.initial).toEqual(first.initial);
		expect(cleared.values?.open?.value).toBeNull();
		expect(cleared.values?.outcome).toBeUndefined();
		expect(cleared.isDeleted ?? false).toBe(false);
		// The intention is open again with its outcome standing, as the picker shows it.
		await startCapture(page);
		await mode(page, 'evidence').click();
		await editor(page).getByTestId('result-pick').click();
		await expect(candidate(page, 'План Х').getByTestId('candidate-state')).toHaveText(
			'Частично выполнено · открыто'
		);
		await page.getByRole('button', { name: 'Закрыть Context', exact: true }).click();
		await selectRecord(page, /Итог Х/);
		await showOverview(page);
		// An untouched form writes no correction at all.
		await panel(page).getByTestId('edit-trace').click();
		await expect(target(page, 'План Х').getByTestId('target-own')).toHaveText(
			'Своя оценка через эту связь: Частично выполнено · —'
		);
		await editor(page).getByTestId('draft-description').fill('Только описание');
		await editor(page).getByTestId('edit-save').click();
		await expect(panel(page).getByTestId('selected-description')).toHaveText('Только описание');
		expect(sourceOf(await exportBackup(page), 'Итог Х')).toEqual(cleared);
		// Closing again, then an explicit reopen: two distinct statements, not the absence of one.
		await panel(page).getByTestId('edit-trace').click();
		await closeBox(page, 'План Х').check();
		await editor(page).getByTestId('edit-save').click();
		await expect(panel(page).getByTestId('edit-trace-form')).toHaveCount(0);
		expect(sourceOf(await exportBackup(page), 'Итог Х').values?.open?.value).toBe(false);
		await panel(page).getByTestId('edit-trace').click();
		await reopenBox(page, 'План Х').check();
		await editor(page).getByTestId('edit-save').click();
		await expect(panel(page).getByTestId('edit-trace-form')).toHaveCount(0);
		const reopened = sourceOf(await exportBackup(page), 'Итог Х');
		expect(reopened.values?.open?.value).toBe(true);
		expect(reopened.initial).toEqual(first.initial);
	});
});
