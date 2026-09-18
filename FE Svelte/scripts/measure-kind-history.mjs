#!/usr/bin/env node
// The rendered entry path of a Kind's history at scale, against a served app — a dev server or
// a production preview — with a backup file the app restores through «Загрузить JSON» (the
// backup is written by src/lib/state/triplit/TraceDataset/kind-history.backup.test.ts with
// TEMPIENCE_WRITE_BACKUP=1 TEMPIENCE_BACKUP_ROWS=<rows>). Everything is timed from the user's
// action to the screen: the cold boot of the timeline, the catalog, the history's first page,
// the next page, a Scope filter, a value filter, a record opened on the right, an edit saved and
// shown again in the table. Memory is Chromium's JS heap (--enable-precise-memory-info).
//
// The app restores a file of up to 50 MiB — about 28K rows of the synthetic space — so a
// larger space is seeded through the app's own modules instead, which only a dev server
// serves (--seed-rows, the same generator as the backup, batched into the active database).
// With --profile the browser keeps its profile, so the database seeded under a dev server is
// read again by a production build served on the same origin (--reuse: no restore, no seed).
//
// usage: node scripts/measure-kind-history.mjs --base http://127.0.0.1:5185 \
//          (--backup /path/backup-28k.json | --seed-rows 100000 | --reuse) --out /path/proof.json \
//          [--profile /path/profile-dir] [--kind Замер] [--width 1440]
import { writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const args = Object.fromEntries(
	process.argv.slice(2).reduce((pairs, value, index, all) => {
		if (value.startsWith('--')) pairs.push([value.slice(2), all[index + 1] ?? '']);
		return pairs;
	}, [])
);
const base = args.base ?? 'http://127.0.0.1:5185';
const kindName = args.kind ?? 'Замер';
const width = Number(args.width ?? 1440);
if (!(args.backup || args['seed-rows'] || 'reuse' in args) || !args.out)
	throw new Error('--backup, --seed-rows or --reuse, and --out, are required');

const launch = { args: ['--enable-precise-memory-info'], viewport: { width, height: 900 } };
const browser = args.profile
	? await chromium.launchPersistentContext(args.profile, launch)
	: await chromium.launch(launch);
const page = args.profile ? await browser.newPage() : await browser.newPage(launch);
const proof = {
	base,
	width,
	kind: kindName,
	backup: args.backup ?? null,
	seedRows: args['seed-rows'] ? Number(args['seed-rows']) : null,
	profile: args.profile ?? null,
	reuse: 'reuse' in args,
	steps: {},
	loadTiming: []
};
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => {
	if (!message.text().startsWith('[tempience:load]')) return;
	// The report object whole: the console's own preview shows a few of its keys only.
	const [, report] = message.args();
	proof.loadTiming.push(report ? report.jsonValue() : Promise.resolve(message.text()));
});
const lastTiming = async () => {
	const last = proof.loadTiming.at(-1);
	return last ? await last : null;
};
const heap = () =>
	page.evaluate(() => Math.round((performance.memory?.usedJSHeapSize ?? 0) / 1048576));
const ready = () =>
	page.waitForFunction(
		() =>
			document.querySelector('[data-testid="time-workbench"]')?.getAttribute('data-status') ===
			'ready',
		null,
		{ timeout: 600_000 }
	);
const timed = async (name, run) => {
	const started = Date.now();
	const value = await run();
	proof.steps[name] = { ms: Date.now() - started, heapMiB: await heap(), ...(value ?? {}) };
	console.log(name, JSON.stringify(proof.steps[name]));
};

await page.goto(base + '/time');
await ready();

if (proof.reuse) {
	// The database of the profile as it is: the space seeded or restored by an earlier run.
} else if (proof.seedRows) {
	// The synthetic space written into the active database through the app's own modules: the
	// same generator as the backup file, batched, which a dev server serves by path.
	await timed('seed', async () => {
		const counts = await page.evaluate(async (rows) => {
			const [{ triplit }, { tempienceRepository }, { seedHistoryFixture }] = await Promise.all([
				import('/src/lib/state/triplit/client.ts'),
				import('/src/lib/state/triplit/index.ts'),
				import('/src/lib/state/triplit/TraceDataset/history.fixture.ts')
			]);
			const fixture = await seedHistoryFixture(triplit, tempienceRepository, { rows });
			return { ...fixture.counts, seedMs: fixture.seedMs };
		}, proof.seedRows);
		return { counts };
	});
} else {
	// The restore: a JSON file of the whole space into a database of its own, then the reload.
	await timed('restore', async () => {
		await page.getByRole('button', { name: /Синхронизация:/ }).click();
		// By path: Playwright refuses an in-memory buffer over 50 MB, and the 100K space is 170 MB.
		await page.getByLabel('JSON-файл с данными').setInputFiles(args.backup);
		await page.getByTestId('backup-import-preview').waitFor({ timeout: 600_000 });
		const preview = await page.getByTestId('backup-import-preview').innerText();
		await Promise.all([
			page.waitForEvent('framenavigated', {
				predicate: (frame) => frame === page.mainFrame(),
				timeout: 600_000
			}),
			// The restore writes the whole space in one transaction and holds the page meanwhile.
			page
				.getByRole('button', { name: 'Создать базу из файла', exact: true })
				.click({ timeout: 600_000, noWaitAfter: true })
		]);
		await ready();
		return { preview: preview.split('\n').find((line) => line.includes('записей')) ?? '' };
	});
	proof.space = await page.getByTestId('data-space-switcher').inputValue();
}

// The cold boot of the timeline in the restored space: a reload, the app's own timing line kept.
proof.loadTiming = [];
await timed('coldBoot', async () => {
	await page.reload();
	await ready();
	return { loadTiming: await lastTiming() };
});
await timed('catalog', async () => {
	await page.getByTestId('all-kinds').click();
	await page.getByTestId('kinds-center').waitFor();
});
const surface = page.getByTestId('kind-data-surface');
const firstTable = page.getByTestId('version-table').first();
const rows = () => firstTable.getByTestId('dataset-row');
await timed('historyFirstPage', async () => {
	await page
		.getByTestId('kinds-center')
		.getByRole('button', { name: kindName, exact: true })
		.click();
	await surface.waitFor();
	await rows().first().waitFor({ timeout: 600_000 });
	await page.waitForFunction(
		() =>
			!document
				.querySelector('[data-testid="version-table"]')
				?.textContent?.includes('Читаю строки'),
		null,
		{ timeout: 600_000 }
	);
	const text = (await firstTable.innerText()).split('\n');
	return {
		rows: await rows().count(),
		tables: await page.getByTestId('version-table').count(),
		counted: text.find((line) => line.includes('с датой')) ?? ''
	};
});
const firstDate = await rows().first().getByRole('cell').first().innerText();
await timed('nextPage', async () => {
	await firstTable.getByRole('button', { name: 'Следующая', exact: true }).click();
	await page.waitForFunction(
		(before) =>
			document.querySelector('[data-testid="version-table"] [data-testid="dataset-row"] td')
				?.textContent !== before,
		firstDate,
		{ timeout: 600_000 }
	);
	return {
		page:
			(await firstTable.innerText()).split('\n').find((line) => line.startsWith('Страница')) ?? ''
	};
});
await timed('scopeFilter', async () => {
	await surface.getByText('Фильтры истории', { exact: true }).click();
	await surface.getByRole('combobox', { name: 'Scope', exact: true }).selectOption({ index: 1 });
	await surface.getByTestId('history-active').getByText('Scope:', { exact: false }).waitFor();
	await page.waitForFunction(
		() => !document.querySelector('[data-testid="version-table"]')?.textContent?.includes('Читаю'),
		null,
		{ timeout: 600_000 }
	);
	const text = (await firstTable.innerText()).split('\n');
	return {
		rows: await rows().count(),
		counted: text.find((line) => line.includes('с датой')) ?? ''
	};
});
await timed('valueFilter', async () => {
	await surface.getByRole('combobox', { name: 'Поле' }).selectOption({ index: 0 });
	await surface.getByRole('combobox', { name: 'Условие' }).selectOption({ label: 'не меньше' });
	await surface.getByTestId('history-value').fill('80');
	await surface.getByRole('button', { name: 'Добавить условие', exact: true }).click();
	await surface.getByTestId('history-active').getByText('>= 80', { exact: false }).waitFor();
	await page.waitForFunction(
		() => !document.querySelector('[data-testid="version-table"]')?.textContent?.includes('Читаю'),
		null,
		{ timeout: 600_000 }
	);
	const text = (await firstTable.innerText()).split('\n');
	return {
		rows: await rows().count(),
		counted: text.find((line) => line.includes('с датой')) ?? ''
	};
});
await timed('resetFilters', async () => {
	await surface.getByRole('button', { name: 'Сбросить фильтры', exact: true }).click();
	// The filters fold when none applies; their count badge is gone before the rows are.
	await surface.getByTestId('history-filters-count').waitFor({ state: 'detached' });
	await page.waitForFunction(
		() => !document.querySelector('[data-testid="version-table"]')?.textContent?.includes('Читаю'),
		null,
		{ timeout: 600_000 }
	);
	return { rows: await rows().count() };
});
const openedId = await rows().first().getAttribute('data-trace-id');
await timed('openRecord', async () => {
	await rows().first().getByRole('button', { name: 'Открыть запись', exact: true }).click();
	await page.getByTestId('context-overview').waitFor({ timeout: 600_000 });
});
proof.loadTiming = [];
await timed('editAndReturn', async () => {
	await page.getByTestId('edit-trace').click();
	const editor = page.getByTestId('trace-editor');
	const field = editor.getByRole('spinbutton').first();
	await field.waitFor();
	const value = Number(await field.inputValue()) + 1;
	await field.fill(String(value));
	await editor.getByRole('button', { name: 'Сохранить', exact: true }).click();
	await page.getByTestId('context-overview').waitFor({ timeout: 600_000 });
	// The table shows the saved value in the record's own row, under its current page; the
	// cell is formatted for the locale, so the digits are compared.
	await page.waitForFunction(
		([id, expected]) =>
			[...document.querySelectorAll(`[data-testid="dataset-row"][data-trace-id="${id}"] td`)].some(
				(cell) => (cell.textContent ?? '').replace(',', '.').startsWith(expected)
			),
		[openedId, String(value)],
		{ timeout: 600_000 }
	);
	return { value, reloadTiming: await lastTiming() };
});
proof.errors = errors;
proof.loadTiming = await Promise.all(proof.loadTiming);
writeFileSync(args.out, JSON.stringify(proof, null, 2));
console.log('written', args.out);
await browser.close();
