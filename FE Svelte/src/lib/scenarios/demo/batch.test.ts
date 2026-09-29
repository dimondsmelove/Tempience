import { describe, expect, it } from 'vitest';
import { parsePeriodTime, periodTimeBounds } from '$lib/state/triplit/period-time';
import type { ScenarioImportEntry } from '$lib/state/triplit/scenario-import-repository';
import {
	assertTraceData,
	assertTraceFormDefinition
} from '$lib/state/triplit/trace-kind-v-validation';
import { assertTraceTemporalPlacement, parseTraceAboutTime } from '$lib/state/triplit/trace-time';
import type { TraceAboutTime } from '$lib/state/triplit/types';
import { buildDemoSeed, demoRecordId } from './batch';
import { WATSON_STORY, type DemoStoryEntry } from './registry';
import { DEMO_STORY } from './story';
import type { DemoStory } from './types';

const CAPTURED_AT = '2026-09-19T10:00:00.000Z';
const DEMO_TIMEZONE = WATSON_STORY.timezone;
/** Watson's record ids, the only ones these tests speak of. */
const recordId = (storyId: string): string => demoRecordId(WATSON_STORY, storyId);

type Entry<T extends ScenarioImportEntry['type']> = Extract<ScenarioImportEntry, { type: T }>;

const seed = buildDemoSeed(
	{ locale: 'ru', capturedAt: CAPTURED_AT, entry: WATSON_STORY },
	DEMO_STORY
);
const of = <T extends ScenarioImportEntry['type']>(type: T): Entry<T>[] =>
	seed.batch.entries.filter((entry): entry is Entry<T> => entry.type === type);
const scopes = of('scope');
const traces = of('trace');
const periods = of('period');
const links = of('intersection');
const scopeIds = new Set(scopes.map((entry) => entry.id));
const traceIds = new Set(traces.map((entry) => entry.id));
const trace = (storyId: string): Entry<'trace'> => {
	const found = traces.find((entry) => entry.id === recordId(storyId));
	if (!found) throw new Error(`missing ${storyId}`);
	return found;
};
const traceById = (id: string): Entry<'trace'> => {
	const found = traces.find((entry) => entry.id === id);
	if (!found) throw new Error(`missing ${id}`);
	return found;
};
const period = (storyId: string): Entry<'period'> => {
	const found = periods.find((entry) => entry.id === recordId(storyId));
	if (!found) throw new Error(`missing ${storyId}`);
	return found;
};
const absolute = (entry: Entry<'trace'>): Extract<TraceAboutTime, { basis: 'absolute' }> => {
	const time = entry.draft.aboutTime;
	if (time?.basis !== 'absolute') throw new Error(`${entry.id} is not absolute`);
	return time;
};
const byKind = (kind: string, endpoint?: 'scope' | 'trace') =>
	links.filter(
		(entry) =>
			entry.draft.kind === kind &&
			(endpoint === undefined ||
				(endpoint === 'scope' ? scopeIds : traceIds).has(entry.draft.fromId))
	);

describe('demo seed batch', () => {
	it('holds the whole notebook: every Scope, Trace, Period, Kind and link of comment-watson.md', () => {
		expect(scopes).toHaveLength(27);
		expect(traces).toHaveLength(101);
		expect(periods).toHaveLength(6);
		expect(seed.kinds).toHaveLength(2);
		// `belongs_to` is the sum of the «scopes» columns of the Trace tables.
		expect(byKind('belongs_to')).toHaveLength(158);
		expect(byKind('belongs_to')).toHaveLength(
			DEMO_STORY.traces.reduce((sum, item) => sum + item.scopeIds.length, 0)
		);
		expect(byKind('child_of')).toHaveLength(23);
		expect(byKind('related_to', 'scope')).toHaveLength(3);
		expect(byKind('related_to', 'trace')).toHaveLength(9);
		expect(byKind('part_of')).toHaveLength(6);
		expect(byKind('evidence_for')).toHaveLength(12);
		expect(byKind('revisits')).toHaveLength(2);
		expect(links).toHaveLength(158 + 23 + 3 + 9 + 6 + 12 + 2);
		expect(seed.kindScopes).toEqual({
			'demo-kind-case': [recordId('s.cases')],
			'demo-kind-wire': [recordId('s.holmes')]
		});
		// The preface's links are the table of contents; the steps close on the intention.
		const start = recordId('w.start');
		expect(
			byKind('related_to', 'trace')
				.filter((entry) => entry.draft.fromId === start || entry.draft.toId === start)
				.map((entry) => (entry.draft.fromId === start ? entry.draft.toId : entry.draft.fromId))
				.toSorted()
		).toEqual(['w.final', 'w.hound.intent', 'w.meet', 'w.return'].map(recordId).toSorted());
		expect(
			byKind('related_to', 'trace').filter((entry) =>
				[entry.draft.fromId, entry.draft.toId].includes(recordId('w.mire.search'))
			)
		).toHaveLength(1);
		// The story in print sits beside the fall it tells; the colonel beside the intention to take him.
		const pair = (a: string, b: string) => [recordId(a), recordId(b)].toSorted();
		expect(
			byKind('related_to', 'trace')
				.filter((entry) => ![entry.draft.fromId, entry.draft.toId].includes(start))
				.map((entry) => [entry.draft.fromId, entry.draft.toId])
				.toSorted()
		).toEqual(
			[
				pair('w.mire.search', 'w.night'),
				pair('w.published', 'w.final'),
				pair('w.moran.who', 'w.moran.intent'),
				pair('w.study.print', 'w.scarlet.case'),
				pair('w.married', 'w.engaged')
			].toSorted()
		);
		expect(
			byKind('part_of').every((entry) => entry.draft.toId === recordId('w.hound.intent'))
		).toBe(true);
		expect(byKind('revisits').map((entry) => [entry.draft.fromId, entry.draft.toId])).toEqual([
			[recordId('w.revisit.barrymore'), recordId('w.hyp.barrymore')],
			[recordId('w.return'), recordId('w.final')]
		]);
	});

	it('assesses every evidence link and closes it, Openshaw lost, and leaves the mire search open', () => {
		expect(seed.assessments).toHaveLength(12);
		const evidence = new Map<string, Entry<'intersection'>['draft']>(
			byKind('evidence_for').map((entry) => [`link:${entry.id}`, entry.draft])
		);
		expect(new Set(seed.assessments.map((item) => item.candidateId)).size).toBe(12);
		for (const item of seed.assessments) {
			const link = evidence.get(item.candidateId);
			expect(link, item.candidateId).toBeDefined();
			expect(seed.batch.mapping[item.candidateId]).toBe(item.candidateId.slice('link:'.length));
			// Holmes saved every client he was asked to but one: John Openshaw, in 1887.
			const lost = link!.toId === recordId('w.pips.intent');
			expect(item.values).toEqual({ outcome: lost ? 'not_completed' : 'completed', open: false });
			// The fact is dated and actual, the addressee an intention: what the repository accepts.
			expect(traceById(link!.fromId).draft.relation).toBe('actual');
			expect(traceById(link!.fromId).draft.aboutTime?.basis).toBe('absolute');
			expect(traceById(link!.toId).draft.relation).toBe('intend');
		}
		// Every evidence link is assessed; the one open intention has no evidence at all.
		expect(new Set(seed.assessments.map((item) => item.candidateId))).toEqual(
			new Set(evidence.keys())
		);
		const search = recordId('w.mire.search');
		expect(trace('w.mire.search').draft).toMatchObject({
			relation: 'intend',
			content: 'Найти Стэплтона в трясине',
			aboutTime: { precision: 'day', certainty: 'approximate', start: '1889-10-20' },
			capturedAt: '1889-10-20T13:00:00.000Z'
		});
		expect([...evidence.values()].some((link) => link.toId === search)).toBe(false);
		expect(
			byKind('belongs_to')
				.filter((entry) => entry.draft.fromId === search)
				.map((entry) => entry.draft.toId)
				.toSorted()
		).toEqual([recordId('s.hound'), recordId('s.mire')].toSorted());
	});

	it('references only records of the batch or Kinds of the seed, with a complete mapping', () => {
		const ids = new Set(seed.batch.entries.map((entry) => entry.id));
		expect(ids.size).toBe(seed.batch.entries.length);
		for (const entry of seed.batch.entries) {
			expect(seed.batch.mapping[entry.candidateId]).toBe(entry.id);
		}
		expect(Object.keys(seed.batch.mapping)).toHaveLength(seed.batch.entries.length);
		const kindIds = new Set(seed.kinds.map((kind) => kind.id));
		const kindVIds = new Set(seed.kinds.map((kind) => kind.initialKindV.id));
		for (const entry of links) {
			expect(ids.has(entry.draft.fromId), entry.id).toBe(true);
			expect(ids.has(entry.draft.toId), entry.id).toBe(true);
			expect(entry.id).toBe(`${entry.draft.fromId}:${entry.draft.toId}:${entry.draft.kind}`);
			if (entry.draft.kind === 'belongs_to') {
				expect(traceIds.has(entry.draft.fromId)).toBe(true);
				expect(scopeIds.has(entry.draft.toId)).toBe(true);
			}
			if (entry.draft.kind === 'child_of') {
				expect(scopeIds.has(entry.draft.fromId)).toBe(true);
				expect(scopeIds.has(entry.draft.toId)).toBe(true);
			}
			if (['part_of', 'evidence_for', 'revisits'].includes(entry.draft.kind)) {
				expect(traceIds.has(entry.draft.fromId)).toBe(true);
				expect(traceIds.has(entry.draft.toId)).toBe(true);
			}
			if (entry.draft.kind === 'related_to') {
				expect(entry.draft.fromId.localeCompare(entry.draft.toId)).toBeLessThan(0);
			}
		}
		for (const entry of traces) {
			expect((entry.draft.kindId === null) === (entry.draft.kindVId === null)).toBe(true);
			if (entry.draft.kindId) expect(kindIds.has(entry.draft.kindId)).toBe(true);
			if (entry.draft.kindVId) expect(kindVIds.has(entry.draft.kindVId)).toBe(true);
			if (entry.draft.aboutTime?.basis === 'relative') {
				expect(traceIds.has(entry.draft.aboutTime.anchorTraceId)).toBe(true);
			}
		}
		for (const scopeId of Object.values(seed.kindScopes).flat()) {
			expect(scopeIds.has(scopeId)).toBe(true);
		}
	});

	it('covers every placement the model supports and passes the storage checks', () => {
		const absolutes = traces
			.map((entry) => entry.draft.aboutTime)
			.filter((t) => t?.basis === 'absolute');
		expect(new Set(absolutes.map((t) => t.precision))).toEqual(
			new Set(['minute', 'day', 'month', 'season', 'year'])
		);
		expect(new Set(absolutes.map((t) => t.certainty))).toEqual(new Set(['exact', 'approximate']));
		expect(traces.filter((entry) => entry.draft.aboutTime?.basis === 'unknown')).toHaveLength(1);
		expect(traces.filter((entry) => entry.draft.aboutTime?.basis === 'relative')).toHaveLength(2);
		expect(traces.filter((entry) => entry.draft.aboutKind === 'interval')).toHaveLength(5);
		expect(absolutes.filter((t) => t.precision === 'minute').length).toBeGreaterThanOrEqual(5);
		expect(new Set(traces.map((entry) => entry.draft.relation))).toEqual(
			new Set(['intend', 'actual'])
		);
		for (const entry of traces) {
			const time = parseTraceAboutTime(entry.draft.aboutTime);
			expect(() =>
				assertTraceTemporalPlacement(entry.draft.aboutKind, time, entry.draft.aboutTraceId ?? null)
			).not.toThrow();
			expect(entry.draft.timezone).toBe(DEMO_TIMEZONE);
			// Written between the return from Afghanistan and the spring after the return of Holmes.
			expect(entry.draft.capturedAt, entry.id).toMatch(/^18(80|8[1-9]|9[0-4])-/);
		}
		for (const entry of periods) {
			expect(entry.draft.timezone).toBe(DEMO_TIMEZONE);
			const time = parsePeriodTime(entry.draft.time);
			expect(periodTimeBounds(time, entry.draft.timezone).end).toBeGreaterThan(
				periodTimeBounds(time, entry.draft.timezone).start
			);
		}
	});

	it('anchors relative placements to records captured no later', () => {
		const capturedAt = new Map(traces.map((entry) => [entry.id, entry.draft.capturedAt ?? '']));
		for (const entry of traces) {
			if (entry.draft.aboutTime?.basis !== 'relative') continue;
			const anchor = capturedAt.get(entry.draft.aboutTime.anchorTraceId);
			expect(anchor, entry.id).toBeDefined();
			expect(Date.parse(anchor ?? '')).toBeLessThanOrEqual(
				Date.parse(entry.draft.capturedAt ?? '')
			);
		}
		expect(trace('w.list').draft.aboutTime).toEqual({
			basis: 'relative',
			precision: 'unknown',
			anchorTraceId: recordId('w.rooms'),
			relation: 'after'
		});
		expect(trace('w.mycroft').draft.aboutTime).toEqual({
			basis: 'relative',
			precision: 'year',
			anchorTraceId: recordId('w.hiatus.tibet'),
			relation: 'during'
		});
		expect(trace('w.hiatus.persia').draft.aboutTime).toEqual({ basis: 'unknown' });
	});

	it('types the cases and the telegrams against their Kind versions', () => {
		for (const kind of seed.kinds)
			expect(() => assertTraceFormDefinition(kind.initialKindV)).not.toThrow();
		const kindVById = new Map(seed.kinds.map((kind) => [kind.initialKindV.id, kind.initialKindV]));
		const typed = traces.filter((entry) => entry.draft.kindId !== null);
		expect(typed).toHaveLength(15);
		expect(typed.filter((entry) => entry.draft.kindId === 'demo-kind-case')).toHaveLength(13);
		expect(typed.filter((entry) => entry.draft.kindId === 'demo-kind-wire')).toHaveLength(2);
		for (const entry of typed) {
			const kindV = kindVById.get(entry.draft.kindVId ?? '');
			expect(kindV).toBeDefined();
			expect(() => assertTraceData(entry.draft.data, kindV!.dataSchema)).not.toThrow();
			expect(entry.draft.description).toBeNull();
		}
		expect(trace('w.hound.case').draft).toMatchObject({
			kindId: 'demo-kind-case',
			kindVId: 'demo-kind-case-v1',
			data: { client: 'Сэр Генри Баскервиль', fee: 500, days: 24 },
			content:
				'Двадцать четыре дня — от трости в нашей гостиной до островка в трясине. Мортимер увозит сэра Генри в кругосветное путешествие лечить нервы. Гонорар записываю условно: Холмс никогда не называл мне сумм.'
		});
		expect(trace('w.band.case').draft).toMatchObject({
			data: { client: 'Хелен Стоунер', fee: 0, days: 2 },
			content:
				'Два дня. Гонорара не взяли: у Хелен ничего не было, а Ройлотт распоряжался наследством.'
		});
		expect(trace('w.wire.2').draft).toMatchObject({
			kindId: 'demo-kind-wire',
			kindVId: 'demo-kind-wire-v1',
			data: { to: 'Лестрейд, Скотленд-Ярд', words: 9, pence: 5 }
		});
		expect(seed.kinds.map((kind) => kind.name)).toEqual(['Дело', 'Телеграмма']);
		expect(seed.kinds[0].initialKindV.fieldMeta).toEqual({
			'/properties/fee': { unit: { id: 'gbp', label: '£' } }
		});
		expect(seed.kinds[1].initialKindV.fieldMeta).toEqual({
			'/properties/pence': { unit: { id: 'pence', label: 'п.' } }
		});
		for (const entry of traces.filter((item) => item.draft.kindId === null)) {
			expect(entry.draft.content.trim().length, entry.id).toBeGreaterThan(0);
		}
	});

	it('places every record at its own date in London time, 1880–1894', () => {
		expect(trace('w.start').draft).toMatchObject({
			content: 'Начните отсюда',
			relation: 'actual',
			aboutKind: 'instant',
			aboutTime: { precision: 'month', certainty: 'approximate', start: '1881-01', end: null }
		});
		expect(trace('w.start').draft.description).toMatch(
			/^Это моя книжка о годах с Шерлоком Холмсом — с зимы 1881-го/
		);
		expect(trace('w.start').draft.description).toContain('отставного военного врача');
		expect(trace('w.start').draft.description).toMatch(
			/\n→ дальше: «Вы были в Афганистане, я вижу»$/
		);
		// London kept Greenwich time from 1847: noon is 12:00Z, no summer time before 1916; a day that
		// holds several records gives each its hour in the reading order.
		expect(trace('w.start').draft.capturedAt).toBe('1894-05-01T12:00:00.000Z');
		expect(trace('w.charles').draft.capturedAt).toBe('1889-09-26T13:30:00.000Z');
		expect(trace('w.legend').draft.capturedAt).toBe('1889-09-26T13:00:00.000Z');
		for (const id of ['w.hiatus.tibet', 'w.hiatus.persia', 'w.hiatus.montpellier', 'w.mycroft'])
			expect(trace(id).draft.capturedAt, id).toBe('1894-04-06T10:00:00.000Z');
		expect(trace('w.report1').draft.capturedAt).toBe('1889-10-13T20:00:00.000Z');
		// The legend of 1742 sits on the day Mortimer read it aloud; the year stays in its text.
		expect(absolute(trace('w.legend'))).toEqual({
			basis: 'absolute',
			precision: 'day',
			certainty: 'approximate',
			start: '1889-09-26',
			end: null
		});
		// Sir Charles died in early May: the Devon County Chronicle reported it on the 14th.
		expect(absolute(trace('w.charles'))).toMatchObject({ precision: 'day', start: '1889-05-04' });
		expect(trace('w.legend').draft.description).toContain('рукопись 1742 года');
		// Nothing of the notebook is placed before the return from Afghanistan.
		const yearOf = (start: string) => Number(start.slice(0, 4));
		for (const entry of traces) {
			const time = entry.draft.aboutTime;
			if (time?.basis !== 'absolute') continue;
			expect(yearOf(time.start), entry.id).toBeGreaterThanOrEqual(1880);
			if (time.end !== null) expect(yearOf(time.end), entry.id).toBeGreaterThanOrEqual(1880);
		}
		// The Scope «Собака Баскервилей» spans one year: May to October 1889.
		const hound = recordId('s.hound');
		const houndStarts = byKind('belongs_to')
			.filter((entry) => entry.draft.toId === hound)
			.map((entry) => absolute(traceById(entry.draft.fromId)).start)
			.toSorted();
		expect(houndStarts.length).toBeGreaterThanOrEqual(20);
		expect(houndStarts[0]).toBe('1889-05-04');
		expect(houndStarts.at(-1)).toBe('1889-10-20');
		expect(new Set(houndStarts.map(yearOf))).toEqual(new Set([1889]));
		expect(absolute(trace('w.report1'))).toEqual({
			basis: 'absolute',
			precision: 'day',
			certainty: 'exact',
			start: '1889-10-13',
			end: null
		});
		expect(absolute(trace('w.hope'))).toMatchObject({
			precision: 'day',
			certainty: 'approximate',
			start: '1881-03-07'
		});
		expect(absolute(trace('w.whistle'))).toEqual({
			basis: 'absolute',
			precision: 'minute',
			certainty: 'exact',
			start: '1883-04-05T03:00:00.000Z',
			end: null
		});
		expect(absolute(trace('w.stoner'))).toMatchObject({
			precision: 'minute',
			certainty: 'approximate',
			start: '1883-04-04T07:15:00.000Z'
		});
		expect(absolute(trace('w.moran'))).toMatchObject({
			precision: 'minute',
			certainty: 'approximate',
			start: '1894-04-05T23:30:00.000Z'
		});
		expect(trace('w.vigil').draft).toMatchObject({
			aboutKind: 'interval',
			aboutTime: {
				precision: 'minute',
				certainty: 'approximate',
				start: '1883-04-04T23:00:00.000Z',
				end: '1883-04-05T03:30:00.000Z'
			}
		});
		expect(trace('w.flight').draft).toMatchObject({
			aboutKind: 'interval',
			aboutTime: { precision: 'day', certainty: 'exact', start: '1891-04-25', end: '1891-05-03' }
		});
		expect(trace('w.hiatus.tibet').draft).toMatchObject({
			aboutKind: 'interval',
			aboutTime: { precision: 'year', certainty: 'approximate', start: '1891', end: '1893' }
		});
		expect(absolute(trace('w.back'))).toEqual({
			basis: 'absolute',
			precision: 'season',
			certainty: 'approximate',
			start: '1894-03',
			end: '1894-05'
		});
		expect(periods.map((entry) => entry.draft)).toEqual([
			expect.objectContaining({
				name: '1880-е годы',
				time: { precision: 'year', start: '1880', end: '1889' },
				timezone: DEMO_TIMEZONE
			}),
			expect.objectContaining({
				name: '1881 год',
				time: { precision: 'year', start: '1881', end: '1881' }
			}),
			expect.objectContaining({
				name: 'Апрель 1883',
				time: { precision: 'month', start: '1883-04', end: '1883-04' }
			}),
			expect.objectContaining({
				name: 'Октябрь 1889',
				time: { precision: 'month', start: '1889-10', end: '1889-10' },
				note: 'Дартмур. Три недели, которые я провёл, как думал, без Холмса: тисовая аллея, свеча в окне, каторжник на болоте, человек на скале. Читайте по отчётам: 13-е, 15-е, дневник 16-го и 17-го — и мою версию от 10-го, за которую мне стыдно до сих пор.'
			}),
			expect.objectContaining({
				name: '1891 год',
				time: { precision: 'year', start: '1891', end: '1891' }
			}),
			expect.objectContaining({
				name: '1894 год',
				time: { precision: 'year', start: '1894', end: '1894' }
			})
		]);
		expect(seed.batch.capturedAt).toBe(CAPTURED_AT);
	});

	it('dates every record by the event that caused it, and writes it no earlier than that day', () => {
		const startOf = (storyId: string): string => absolute(trace(storyId)).start;
		// An intention sits on the day it arose, not on the first of an approximate month.
		const steps = {
			'w.hound.intent': '1889-09-26',
			'w.step.boot': '1889-09-28',
			'w.step.barrymore': '1889-09-28',
			'w.step.convict': '1889-10-01',
			'w.step.stapleton': '1889-10-04',
			'w.step.tor': '1889-10-15',
			'w.step.night': '1889-10-19'
		};
		for (const [id, start] of Object.entries(steps)) {
			expect(absolute(trace(id)), id).toMatchObject({
				precision: 'day',
				certainty: 'approximate',
				start
			});
		}
		// The theory comes before the report that carries it and the night that refutes it.
		expect(startOf('w.hyp.barrymore')).toBe('1889-10-12');
		expect(startOf('w.report1')).toBe('1889-10-13');
		expect(startOf('w.light')).toBe('1889-10-14');
		expect(startOf('w.hyp.barrymore') < startOf('w.report1')).toBe(true);
		expect(startOf('w.report1') < startOf('w.light')).toBe(true);
		// A Case is entered on the day it closed; Laura Lyons is the morning after the portrait.
		expect(startOf('w.scarlet.case')).toBe('1881-03-07');
		expect(startOf('w.scarlet.intent')).toBe('1881-03-04');
		expect(startOf('w.lyons')).toBe('1889-10-19');
		expect(startOf('w.portrait') < startOf('w.lyons')).toBe(true);
		// The hours of one day are its reading order (Europe/London was GMT throughout).
		const capturedOf = (storyId: string): string => trace(storyId).draft.capturedAt ?? '';
		expect(['w.mortimer', 'w.legend', 'w.charles', 'w.hound.intent'].map(capturedOf)).toEqual([
			'1889-09-26T12:00:00.000Z',
			'1889-09-26T13:00:00.000Z',
			'1889-09-26T13:30:00.000Z',
			'1889-09-26T18:00:00.000Z'
		]);
		expect(capturedOf('w.hyp.barrymore')).toBe('1889-10-12T08:00:00.000Z');
		expect(capturedOf('w.adair')).toBe('1894-03-31T09:00:00.000Z');
		expect(capturedOf('w.moran')).toBe('1894-04-06T00:30:00.000Z');
		expect(capturedOf('w.empty.case')).toBe('1894-04-06T01:00:00.000Z');
		expect(capturedOf('w.flight')).toBe('1891-05-03T21:00:00.000Z');
		// A record with no hour of its own is written at noon.
		for (const id of ['w.start', 'w.afghan', 'w.mycroft.meet', 'w.practice.91', 'w.published'])
			expect(capturedOf(id), id).toMatch(/T12:00:00\.000Z$/);
		// Nothing is written before it happened. Watson wrote a few things down after the fact — the
		// preface, what Mortimer told of June, the manuscript of 1742, the hiatus from Holmes's words,
		// the papers of the morning after — and one plan the evening before its night.
		const RETROSPECTIVE = [
			'w.start',
			'w.charles',
			'w.hiatus.tibet',
			'w.hiatus.montpellier',
			'w.adair'
		].map(recordId);
		const PLANNED_AHEAD = ['w.step.night'].map(recordId);
		const pad = (value: number) => String(value).padStart(2, '0');
		const firstDay = (value: string): string => `${value}-01-01`.slice(0, 10);
		const lastDay = (value: string): string => {
			if (value.length >= 10) return value.slice(0, 10);
			const [year, month = 12] = value.split('-').map(Number);
			return `${year}-${pad(month)}-${pad(new Date(Date.UTC(year, month, 0)).getUTCDate())}`;
		};
		const nextDay = (day: string): string =>
			new Date(Date.parse(day) + 86_400_000).toISOString().slice(0, 10);
		let dated = 0;
		for (const entry of traces) {
			const time = entry.draft.aboutTime;
			if (time?.basis !== 'absolute') continue;
			dated += 1;
			const captured = (entry.draft.capturedAt ?? '').slice(0, 10);
			const start = firstDay(time.start);
			const end = lastDay(time.end ?? time.start);
			if (PLANNED_AHEAD.includes(entry.id)) expect(captured < start, entry.id).toBe(true);
			else expect(captured >= start, entry.id).toBe(true);
			if (RETROSPECTIVE.includes(entry.id)) expect(captured > start, entry.id).toBe(true);
			else expect(captured <= nextDay(end), entry.id).toBe(true);
		}
		// Every record but Persia (unknown) and the list and Mycroft (relative to another record).
		expect(dated).toBe(101 - 3);
		expect(traces).toHaveLength(101);
		expect(seed.assessments).toHaveLength(12);
	});

	it('writes the notebook in the seed language, once, with no empty text', () => {
		const en = buildDemoSeed(
			{ locale: 'en', capturedAt: CAPTURED_AT, entry: WATSON_STORY },
			DEMO_STORY
		);
		expect(seed.manifestId).toBe('watson-v1:ru');
		expect(en.manifestId).toBe('watson-v1:en');
		expect(seed.batch.targetDataSpaceId).toBe('demo-v1');
		for (const built of [seed, en]) {
			for (const kind of built.kinds) {
				expect(kind.name.trim()).not.toBe('');
				const properties = kind.initialKindV.dataSchema.properties as Record<
					string,
					{ title: string }
				>;
				for (const field of Object.values(properties)) expect(field.title.trim()).not.toBe('');
				for (const meta of Object.values(kind.initialKindV.fieldMeta ?? {}))
					expect(meta.unit?.label.trim()).not.toBe('');
			}
			for (const entry of built.batch.entries) {
				if (entry.type === 'scope') {
					expect(entry.draft.name.trim()).not.toBe('');
					if (entry.draft.note !== null) expect(entry.draft.note?.trim()).not.toBe('');
				}
				if (entry.type === 'period') {
					expect(entry.draft.name.trim()).not.toBe('');
					expect(entry.draft.note?.trim()).not.toBe('');
				}
				if (entry.type === 'trace') {
					if (entry.draft.kindId === null) expect(entry.draft.content.trim()).not.toBe('');
					if (entry.draft.description !== null)
						expect(entry.draft.description?.trim()).not.toBe('');
					for (const value of Object.values(entry.draft.data ?? {}))
						if (typeof value === 'string') expect(value.trim()).not.toBe('');
				}
			}
			// Nothing came back as a raw key.
			expect(JSON.stringify(built)).not.toMatch(/"demo\.(scope|kind|period|trace)\./);
		}
		const draftOf = (built: typeof seed, storyId: string) =>
			built.batch.entries.find((entry) => entry.id === recordId(storyId))?.draft;
		expect(draftOf(seed, 's.hound')).toMatchObject({ name: 'Собака Баскервилей' });
		expect(draftOf(en, 's.hound')).toMatchObject({ name: 'The Hound of the Baskervilles' });
		expect(draftOf(en, 's.cases')).toMatchObject({ name: 'Cases' });
		expect(draftOf(en, 'w.start')).toMatchObject({ content: 'Start here' });
		expect(draftOf(en, 'w.hound.case')).toMatchObject({
			data: { client: 'Sir Henry Baskerville', fee: 500, days: 24 }
		});
		expect(en.kinds.map((kind) => kind.name)).toEqual(['Case', 'Telegram']);
		expect(draftOf(en, 'p.1880s')).toMatchObject({ name: 'The 1880s' });
		expect(period('p.1889-10').draft.name).toBe('Октябрь 1889');
		expect(DEMO_STORY.traces.map((item) => item.id)).toHaveLength(101);
		expect(new Set(DEMO_STORY.traces.map((item) => item.id)).size).toBe(101);
	});
});

describe('demo story colours', () => {
	it('gives every Scope a hue on the circle, a saturation and a depth of the flower', () => {
		for (const scope of DEMO_STORY.scopes) {
			expect(scope.colour, scope.id).toBeDefined();
			const { hue, chroma, depth } = scope.colour!;
			expect(Number.isInteger(hue) && hue >= 0 && hue < 360, scope.id).toBe(true);
			expect(chroma !== undefined && chroma >= 0 && chroma <= 100, scope.id).toBe(true);
			expect(depth !== undefined && depth >= 0 && depth <= 2, scope.id).toBe(true);
		}
		// Siblings are told apart by hue: no two children of one parent share it.
		const byParent = new Map<string, number[]>();
		for (const scope of DEMO_STORY.scopes) {
			const key = scope.parentId ?? '';
			byParent.set(key, [...(byParent.get(key) ?? []), scope.colour!.hue]);
		}
		for (const [parent, hues] of byParent) expect(new Set(hues).size, parent).toBe(hues.length);
	});
});

describe('demo story chapters', () => {
	const ms = (instant: string): number => Date.parse(instant);
	const chapter = (name: string) => {
		const found = seed.chapters.find((item) => item.draft.name === name);
		if (!found) throw new Error(`missing chapter ${name}`);
		return found;
	};
	/** Where a chapter ends: the next one's start, or the close of the last. */
	const endOf = (index: number): number => {
		const next = seed.chapters[index + 1];
		return next ? ms(next.draft.start) : ms(seed.chapters[index].draft.closedAt!);
	};

	it('writes each chapter in the seed language, at midnight of London', () => {
		expect(seed.chapters.map((item) => item.draft.name)).toEqual([
			'Возвращение из Афганистана',
			'Знакомство',
			'Тихие годы',
			'Первая слава',
			'Мэри Морстен',
			'Дело Баскервилей',
			'Женитьба и Паддингтон',
			'Без Холмса',
			'Снова на Бейкер-стрит'
		]);
		// London kept Greenwich time all year before 1916: a local midnight is a UTC one.
		expect(chapter('Возвращение из Афганистана').draft).toMatchObject({
			start: '1880-11-01T00:00:00.000Z',
			colorHue: 30
		});
		expect(chapter('Без Холмса').stages.map((stage) => [stage.name, stage.start])).toEqual([
			['Последнее дело', '1891-04-24T00:00:00.000Z'],
			['Один', '1891-05-05T00:00:00.000Z'],
			['Рассказ в печати', '1893-12-01T00:00:00.000Z'],
			['Убийство Адэра', '1894-03-30T00:00:00.000Z']
		]);
		const english = buildDemoSeed(
			{ locale: 'en', capturedAt: CAPTURED_AT, entry: WATSON_STORY },
			DEMO_STORY
		);
		expect(english.chapters.map((item) => item.draft.name)).toContain('Mary Morstan');
	});

	it('puts in front only Scopes of the story, by their record ids; a stage may keep the chapter lineup', () => {
		for (const item of seed.chapters) {
			const lineups = [item.draft.lineup ?? [], ...item.stages.map((stage) => stage.lineup ?? [])];
			for (const entry of lineups.flat())
				expect(scopeIds.has(entry.scopeId), entry.scopeId).toBe(true);
		}
		expect(chapter('Дело Баскервилей').stages.map((stage) => stage.lineup)).toEqual([
			['s.hall', 's.hound'].map((id) => ({ scopeId: recordId(id), level: 'focus' })),
			['s.hound', 's.holmes', 's.baker'].map((id) => ({ scopeId: recordId(id), level: 'focus' })),
			['s.hound', 's.hall', 's.mire'].map((id) => ({ scopeId: recordId(id), level: 'focus' })),
			null
		]);
	});

	it('divides the whole notebook: only starts, the last one closed where the notebook ends', () => {
		const starts = seed.chapters.map((item) => ms(item.draft.start));
		expect(starts).toEqual(starts.toSorted((a, b) => a - b));
		expect(new Set(starts).size).toBe(starts.length);
		// Only the last chapter closes, so none runs on to today and none leaves a gap.
		expect(seed.chapters.slice(0, -1).map((item) => item.draft.closedAt)).toEqual(
			seed.chapters.slice(0, -1).map(() => null)
		);
		expect(seed.chapters.at(-1)!.draft.closedAt).toBe('1894-06-01T00:00:00.000Z');
		// Every dated record of the notebook falls inside a chapter.
		for (const entry of traces) {
			const time = entry.draft.aboutTime;
			if (time?.basis !== 'absolute') continue;
			const at = Date.parse(time.start);
			expect(at >= starts[0] && at < endOf(seed.chapters.length - 1), entry.id).toBe(true);
		}
		seed.chapters.forEach((item, index) => {
			// A chapter with stages is covered by them from its own start.
			if (item.stages.length) expect(item.stages[0].start, item.draft.name).toBe(item.draft.start);
			for (const stage of item.stages) {
				expect(ms(stage.start) >= ms(item.draft.start), stage.name).toBe(true);
				expect(ms(stage.start) < endOf(index), stage.name).toBe(true);
			}
		});
	});

	it('gives every chapter records of its own', () => {
		// A chapter tells what happened in it: no chapter is an empty stretch of the axis.
		seed.chapters.forEach((item, index) => {
			const inside = traces.filter((entry) => {
				const time = entry.draft.aboutTime;
				if (time?.basis !== 'absolute') return false;
				const at = Date.parse(time.start);
				return at >= ms(item.draft.start) && at < endOf(index);
			});
			expect(inside.length, item.draft.name).toBeGreaterThanOrEqual(2);
		});
	});
});

describe('a story whose first page is dated by the install', () => {
	const FIXTURE_STORY: DemoStory = {
		scopes: [],
		scopeLinks: [],
		kinds: [],
		periods: [],
		traces: [
			{
				id: 'f.start',
				relation: 'actual',
				time: { type: 'year', value: 2023 },
				captured: '2023-01-01',
				contentKey: 'demo.trace.start',
				scopeIds: []
			},
			{
				id: 'f.later',
				relation: 'actual',
				time: { type: 'day', value: '2024-03-04' },
				captured: '2024-03-04',
				contentKey: 'demo.trace.start',
				scopeIds: []
			}
		],
		traceLinks: [],
		assessments: [],
		chapters: []
	};
	const FIXTURE: DemoStoryEntry = {
		...WATSON_STORY,
		id: 'fixture',
		manifestPrefix: 'fixture-v1',
		recordPrefix: 'fix-',
		timezone: 'Europe/Belgrade',
		captureTime: '21:00',
		startId: 'f.start',
		startAtInstall: true,
		load: async () => FIXTURE_STORY
	};
	const fixture = buildDemoSeed(
		{ locale: 'ru', capturedAt: CAPTURED_AT, entry: FIXTURE },
		FIXTURE_STORY
	);
	const draftOf = (id: string): Entry<'trace'>['draft'] => {
		const found = fixture.batch.entries.find(
			(item): item is Entry<'trace'> => item.type === 'trace' && item.id === id
		);
		if (!found) throw new Error(`missing ${id}`);
		return found.draft;
	};

	it("dates the entry's start record by the install day and instant, in the story's zone", () => {
		// 2026-09-19T10:00Z is 12:00 in Belgrade: the same day there, whatever zone the browser is in.
		expect(draftOf('fix-f-start')).toMatchObject({
			capturedAt: CAPTURED_AT,
			timezone: 'Europe/Belgrade',
			aboutKind: 'instant',
			aboutTime: {
				basis: 'absolute',
				precision: 'day',
				certainty: 'exact',
				start: '2026-09-19',
				end: null
			}
		});
	});

	it('leaves every other record of that story on its own date and wall-clock hour', () => {
		expect(draftOf('fix-f-later')).toMatchObject({
			// 21:00 in Belgrade on a March day before the change of clocks is 20:00 UTC.
			capturedAt: '2024-03-04T20:00:00.000Z',
			aboutTime: { basis: 'absolute', precision: 'day', start: '2024-03-04' }
		});
	});

	it("writes the seed into the entry's own space under the entry's own manifest", () => {
		expect(fixture.manifestId).toBe('fixture-v1:ru');
		expect(fixture.batch.manifestId).toBe('fixture-v1:ru');
		expect(fixture.batch.targetDataSpaceId).toBe(FIXTURE.dataSpaceId);
	});

	it('keeps a story without the flag on the dates written in its own file', () => {
		expect(WATSON_STORY.startAtInstall).toBe(false);
		expect(trace('w.start').draft.capturedAt).toBe('1894-05-01T12:00:00.000Z');
		expect(trace('w.start').draft.capturedAt).not.toBe(CAPTURED_AT);
	});
});
