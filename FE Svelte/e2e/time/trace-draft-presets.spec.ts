import { expect, test } from '@playwright/test';
import { exportBackup } from '../public/helpers';
import { ARTIFACTS, cleanConsole, editor, title, mode, modes } from './draft.helpers';
import { loadTime } from './helpers';
import {
	candidate,
	captureIntention,
	openLinks,
	outcome,
	panel,
	picker,
	selectRecord,
	showOverview,
	startCapture,
	target
} from './results.helpers';

cleanConsole(test, 'i4c-console-presets.log');

for (const width of [390, 1440]) {
	test.describe('Context presets at ' + width, () => {
		test.use({
			viewport: { width, height: 900 },
			isMobile: width === 390,
			hasTouch: width === 390
		});

		test('«Добавить результат», «Добавить часть» and «Дополнить» start the one form with their presets', async ({
			page
		}) => {
			test.setTimeout(120_000);
			await loadTime(page, { manifest: 'small' });
			await startCapture(page);
			await title(page).fill('План Р');
			await mode(page, 'intend').click();
			await editor(page).getByLabel('Выбрать Scope', { exact: true }).selectOption({ index: 1 });
			await editor(page).getByTestId('capture-save').click();
			await expect(panel(page).getByTestId('selected-title')).toHaveText('План Р');
			// «Добавить результат»: the intention is chosen, its Scope is the fact's initial one.
			await panel(page).getByTestId('add-result').click();
			await expect(target(page, 'План Р')).toBeVisible();
			await expect(editor(page).getByRole('list', { name: 'Выбранные Scope' })).toHaveCount(1);
			await title(page).fill('Сделано');
			await outcome(page, 'План Р').selectOption('completed');
			await page.screenshot({
				path: `${ARTIFACTS}/i4c-preset-result-${width}.png`,
				fullPage: true
			});
			await editor(page).getByTestId('capture-save').click();
			await expect(panel(page).getByTestId('selected-title')).toHaveText('Сделано');
			let links = await openLinks(page);
			await expect(links.getByTestId('link-target')).toHaveText([/План Р/]);
			await links.getByTestId('link-target').click();
			await showOverview(page);
			await expect(panel(page).getByTestId('selected-title')).toHaveText('План Р');
			// «Добавить часть» of an intention: an undated intention in the parent's Scope, part_of only.
			await panel(page).getByTestId('add-part').click();
			await expect(editor(page).getByTestId('draft-preset')).toHaveText('Часть записи «План Р»');
			await expect(mode(page, 'intend')).toHaveAttribute('aria-pressed', 'true');
			await expect(editor(page).getByTestId('trace-time')).toContainText('время неизвестно');
			await expect(editor(page).getByRole('list', { name: 'Выбранные Scope' })).toHaveCount(1);
			await expect(editor(page).getByTestId('result-fields')).toHaveCount(0);
			await title(page).fill('Этап');
			await editor(page).getByTestId('capture-save').click();
			await expect(panel(page).getByTestId('selected-title')).toHaveText('Этап');
			links = await openLinks(page);
			await expect(links).toContainText('Часть чего');
			await expect(links.getByTestId('link-target')).toHaveText([/План Р/]);
			// «Дополнить»: a completed marker without its own time, one revisits link; the original's
			// direct Scopes are its initial memberships like any capture from a record's Context.
			await showOverview(page);
			await panel(page).getByTestId('add-supplement').click();
			await expect(editor(page).getByTestId('draft-preset')).toContainText('Дополнение к «Этап»');
			await expect(editor(page).getByTestId('draft-preset')).toContainText(
				'Без собственного времени'
			);
			await expect(editor(page).getByTestId('trace-time')).toHaveCount(0);
			await expect(modes(page)).toHaveCount(0);
			await expect(editor(page).getByTestId('result-fields')).toHaveCount(0);
			await title(page).fill('Уточнение');
			await page.screenshot({
				path: `${ARTIFACTS}/i4c-preset-supplement-${width}.png`,
				fullPage: true
			});
			await editor(page).getByTestId('capture-save').click();
			await expect(panel(page).getByTestId('selected-title')).toHaveText('Уточнение');
			await expect(panel(page).getByTestId('selected-time')).toContainText('ссылка на запись');
			links = await openLinks(page);
			await expect(links).toContainText('К чему возвращается');
			await expect(links.getByTestId('link-target')).toHaveText([/Этап/]);
			await page.getByRole('button', { name: 'Закрыть Context', exact: true }).click();
			const backup = await exportBackup(page);
			const rows = backup.collections.traces as {
				id: string;
				content: string;
				relation: string;
				aboutKind: string;
				aboutTime: unknown;
				aboutTraceId: string | null;
			}[];
			const byTitle = (content: string) => rows.find((row) => row.content === content)!;
			expect(byTitle('Уточнение')).toMatchObject({
				relation: 'actual',
				aboutKind: 'trace_ref',
				aboutTraceId: null
			});
			expect(byTitle('Этап')).toMatchObject({ relation: 'intend' });
			const kinds = (backup.collections.intersections as { fromId: string; kind: string }[])
				.filter((link) => [byTitle('Этап').id, byTitle('Уточнение').id].includes(link.fromId))
				.map((link) => link.kind)
				.toSorted();
			expect(kinds).toEqual(['belongs_to', 'belongs_to', 'part_of', 'revisits']);
			const assessed = (
				backup.collections.intentionAssessments as { origin: { intentionId: string } }[]
			).filter((row) => row.origin.intentionId === byTitle('План Р').id);
			expect(assessed).toHaveLength(1);
		});
	});
}

test.describe("An intention's results and the generic link picker at 1440", () => {
	test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

	test('a saved intention lists its results, links an existing fact, and a wrong role is refused visibly', async ({
		page
	}) => {
		test.setTimeout(90_000);
		await loadTime(page, { manifest: 'small' });
		await captureIntention(page, 'План Д');
		await startCapture(page);
		await title(page).fill('Факт Е');
		await editor(page).getByTestId('capture-save').click();
		await expect(panel(page).getByTestId('selected-title')).toHaveText('Факт Е');
		await startCapture(page);
		await title(page).fill('Факт Ж');
		await editor(page).getByTestId('capture-save').click();
		await expect(panel(page).getByTestId('selected-title')).toHaveText('Факт Ж');
		// The generic picker cannot make a fact the target of a result: the refusal is shown.
		let links = await openLinks(page);
		await links.getByTestId('link-search-open').click();
		await links.getByTestId('link-kind').selectOption('evidence_for');
		await links.getByTestId('link-search').fill('Факт Е');
		await links.getByTestId('link-candidate').click();
		await expect(links.getByTestId('link-refused')).toContainText('намерение');
		await links.getByTestId('link-search').fill('План Д');
		await links.getByTestId('link-candidate').click();
		await expect(links.getByTestId('link-target')).toHaveText([/План Д/]);
		await links.getByTestId('link-target').click();
		await showOverview(page);
		await expect(panel(page).getByTestId('selected-title')).toHaveText('План Д');
		// The intention's own form states no results (TRACE_FORMS 2026-09-15): a result is the
		// fact's statement, made in its third position. The saved link without a statement of its own:
		await panel(page).getByTestId('edit-trace').click();
		await expect(editor(page).getByTestId('result-fields')).toHaveCount(0);
		await editor(page).getByRole('button', { name: 'Отмена', exact: true }).click();
		links = await openLinks(page);
		await links.getByTestId('link-target').filter({ hasText: 'Факт Ж' }).click();
		await showOverview(page);
		await expect(panel(page).getByTestId('selected-title')).toHaveText('Факт Ж');
		await panel(page).getByTestId('edit-trace').click();
		await expect(editor(page).getByTestId('result-fields')).toHaveAttribute(
			'data-role',
			'intention'
		);
		await expect(target(page, 'План Д').getByTestId('target-own')).toHaveText(
			'Своей оценки через эту связь нет'
		);
		await expect(editor(page).getByTestId('edit-save')).toBeDisabled();
		await editor(page).getByRole('button', { name: 'Отмена', exact: true }).click();
		// A second fact becomes a result with a statement, from its own form.
		await selectRecord(page, 'Факт Е');
		await showOverview(page);
		await expect(panel(page).getByTestId('selected-title')).toHaveText('Факт Е');
		await panel(page).getByTestId('edit-trace').click();
		await expect(panel(page).getByTestId('edit-trace-form')).toBeVisible();
		await expect(editor(page).getByTestId('draft-title')).toHaveValue('Факт Е');
		await mode(page, 'evidence').click();
		await expect(mode(page, 'evidence')).toHaveAttribute('aria-pressed', 'true');
		await editor(page).getByTestId('result-pick').click();
		await picker(page).getByTestId('result-search').fill('План Д');
		await expect(picker(page).getByTestId('result-candidate')).toHaveText([/План Д/]);
		await candidate(page, 'План Д').click();
		await picker(page).getByTestId('result-picker-close').click();
		await outcome(page, 'План Д').selectOption('completed');
		await page.screenshot({ path: `${ARTIFACTS}/i4c-intention-results-1440.png`, fullPage: true });
		await editor(page).getByTestId('edit-save').click();
		await expect(panel(page).getByTestId('edit-trace-form')).toHaveCount(0);
		links = await openLinks(page);
		await links.getByTestId('link-target').filter({ hasText: 'План Д' }).click();
		links = await openLinks(page);
		await expect(links.getByTestId('link-target')).toHaveCount(2);
		await startCapture(page);
		await mode(page, 'evidence').click();
		await editor(page).getByTestId('result-pick').click();
		await picker(page).getByTestId('result-all').click();
		await expect(candidate(page, 'План Д').getByTestId('candidate-state')).toHaveText(
			'Выполнено · открыто'
		);
	});
});
