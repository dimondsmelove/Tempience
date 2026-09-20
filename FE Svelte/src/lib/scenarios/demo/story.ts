import type { MessageKey } from '$lib/state/Locale/types';
import type { CanonicalTraceRelation } from '$lib/state/triplit/types';
import {
	DEMO_KIND_CASE_ID,
	DEMO_KIND_CASE_V_ID,
	DEMO_KIND_WIRE_ID,
	DEMO_KIND_WIRE_V_ID
} from './constants';
import type {
	DemoStory,
	StoryAssessment,
	StoryCaptured,
	StoryDate,
	StoryKind,
	StoryPeriod,
	StoryScope,
	StoryScopeLink,
	StoryTime,
	StoryTrace,
	StoryTraceLink,
	StoryValue
} from './types';

/**
 * «Записная книжка доктора Ватсона»: Watson's notes on the years with Holmes, 1880–1894, in
 * his own voice (our retelling; the canon is public domain). The spine is «The Hound of the
 * Baskervilles» (October 1889): an intention made of steps, wrong theories, evidence that
 * closes each step. Around it, the arc of the partnership: the meeting (1881), «The Speckled
 * Band» (April 1883), the evening Holmes named his brother (summer 1888), Reichenbach (May
 * 1891), the Great Hiatus (1891–1894, times unknown or approximate, from what Holmes said) and
 * the return (April 1894), which revisits the entry of 1891. Every date is absolute, London
 * time, 1880–1894: the legend of 1742 sits on the day Mortimer read it aloud, not in 1742.
 * Every record is dated by the event that caused it (an intention by the day it arose, a Case by
 * the day it closed) and knows only what Watson knew that day; `captured` carries the hour of
 * the reading order within a day, and the entries below follow that order. Texts are catalog
 * keys: the seed writes them in the language active at seed time.
 */

const day = (value: StoryDate): StoryTime => ({ type: 'day', value });
const aboutDay = (value: StoryDate): StoryTime => ({
	type: 'day',
	value,
	certainty: 'approximate'
});
const month = (value: string): StoryTime => ({ type: 'month', value });
const minute = (value: string): StoryTime => ({ type: 'minute', value });
const aboutMinute = (value: string): StoryTime => ({
	type: 'minute',
	value,
	certainty: 'approximate'
});
const unknown: StoryTime = { type: 'unknown' };
/** The local minute Watson wrote a record, when its day holds more than one. */
const captured = (day: StoryDate, time: string): StoryCaptured => `${day}T${time}`;

const plain = (
	id: string,
	relation: CanonicalTraceRelation,
	time: StoryTime,
	captured: StoryCaptured,
	scopeIds: readonly string[],
	contentKey: MessageKey,
	descriptionKey?: MessageKey
): StoryTrace => ({
	id,
	relation,
	time,
	captured,
	scopeIds,
	contentKey,
	...(descriptionKey ? { descriptionKey } : {})
});

const typed = (
	id: string,
	kindId: string,
	data: Readonly<Record<string, StoryValue>>,
	time: StoryTime,
	captured: StoryCaptured,
	scopeIds: readonly string[],
	contentKey?: MessageKey
): StoryTrace => ({
	id,
	relation: 'actual',
	time,
	captured,
	scopeIds,
	kind: { id: kindId, data },
	...(contentKey ? { contentKey } : {})
});

export const STORY_SCOPES: readonly StoryScope[] = [
	{
		id: 's.people',
		nameKey: 'demo.scope.people',
		colour: { hue: 35, chroma: 55, depth: 0 }
	},
	{
		id: 's.holmes',
		nameKey: 'demo.scope.holmes',
		noteKey: 'demo.scope.holmes.note',
		parentId: 's.people',
		colour: { hue: 265, chroma: 70, depth: 2 }
	},
	{
		id: 's.lestrade',
		nameKey: 'demo.scope.lestrade',
		noteKey: 'demo.scope.lestrade.note',
		parentId: 's.people',
		colour: { hue: 215, chroma: 45, depth: 1 }
	},
	{
		id: 's.moriarty',
		nameKey: 'demo.scope.moriarty',
		noteKey: 'demo.scope.moriarty.note',
		parentId: 's.people',
		colour: { hue: 350, chroma: 85, depth: 2 }
	},
	{
		id: 's.hudson',
		nameKey: 'demo.scope.hudson',
		noteKey: 'demo.scope.hudson.note',
		parentId: 's.people',
		colour: { hue: 30, chroma: 40, depth: 0 }
	},
	{
		id: 's.mycroft',
		nameKey: 'demo.scope.mycroft',
		noteKey: 'demo.scope.mycroft.note',
		parentId: 's.people',
		colour: { hue: 260, chroma: 25, depth: 1 }
	},
	{
		id: 's.places',
		nameKey: 'demo.scope.places',
		colour: { hue: 95, chroma: 35, depth: 0 }
	},
	{
		id: 's.baker',
		nameKey: 'demo.scope.baker',
		noteKey: 'demo.scope.baker.note',
		parentId: 's.places',
		colour: { hue: 42, chroma: 75, depth: 1 }
	},
	{
		id: 's.hall',
		nameKey: 'demo.scope.hall',
		noteKey: 'demo.scope.hall.note',
		parentId: 's.places',
		colour: { hue: 140, chroma: 45, depth: 2 }
	},
	{
		id: 's.mire',
		nameKey: 'demo.scope.mire',
		noteKey: 'demo.scope.mire.note',
		parentId: 's.places',
		colour: { hue: 80, chroma: 50, depth: 2 }
	},
	{
		id: 's.reichenbach',
		nameKey: 'demo.scope.reichenbach',
		noteKey: 'demo.scope.reichenbach.note',
		parentId: 's.places',
		colour: { hue: 195, chroma: 50, depth: 1 }
	},
	{
		id: 's.cases',
		nameKey: 'demo.scope.cases',
		noteKey: 'demo.scope.cases.note',
		colour: { hue: 10, chroma: 55, depth: 0 }
	},
	{
		id: 's.scarlet',
		nameKey: 'demo.scope.scarlet',
		noteKey: 'demo.scope.scarlet.note',
		parentId: 's.cases',
		colour: { hue: 0, chroma: 90, depth: 1 }
	},
	{
		id: 's.band',
		nameKey: 'demo.scope.band',
		noteKey: 'demo.scope.band.note',
		parentId: 's.cases',
		colour: { hue: 50, chroma: 75, depth: 2 }
	},
	{
		id: 's.hound',
		nameKey: 'demo.scope.hound',
		noteKey: 'demo.scope.hound.note',
		parentId: 's.cases',
		colour: { hue: 160, chroma: 90, depth: 1 }
	},
	{
		id: 's.final',
		nameKey: 'demo.scope.final',
		noteKey: 'demo.scope.final.note',
		parentId: 's.cases',
		colour: { hue: 220, chroma: 20, depth: 2 }
	},
	{
		id: 's.practice',
		nameKey: 'demo.scope.practice',
		noteKey: 'demo.scope.practice.note',
		colour: { hue: 180, chroma: 25, depth: 0 }
	}
];

export const STORY_SCOPE_LINKS: readonly StoryScopeLink[] = [
	{ kind: 'related_to', fromId: 's.moriarty', toId: 's.reichenbach' },
	{ kind: 'related_to', fromId: 's.hall', toId: 's.mire' },
	{ kind: 'related_to', fromId: 's.holmes', toId: 's.baker' }
];

export const STORY_KINDS: readonly StoryKind[] = [
	{
		id: DEMO_KIND_CASE_ID,
		kindVId: DEMO_KIND_CASE_V_ID,
		nameKey: 'demo.kind.case',
		fields: [
			{ key: 'client', type: 'string', titleKey: 'demo.kind.case.client' },
			{
				key: 'fee',
				type: 'number',
				titleKey: 'demo.kind.case.fee',
				unit: { id: 'gbp', labelKey: 'demo.kind.case.fee.unit' }
			},
			{ key: 'days', type: 'integer', titleKey: 'demo.kind.case.days' }
		],
		scopeIds: ['s.cases']
	},
	{
		id: DEMO_KIND_WIRE_ID,
		kindVId: DEMO_KIND_WIRE_V_ID,
		nameKey: 'demo.kind.wire',
		fields: [
			{ key: 'to', type: 'string', titleKey: 'demo.kind.wire.to' },
			{ key: 'words', type: 'integer', titleKey: 'demo.kind.wire.words' },
			{
				key: 'pence',
				type: 'integer',
				titleKey: 'demo.kind.wire.pence',
				unit: { id: 'pence', labelKey: 'demo.kind.wire.pence.unit' }
			}
		],
		scopeIds: ['s.holmes']
	}
];

export const STORY_PERIODS: readonly StoryPeriod[] = [
	{ id: 'p.1880s', unit: 'decade', year: 1880, noteKey: 'demo.period.1880s.note' },
	{ id: 'p.1881', unit: 'year', year: 1881, noteKey: 'demo.period.1881.note' },
	{ id: 'p.1883-04', unit: 'month', year: 1883, month: 4, noteKey: 'demo.period.1883-04.note' },
	{ id: 'p.1889-10', unit: 'month', year: 1889, month: 10, noteKey: 'demo.period.1889-10.note' },
	{ id: 'p.1891', unit: 'year', year: 1891, noteKey: 'demo.period.1891.note' },
	{ id: 'p.1894', unit: 'year', year: 1894, noteKey: 'demo.period.1894.note' }
];

/** The morning the chapters of the Great Hiatus were written down, from what Holmes told. */
const HIATUS_CAPTURED = captured('1894-04-06', '10:00');

export const STORY_TRACES: readonly StoryTrace[] = [
	// Старт
	plain(
		'w.start',
		'actual',
		month('1881-01'),
		'1894-05-01',
		['s.baker'],
		'demo.trace.start',
		'demo.trace.start.desc'
	),
	// 1881 — Знакомство
	plain(
		'w.afghan',
		'actual',
		month('1880-11'),
		'1880-11-26',
		['s.practice'],
		'demo.trace.afghan',
		'demo.trace.afghan.desc'
	),
	plain(
		'w.stamford',
		'actual',
		month('1881-01'),
		captured('1881-01-04', '12:00'),
		['s.holmes'],
		'demo.trace.stamford',
		'demo.trace.stamford.desc'
	),
	plain(
		'w.meet',
		'actual',
		month('1881-01'),
		captured('1881-01-04', '14:00'),
		['s.holmes', 's.scarlet'],
		'demo.trace.meet',
		'demo.trace.meet.desc'
	),
	plain(
		'w.rooms',
		'actual',
		month('1881-01'),
		captured('1881-01-05', '12:00'),
		['s.baker', 's.hudson'],
		'demo.trace.rooms',
		'demo.trace.rooms.desc'
	),
	plain(
		'w.list',
		'actual',
		{ type: 'relative', anchor: 'w.rooms', precision: 'unknown', relation: 'after' },
		captured('1881-01-12', '12:00'),
		['s.holmes'],
		'demo.trace.list',
		'demo.trace.list.desc'
	),
	plain(
		'w.gregson',
		'actual',
		day('1881-03-04'),
		captured('1881-03-04', '09:00'),
		['s.scarlet', 's.lestrade'],
		'demo.trace.gregson',
		'demo.trace.gregson.desc'
	),
	plain(
		'w.scarlet.intent',
		'intend',
		aboutDay('1881-03-04'),
		captured('1881-03-04', '14:00'),
		['s.scarlet', 's.lestrade'],
		'demo.trace.scarlet.intent',
		'demo.trace.scarlet.intent.desc'
	),
	plain(
		'w.hope',
		'actual',
		aboutDay('1881-03-07'),
		captured('1881-03-07', '12:00'),
		['s.scarlet', 's.baker'],
		'demo.trace.hope',
		'demo.trace.hope.desc'
	),
	typed(
		'w.scarlet.case',
		DEMO_KIND_CASE_ID,
		{ client: { key: 'demo.trace.scarlet.case.client' }, fee: 0, days: 3 },
		day('1881-03-07'),
		captured('1881-03-07', '15:00'),
		['s.scarlet'],
		'demo.trace.scarlet.case'
	),
	// Апрель 1883 — Пёстрая лента
	plain(
		'w.stoner',
		'actual',
		aboutMinute('1883-04-04T07:15'),
		captured('1883-04-04', '08:00'),
		['s.band'],
		'demo.trace.stoner',
		'demo.trace.stoner.desc'
	),
	plain(
		'w.band.intent',
		'intend',
		aboutDay('1883-04-04'),
		captured('1883-04-04', '08:30'),
		['s.band'],
		'demo.trace.band.intent',
		'demo.trace.band.intent.desc'
	),
	plain(
		'w.roylott',
		'actual',
		aboutMinute('1883-04-04T09:00'),
		captured('1883-04-04', '09:30'),
		['s.band'],
		'demo.trace.roylott',
		'demo.trace.roylott.desc'
	),
	plain(
		'w.stoke',
		'actual',
		day('1883-04-04'),
		captured('1883-04-04', '16:00'),
		['s.band'],
		'demo.trace.stoke',
		'demo.trace.stoke.desc'
	),
	plain(
		'w.vigil',
		'actual',
		{
			type: 'interval',
			precision: 'minute',
			start: '1883-04-04T23:00',
			end: '1883-04-05T03:30',
			certainty: 'approximate'
		},
		captured('1883-04-04', '22:30'),
		['s.band'],
		'demo.trace.vigil',
		'demo.trace.vigil.desc'
	),
	plain(
		'w.whistle',
		'actual',
		minute('1883-04-05T03:00'),
		captured('1883-04-05', '06:00'),
		['s.band', 's.holmes'],
		'demo.trace.whistle',
		'demo.trace.whistle.desc'
	),
	typed(
		'w.band.case',
		DEMO_KIND_CASE_ID,
		{ client: { key: 'demo.trace.band.case.client' }, fee: 0, days: 2 },
		day('1883-04-05'),
		captured('1883-04-05', '10:00'),
		['s.band'],
		'demo.trace.band.case'
	),
	// 1888 — Майкрофт
	plain(
		'w.mycroft.meet',
		'actual',
		month('1888-07'),
		'1888-07-14',
		['s.mycroft', 's.holmes'],
		'demo.trace.mycroft.meet',
		'demo.trace.mycroft.meet.desc'
	),
	// Октябрь 1889 — Собака Баскервилей
	plain(
		'w.mortimer',
		'actual',
		month('1889-09'),
		captured('1889-09-26', '12:00'),
		['s.hound', 's.baker'],
		'demo.trace.mortimer',
		'demo.trace.mortimer.desc'
	),
	plain(
		'w.legend',
		'actual',
		month('1889-09'),
		captured('1889-09-26', '13:00'),
		['s.hound', 's.hall'],
		'demo.trace.legend',
		'demo.trace.legend.desc'
	),
	plain(
		'w.charles',
		'actual',
		month('1889-06'),
		captured('1889-09-26', '13:30'),
		['s.hall', 's.hound'],
		'demo.trace.charles',
		'demo.trace.charles.desc'
	),
	plain(
		'w.hound.intent',
		'intend',
		aboutDay('1889-09-26'),
		captured('1889-09-26', '18:00'),
		['s.hound'],
		'demo.trace.hound.intent',
		'demo.trace.hound.intent.desc'
	),
	plain(
		'w.henry',
		'actual',
		aboutDay('1889-09-27'),
		captured('1889-09-27', '10:30'),
		['s.hound', 's.baker'],
		'demo.trace.henry',
		'demo.trace.henry.desc'
	),
	plain(
		'w.letter',
		'actual',
		aboutDay('1889-09-27'),
		captured('1889-09-27', '11:00'),
		['s.hound'],
		'demo.trace.letter',
		'demo.trace.letter.desc'
	),
	plain(
		'w.boots',
		'actual',
		aboutDay('1889-09-28'),
		captured('1889-09-28', '10:00'),
		['s.hound'],
		'demo.trace.boots',
		'demo.trace.boots.desc'
	),
	plain(
		'w.cab',
		'actual',
		aboutDay('1889-09-28'),
		captured('1889-09-28', '12:00'),
		['s.hound'],
		'demo.trace.cab',
		'demo.trace.cab.desc'
	),
	typed(
		'w.wire.1',
		DEMO_KIND_WIRE_ID,
		{ to: { key: 'demo.trace.wire.1.to' }, words: 12, pence: 6 },
		day('1889-09-28'),
		captured('1889-09-28', '13:00'),
		['s.holmes', 's.hound'],
		'demo.trace.wire.1'
	),
	plain(
		'w.step.boot',
		'intend',
		aboutDay('1889-09-28'),
		captured('1889-09-28', '14:00'),
		['s.hound'],
		'demo.trace.step.boot',
		'demo.trace.step.boot.desc'
	),
	plain(
		'w.step.barrymore',
		'intend',
		aboutDay('1889-09-28'),
		captured('1889-09-28', '18:00'),
		['s.hound', 's.hall'],
		'demo.trace.step.barrymore',
		'demo.trace.step.barrymore.desc'
	),
	plain(
		'w.paddington',
		'actual',
		aboutMinute('1889-10-01T10:30'),
		captured('1889-10-01', '10:30'),
		['s.hound'],
		'demo.trace.paddington',
		'demo.trace.paddington.desc'
	),
	plain(
		'w.hall.arrive',
		'actual',
		aboutDay('1889-10-01'),
		captured('1889-10-01', '22:00'),
		['s.hall'],
		'demo.trace.hall.arrive',
		'demo.trace.hall.arrive.desc'
	),
	plain(
		'w.step.convict',
		'intend',
		aboutDay('1889-10-01'),
		captured('1889-10-01', '23:00'),
		['s.hound', 's.mire'],
		'demo.trace.step.convict',
		'demo.trace.step.convict.desc'
	),
	plain(
		'w.stapleton.meet',
		'actual',
		aboutDay('1889-10-03'),
		captured('1889-10-03', '15:00'),
		['s.mire', 's.hound'],
		'demo.trace.stapleton.meet',
		'demo.trace.stapleton.meet.desc'
	),
	plain(
		'w.step.stapleton',
		'intend',
		aboutDay('1889-10-04'),
		captured('1889-10-04', '09:00'),
		['s.hound'],
		'demo.trace.step.stapleton',
		'demo.trace.step.stapleton.desc'
	),
	plain(
		'w.hyp.barrymore',
		'actual',
		aboutDay('1889-10-12'),
		captured('1889-10-12', '08:00'),
		['s.hound', 's.hall'],
		'demo.trace.hyp.barrymore',
		'demo.trace.hyp.barrymore.desc'
	),
	plain(
		'w.report1',
		'actual',
		day('1889-10-13'),
		captured('1889-10-13', '20:00'),
		['s.hall', 's.hound'],
		'demo.trace.report1',
		'demo.trace.report1.desc'
	),
	plain(
		'w.light',
		'actual',
		day('1889-10-14'),
		captured('1889-10-14', '23:00'),
		['s.hall', 's.mire'],
		'demo.trace.light',
		'demo.trace.light.desc'
	),
	plain(
		'w.report2',
		'actual',
		day('1889-10-15'),
		captured('1889-10-15', '20:00'),
		['s.hall', 's.mire'],
		'demo.trace.report2',
		'demo.trace.report2.desc'
	),
	plain(
		'w.step.tor',
		'intend',
		aboutDay('1889-10-15'),
		captured('1889-10-15', '21:00'),
		['s.hound', 's.mire'],
		'demo.trace.step.tor',
		'demo.trace.step.tor.desc'
	),
	plain(
		'w.diary16',
		'actual',
		day('1889-10-16'),
		captured('1889-10-16', '21:00'),
		['s.mire'],
		'demo.trace.diary16',
		'demo.trace.diary16.desc'
	),
	plain(
		'w.hut',
		'actual',
		day('1889-10-17'),
		captured('1889-10-17', '18:00'),
		['s.mire', 's.holmes'],
		'demo.trace.hut',
		'demo.trace.hut.desc'
	),
	plain(
		'w.selden',
		'actual',
		day('1889-10-17'),
		captured('1889-10-17', '23:00'),
		['s.mire'],
		'demo.trace.selden',
		'demo.trace.selden.desc'
	),
	typed(
		'w.wire.2',
		DEMO_KIND_WIRE_ID,
		{ to: { key: 'demo.trace.wire.2.to' }, words: 9, pence: 5 },
		day('1889-10-18'),
		captured('1889-10-18', '12:00'),
		['s.holmes', 's.lestrade'],
		'demo.trace.wire.2'
	),
	plain(
		'w.portrait',
		'actual',
		day('1889-10-18'),
		captured('1889-10-18', '22:00'),
		['s.hall'],
		'demo.trace.portrait',
		'demo.trace.portrait.desc'
	),
	plain(
		'w.step.night',
		'intend',
		aboutDay('1889-10-19'),
		captured('1889-10-18', '23:00'),
		['s.hound', 's.mire'],
		'demo.trace.step.night',
		'demo.trace.step.night.desc'
	),
	plain(
		'w.lyons',
		'actual',
		day('1889-10-19'),
		captured('1889-10-19', '11:00'),
		['s.hound'],
		'demo.trace.lyons',
		'demo.trace.lyons.desc'
	),
	plain(
		'w.night',
		'actual',
		day('1889-10-19'),
		captured('1889-10-20', '01:00'),
		['s.mire', 's.hound'],
		'demo.trace.night',
		'demo.trace.night.desc'
	),
	plain(
		'w.boot.answer',
		'actual',
		day('1889-10-20'),
		captured('1889-10-20', '10:00'),
		['s.hound'],
		'demo.trace.boot.answer',
		'demo.trace.boot.answer.desc'
	),
	plain(
		'w.hound.answer',
		'actual',
		day('1889-10-20'),
		captured('1889-10-20', '10:30'),
		['s.hound', 's.hall'],
		'demo.trace.hound.answer',
		'demo.trace.hound.answer.desc'
	),
	plain(
		'w.revisit.barrymore',
		'actual',
		day('1889-10-20'),
		captured('1889-10-20', '11:00'),
		['s.hound'],
		'demo.trace.revisit.barrymore',
		'demo.trace.revisit.barrymore.desc'
	),
	typed(
		'w.hound.case',
		DEMO_KIND_CASE_ID,
		{ client: { key: 'demo.trace.hound.case.client' }, fee: 500, days: 24 },
		day('1889-10-20'),
		captured('1889-10-20', '12:00'),
		['s.hound'],
		'demo.trace.hound.case'
	),
	// The one intention the story never closes: the mire keeps its own.
	plain(
		'w.mire.search',
		'intend',
		aboutDay('1889-10-20'),
		captured('1889-10-20', '13:00'),
		['s.mire', 's.hound'],
		'demo.trace.mire.search',
		'demo.trace.mire.search.desc'
	),
	// 1890 — мостик между Дартмуром и Мориарти
	plain(
		'w.married',
		'actual',
		month('1890-06'),
		captured('1890-06-15', '12:00'),
		['s.practice'],
		'demo.trace.married',
		'demo.trace.married.desc'
	),
	// 1891 — Последнее дело
	plain(
		'w.moriarty',
		'actual',
		day('1891-04-24'),
		captured('1891-04-24', '21:00'),
		['s.final', 's.moriarty', 's.practice'],
		'demo.trace.moriarty',
		'demo.trace.moriarty.desc'
	),
	plain(
		'w.moriarty.who',
		'actual',
		day('1891-04-24'),
		captured('1891-04-24', '22:00'),
		['s.moriarty', 's.final'],
		'demo.trace.moriarty.who',
		'demo.trace.moriarty.who.desc'
	),
	plain(
		'w.flight',
		'actual',
		{ type: 'interval', precision: 'day', start: '1891-04-25', end: '1891-05-03' },
		captured('1891-05-03', '21:00'),
		['s.final'],
		'demo.trace.flight',
		'demo.trace.flight.desc'
	),
	plain(
		'w.final',
		'actual',
		day('1891-05-04'),
		captured('1891-05-04', '22:00'),
		['s.reichenbach', 's.final', 's.holmes'],
		'demo.trace.final',
		'demo.trace.final.desc'
	),
	plain(
		'w.practice.91',
		'actual',
		month('1891-09'),
		'1891-09-15',
		['s.practice'],
		'demo.trace.practice.91',
		'demo.trace.practice.91.desc'
	),
	plain(
		'w.published',
		'actual',
		month('1893-12'),
		'1893-12-15',
		['s.final', 's.practice'],
		'demo.trace.published',
		'demo.trace.published.desc'
	),
	// Апрель 1894 — Пустой дом
	plain(
		'w.adair',
		'actual',
		day('1894-03-30'),
		captured('1894-03-31', '09:00'),
		['s.cases'],
		'demo.trace.adair',
		'demo.trace.adair.desc'
	),
	plain(
		'w.bookseller',
		'actual',
		aboutDay('1894-04-05'),
		captured('1894-04-05', '20:00'),
		['s.holmes', 's.baker'],
		'demo.trace.bookseller',
		'demo.trace.bookseller.desc'
	),
	plain(
		'w.return',
		'actual',
		aboutDay('1894-04-05'),
		captured('1894-04-05', '21:00'),
		['s.holmes', 's.final'],
		'demo.trace.return',
		'demo.trace.return.desc'
	),
	plain(
		'w.moran.who',
		'actual',
		aboutDay('1894-04-05'),
		captured('1894-04-05', '21:30'),
		['s.baker', 's.holmes'],
		'demo.trace.moran.who',
		'demo.trace.moran.who.desc'
	),
	plain(
		'w.moran.intent',
		'intend',
		aboutDay('1894-04-05'),
		captured('1894-04-05', '21:45'),
		['s.cases', 's.baker'],
		'demo.trace.moran.intent',
		'demo.trace.moran.intent.desc'
	),
	plain(
		'w.bust',
		'actual',
		day('1894-04-05'),
		captured('1894-04-05', '22:00'),
		['s.baker', 's.hudson'],
		'demo.trace.bust',
		'demo.trace.bust.desc'
	),
	plain(
		'w.moran',
		'actual',
		aboutMinute('1894-04-05T23:30'),
		captured('1894-04-06', '00:30'),
		['s.baker', 's.lestrade', 's.holmes'],
		'demo.trace.moran',
		'demo.trace.moran.desc'
	),
	typed(
		'w.empty.case',
		DEMO_KIND_CASE_ID,
		{ client: { key: 'demo.trace.empty.case.client' }, fee: 0, days: 1 },
		day('1894-04-05'),
		captured('1894-04-06', '01:00'),
		['s.cases'],
		'demo.trace.empty.case'
	),
	// Великая пауза — со слов Холмса, written down the morning after the empty house
	plain(
		'w.hiatus.tibet',
		'actual',
		{ type: 'interval', precision: 'year', start: '1891', end: '1893', certainty: 'approximate' },
		HIATUS_CAPTURED,
		['s.holmes'],
		'demo.trace.hiatus.tibet',
		'demo.trace.hiatus.tibet.desc'
	),
	plain(
		'w.hiatus.persia',
		'actual',
		unknown,
		HIATUS_CAPTURED,
		['s.holmes'],
		'demo.trace.hiatus.persia',
		'demo.trace.hiatus.persia.desc'
	),
	plain(
		'w.hiatus.montpellier',
		'actual',
		month('1894-01'),
		HIATUS_CAPTURED,
		['s.holmes'],
		'demo.trace.hiatus.montpellier',
		'demo.trace.hiatus.montpellier.desc'
	),
	plain(
		'w.mycroft',
		'actual',
		{ type: 'relative', anchor: 'w.hiatus.tibet', precision: 'year', relation: 'during' },
		HIATUS_CAPTURED,
		['s.mycroft', 's.baker'],
		'demo.trace.mycroft',
		'demo.trace.mycroft.desc'
	),
	// Снова на Бейкер-стрит
	plain(
		'w.back',
		'actual',
		{ type: 'season', year: 1894, season: 'spring' },
		captured('1894-04-30', '12:00'),
		['s.practice', 's.baker'],
		'demo.trace.back',
		'demo.trace.back.desc'
	)
];

export const STORY_TRACE_LINKS: readonly StoryTraceLink[] = [
	// The preface's links are the table of contents.
	{ kind: 'related_to', fromId: 'w.start', toId: 'w.meet' },
	{ kind: 'related_to', fromId: 'w.start', toId: 'w.hound.intent' },
	{ kind: 'related_to', fromId: 'w.start', toId: 'w.final' },
	{ kind: 'related_to', fromId: 'w.start', toId: 'w.return' },
	// 1881
	{ kind: 'evidence_for', fromId: 'w.hope', toId: 'w.scarlet.intent' },
	// 1883
	{ kind: 'evidence_for', fromId: 'w.whistle', toId: 'w.band.intent' },
	// 1889: the intention's steps, the evidence that closes each, the theory revisited.
	{ kind: 'part_of', fromId: 'w.step.boot', toId: 'w.hound.intent' },
	{ kind: 'part_of', fromId: 'w.step.barrymore', toId: 'w.hound.intent' },
	{ kind: 'part_of', fromId: 'w.step.convict', toId: 'w.hound.intent' },
	{ kind: 'part_of', fromId: 'w.step.tor', toId: 'w.hound.intent' },
	{ kind: 'part_of', fromId: 'w.step.stapleton', toId: 'w.hound.intent' },
	{ kind: 'part_of', fromId: 'w.step.night', toId: 'w.hound.intent' },
	{ kind: 'evidence_for', fromId: 'w.light', toId: 'w.step.barrymore' },
	{ kind: 'evidence_for', fromId: 'w.hut', toId: 'w.step.tor' },
	{ kind: 'evidence_for', fromId: 'w.selden', toId: 'w.step.convict' },
	{ kind: 'evidence_for', fromId: 'w.portrait', toId: 'w.step.stapleton' },
	{ kind: 'evidence_for', fromId: 'w.boot.answer', toId: 'w.step.boot' },
	{ kind: 'evidence_for', fromId: 'w.night', toId: 'w.step.night' },
	{ kind: 'evidence_for', fromId: 'w.night', toId: 'w.hound.intent' },
	{ kind: 'evidence_for', fromId: 'w.hound.answer', toId: 'w.hound.intent' },
	{ kind: 'related_to', fromId: 'w.mire.search', toId: 'w.night' },
	{ kind: 'revisits', fromId: 'w.revisit.barrymore', toId: 'w.hyp.barrymore' },
	// 1891: the story in print, two years after the fall it tells.
	{ kind: 'related_to', fromId: 'w.published', toId: 'w.final' },
	// 1894
	{ kind: 'revisits', fromId: 'w.return', toId: 'w.final' },
	{ kind: 'related_to', fromId: 'w.moran.who', toId: 'w.moran.intent' },
	{ kind: 'evidence_for', fromId: 'w.moran', toId: 'w.moran.intent' }
];

const closed = (factId: string, intentionId: string): StoryAssessment => ({
	factId,
	intentionId,
	outcome: 'completed',
	open: false
});

/**
 * Watson's verdicts, one per `evidence_for` link: every intention he wrote a confirmation for
 * is completed and closed. `w.mire.search` has no evidence and stays open, as the story leaves it.
 */
export const STORY_ASSESSMENTS: readonly StoryAssessment[] = [
	closed('w.hope', 'w.scarlet.intent'),
	closed('w.whistle', 'w.band.intent'),
	closed('w.boot.answer', 'w.step.boot'),
	closed('w.light', 'w.step.barrymore'),
	closed('w.selden', 'w.step.convict'),
	closed('w.hut', 'w.step.tor'),
	closed('w.portrait', 'w.step.stapleton'),
	closed('w.night', 'w.step.night'),
	closed('w.night', 'w.hound.intent'),
	closed('w.hound.answer', 'w.hound.intent'),
	closed('w.moran', 'w.moran.intent')
];

export const DEMO_STORY: DemoStory = {
	scopes: STORY_SCOPES,
	scopeLinks: STORY_SCOPE_LINKS,
	kinds: STORY_KINDS,
	periods: STORY_PERIODS,
	traces: STORY_TRACES,
	traceLinks: STORY_TRACE_LINKS,
	assessments: STORY_ASSESSMENTS
};
