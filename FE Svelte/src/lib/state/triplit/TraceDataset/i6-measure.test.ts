import { mkdirSync, writeFileSync } from 'node:fs';
import { cpus, totalmem } from 'node:os';
import { TriplitClient } from '@triplit/client';
import { expect, it } from 'vitest';
import { versionSummaries } from '$lib/model/TraceForm/summary-fields';
import { createTriplitRepository } from '../repository';
import { schema } from '../schema';
import { seedHistoryFixture } from './history.fixture';
import {
	measureBoot,
	measureContextOpen,
	measureFormOpen,
	measureHeadsPhases,
	measureLists
} from './measure/entry-paths';
import { measureCrossVersion } from './measure/cross-version';
import { measureHistory } from './measure/history';
import { memory } from './measure/tools';

/**
 * Opt-in: TEMPIENCE_I6_MEASURE=1, rows from TEMPIENCE_I6_ROWS (100000), the proof written to
 * TEMPIENCE_I6_OUT. Memory SDK in Node: what the source pipeline reads and answers with, not a
 * browser, not IndexedDB, not a phone. The fixture repeats one note text, so heap numbers do
 * not model unique content. Every predicate but an id is a scan of its collection in the
 * installed SDK, so the bounded reads bound what is answered and held, not the scan.
 */
const enabled = process.env.TEMPIENCE_I6_MEASURE === '1';
const rows = Number(process.env.TEMPIENCE_I6_ROWS ?? 100_000);
const out = process.env.TEMPIENCE_I6_OUT ?? '/tmp/i6-measure.json';

it.skipIf(!enabled)(
	'measures the entry paths of the app at scale',
	async () => {
		const client = new TriplitClient({ schema, storage: { type: 'memory' }, autoConnect: false });
		const repository = createTriplitRepository(client);
		const proof: Record<string, unknown> = {
			environment: {
				node: process.version,
				cpu: cpus()[0]?.model,
				totalMemoryMiB: Math.round(totalmem() / 1024 / 1024),
				storage: 'memory'
			},
			rows
		};
		try {
			const fixture = await seedHistoryFixture(client, repository, { rows });
			proof.fixture = { counts: fixture.counts, seedMs: fixture.seedMs, memoryMiB: memory() };
			const paths = versionSummaries(await repository.listTraceKindVersions());
			proof.summaries = paths.map((entry) => [
				entry.kindVId,
				entry.paths.map((path) => path.join('.')).join(', ')
			]);

			const boot = await measureBoot(repository, paths);
			proof.bootWhole = boot.whole;
			proof.bootThin = boot.thin;
			proof.display = boot.display;
			expect(boot.thin.traces).toBe(boot.whole.traces);

			proof.headsPhases = await measureHeadsPhases(client, paths);
			proof.formOpen = await measureFormOpen(repository, paths);
			proof.contextOpen = await measureContextOpen(repository, fixture.samples.day, paths);
			proof.lists = await measureLists(repository, fixture);
			proof.history = await measureHistory(repository, fixture);
			proof.crossVersion = await measureCrossVersion(repository, 2000);
			proof.memoryMiB = memory();

			writeFileSync(out, JSON.stringify(proof, null, 2));
		} finally {
			await client.clear({ full: true });
			client.disconnect();
		}
	},
	900_000
);

mkdirSync(out.slice(0, out.lastIndexOf('/')), { recursive: true });
