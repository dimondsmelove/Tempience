import { describe, expect, it } from 'vitest';
import type { ScenarioImportEntry } from '$lib/state/triplit/scenario-import-repository';
import {
	assertTraceData,
	assertTraceFormDefinition
} from '$lib/state/triplit/trace-kind-v-validation';
import { assertTraceTemporalPlacement, parseTraceAboutTime } from '$lib/state/triplit/trace-time';
import ruDemoAnya from '$lib/state/Locale/messages/ru/demo-anya.json';
import { buildDemoSeed, demoRecordId as recordIdOf } from './batch';
import { ANYA_STORY_ENTRY } from './registry';
import {
	ANYA_ASSESSMENTS,
	ANYA_KINDS,
	ANYA_PERIODS,
	ANYA_SCOPES,
	ANYA_SCOPE_LINKS,
	ANYA_STORY,
	ANYA_TRACES,
	ANYA_TRACE_LINKS
} from './story-anya';

type Entry<T extends ScenarioImportEntry['type']> = Extract<ScenarioImportEntry, { type: T }>;

const CAPTURED_AT = '2026-09-21T10:00:00.000Z';
const seed = buildDemoSeed(
	{ locale: 'ru', capturedAt: CAPTURED_AT, entry: ANYA_STORY_ENTRY },
	ANYA_STORY
);
const demoRecordId = (storyId: string): string => recordIdOf(ANYA_STORY_ENTRY, storyId);
const of = <T extends ScenarioImportEntry['type']>(type: T): Entry<T>[] =>
	seed.batch.entries.filter((entry): entry is Entry<T> => entry.type === type);
const scopes = of('scope');
const traces = of('trace');
const periods = of('period');
const links = of('intersection');
const scopeIds = new Set(scopes.map((entry) => entry.id));
const traceIds = new Set(traces.map((entry) => entry.id));
const trace = (storyId: string): Entry<'trace'> => {
	const found = traces.find((entry) => entry.id === demoRecordId(storyId));
	if (!found) throw new Error(`missing ${storyId}`);
	return found;
};
const byKind = (kind: string) => links.filter((entry) => entry.draft.kind === kind);

// The 8 records the owner allows vague time on: month, season or unknown.
const VAGUE_TIME_IDS = [
	't.plan-move',
	't.plan-vnz',
	't.maxim-jan',
	't.maxim-spring-i',
	't.maxim-summer-i',
	't.mama-next',
	't.zemun-q',
	't.not-final'
];
// The 2 records the owner allows relative time on.
const RELATIVE_TIME_IDS = ['t.wait', 't.step-blood'];
// Intentions with no distant target: the skeleton keeps their own arising day for both the
// TIME (an absolute day) and CAPTURED — captured equals the time's day exactly, not earlier.
const DATED_BY_ARISING_IDS = [
	't.get-vnz',
	't.step-card',
	't.step-ip',
	't.step-visarun',
	't.step-bank',
	't.step-submit',
	't.step-chip',
	't.find-dentist',
	't.gym',
	't.pmz-list',
	't.pmz-cert'
];
// Intentions with an interval target and no separate arising day: captured equals the interval's
// first day, for the same reason as the day-precision ones above.
const DATED_BY_ARISING_INTERVAL_IDS = ['t.course', 't.autotests'];

describe('demo story: Anya — structure', () => {
	it('holds the whole notebook: 32 Scope, 5 Kind, 25 Period, 207 Trace, 27 assessments', () => {
		// The skeleton's own "Итоги" summary undercounts several totals (Расход 12 vs 10 authored,
		// Продажа 7 vs 6, Визит 15 vs 14, Записей ~213 vs 207, Намерений 33 vs 37, Оценок 24 vs 27):
		// every one of those figures is a rough paragraph, not the per-row "Записи" table, which is
		// the actual contract. This test asserts the exact counts the per-row table produces.
		expect(ANYA_SCOPES).toHaveLength(32);
		expect(ANYA_KINDS).toHaveLength(5);
		expect(ANYA_PERIODS).toHaveLength(25);
		expect(ANYA_TRACES).toHaveLength(207);
		expect(new Set(ANYA_TRACES.map((t) => t.id)).size).toBe(207);
		expect(ANYA_ASSESSMENTS).toHaveLength(27);

		expect(scopes).toHaveLength(32);
		expect(traces).toHaveLength(207);
		expect(periods).toHaveLength(25);
		expect(seed.kinds).toHaveLength(5);
		expect(byKind('belongs_to')).toHaveLength(
			ANYA_STORY.traces.reduce((sum, item) => sum + item.scopeIds.length, 0)
		);
		expect(byKind('child_of')).toHaveLength(29); // every Scope but the 3 branch roots
		expect(
			links.filter((l) => l.draft.kind === 'related_to' && scopeIds.has(l.draft.fromId))
		).toHaveLength(7);
		expect(
			links.filter((l) => l.draft.kind === 'related_to' && traceIds.has(l.draft.fromId))
		).toHaveLength(13);
		expect(byKind('part_of')).toHaveLength(10);
		expect(byKind('evidence_for')).toHaveLength(27);
		expect(byKind('revisits')).toHaveLength(12);
	});

	it('ids are unique; every link, assessment and Kind membership resolves', () => {
		const allIds = [
			...ANYA_SCOPES.map((s) => s.id),
			...ANYA_KINDS.map((k) => k.id),
			...ANYA_PERIODS.map((p) => p.id),
			...ANYA_TRACES.map((t) => t.id)
		];
		expect(new Set(allIds).size).toBe(allIds.length);

		const traceStoryIds = new Set(ANYA_TRACES.map((t) => t.id));
		const scopeStoryIds = new Set(ANYA_SCOPES.map((s) => s.id));
		for (const scope of ANYA_SCOPES) {
			if (scope.parentId) expect(scopeStoryIds.has(scope.parentId), scope.id).toBe(true);
		}
		for (const link of ANYA_SCOPE_LINKS) {
			expect(scopeStoryIds.has(link.fromId), link.fromId).toBe(true);
			expect(scopeStoryIds.has(link.toId), link.toId).toBe(true);
		}
		for (const link of ANYA_TRACE_LINKS) {
			expect(traceStoryIds.has(link.fromId), `${link.kind} ${link.fromId}`).toBe(true);
			expect(traceStoryIds.has(link.toId), `${link.kind} ${link.toId}`).toBe(true);
		}
		for (const trace_ of ANYA_TRACES) {
			for (const scopeId of trace_.scopeIds) expect(scopeStoryIds.has(scopeId), scopeId).toBe(true);
			if (trace_.time.type === 'relative') expect(traceStoryIds.has(trace_.time.anchor)).toBe(true);
		}
		const kindStoryIds = new Set(ANYA_KINDS.map((k) => k.id));
		for (const trace_ of ANYA_TRACES) {
			if (trace_.kind) expect(kindStoryIds.has(trace_.kind.id), trace_.id).toBe(true);
		}
		for (const kind of ANYA_KINDS) {
			for (const scopeId of kind.scopeIds) expect(scopeStoryIds.has(scopeId), scopeId).toBe(true);
		}

		// Every assessment has a matching evidence_for link, and every intention it targets is
		// addressed only once.
		const evidenceLinks = new Set(
			ANYA_TRACE_LINKS.filter((l) => l.kind === 'evidence_for').map((l) => `${l.fromId}>${l.toId}`)
		);
		for (const a of ANYA_ASSESSMENTS) {
			expect(
				evidenceLinks.has(`${a.factId}>${a.intentionId}`),
				`${a.factId}>${a.intentionId}`
			).toBe(true);
			expect(traceStoryIds.has(a.factId)).toBe(true);
			expect(traceStoryIds.has(a.intentionId)).toBe(true);
		}
		expect(new Set(ANYA_ASSESSMENTS.map((a) => `${a.factId}>${a.intentionId}`)).size).toBe(
			ANYA_ASSESSMENTS.length
		);

		// t.papers-q and t.ticket-home deliberately have no link at all.
		for (const id of ['t.papers-q', 't.ticket-home']) {
			const involved = ANYA_TRACE_LINKS.some((l) => l.fromId === id || l.toId === id);
			expect(involved, id).toBe(false);
		}

		// Open intentions (marked «открыто» in the skeleton) have no assessment.
		const OPEN_IDS = [
			't.not-final',
			't.gym',
			't.zemun-q',
			't.pmz',
			't.pmz-list',
			't.pmz-cert',
			't.crown-check',
			't.workshop-2',
			't.market-3',
			't.mama-next'
		];
		expect(OPEN_IDS).toHaveLength(10);
		const assessedIntentions = new Set(ANYA_ASSESSMENTS.map((a) => a.intentionId));
		for (const id of OPEN_IDS) expect(assessedIntentions.has(id), id).toBe(false);
	});

	it("every typed record's data keys equal its Kind's field keys", () => {
		const fieldKeysByKind = new Map(
			ANYA_KINDS.map((k) => [k.id, new Set(k.fields.map((f) => f.key))])
		);
		for (const trace_ of ANYA_TRACES) {
			if (!trace_.kind) continue;
			const expected = fieldKeysByKind.get(trace_.kind.id);
			expect(expected, trace_.id).toBeDefined();
			const actualKeys = Object.keys(trace_.kind.data);
			expect(new Set(actualKeys), trace_.id).toEqual(expected);
		}
	});

	it('every referenced message key exists in ru/demo-anya.json, is non-empty, and no key is unused', () => {
		const referenced = new Set<string>();
		const add = (key: string | undefined) => {
			if (key) referenced.add(key);
		};
		for (const scope of ANYA_SCOPES) {
			add(scope.nameKey);
			add(scope.noteKey);
		}
		for (const kind of ANYA_KINDS) {
			add(kind.nameKey);
			for (const field of kind.fields) {
				add(field.titleKey);
				if (field.unit) add(field.unit.labelKey);
			}
		}
		for (const period of ANYA_PERIODS) add(period.noteKey);
		for (const trace_ of ANYA_TRACES) {
			add(trace_.contentKey);
			add(trace_.descriptionKey);
			if (trace_.kind) {
				for (const value of Object.values(trace_.kind.data)) {
					if (typeof value === 'object' && value !== null && 'key' in value) add(value.key);
				}
			}
		}
		const jsonKeys = new Set(Object.keys(ruDemoAnya));
		for (const key of referenced) {
			expect(jsonKeys.has(key), key).toBe(true);
			expect((ruDemoAnya as Record<string, string>)[key].trim().length, key).toBeGreaterThan(0);
		}
		for (const key of jsonKeys) {
			expect(referenced.has(key), key).toBe(true);
		}
		expect(referenced.size).toBe(jsonKeys.size);
	});
});

describe('demo story: Anya — time policy', () => {
	it('restricts vague and relative time to the ids the owner named', () => {
		const monthSeasonUnknown = ANYA_TRACES.filter((t) =>
			['month', 'season', 'unknown'].includes(t.time.type)
		).map((t) => t.id);
		expect(monthSeasonUnknown.toSorted()).toEqual([...VAGUE_TIME_IDS].toSorted());

		const relative = ANYA_TRACES.filter((t) => t.time.type === 'relative').map((t) => t.id);
		expect(relative.toSorted()).toEqual([...RELATIVE_TIME_IDS].toSorted());
	});

	it('every actual record is day, minute or a day interval, at exact certainty', () => {
		for (const trace_ of ANYA_TRACES) {
			if (trace_.relation !== 'actual') continue;
			expect(['day', 'minute', 'interval'].includes(trace_.time.type), trace_.id).toBe(true);
			if (trace_.time.type === 'interval') expect(trace_.time.precision, trace_.id).toBe('day');
			// No fact overrides certainty in the story data; the seed's own placement() then
			// defaults day/minute/interval certainty to 'exact'.
			if ('certainty' in trace_.time) expect(trace_.time.certainty, trace_.id).toBeUndefined();
		}
		for (const entry of traces) {
			const storyTrace = ANYA_TRACES.find((s) => demoRecordId(s.id) === entry.id)!;
			if (storyTrace.relation !== 'actual') continue;
			if (entry.draft.aboutTime?.basis === 'absolute') {
				expect(entry.draft.aboutTime.certainty, entry.id).toBe('exact');
			}
		}
	});

	it('every intention is `intend`, every fact is `actual`', () => {
		const relations = new Set(ANYA_TRACES.map((t) => t.relation));
		expect(relations).toEqual(new Set(['actual', 'intend']));
		expect(ANYA_TRACES.filter((t) => t.relation === 'intend')).toHaveLength(37);
		expect(ANYA_TRACES.filter((t) => t.relation === 'actual')).toHaveLength(170);
	});
});

describe('demo story: Anya — captured rule', () => {
	const dayOf = (value: string) => value.slice(0, 10);

	it('for every actual, captured is no earlier than the event day (interval: its start)', () => {
		for (const trace_ of ANYA_TRACES) {
			if (trace_.relation !== 'actual') continue;
			const capturedDay = dayOf(trace_.captured);
			const eventDay =
				trace_.time.type === 'interval'
					? trace_.time.start
					: trace_.time.type === 'minute' || trace_.time.type === 'day'
						? dayOf(trace_.time.value)
						: undefined;
			expect(eventDay, trace_.id).toBeDefined();
			expect(capturedDay >= (eventDay as string), trace_.id).toBe(true);
		}
	});

	it(
		'for every intend with an absolute day/minute time, captured is no later than the target; ' +
			'the dated-by-arising ids are captured exactly on the target day',
		() => {
			for (const trace_ of ANYA_TRACES) {
				if (trace_.relation !== 'intend') continue;
				if (trace_.time.type !== 'day') continue; // no intend in this story targets a minute
				const capturedDay = dayOf(trace_.captured);
				expect(capturedDay <= trace_.time.value, trace_.id).toBe(true);
				if (DATED_BY_ARISING_IDS.includes(trace_.id)) {
					expect(capturedDay, trace_.id).toBe(trace_.time.value);
				}
			}
			for (const trace_ of ANYA_TRACES) {
				if (trace_.relation !== 'intend' || trace_.time.type !== 'interval') continue;
				const capturedDay = dayOf(trace_.captured);
				expect(capturedDay <= trace_.time.start, trace_.id).toBe(true);
				if (DATED_BY_ARISING_INTERVAL_IDS.includes(trace_.id)) {
					expect(capturedDay, trace_.id).toBe(trace_.time.start);
				}
			}
		}
	);

	it('resolves both relative anchors, even where the anchor event is captured later', () => {
		// t.wait's anchor (t.submit) is captured before it, but t.step-blood's anchor (t.chip-done,
		// 2024-09-14) is captured two days AFTER t.step-blood itself (2024-09-12): the whole blood-test
		// plan was decided the same day as the chip step, ahead of the chip actually happening. A
		// relative time is a real forward plan, not necessarily anchored to something already past —
		// so this story does not assert anchor-captured-no-later as a blanket rule, only that both
		// anchors resolve to real records (checked in the "ids are unique" test above).
		expect(trace('t.wait').draft.aboutTime).toMatchObject({
			basis: 'relative',
			precision: 'day',
			anchorTraceId: demoRecordId('t.submit'),
			relation: 'after'
		});
		expect(trace('t.step-blood').draft.aboutTime).toMatchObject({
			basis: 'relative',
			precision: 'day',
			anchorTraceId: demoRecordId('t.chip-done'),
			relation: 'after'
		});
	});
});

describe('demo story: Anya — seed build', () => {
	it('builds a seed with no throw, storage-valid drafts, and a complete mapping', () => {
		const ids = new Set(seed.batch.entries.map((entry) => entry.id));
		expect(ids.size).toBe(seed.batch.entries.length);
		for (const entry of seed.batch.entries)
			expect(seed.batch.mapping[entry.candidateId]).toBe(entry.id);
		expect(Object.keys(seed.batch.mapping)).toHaveLength(seed.batch.entries.length);

		for (const entry of links) {
			expect(ids.has(entry.draft.fromId), entry.id).toBe(true);
			expect(ids.has(entry.draft.toId), entry.id).toBe(true);
			if (entry.draft.kind === 'belongs_to') {
				expect(traceIds.has(entry.draft.fromId)).toBe(true);
				expect(scopeIds.has(entry.draft.toId)).toBe(true);
			}
			if (entry.draft.kind === 'related_to') {
				expect(entry.draft.fromId.localeCompare(entry.draft.toId)).toBeLessThan(0);
			}
		}

		for (const entry of traces) {
			const time = parseTraceAboutTime(entry.draft.aboutTime);
			expect(() =>
				assertTraceTemporalPlacement(entry.draft.aboutKind, time, entry.draft.aboutTraceId ?? null)
			).not.toThrow();
			if (entry.draft.aboutTime?.basis === 'relative') {
				expect(traceIds.has(entry.draft.aboutTime.anchorTraceId), entry.id).toBe(true);
			}
			expect((entry.draft.kindId === null) === (entry.draft.kindVId === null)).toBe(true);
		}

		const kindVById = new Map(seed.kinds.map((k) => [k.initialKindV.id, k.initialKindV]));
		for (const kind of seed.kinds)
			expect(() => assertTraceFormDefinition(kind.initialKindV)).not.toThrow();
		const typedEntries = traces.filter((entry) => entry.draft.kindId !== null);
		expect(typedEntries).toHaveLength(63);
		for (const entry of typedEntries) {
			const kindV = kindVById.get(entry.draft.kindVId ?? '');
			expect(kindV, entry.id).toBeDefined();
			expect(() => assertTraceData(entry.draft.data, kindV!.dataSchema)).not.toThrow();
			expect(entry.draft.description, entry.id).toBeNull();
		}
		for (const entry of traces.filter((item) => item.draft.kindId === null)) {
			expect(entry.draft.content.trim().length, entry.id).toBeGreaterThan(0);
		}
		for (const entry of seed.batch.entries) {
			if (entry.type === 'scope') expect(entry.draft.name.trim()).not.toBe('');
			if (entry.type === 'period') {
				expect(entry.draft.name.trim()).not.toBe('');
				expect(entry.draft.note?.trim()).not.toBe('');
			}
		}

		expect(seed.manifestId).toBe('anya-v1:ru');
		expect(seed.batch.capturedAt).toBe(CAPTURED_AT);
		// t.start carries a placeholder day the seed's bootstrap replaces at install time.
		expect(trace('t.start').draft.aboutTime).toMatchObject({
			basis: 'absolute',
			start: '2026-09-21'
		});
	});
});

describe('demo story: Anya — zone and first page', () => {
	it('places every instant in Europe/Belgrade and writes a day record at 21:00 local', () => {
		// December is CET (UTC+1), October is CEST (UTC+2).
		expect(trace('t.talk').draft.capturedAt).toBe('2024-12-30T00:40:00.000Z');
		expect(trace('t.talk').draft.aboutTime).toMatchObject({
			basis: 'absolute',
			precision: 'minute',
			start: '2024-12-30T00:40:00.000Z'
		});
		expect(trace('t.tooth').draft.capturedAt).toBe('2024-10-09T19:40:00.000Z');
		expect(trace('t.arrive').draft.capturedAt).toBe('2023-09-09T19:00:00.000Z');
		for (const entry of traces) expect(entry.draft.timezone, entry.id).toBe('Europe/Belgrade');
	});

	it('dates «Начните отсюда» by the install day, not by the story file', () => {
		const start = trace('t.start');
		expect(start.draft.capturedAt).toBe(CAPTURED_AT);
		expect(start.draft.aboutTime).toMatchObject({
			basis: 'absolute',
			precision: 'day',
			start: '2026-09-21'
		});
		expect(seed.manifestId).toBe('anya-v1:ru');
		expect(seed.batch.targetDataSpaceId).toBe('demo-anya-v1');
		expect(start.id).toBe('anya-t-start');
	});
});
