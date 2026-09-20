import { TriplitClient } from '@triplit/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DATA_SPACES, DEMO_SEED_MARKER_KEY } from '$lib/state/triplit/data-space';
import {
	asRepositoryClient,
	createTriplitRepository,
	type TempienceRepository
} from '$lib/state/triplit/repository';
import { schema } from '$lib/state/triplit/schema';
import {
	createScenarioImportRepository,
	type ScenarioImportRepository
} from '$lib/state/triplit/scenario-import-repository';
import { evaluateIntention } from '$lib/state/triplit/IntentionAssessments/result';
import type { Intersection, Trace } from '$lib/state/triplit/types';
import { WORKBENCH_OPEN_AT_KEY } from '$lib/state/Workbench/constants';
import { bootstrapDemoSeed } from './bootstrap';
import { demoRecordId } from './batch';
import { DEMO_STORY } from './story';
import type { DemoSeedStorage } from './types';

const NOW = '2026-09-19T10:00:00.000Z';

const storage = (
	values: Record<string, string> = {}
): DemoSeedStorage & { dump: () => Record<string, string> } => {
	const map = new Map(Object.entries(values));
	return {
		getItem: vi.fn((key: string) => map.get(key) ?? null),
		setItem: vi.fn((key: string, value: string) => void map.set(key, value)),
		dump: () => Object.fromEntries(map)
	};
};

describe('demo seed bootstrap', () => {
	let client: TriplitClient<typeof schema>;
	let repository: TempienceRepository;
	let importRepository: ScenarioImportRepository;

	beforeEach(async () => {
		client = new TriplitClient({ schema, storage: { type: 'memory' }, autoConnect: false });
		await client.ready;
		repository = createTriplitRepository(client);
		importRepository = createScenarioImportRepository(
			asRepositoryClient(client),
			DATA_SPACES['demo-v1']
		);
	});

	afterEach(async () => {
		await client.clear({ full: true });
		client.disconnect();
	});

	/** The result exactly as the Context's «Результат» assembles it over the replica. */
	const evaluate = async (storyId: string) => {
		const tracesById = new Map<string, Trace>(
			(await repository.listTraces(true)).map((row) => [row.id, row])
		);
		const intersectionsById = new Map<string, Intersection>(
			(await repository.listIntersections(true)).map((row) => [row.id, row])
		);
		return evaluateIntention(
			demoRecordId(storyId),
			await repository.listIntentionAssessments(true),
			{ tracesById, intersectionsById }
		);
	};

	const bootstrap = (
		target: DemoSeedStorage,
		dataSpace = DATA_SPACES['demo-v1'],
		locale: 'ru' | 'en' = 'ru'
	) =>
		bootstrapDemoSeed({
			dataSpace,
			repository,
			importRepository,
			clock: () => NOW,
			storage: target,
			locale
		});

	it('seeds the empty demo replica through the Kind repository and the scenario import', async () => {
		const target = storage();

		const result = await bootstrap(target);

		expect(result).toEqual({
			status: 'applied',
			manifestId: 'watson-v1:ru',
			counts: {
				kinds: 2,
				scopes: 17,
				traces: 72,
				periods: 6,
				intersections: 155 + 2,
				assessments: 11
			}
		});
		// The seed marks the replica and asks the workbench, once, to open on the notebook's first page.
		expect(target.dump()).toEqual({
			[DEMO_SEED_MARKER_KEY]: 'watson-v1:ru',
			[WORKBENCH_OPEN_AT_KEY]: demoRecordId('w.start')
		});
		expect(demoRecordId('w.start')).toBe('demo-w-start');
		const [kinds, scopes, traces, periods, intersections] = await Promise.all([
			repository.listTraceKinds(),
			repository.listScopes(),
			repository.listTraces(),
			repository.listPeriods(),
			repository.listIntersections()
		]);
		expect(kinds.map((kind) => kind.name).toSorted()).toEqual(['Дело', 'Телеграмма']);
		expect(scopes).toHaveLength(17);
		expect(traces).toHaveLength(72);
		expect(periods).toHaveLength(6);
		expect(intersections).toHaveLength(157);
		expect(
			intersections.filter((link) => link.fromEntityType === 'traceKind').map((link) => link.id)
		).toEqual(
			expect.arrayContaining([
				`demo-kind-case:${demoRecordId('s.cases')}:belongs_to`,
				`demo-kind-wire:${demoRecordId('s.holmes')}:belongs_to`
			])
		);
		const start = traces.find((trace) => trace.id === demoRecordId('w.start'));
		expect(start).toMatchObject({
			content: 'Начните отсюда',
			relation: 'actual',
			timezone: 'Europe/London',
			capturedAt: '1894-05-01T12:00:00.000Z',
			aboutTime: {
				basis: 'absolute',
				precision: 'month',
				certainty: 'approximate',
				start: '1881-01'
			}
		});
		expect(start?.description).toMatch(/\n→ дальше: «Вы были в Афганистане, я вижу»$/);
		const hound = traces.find((trace) => trace.id === demoRecordId('w.hound.case'));
		expect(hound).toMatchObject({
			kindId: 'demo-kind-case',
			kindVId: 'demo-kind-case-v1',
			data: { client: 'Сэр Генри Баскервиль', fee: 500, days: 24 },
			content:
				'Двадцать четыре дня — от трости в нашей гостиной до островка в трясине. Мортимер увозит сэра Генри в кругосветное путешествие лечить нервы. Гонорар записываю условно: Холмс никогда не называл мне сумм.',
			description: null,
			aboutTime: { basis: 'absolute', precision: 'day', certainty: 'exact', start: '1889-10-20' }
		});
		const wire = traces.find((trace) => trace.id === demoRecordId('w.wire.1'));
		expect(wire).toMatchObject({
			kindId: 'demo-kind-wire',
			content:
				'Холмс отправил телеграмму Бэрримору в Баскервиль-холл с пометкой „вручить лично“: если он в Дартмуре, он не мог сидеть в кэбе на Риджент-стрит. Почтмейстер ответил, что телеграмму вручили — жене Бэрримора, сам он был на чердаке. Ответ ничего не доказал.',
			data: { to: 'Бэрримор, Баскервиль-холл', words: 12, pence: 6 }
		});
		expect(scopes.find((scope) => scope.id === demoRecordId('s.hound'))).toMatchObject({
			name: 'Собака Баскервилей',
			note: 'Октябрь 1889. Дартмур: наследство, легенда и собака с фосфорной мордой. Три недели — как я думал — без Холмса.'
		});
		expect(scopes.find((scope) => scope.id === demoRecordId('s.holmes'))).toMatchObject({
			name: 'Шерлок Холмс',
			note: 'Знает химию глубоко, литературу — ноль. Скрипка, табак в персидской туфле.'
		});
		expect(periods.find((period) => period.id === demoRecordId('p.1889-10'))).toMatchObject({
			name: 'Октябрь 1889',
			time: { precision: 'month', start: '1889-10', end: '1889-10' },
			timezone: 'Europe/London'
		});
	});

	it("colours every Scope with the story's own hue, saturation and depth", async () => {
		await bootstrapDemoSeed({
			dataSpace: DATA_SPACES['demo-v1'],
			repository,
			importRepository,
			clock: () => NOW,
			storage: storage(),
			locale: 'ru'
		});
		const scopes = await repository.listScopes();
		expect(scopes).toHaveLength(17);
		for (const story of DEMO_STORY.scopes) {
			const stored = scopes.find((scope) => scope.id === demoRecordId(story.id));
			expect(stored?.colorHue, story.id).toBe(story.colour!.hue);
			expect(stored?.colorChroma, story.id).toBe(story.colour!.chroma ?? null);
			expect(stored?.colorDepth, story.id).toBe(story.colour!.depth ?? null);
		}
	});

	it('closes every assessed intention as completed through its evidence, and leaves the mire search open', async () => {
		await bootstrap(storage());

		const assessments = await repository.listIntentionAssessments();
		expect(assessments).toHaveLength(11);
		expect(new Set(assessments.map((item) => item.source))).toEqual(new Set(['evidence']));
		expect(new Set(assessments.map((item) => item.evidenceId))).toEqual(
			new Set(
				(await repository.listIntersections())
					.filter((link) => link.kind === 'evidence_for')
					.map((link) => link.id)
			)
		);
		for (const storyId of ['w.hound.intent', 'w.step.barrymore', 'w.moran.intent']) {
			const result = await evaluate(storyId);
			expect(result.outcome.value, storyId).toBe('completed');
			expect(result.open.value, storyId).toBe(false);
			expect(result.outcome.sourceId, storyId).not.toBeNull();
			expect(
				result.sources.every((source) => source.eligibility.eligible),
				storyId
			).toBe(true);
		}
		// The hound's verdict is ordered by its facts — the night at Merripit House, then Holmes's
		// explanation the next morning — not by the install day; the later fact decides.
		const hound = await evaluate('w.hound.intent');
		expect(hound.sources).toHaveLength(2);
		expect(hound.sources.map((source) => source.orderedAt)).toEqual([
			'1889-10-19T00:00:00.000Z',
			'1889-10-20T00:00:00.000Z'
		]);
		expect(hound.sources.map((source) => source.assessment.factId)).toEqual([
			demoRecordId('w.night'),
			demoRecordId('w.hound.answer')
		]);
		expect(hound.outcome.sourceId).toBe(hound.sources[1].assessment.id);
		const search = await evaluate('w.mire.search');
		expect(search).toMatchObject({
			outcome: { value: null, sourceId: null },
			open: { value: true, sourceId: null },
			sources: []
		});
	});

	it('does nothing on a later load once the marker names the same manifest', async () => {
		const target = storage();
		await bootstrap(target);
		const traces = await repository.listTraces();
		target.setItem(WORKBENCH_OPEN_AT_KEY, '');

		await expect(bootstrap(target)).resolves.toEqual({
			status: 'skipped',
			reason: 'marker',
			manifestId: 'watson-v1:ru'
		});
		expect(await repository.listTraces()).toHaveLength(traces.length);
		expect(await repository.listIntentionAssessments()).toHaveLength(11);
		// A skip never asks to open anything.
		expect(target.dump()[WORKBENCH_OPEN_AT_KEY]).toBe('');
	});

	it('is a strict no-op outside the demo space', async () => {
		for (const dataSpace of [
			DATA_SPACES.canonical,
			DATA_SPACES['belgrade-what-if-v1'],
			DATA_SPACES['e2e-synthetic']
		]) {
			const target = storage();
			await expect(bootstrap(target, dataSpace)).resolves.toEqual({
				status: 'skipped',
				reason: 'not-target',
				manifestId: 'watson-v1:ru'
			});
			expect(target.getItem).not.toHaveBeenCalled();
			expect(target.setItem).not.toHaveBeenCalled();
		}
		expect(await repository.listTraces()).toHaveLength(0);
	});

	it('leaves a replica that already holds data alone and marks it, without asking to open', async () => {
		const target = storage();
		await repository.createScope({ name: 'Своя' });

		await expect(bootstrap(target)).resolves.toEqual({
			status: 'skipped',
			reason: 'existing-data',
			manifestId: 'watson-v1:ru'
		});
		expect(target.dump()).toEqual({ [DEMO_SEED_MARKER_KEY]: 'watson-v1:ru' });
		expect(await repository.listScopes()).toHaveLength(1);
		expect(await repository.listTraceKinds()).toHaveLength(0);
		expect(await repository.listIntentionAssessments()).toHaveLength(0);
	});

	it('keeps the marker of the language the notebook was written in when the interface speaks another', async () => {
		const target = storage();
		await bootstrap(target);
		const traces = await repository.listTraces();
		target.setItem(WORKBENCH_OPEN_AT_KEY, '');

		await expect(bootstrap(target, DATA_SPACES['demo-v1'], 'en')).resolves.toEqual({
			status: 'skipped',
			reason: 'existing-data',
			manifestId: 'watson-v1:en'
		});
		// The replica is still the Russian notebook, so the marker keeps saying so; the header offers the rebuild.
		expect(target.dump()[DEMO_SEED_MARKER_KEY]).toBe('watson-v1:ru');
		expect(await repository.listTraces()).toHaveLength(traces.length);
		expect(target.dump()[WORKBENCH_OPEN_AT_KEY]).toBe('');
	});

	it('marks a replica whose marker is not a Watson seed with the language of the moment', async () => {
		const target = storage({ [DEMO_SEED_MARKER_KEY]: 'demo-v1:ru' });
		await repository.createScope({ name: 'Своя' });

		await expect(bootstrap(target, DATA_SPACES['demo-v1'], 'en')).resolves.toEqual({
			status: 'skipped',
			reason: 'existing-data',
			manifestId: 'watson-v1:en'
		});
		expect(target.dump()).toEqual({ [DEMO_SEED_MARKER_KEY]: 'watson-v1:en' });
	});
});
