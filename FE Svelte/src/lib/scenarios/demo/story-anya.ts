import type { MessageKey } from '$lib/state/Locale/types';
import type { CanonicalTraceRelation, TraceRelativeTimeRelation } from '$lib/state/triplit/types';
import type {
	DemoStory,
	StoryAssessment,
	StoryCaptured,
	StoryChapter,
	StoryDate,
	StoryKind,
	StoryPeriod,
	StoryScope,
	StoryScopeLink,
	StorySeason,
	StoryTime,
	StoryTrace,
	StoryTraceLink,
	StoryValue
} from './types';

/**
 * «Записная книжка Ани»: a second demo notebook, in Russian only for now (English waits until the
 * Russian text is approved — see `en/index.ts`). Anya, born 2 March 1994, a QA engineer, moves
 * from Russia to Belgrade in September 2023; Maxim, her partner, stays behind to hand over his
 * studio and never arrives. The notebook runs May 2023 to September 2026 in Europe/Belgrade time
 * and is divided into six chapters by her state, not by the calendar: before the move,
 * adaptation, a plateau, a depression, a catharsis and a life of her own. Every record is written
 * to be read cold: its title says what moved, its note first gives the situation, then one detail;
 * hindsight lives only in chapter and period notes. Motifs run through `revisits`: the second
 * room, the key made for Maxim, the New Year nights, the anniversaries. Every fact (`actual`)
 * has an exact day, minute or day interval; every intention (`intend`) is dated by the day it
 * targets, and `captured` carries the earlier day it arose. Vague and relative time are used only
 * where life itself was vague. The synopsis `research/active/expat-demo-story.md` was the
 * starting point; this file is the story's source. `t.start` carries a placeholder day
 * (2026-09-21) and captured; the seed replaces both with the install day (registry flag
 * `startAtInstall`).
 */

const ANYA_KIND_TRANSFER_ID = 'anya-kind-transfer';
const ANYA_KIND_TRANSFER_V_ID = 'anya-kind-transfer-v1';
const ANYA_KIND_EXPENSE_ID = 'anya-kind-expense';
const ANYA_KIND_EXPENSE_V_ID = 'anya-kind-expense-v1';
const ANYA_KIND_VISIT_ID = 'anya-kind-visit';
const ANYA_KIND_VISIT_V_ID = 'anya-kind-visit-v1';
const ANYA_KIND_SALE_ID = 'anya-kind-sale';
const ANYA_KIND_SALE_V_ID = 'anya-kind-sale-v1';
const ANYA_KIND_CALL_ID = 'anya-kind-call';
const ANYA_KIND_CALL_V_ID = 'anya-kind-call-v1';

const day = (value: StoryDate): StoryTime => ({ type: 'day', value });
const month = (value: string): StoryTime => ({ type: 'month', value });
const season = (year: number, value: StorySeason): StoryTime => ({
	type: 'season',
	year,
	season: value
});
const minute = (value: string): StoryTime => ({ type: 'minute', value });
const interval = (precision: 'day', start: string, end: string): StoryTime => ({
	type: 'interval',
	precision,
	start,
	end
});
const relative = (
	anchor: string,
	relationValue: TraceRelativeTimeRelation,
	precision: 'day'
): StoryTime => ({ type: 'relative', anchor, precision, relation: relationValue });
const unknownTime: StoryTime = { type: 'unknown' };

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

export const ANYA_SCOPES: readonly StoryScope[] = [
	{
		id: 's.people',
		nameKey: 'demo.anya.scope.people',
		noteKey: 'demo.anya.scope.people.note',
		colour: { hue: 38, chroma: 50, depth: 0 }
	},
	{
		id: 's.maxim',
		nameKey: 'demo.anya.scope.maxim',
		noteKey: 'demo.anya.scope.maxim.note',
		parentId: 's.people',
		colour: { hue: 352, chroma: 65, depth: 2 }
	},
	{
		id: 's.lena',
		nameKey: 'demo.anya.scope.lena',
		noteKey: 'demo.anya.scope.lena.note',
		parentId: 's.people',
		colour: { hue: 18, chroma: 60, depth: 2 }
	},
	{
		id: 's.mama',
		nameKey: 'demo.anya.scope.mama',
		noteKey: 'demo.anya.scope.mama.note',
		parentId: 's.people',
		colour: { hue: 48, chroma: 55, depth: 1 }
	},
	{
		id: 's.jovana',
		nameKey: 'demo.anya.scope.jovana',
		noteKey: 'demo.anya.scope.jovana.note',
		parentId: 's.people',
		colour: { hue: 58, chroma: 50, depth: 1 }
	},
	{
		id: 's.milos',
		nameKey: 'demo.anya.scope.milos',
		noteKey: 'demo.anya.scope.milos.note',
		parentId: 's.people',
		colour: { hue: 8, chroma: 45, depth: 1 }
	},
	{
		id: 's.marko',
		nameKey: 'demo.anya.scope.marko',
		noteKey: 'demo.anya.scope.marko.note',
		parentId: 's.people',
		colour: { hue: 340, chroma: 45, depth: 1 }
	},
	{
		id: 's.milica',
		nameKey: 'demo.anya.scope.milica',
		noteKey: 'demo.anya.scope.milica.note',
		parentId: 's.people',
		colour: { hue: 28, chroma: 55, depth: 1 }
	},
	{
		id: 's.luka',
		nameKey: 'demo.anya.scope.luka',
		noteKey: 'demo.anya.scope.luka.note',
		parentId: 's.people',
		colour: { hue: 356, chroma: 70, depth: 2 }
	},
	{
		id: 's.tisha',
		nameKey: 'demo.anya.scope.tisha',
		noteKey: 'demo.anya.scope.tisha.note',
		parentId: 's.people',
		colour: { hue: 44, chroma: 70, depth: 2 }
	},
	{
		id: 's.places',
		nameKey: 'demo.anya.scope.places',
		noteKey: 'demo.anya.scope.places.note',
		colour: { hue: 200, chroma: 40, depth: 0 }
	},
	{
		id: 's.flat',
		nameKey: 'demo.anya.scope.flat',
		noteKey: 'demo.anya.scope.flat.note',
		parentId: 's.places',
		colour: { hue: 205, chroma: 55, depth: 1 }
	},
	{
		id: 's.room',
		nameKey: 'demo.anya.scope.room',
		noteKey: 'demo.anya.scope.room.note',
		parentId: 's.flat',
		colour: { hue: 205, chroma: 42, depth: 2 }
	},
	{
		id: 's.dorcol',
		nameKey: 'demo.anya.scope.dorcol',
		noteKey: 'demo.anya.scope.dorcol.note',
		parentId: 's.places',
		colour: { hue: 185, chroma: 50, depth: 2 }
	},
	{
		id: 's.savska',
		nameKey: 'demo.anya.scope.savska',
		noteKey: 'demo.anya.scope.savska.note',
		parentId: 's.places',
		colour: { hue: 250, chroma: 55, depth: 2 }
	},
	{
		id: 's.apr-bank',
		nameKey: 'demo.anya.scope.apr-bank',
		noteKey: 'demo.anya.scope.apr-bank.note',
		parentId: 's.places',
		colour: { hue: 230, chroma: 45, depth: 1 }
	},
	{
		id: 's.ada',
		nameKey: 'demo.anya.scope.ada',
		noteKey: 'demo.anya.scope.ada.note',
		parentId: 's.places',
		colour: { hue: 195, chroma: 50, depth: 1 }
	},
	{
		id: 's.nbg',
		nameKey: 'demo.anya.scope.nbg',
		noteKey: 'demo.anya.scope.nbg.note',
		parentId: 's.places',
		colour: { hue: 215, chroma: 40, depth: 1 }
	},
	{
		id: 's.office',
		nameKey: 'demo.anya.scope.office',
		noteKey: 'demo.anya.scope.office.note',
		parentId: 's.nbg',
		colour: { hue: 220, chroma: 55, depth: 2 }
	},
	{
		id: 's.gym',
		nameKey: 'demo.anya.scope.gym',
		noteKey: 'demo.anya.scope.gym.note',
		parentId: 's.nbg',
		colour: { hue: 240, chroma: 60, depth: 2 }
	},
	{
		id: 's.zemun',
		nameKey: 'demo.anya.scope.zemun',
		noteKey: 'demo.anya.scope.zemun.note',
		parentId: 's.places',
		colour: { hue: 175, chroma: 55, depth: 2 }
	},
	{
		id: 's.hikes',
		nameKey: 'demo.anya.scope.hikes',
		noteKey: 'demo.anya.scope.hikes.note',
		parentId: 's.places',
		colour: { hue: 260, chroma: 45, depth: 1 }
	},
	{
		id: 's.mama-home',
		nameKey: 'demo.anya.scope.mama-home',
		noteKey: 'demo.anya.scope.mama-home.note',
		parentId: 's.places',
		colour: { hue: 245, chroma: 40, depth: 1 }
	},
	{
		id: 's.tbilisi',
		nameKey: 'demo.anya.scope.tbilisi',
		noteKey: 'demo.anya.scope.tbilisi.note',
		parentId: 's.places',
		colour: { hue: 180, chroma: 50, depth: 1 }
	},
	{
		id: 's.affairs',
		nameKey: 'demo.anya.scope.affairs',
		noteKey: 'demo.anya.scope.affairs.note',
		colour: { hue: 290, chroma: 45, depth: 0 }
	},
	{
		id: 's.legal',
		nameKey: 'demo.anya.scope.legal',
		noteKey: 'demo.anya.scope.legal.note',
		parentId: 's.affairs',
		colour: { hue: 280, chroma: 55, depth: 2 }
	},
	{
		id: 's.money',
		nameKey: 'demo.anya.scope.money',
		noteKey: 'demo.anya.scope.money.note',
		parentId: 's.affairs',
		colour: { hue: 300, chroma: 60, depth: 2 }
	},
	{
		id: 's.work',
		nameKey: 'demo.anya.scope.work',
		noteKey: 'demo.anya.scope.work.note',
		parentId: 's.affairs',
		colour: { hue: 310, chroma: 50, depth: 2 }
	},
	{
		id: 's.desk',
		nameKey: 'demo.anya.scope.desk',
		noteKey: 'demo.anya.scope.desk.note',
		parentId: 's.affairs',
		colour: { hue: 275, chroma: 55, depth: 2 }
	},
	{
		id: 's.health',
		nameKey: 'demo.anya.scope.health',
		noteKey: 'demo.anya.scope.health.note',
		parentId: 's.affairs',
		colour: { hue: 315, chroma: 45, depth: 1 }
	},
	{
		id: 's.serbian',
		nameKey: 'demo.anya.scope.serbian',
		noteKey: 'demo.anya.scope.serbian.note',
		parentId: 's.affairs',
		colour: { hue: 285, chroma: 45, depth: 1 }
	},
	{
		id: 's.next',
		nameKey: 'demo.anya.scope.next',
		noteKey: 'demo.anya.scope.next.note',
		parentId: 's.affairs',
		colour: { hue: 320, chroma: 40, depth: 1 }
	}
];

export const ANYA_SCOPE_LINKS: readonly StoryScopeLink[] = [
	{ kind: 'related_to', fromId: 's.jovana', toId: 's.legal' },
	{ kind: 'related_to', fromId: 's.milos', toId: 's.flat' },
	{ kind: 'related_to', fromId: 's.marko', toId: 's.health' },
	{ kind: 'related_to', fromId: 's.lena', toId: 's.tisha' },
	{ kind: 'related_to', fromId: 's.luka', toId: 's.zemun' },
	{ kind: 'related_to', fromId: 's.milica', toId: 's.office' },
	{ kind: 'related_to', fromId: 's.maxim', toId: 's.money' }
];

export const ANYA_KINDS: readonly StoryKind[] = [
	{
		id: ANYA_KIND_TRANSFER_ID,
		kindVId: ANYA_KIND_TRANSFER_V_ID,
		nameKey: 'demo.anya.kind.transfer',
		fields: [
			{
				key: 'amount',
				type: 'number',
				titleKey: 'demo.anya.kind.transfer.amount',
				unit: { id: 'eur', labelKey: 'demo.anya.unit.eur' }
			},
			{ key: 'from', type: 'string', titleKey: 'demo.anya.kind.transfer.from' }
		],
		scopeIds: ['s.money']
	},
	{
		id: ANYA_KIND_EXPENSE_ID,
		kindVId: ANYA_KIND_EXPENSE_V_ID,
		nameKey: 'demo.anya.kind.expense',
		fields: [
			{
				key: 'amount',
				type: 'number',
				titleKey: 'demo.anya.kind.expense.amount',
				unit: { id: 'eur', labelKey: 'demo.anya.unit.eur' }
			},
			{ key: 'what', type: 'string', titleKey: 'demo.anya.kind.expense.what' }
		],
		scopeIds: ['s.money']
	},
	{
		id: ANYA_KIND_VISIT_ID,
		kindVId: ANYA_KIND_VISIT_V_ID,
		nameKey: 'demo.anya.kind.visit',
		fields: [
			{ key: 'place', type: 'string', titleKey: 'demo.anya.kind.visit.place' },
			{
				key: 'wait',
				type: 'integer',
				titleKey: 'demo.anya.kind.visit.wait',
				unit: { id: 'min', labelKey: 'demo.anya.unit.min' }
			},
			{ key: 'result', type: 'string', titleKey: 'demo.anya.kind.visit.result' }
		],
		scopeIds: ['s.legal', 's.health']
	},
	{
		id: ANYA_KIND_SALE_ID,
		kindVId: ANYA_KIND_SALE_V_ID,
		nameKey: 'demo.anya.kind.sale',
		fields: [
			{
				key: 'amount',
				type: 'number',
				titleKey: 'demo.anya.kind.sale.amount',
				unit: { id: 'eur', labelKey: 'demo.anya.unit.eur' }
			},
			{ key: 'what', type: 'string', titleKey: 'demo.anya.kind.sale.what' }
		],
		scopeIds: ['s.desk', 's.money']
	},
	{
		id: ANYA_KIND_CALL_ID,
		kindVId: ANYA_KIND_CALL_V_ID,
		nameKey: 'demo.anya.kind.call',
		fields: [
			{
				key: 'minutes',
				type: 'integer',
				titleKey: 'demo.anya.kind.call.minutes',
				unit: { id: 'min', labelKey: 'demo.anya.unit.min' }
			}
		],
		scopeIds: ['s.maxim']
	}
];

export const ANYA_PERIODS: readonly StoryPeriod[] = [
	{ id: 'p.2023', unit: 'year', year: 2023, noteKey: 'demo.anya.period.2023' },
	{ id: 'p.2024', unit: 'year', year: 2024, noteKey: 'demo.anya.period.2024' },
	{ id: 'p.2025', unit: 'year', year: 2025, noteKey: 'demo.anya.period.2025' },
	{ id: 'p.2023-05', unit: 'month', year: 2023, month: 5, noteKey: 'demo.anya.period.2023-05' },
	{ id: 'p.2023-09', unit: 'month', year: 2023, month: 9, noteKey: 'demo.anya.period.2023-09' },
	{ id: 'p.2023-10', unit: 'month', year: 2023, month: 10, noteKey: 'demo.anya.period.2023-10' },
	{ id: 'p.2023-11', unit: 'month', year: 2023, month: 11, noteKey: 'demo.anya.period.2023-11' },
	{ id: 'p.2023-12', unit: 'month', year: 2023, month: 12, noteKey: 'demo.anya.period.2023-12' },
	{ id: 'p.2024-01', unit: 'month', year: 2024, month: 1, noteKey: 'demo.anya.period.2024-01' },
	{ id: 'p.2024-03', unit: 'month', year: 2024, month: 3, noteKey: 'demo.anya.period.2024-03' },
	{ id: 'p.2024-07', unit: 'month', year: 2024, month: 7, noteKey: 'demo.anya.period.2024-07' },
	{ id: 'p.2024-09', unit: 'month', year: 2024, month: 9, noteKey: 'demo.anya.period.2024-09' },
	{ id: 'p.2024-10', unit: 'month', year: 2024, month: 10, noteKey: 'demo.anya.period.2024-10' },
	{ id: 'p.2024-11', unit: 'month', year: 2024, month: 11, noteKey: 'demo.anya.period.2024-11' },
	{ id: 'p.2024-12', unit: 'month', year: 2024, month: 12, noteKey: 'demo.anya.period.2024-12' },
	{ id: 'p.2025-01', unit: 'month', year: 2025, month: 1, noteKey: 'demo.anya.period.2025-01' },
	{ id: 'p.2025-02', unit: 'month', year: 2025, month: 2, noteKey: 'demo.anya.period.2025-02' },
	{ id: 'p.2025-05', unit: 'month', year: 2025, month: 5, noteKey: 'demo.anya.period.2025-05' },
	{ id: 'p.2025-10', unit: 'month', year: 2025, month: 10, noteKey: 'demo.anya.period.2025-10' },
	{ id: 'p.2025-12', unit: 'month', year: 2025, month: 12, noteKey: 'demo.anya.period.2025-12' },
	{ id: 'p.2026-01', unit: 'month', year: 2026, month: 1, noteKey: 'demo.anya.period.2026-01' },
	{ id: 'p.2026-03', unit: 'month', year: 2026, month: 3, noteKey: 'demo.anya.period.2026-03' },
	{ id: 'p.2026-05', unit: 'month', year: 2026, month: 5, noteKey: 'demo.anya.period.2026-05' },
	{ id: 'p.2026-08', unit: 'month', year: 2026, month: 8, noteKey: 'demo.anya.period.2026-08' },
	{ id: 'p.2026-09', unit: 'month', year: 2026, month: 9, noteKey: 'demo.anya.period.2026-09' }
];

export const ANYA_TRACES: readonly StoryTrace[] = [
	plain(
		't.pay-abroad',
		'actual',
		day('2023-05-12'),
		'2023-05-12',
		['s.money', 's.work'],
		'demo.anya.trace.pay-abroad',
		'demo.anya.trace.pay-abroad.desc'
	),
	plain(
		't.lena-3',
		'actual',
		day('2023-05-14'),
		'2023-05-14',
		['s.lena'],
		'demo.anya.trace.lena-3',
		'demo.anya.trace.lena-3.desc'
	),
	plain(
		't.we-decided',
		'actual',
		day('2023-05-20'),
		'2023-05-20',
		['s.maxim'],
		'demo.anya.trace.we-decided',
		'demo.anya.trace.we-decided.desc'
	),
	plain(
		't.plan-move',
		'intend',
		month('2023-09'),
		'2023-05-20',
		['s.legal'],
		'demo.anya.trace.plan-move',
		'demo.anya.trace.plan-move.desc'
	),
	plain(
		't.plan-vnz',
		'intend',
		month('2023-12'),
		'2023-05-20',
		['s.legal'],
		'demo.anya.trace.plan-vnz',
		'demo.anya.trace.plan-vnz.desc'
	),
	plain(
		't.jovana-contact',
		'actual',
		day('2023-06-10'),
		'2023-06-10',
		['s.jovana', 's.legal'],
		'demo.anya.trace.jovana-contact',
		'demo.anya.trace.jovana-contact.desc'
	),
	typed(
		't.ticket',
		ANYA_KIND_EXPENSE_ID,
		{ amount: 340, what: { key: 'demo.anya.value.ticket.what' } },
		day('2023-06-28'),
		'2023-06-28',
		['s.money'],
		'demo.anya.trace.ticket'
	),
	plain(
		't.tisha-mama',
		'actual',
		day('2023-08-19'),
		'2023-08-19',
		['s.tisha', 's.mama'],
		'demo.anya.trace.tisha-mama',
		'demo.anya.trace.tisha-mama.desc'
	),
	plain(
		't.maxim-dec12',
		'intend',
		day('2023-12-12'),
		'2023-08-25',
		['s.maxim'],
		'demo.anya.trace.maxim-dec12',
		'demo.anya.trace.maxim-dec12.desc'
	),
	plain(
		't.goodbye',
		'actual',
		day('2023-09-08'),
		'2023-09-08',
		['s.maxim'],
		'demo.anya.trace.goodbye',
		'demo.anya.trace.goodbye.desc'
	),
	plain(
		't.arrive',
		'actual',
		day('2023-09-09'),
		'2023-09-09',
		['s.lena', 's.dorcol'],
		'demo.anya.trace.arrive',
		'demo.anya.trace.arrive.desc'
	),
	plain(
		't.get-vnz',
		'intend',
		day('2023-09-10'),
		'2023-09-10',
		['s.legal'],
		'demo.anya.trace.get-vnz',
		'demo.anya.trace.get-vnz.desc'
	),
	plain(
		't.step-card',
		'intend',
		day('2023-09-10'),
		'2023-09-10',
		['s.legal'],
		'demo.anya.trace.step-card',
		'demo.anya.trace.step-card.desc'
	),
	plain(
		't.card-refuse',
		'actual',
		day('2023-09-10'),
		'2023-09-10',
		['s.dorcol', 's.legal'],
		'demo.anya.trace.card-refuse',
		'demo.anya.trace.card-refuse.desc'
	),
	typed(
		't.card-hostel',
		ANYA_KIND_VISIT_ID,
		{
			place: { key: 'demo.anya.value.card-hostel.place' },
			wait: 30,
			result: { key: 'demo.anya.value.card-hostel.result' }
		},
		minute('2023-09-11T09:30'),
		'2023-09-11T09:30',
		['s.legal'],
		'demo.anya.trace.card-hostel'
	),
	plain(
		't.menjacnica',
		'actual',
		day('2023-09-12'),
		'2023-09-12',
		['s.money', 's.dorcol'],
		'demo.anya.trace.menjacnica',
		'demo.anya.trace.menjacnica.desc'
	),
	plain(
		't.jovana-first',
		'actual',
		day('2023-09-13'),
		'2023-09-13',
		['s.jovana', 's.legal'],
		'demo.anya.trace.jovana-first',
		'demo.anya.trace.jovana-first.desc'
	),
	plain(
		't.step-ip',
		'intend',
		day('2023-09-13'),
		'2023-09-13',
		['s.legal'],
		'demo.anya.trace.step-ip'
	),
	typed(
		't.call-1',
		ANYA_KIND_CALL_ID,
		{ minutes: 45 },
		day('2023-09-16'),
		'2023-09-16',
		['s.maxim'],
		'demo.anya.trace.call-1'
	),
	typed(
		't.apr-submit',
		ANYA_KIND_VISIT_ID,
		{
			place: { key: 'demo.anya.value.apr-submit.place' },
			wait: 45,
			result: { key: 'demo.anya.value.apr-submit.result' }
		},
		minute('2023-09-20T10:15'),
		'2023-09-20T10:15',
		['s.apr-bank'],
		'demo.anya.trace.apr-submit'
	),
	plain(
		't.golden',
		'actual',
		day('2023-09-24'),
		'2023-09-24',
		['s.dorcol'],
		'demo.anya.trace.golden',
		'demo.anya.trace.golden.desc'
	),
	plain(
		't.ip-decision',
		'actual',
		day('2023-09-27'),
		'2023-09-27',
		['s.legal'],
		'demo.anya.trace.ip-decision',
		'demo.anya.trace.ip-decision.desc'
	),
	typed(
		't.call-2',
		ANYA_KIND_CALL_ID,
		{ minutes: 38 },
		day('2023-09-29'),
		'2023-09-29',
		['s.maxim'],
		'demo.anya.trace.call-2'
	),
	plain(
		't.flat',
		'actual',
		day('2023-10-01'),
		'2023-10-01',
		['s.flat', 's.milos'],
		'demo.anya.trace.flat',
		'demo.anya.trace.flat.desc'
	),
	typed(
		't.deposit',
		ANYA_KIND_EXPENSE_ID,
		{ amount: 1100, what: { key: 'demo.anya.value.deposit.what' } },
		day('2023-10-01'),
		'2023-10-01',
		['s.money'],
		'demo.anya.trace.deposit'
	),
	plain(
		't.room-empty',
		'actual',
		day('2023-10-02'),
		'2023-10-02',
		['s.room'],
		'demo.anya.trace.room-empty',
		'demo.anya.trace.room-empty.desc'
	),
	typed(
		't.transfer-1',
		ANYA_KIND_TRANSFER_ID,
		{ amount: 500, from: { key: 'demo.anya.value.transfer-1.from' } },
		day('2023-10-05'),
		'2023-10-05',
		['s.money', 's.maxim'],
		'demo.anya.trace.transfer-1'
	),
	plain(
		't.step-visarun',
		'intend',
		day('2023-10-08'),
		'2023-10-08',
		['s.legal'],
		'demo.anya.trace.step-visarun',
		'demo.anya.trace.step-visarun.desc'
	),
	plain(
		't.visegrad',
		'actual',
		day('2023-10-08'),
		'2023-10-08',
		['s.legal'],
		'demo.anya.trace.visegrad',
		'demo.anya.trace.visegrad.desc'
	),
	plain(
		't.step-bank',
		'intend',
		day('2023-10-09'),
		'2023-10-09',
		['s.legal'],
		'demo.anya.trace.step-bank'
	),
	typed(
		't.bank-refuse',
		ANYA_KIND_VISIT_ID,
		{
			place: { key: 'demo.anya.value.bank-refuse.place' },
			wait: 25,
			result: { key: 'demo.anya.value.bank-refuse.result' }
		},
		minute('2023-10-10T11:00'),
		'2023-10-10T11:00',
		['s.apr-bank'],
		'demo.anya.trace.bank-refuse'
	),
	typed(
		't.call-3',
		ANYA_KIND_CALL_ID,
		{ minutes: 30 },
		day('2023-10-11'),
		'2023-10-11',
		['s.maxim'],
		'demo.anya.trace.call-3'
	),
	plain(
		't.apostille-panic',
		'actual',
		day('2023-10-12'),
		'2023-10-12',
		['s.legal'],
		'demo.anya.trace.apostille-panic',
		'demo.anya.trace.apostille-panic.desc'
	),
	typed(
		't.bank-ok',
		ANYA_KIND_VISIT_ID,
		{
			place: { key: 'demo.anya.value.bank-ok.place' },
			wait: 120,
			result: { key: 'demo.anya.value.bank-ok.result' }
		},
		minute('2023-10-17T12:40'),
		'2023-10-17T12:40',
		['s.apr-bank'],
		'demo.anya.trace.bank-ok'
	),
	plain(
		't.apostille-no',
		'actual',
		day('2023-10-19'),
		'2023-10-19',
		['s.jovana'],
		'demo.anya.trace.apostille-no',
		'demo.anya.trace.apostille-no.desc'
	),
	typed(
		't.card2',
		ANYA_KIND_VISIT_ID,
		{
			place: { key: 'demo.anya.value.card2.place' },
			wait: 90,
			result: { key: 'demo.anya.value.card2.result' }
		},
		minute('2023-10-23T08:10'),
		'2023-10-23T08:10',
		['s.savska', 's.milos'],
		'demo.anya.trace.card2'
	),
	typed(
		't.call-4',
		ANYA_KIND_CALL_ID,
		{ minutes: 25 },
		day('2023-10-26'),
		'2023-10-26',
		['s.maxim'],
		'demo.anya.trace.call-4'
	),
	plain(
		't.rain',
		'actual',
		day('2023-11-03'),
		'2023-11-03',
		['s.flat'],
		'demo.anya.trace.rain',
		'demo.anya.trace.rain.desc'
	),
	typed(
		't.transfer-2',
		ANYA_KIND_TRANSFER_ID,
		{ amount: 500, from: { key: 'demo.anya.value.transfer-1.from' } },
		day('2023-11-05'),
		'2023-11-05',
		['s.money']
	),
	plain(
		't.bar',
		'actual',
		interval('day', '2023-11-05', '2023-11-06'),
		'2023-11-05',
		['s.legal', 's.maxim'],
		'demo.anya.trace.bar',
		'demo.anya.trace.bar.desc'
	),
	typed(
		't.call-5',
		ANYA_KIND_CALL_ID,
		{ minutes: 20 },
		day('2023-11-08'),
		'2023-11-08',
		['s.maxim'],
		'demo.anya.trace.call-5'
	),
	plain(
		't.step-submit',
		'intend',
		day('2023-11-10'),
		'2023-11-10',
		['s.legal'],
		'demo.anya.trace.step-submit'
	),
	typed(
		't.submit',
		ANYA_KIND_VISIT_ID,
		{
			place: { key: 'demo.anya.value.card2.place' },
			wait: 150,
			result: { key: 'demo.anya.value.apr-submit.result' }
		},
		minute('2023-11-10T07:00'),
		'2023-11-10T07:00',
		['s.savska'],
		'demo.anya.trace.submit'
	),
	plain(
		't.wait',
		'intend',
		relative('t.submit', 'after', 'day'),
		'2023-11-10',
		['s.legal'],
		'demo.anya.trace.wait',
		'demo.anya.trace.wait.desc'
	),
	typed(
		't.call-6',
		ANYA_KIND_CALL_ID,
		{ minutes: 18 },
		day('2023-11-19'),
		'2023-11-19',
		['s.maxim'],
		'demo.anya.trace.call-6'
	),
	plain(
		't.maxim-confirm',
		'actual',
		day('2023-11-20'),
		'2023-11-20',
		['s.maxim'],
		'demo.anya.trace.maxim-confirm',
		'demo.anya.trace.maxim-confirm.desc'
	),
	plain(
		't.calls-twice',
		'actual',
		day('2023-11-25'),
		'2023-11-25',
		['s.maxim'],
		'demo.anya.trace.calls-twice',
		'demo.anya.trace.calls-twice.desc'
	),
	plain(
		't.no-ticket',
		'actual',
		day('2023-11-28'),
		'2023-11-28',
		['s.maxim'],
		'demo.anya.trace.no-ticket',
		'demo.anya.trace.no-ticket.desc'
	),
	typed(
		't.key',
		ANYA_KIND_EXPENSE_ID,
		{ amount: 5, what: { key: 'demo.anya.value.key.what' } },
		day('2023-11-30'),
		'2023-11-30',
		['s.flat', 's.maxim'],
		'demo.anya.trace.key'
	),
	plain(
		't.dark',
		'actual',
		day('2023-12-04'),
		'2023-12-04',
		['s.flat'],
		'demo.anya.trace.dark',
		'demo.anya.trace.dark.desc'
	),
	typed(
		't.transfer-3',
		ANYA_KIND_TRANSFER_ID,
		{ amount: 500, from: { key: 'demo.anya.value.transfer-1.from' } },
		day('2023-12-05'),
		'2023-12-05',
		['s.money']
	),
	plain(
		't.maxim-after',
		'actual',
		day('2023-12-08'),
		'2023-12-08',
		['s.maxim'],
		'demo.anya.trace.maxim-after',
		'demo.anya.trace.maxim-after.desc'
	),
	plain(
		't.maxim-jan',
		'intend',
		month('2024-01'),
		'2023-12-08',
		['s.maxim'],
		'demo.anya.trace.maxim-jan',
		'demo.anya.trace.maxim-jan.desc'
	),
	plain(
		't.dec12',
		'actual',
		day('2023-12-12'),
		'2023-12-12',
		['s.maxim', 's.room'],
		'demo.anya.trace.dec12',
		'demo.anya.trace.dec12.desc'
	),
	typed(
		't.call-7',
		ANYA_KIND_CALL_ID,
		{ minutes: 15 },
		day('2023-12-15'),
		'2023-12-15',
		['s.maxim'],
		'demo.anya.trace.call-7'
	),
	plain(
		't.smog',
		'actual',
		day('2023-12-19'),
		'2023-12-19',
		['s.flat'],
		'demo.anya.trace.smog',
		'demo.anya.trace.smog.desc'
	),
	plain(
		't.ny-lena',
		'actual',
		minute('2023-12-31T22:00'),
		'2023-12-31T22:00',
		['s.lena', 's.dorcol'],
		'demo.anya.trace.ny-lena',
		'demo.anya.trace.ny-lena.desc'
	),
	typed(
		't.transfer-4',
		ANYA_KIND_TRANSFER_ID,
		{ amount: 500, from: { key: 'demo.anya.value.transfer-1.from' } },
		day('2024-01-05'),
		'2024-01-05',
		['s.money']
	),
	typed(
		't.pausal',
		ANYA_KIND_EXPENSE_ID,
		{ amount: 300, what: { key: 'demo.anya.value.pausal.what' } },
		day('2024-01-10'),
		'2024-01-10',
		['s.money', 's.jovana'],
		'demo.anya.trace.pausal'
	),
	plain(
		't.maxim-spring',
		'actual',
		day('2024-01-21'),
		'2024-01-21',
		['s.maxim'],
		'demo.anya.trace.maxim-spring',
		'demo.anya.trace.maxim-spring.desc'
	),
	plain(
		't.maxim-spring-i',
		'intend',
		season(2024, 'spring'),
		'2024-01-21',
		['s.maxim'],
		'demo.anya.trace.maxim-spring-i',
		'demo.anya.trace.maxim-spring-i.desc'
	),
	typed(
		't.transfer-5',
		ANYA_KIND_TRANSFER_ID,
		{ amount: 500, from: { key: 'demo.anya.value.transfer-1.from' } },
		day('2024-02-05'),
		'2024-02-05',
		['s.money']
	),
	plain(
		't.ny-plateau',
		'actual',
		day('2024-02-06'),
		'2024-02-06',
		['s.flat', 's.work'],
		'demo.anya.trace.ny-plateau',
		'demo.anya.trace.ny-plateau.desc'
	),
	typed(
		't.call-8',
		ANYA_KIND_CALL_ID,
		{ minutes: 22 },
		day('2024-02-11'),
		'2024-02-11',
		['s.maxim'],
		'demo.anya.trace.call-8'
	),
	plain(
		't.decision-call',
		'actual',
		day('2024-02-22'),
		'2024-02-22',
		['s.savska'],
		'demo.anya.trace.decision-call',
		'demo.anya.trace.decision-call.desc'
	),
	plain(
		't.bday30',
		'actual',
		day('2024-03-02'),
		'2024-03-02',
		['s.maxim', 's.lena', 's.dorcol'],
		'demo.anya.trace.bday30',
		'demo.anya.trace.bday30.desc'
	),
	typed(
		't.transfer-6',
		ANYA_KIND_TRANSFER_ID,
		{ amount: 500, from: { key: 'demo.anya.value.transfer-1.from' } },
		day('2024-03-05'),
		'2024-03-05',
		['s.money']
	),
	typed(
		't.card',
		ANYA_KIND_VISIT_ID,
		{
			place: { key: 'demo.anya.value.card2.place' },
			wait: 40,
			result: { key: 'demo.anya.value.card.result' }
		},
		minute('2024-03-11T08:30'),
		'2024-03-11T08:30',
		['s.savska', 's.legal'],
		'demo.anya.trace.card'
	),
	plain(
		't.renew-hint',
		'actual',
		day('2024-03-11'),
		'2024-03-11',
		['s.jovana'],
		'demo.anya.trace.renew-hint',
		'demo.anya.trace.renew-hint.desc'
	),
	plain(
		't.renew-1',
		'intend',
		day('2025-01-10'),
		'2024-03-11',
		['s.legal'],
		'demo.anya.trace.renew-1',
		'demo.anya.trace.renew-1.desc'
	),
	plain(
		't.spring',
		'actual',
		day('2024-03-16'),
		'2024-03-16',
		['s.dorcol'],
		'demo.anya.trace.spring',
		'demo.anya.trace.spring.desc'
	),
	typed(
		't.call-9',
		ANYA_KIND_CALL_ID,
		{ minutes: 20 },
		day('2024-03-17'),
		'2024-03-17',
		['s.maxim'],
		'demo.anya.trace.call-9'
	),
	plain(
		't.maxim-summer',
		'actual',
		day('2024-03-24'),
		'2024-03-24',
		['s.maxim'],
		'demo.anya.trace.maxim-summer',
		'demo.anya.trace.maxim-summer.desc'
	),
	plain(
		't.maxim-summer-i',
		'intend',
		season(2024, 'summer'),
		'2024-03-24',
		['s.maxim'],
		'demo.anya.trace.maxim-summer-i',
		'demo.anya.trace.maxim-summer-i.desc'
	),
	plain(
		't.course',
		'intend',
		interval('day', '2024-04-03', '2024-08-28'),
		'2024-04-03',
		['s.serbian'],
		'demo.anya.trace.course',
		'demo.anya.trace.course.desc'
	),
	plain(
		't.course-1',
		'actual',
		day('2024-04-03'),
		'2024-04-03',
		['s.serbian'],
		'demo.anya.trace.course-1',
		'demo.anya.trace.course-1.desc'
	),
	typed(
		't.transfer-7',
		ANYA_KIND_TRANSFER_ID,
		{ amount: 500, from: { key: 'demo.anya.value.transfer-1.from' } },
		day('2024-04-05'),
		'2024-04-05',
		['s.money']
	),
	typed(
		't.transfer-8',
		ANYA_KIND_TRANSFER_ID,
		{ amount: 500, from: { key: 'demo.anya.value.transfer-1.from' } },
		day('2024-05-05'),
		'2024-05-05',
		['s.money']
	),
	typed(
		't.call-10',
		ANYA_KIND_CALL_ID,
		{ minutes: 12 },
		day('2024-05-12'),
		'2024-05-12',
		['s.maxim'],
		'demo.anya.trace.call-10'
	),
	plain(
		't.serbian-fail',
		'actual',
		day('2024-05-14'),
		'2024-05-14',
		['s.serbian'],
		'demo.anya.trace.serbian-fail',
		'demo.anya.trace.serbian-fail.desc'
	),
	plain(
		't.ada-1',
		'actual',
		day('2024-05-19'),
		'2024-05-19',
		['s.ada'],
		'demo.anya.trace.ada-1',
		'demo.anya.trace.ada-1.desc'
	),
	typed(
		't.transfer-9',
		ANYA_KIND_TRANSFER_ID,
		{ amount: 500, from: { key: 'demo.anya.value.transfer-1.from' } },
		day('2024-06-05'),
		'2024-06-05',
		['s.money']
	),
	plain(
		't.heat',
		'actual',
		day('2024-07-02'),
		'2024-07-02',
		['s.flat'],
		'demo.anya.trace.heat',
		'demo.anya.trace.heat.desc'
	),
	plain(
		't.room-closed',
		'actual',
		day('2024-07-02'),
		'2024-07-02',
		['s.room'],
		'demo.anya.trace.room-closed',
		'demo.anya.trace.room-closed.desc'
	),
	typed(
		't.transfer-10',
		ANYA_KIND_TRANSFER_ID,
		{ amount: 500, from: { key: 'demo.anya.value.transfer-1.from' } },
		day('2024-07-05'),
		'2024-07-05',
		['s.money']
	),
	plain(
		't.maxim-sept',
		'actual',
		day('2024-07-14'),
		'2024-07-14',
		['s.maxim'],
		'demo.anya.trace.maxim-sept',
		'demo.anya.trace.maxim-sept.desc'
	),
	plain(
		't.maxim-sept-i',
		'intend',
		day('2024-09-09'),
		'2024-07-14',
		['s.maxim'],
		'demo.anya.trace.maxim-sept-i',
		'demo.anya.trace.maxim-sept-i.desc'
	),
	typed(
		't.call-11',
		ANYA_KIND_CALL_ID,
		{ minutes: 10 },
		day('2024-07-21'),
		'2024-07-21',
		['s.maxim'],
		'demo.anya.trace.call-11'
	),
	typed(
		't.transfer-11',
		ANYA_KIND_TRANSFER_ID,
		{ amount: 500, from: { key: 'demo.anya.value.transfer-1.from' } },
		day('2024-08-05'),
		'2024-08-05',
		['s.money']
	),
	plain(
		't.course-drop',
		'actual',
		day('2024-08-07'),
		'2024-08-07',
		['s.serbian'],
		'demo.anya.trace.course-drop',
		'demo.anya.trace.course-drop.desc'
	),
	plain(
		't.few-notes',
		'actual',
		day('2024-08-20'),
		'2024-08-20',
		['s.flat'],
		'demo.anya.trace.few-notes',
		'demo.anya.trace.few-notes.desc'
	),
	typed(
		't.transfer-12',
		ANYA_KIND_TRANSFER_ID,
		{ amount: 500, from: { key: 'demo.anya.value.transfer-1.from' } },
		day('2024-09-05'),
		'2024-09-05',
		['s.money']
	),
	plain(
		't.anniv-1',
		'actual',
		day('2024-09-09'),
		'2024-09-09',
		['s.maxim'],
		'demo.anya.trace.anniv-1',
		'demo.anya.trace.anniv-1.desc'
	),
	plain(
		't.maxim-ny-i',
		'intend',
		day('2024-12-30'),
		'2024-09-09',
		['s.maxim'],
		'demo.anya.trace.maxim-ny-i',
		'demo.anya.trace.maxim-ny-i.desc'
	),
	plain(
		't.tisha-plan',
		'intend',
		day('2024-12-30'),
		'2024-09-12',
		['s.tisha', 's.maxim'],
		'demo.anya.trace.tisha-plan',
		'demo.anya.trace.tisha-plan.desc'
	),
	plain(
		't.step-chip',
		'intend',
		day('2024-09-12'),
		'2024-09-12',
		['s.tisha', 's.mama'],
		'demo.anya.trace.step-chip',
		'demo.anya.trace.step-chip.desc'
	),
	plain(
		't.chip-done',
		'actual',
		day('2024-09-14'),
		'2024-09-14',
		['s.mama', 's.tisha'],
		'demo.anya.trace.chip-done',
		'demo.anya.trace.chip-done.desc'
	),
	plain(
		't.step-blood',
		'intend',
		relative('t.chip-done', 'after', 'day'),
		'2024-09-12',
		['s.tisha'],
		'demo.anya.trace.step-blood',
		'demo.anya.trace.step-blood.desc'
	),
	typed(
		't.call-12',
		ANYA_KIND_CALL_ID,
		{ minutes: 12 },
		day('2024-09-15'),
		'2024-09-15',
		['s.maxim'],
		'demo.anya.trace.call-12'
	),
	plain(
		't.autumn2',
		'actual',
		day('2024-09-27'),
		'2024-09-27',
		['s.flat'],
		'demo.anya.trace.autumn2',
		'demo.anya.trace.autumn2.desc'
	),
	typed(
		't.transfer-13',
		ANYA_KIND_TRANSFER_ID,
		{ amount: 500, from: { key: 'demo.anya.value.transfer-1.from' } },
		day('2024-10-05'),
		'2024-10-05',
		['s.money']
	),
	plain(
		't.tooth',
		'actual',
		minute('2024-10-09T21:40'),
		'2024-10-09T21:40',
		['s.health', 's.dorcol'],
		'demo.anya.trace.tooth',
		'demo.anya.trace.tooth.desc'
	),
	plain(
		't.find-dentist',
		'intend',
		day('2024-10-10'),
		'2024-10-10',
		['s.health'],
		'demo.anya.trace.find-dentist',
		'demo.anya.trace.find-dentist.desc'
	),
	typed(
		't.marko',
		ANYA_KIND_VISIT_ID,
		{
			place: { key: 'demo.anya.value.marko.place' },
			wait: 20,
			result: { key: 'demo.anya.value.marko.result' }
		},
		minute('2024-10-14T17:00'),
		'2024-10-14T17:00',
		['s.marko', 's.health'],
		'demo.anya.trace.marko'
	),
	plain(
		't.blood-done',
		'actual',
		day('2024-10-16'),
		'2024-10-16',
		['s.mama', 's.tisha'],
		'demo.anya.trace.blood-done',
		'demo.anya.trace.blood-done.desc'
	),
	plain(
		't.pasha',
		'actual',
		day('2024-10-19'),
		'2024-10-19',
		['s.next'],
		'demo.anya.trace.pasha',
		'demo.anya.trace.pasha.desc'
	),
	plain(
		't.threshold',
		'actual',
		minute('2024-10-19T22:10'),
		'2024-10-19T22:10',
		['s.next', 's.money'],
		'demo.anya.trace.threshold',
		'demo.anya.trace.threshold.desc'
	),
	plain(
		't.not-final',
		'intend',
		unknownTime,
		'2024-10-19',
		['s.next'],
		'demo.anya.trace.not-final',
		'demo.anya.trace.not-final.desc'
	),
	typed(
		't.call-13',
		ANYA_KIND_CALL_ID,
		{ minutes: 9 },
		day('2024-10-20'),
		'2024-10-20',
		['s.maxim'],
		'demo.anya.trace.call-13'
	),
	typed(
		't.crown',
		ANYA_KIND_EXPENSE_ID,
		{ amount: 720, what: { key: 'demo.anya.value.crown.what' } },
		day('2024-10-25'),
		'2024-10-25',
		['s.health', 's.money'],
		'demo.anya.trace.crown'
	),
	plain(
		't.count',
		'actual',
		minute('2024-10-25T23:30'),
		'2024-10-25T23:30',
		['s.money'],
		'demo.anya.trace.count',
		'demo.anya.trace.count.desc'
	),
	typed(
		't.transfer-700',
		ANYA_KIND_TRANSFER_ID,
		{ amount: 700, from: { key: 'demo.anya.value.transfer-1.from' } },
		day('2024-10-27'),
		'2024-10-27',
		['s.money', 's.maxim'],
		'demo.anya.trace.transfer-700'
	),
	typed(
		't.transfer-14',
		ANYA_KIND_TRANSFER_ID,
		{ amount: 500, from: { key: 'demo.anya.value.transfer-1.from' } },
		day('2024-11-05'),
		'2024-11-05',
		['s.money']
	),
	plain(
		't.dark2',
		'actual',
		day('2024-11-06'),
		'2024-11-06',
		['s.flat'],
		'demo.anya.trace.dark2',
		'demo.anya.trace.dark2.desc'
	),
	plain(
		't.room-storage',
		'actual',
		day('2024-11-10'),
		'2024-11-10',
		['s.room'],
		'demo.anya.trace.room-storage',
		'demo.anya.trace.room-storage.desc'
	),
	typed(
		't.fight',
		ANYA_KIND_CALL_ID,
		{ minutes: 35 },
		day('2024-11-16'),
		'2024-11-16',
		['s.maxim', 's.money'],
		'demo.anya.trace.fight'
	),
	plain(
		't.lena-says',
		'actual',
		day('2024-11-23'),
		'2024-11-23',
		['s.lena', 's.dorcol'],
		'demo.anya.trace.lena-says',
		'demo.anya.trace.lena-says.desc'
	),
	plain(
		't.come-you',
		'actual',
		day('2024-11-27'),
		'2024-11-27',
		['s.maxim'],
		'demo.anya.trace.come-you',
		'demo.anya.trace.come-you.desc'
	),
	typed(
		't.call-14',
		ANYA_KIND_CALL_ID,
		{ minutes: 8 },
		day('2024-11-30'),
		'2024-11-30',
		['s.maxim'],
		'demo.anya.trace.call-14'
	),
	typed(
		't.ticket-home',
		ANYA_KIND_EXPENSE_ID,
		{ amount: 280, what: { key: 'demo.anya.value.ticket-home.what' } },
		day('2024-12-03'),
		'2024-12-03',
		['s.money', 's.mama-home'],
		'demo.anya.trace.ticket-home'
	),
	plain(
		't.papers-q',
		'actual',
		day('2024-12-03'),
		'2024-12-03',
		['s.mama', 's.tisha'],
		'demo.anya.trace.papers-q',
		'demo.anya.trace.papers-q.desc'
	),
	typed(
		't.transfer-15',
		ANYA_KIND_TRANSFER_ID,
		{ amount: 500, from: { key: 'demo.anya.value.transfer-1.from' } },
		day('2024-12-05'),
		'2024-12-05',
		['s.money']
	),
	plain(
		't.smog2',
		'actual',
		day('2024-12-12'),
		'2024-12-12',
		['s.flat'],
		'demo.anya.trace.smog2',
		'demo.anya.trace.smog2.desc'
	),
	typed(
		't.call-15',
		ANYA_KIND_CALL_ID,
		{ minutes: 7 },
		day('2024-12-14'),
		'2024-12-14',
		['s.maxim'],
		'demo.anya.trace.call-15'
	),
	plain(
		't.fly-home',
		'actual',
		day('2024-12-27'),
		'2024-12-27',
		['s.maxim', 's.mama-home'],
		'demo.anya.trace.fly-home',
		'demo.anya.trace.fly-home.desc'
	),
	plain(
		't.talk',
		'actual',
		minute('2024-12-30T01:40'),
		'2024-12-30T01:40',
		['s.maxim'],
		'demo.anya.trace.talk',
		'demo.anya.trace.talk.desc'
	),
	plain(
		't.ny-mama',
		'actual',
		minute('2024-12-31T23:00'),
		'2024-12-31T23:00',
		['s.mama', 's.mama-home', 's.tisha'],
		'demo.anya.trace.ny-mama',
		'demo.anya.trace.ny-mama.desc'
	),
	plain(
		't.mama-cat',
		'actual',
		day('2025-01-02'),
		'2025-01-02',
		['s.mama', 's.tisha'],
		'demo.anya.trace.mama-cat',
		'demo.anya.trace.mama-cat.desc'
	),
	typed(
		't.vet-export',
		ANYA_KIND_VISIT_ID,
		{
			place: { key: 'demo.anya.value.vet-export.place' },
			wait: 40,
			result: { key: 'demo.anya.value.vet-export.result' }
		},
		minute('2025-01-03T10:00'),
		'2025-01-03T10:00',
		['s.tisha', 's.mama-home'],
		'demo.anya.trace.vet-export'
	),
	plain(
		't.tisha-home',
		'actual',
		day('2025-01-05'),
		'2025-01-05',
		['s.tisha', 's.flat', 's.room'],
		'demo.anya.trace.tisha-home',
		'demo.anya.trace.tisha-home.desc'
	),
	typed(
		't.transfer-16',
		ANYA_KIND_TRANSFER_ID,
		{ amount: 500, from: { key: 'demo.anya.value.transfer-1.from' } },
		day('2025-01-05'),
		'2025-01-05',
		['s.money'],
		'demo.anya.trace.transfer-16'
	),
	typed(
		't.bowls',
		ANYA_KIND_EXPENSE_ID,
		{ amount: 35, what: { key: 'demo.anya.value.bowls.what' } },
		day('2025-01-07'),
		'2025-01-07',
		['s.tisha'],
		'demo.anya.trace.bowls'
	),
	plain(
		't.daily-cat',
		'actual',
		day('2025-01-09'),
		'2025-01-09',
		['s.work', 's.tisha'],
		'demo.anya.trace.daily-cat',
		'demo.anya.trace.daily-cat.desc'
	),
	typed(
		't.desk',
		ANYA_KIND_EXPENSE_ID,
		{ amount: 140, what: { key: 'demo.anya.value.desk.what' } },
		day('2025-01-20'),
		'2025-01-20',
		['s.desk', 's.room'],
		'demo.anya.trace.desk'
	),
	plain(
		't.room-cat',
		'actual',
		day('2025-01-20'),
		'2025-01-20',
		['s.room'],
		'demo.anya.trace.room-cat',
		'demo.anya.trace.room-cat.desc'
	),
	plain(
		't.cv',
		'actual',
		day('2025-01-25'),
		'2025-01-25',
		['s.work'],
		'demo.anya.trace.cv',
		'demo.anya.trace.cv.desc'
	),
	plain(
		't.find-job',
		'intend',
		day('2025-04-30'),
		'2025-01-25',
		['s.work'],
		'demo.anya.trace.find-job',
		'demo.anya.trace.find-job.desc'
	),
	plain(
		't.stop-money',
		'actual',
		day('2025-02-03'),
		'2025-02-03',
		['s.maxim', 's.money'],
		'demo.anya.trace.stop-money',
		'demo.anya.trace.stop-money.desc'
	),
	plain(
		't.off-500',
		'intend',
		day('2025-05-05'),
		'2025-02-03',
		['s.money'],
		'demo.anya.trace.off-500',
		'demo.anya.trace.off-500.desc'
	),
	typed(
		't.renew-submit',
		ANYA_KIND_VISIT_ID,
		{
			place: { key: 'demo.anya.value.card2.place' },
			wait: 130,
			result: { key: 'demo.anya.value.renew-submit.result' }
		},
		minute('2025-02-10T07:30'),
		'2025-02-10T07:30',
		['s.savska', 's.legal'],
		'demo.anya.trace.renew-submit'
	),
	typed(
		't.net',
		ANYA_KIND_EXPENSE_ID,
		{ amount: 60, what: { key: 'demo.anya.value.net.what' } },
		day('2025-02-15'),
		'2025-02-15',
		['s.tisha', 's.flat'],
		'demo.anya.trace.net'
	),
	plain(
		't.interviews',
		'actual',
		day('2025-02-20'),
		'2025-02-20',
		['s.work'],
		'demo.anya.trace.interviews',
		'demo.anya.trace.interviews.desc'
	),
	plain(
		't.minus-400',
		'actual',
		day('2025-02-28'),
		'2025-02-28',
		['s.money'],
		'demo.anya.trace.minus-400',
		'demo.anya.trace.minus-400.desc'
	),
	plain(
		't.bday31',
		'actual',
		day('2025-03-02'),
		'2025-03-02',
		['s.lena'],
		'demo.anya.trace.bday31',
		'demo.anya.trace.bday31.desc'
	),
	typed(
		't.cards',
		ANYA_KIND_SALE_ID,
		{ amount: 255, what: { key: 'demo.anya.value.cards.what' } },
		day('2025-03-08'),
		'2025-03-08',
		['s.desk', 's.money'],
		'demo.anya.trace.cards'
	),
	typed(
		't.card-2',
		ANYA_KIND_VISIT_ID,
		{
			place: { key: 'demo.anya.value.card2.place' },
			wait: 30,
			result: { key: 'demo.anya.value.card-2.result' }
		},
		minute('2025-03-11T08:40'),
		'2025-03-11T08:40',
		['s.legal'],
		'demo.anya.trace.card-2'
	),
	plain(
		't.rejections',
		'actual',
		day('2025-03-21'),
		'2025-03-21',
		['s.work'],
		'demo.anya.trace.rejections',
		'demo.anya.trace.rejections.desc'
	),
	plain(
		't.minus-250',
		'actual',
		day('2025-03-31'),
		'2025-03-31',
		['s.money'],
		'demo.anya.trace.minus-250',
		'demo.anya.trace.minus-250.desc'
	),
	plain(
		't.renew-2',
		'intend',
		day('2026-01-10'),
		'2025-03-11',
		['s.legal'],
		'demo.anya.trace.renew-2',
		'demo.anya.trace.renew-2.desc'
	),
	plain(
		't.offer',
		'actual',
		day('2025-04-14'),
		'2025-04-14',
		['s.work'],
		'demo.anya.trace.offer',
		'demo.anya.trace.offer.desc'
	),
	plain(
		't.minus-100',
		'actual',
		day('2025-04-30'),
		'2025-04-30',
		['s.money'],
		'demo.anya.trace.minus-100',
		'demo.anya.trace.minus-100.desc'
	),
	plain(
		't.salary-1',
		'actual',
		day('2025-05-05'),
		'2025-05-05',
		['s.money', 's.work'],
		'demo.anya.trace.salary-1',
		'demo.anya.trace.salary-1.desc'
	),
	plain(
		't.office-1',
		'actual',
		day('2025-05-06'),
		'2025-05-06',
		['s.office', 's.milica'],
		'demo.anya.trace.office-1',
		'demo.anya.trace.office-1.desc'
	),
	typed(
		't.market-1',
		ANYA_KIND_SALE_ID,
		{ amount: 400, what: { key: 'demo.anya.value.market-1.what' } },
		day('2025-05-17'),
		'2025-05-17',
		['s.desk', 's.dorcol'],
		'demo.anya.trace.market-1'
	),
	plain(
		't.plus-300',
		'actual',
		day('2025-05-31'),
		'2025-05-31',
		['s.money'],
		'demo.anya.trace.plus-300',
		'demo.anya.trace.plus-300.desc'
	),
	plain(
		't.autotests',
		'intend',
		interval('day', '2025-06-02', '2025-09-25'),
		'2025-06-02',
		['s.work'],
		'demo.anya.trace.autotests',
		'demo.anya.trace.autotests.desc'
	),
	typed(
		't.cafe-series',
		ANYA_KIND_SALE_ID,
		{ amount: 300, what: { key: 'demo.anya.value.cafe-series.what' } },
		day('2025-06-20'),
		'2025-06-20',
		['s.desk'],
		'demo.anya.trace.cafe-series'
	),
	plain(
		't.bug',
		'actual',
		day('2025-07-08'),
		'2025-07-08',
		['s.work'],
		'demo.anya.trace.bug',
		'demo.anya.trace.bug.desc'
	),
	typed(
		't.ac',
		ANYA_KIND_EXPENSE_ID,
		{ amount: 450, what: { key: 'demo.anya.value.ac.what' } },
		day('2025-07-15'),
		'2025-07-15',
		['s.flat'],
		'demo.anya.trace.ac'
	),
	plain(
		't.maxim-msg',
		'actual',
		day('2025-07-20'),
		'2025-07-20',
		['s.maxim'],
		'demo.anya.trace.maxim-msg',
		'demo.anya.trace.maxim-msg.desc'
	),
	plain(
		't.ada-milica',
		'actual',
		day('2025-07-27'),
		'2025-07-27',
		['s.ada', 's.milica'],
		'demo.anya.trace.ada-milica',
		'demo.anya.trace.ada-milica.desc'
	),
	plain(
		't.insta',
		'actual',
		day('2025-08-03'),
		'2025-08-03',
		['s.desk'],
		'demo.anya.trace.insta',
		'demo.anya.trace.insta.desc'
	),
	plain(
		't.anniv-2',
		'actual',
		day('2025-09-09'),
		'2025-09-09',
		['s.lena', 's.milica'],
		'demo.anya.trace.anniv-2',
		'demo.anya.trace.anniv-2.desc'
	),
	plain(
		't.course-done',
		'actual',
		day('2025-09-25'),
		'2025-09-25',
		['s.work'],
		'demo.anya.trace.course-done',
		'demo.anya.trace.course-done.desc'
	),
	plain(
		't.tbilisi-i',
		'intend',
		interval('day', '2025-10-20', '2025-10-27'),
		'2025-09-30',
		['s.tbilisi', 's.next'],
		'demo.anya.trace.tbilisi-i',
		'demo.anya.trace.tbilisi-i.desc'
	),
	plain('t.gym', 'intend', day('2025-10-02'), '2025-10-02', ['s.gym'], 'demo.anya.trace.gym'),
	plain(
		't.gym-1',
		'actual',
		day('2025-10-02'),
		'2025-10-02',
		['s.gym'],
		'demo.anya.trace.gym-1',
		'demo.anya.trace.gym-1.desc'
	),
	plain(
		't.avala',
		'actual',
		day('2025-10-12'),
		'2025-10-12',
		['s.hikes'],
		'demo.anya.trace.avala',
		'demo.anya.trace.avala.desc'
	),
	plain(
		't.luka',
		'actual',
		day('2025-10-16'),
		'2025-10-16',
		['s.luka', 's.gym'],
		'demo.anya.trace.luka',
		'demo.anya.trace.luka.desc'
	),
	plain(
		't.tisha-lena',
		'actual',
		day('2025-10-19'),
		'2025-10-19',
		['s.lena', 's.tisha'],
		'demo.anya.trace.tisha-lena',
		'demo.anya.trace.tisha-lena.desc'
	),
	plain(
		't.tbilisi',
		'actual',
		interval('day', '2025-10-20', '2025-10-27'),
		'2025-10-20',
		['s.tbilisi'],
		'demo.anya.trace.tbilisi',
		'demo.anya.trace.tbilisi.desc'
	),
	plain(
		't.tbilisi-back',
		'actual',
		day('2025-10-28'),
		'2025-10-28',
		['s.next'],
		'demo.anya.trace.tbilisi-back',
		'demo.anya.trace.tbilisi-back.desc'
	),
	plain(
		't.kosmaj',
		'actual',
		day('2025-11-09'),
		'2025-11-09',
		['s.hikes', 's.luka'],
		'demo.anya.trace.kosmaj',
		'demo.anya.trace.kosmaj.desc'
	),
	typed(
		't.sofa',
		ANYA_KIND_EXPENSE_ID,
		{ amount: 380, what: { key: 'demo.anya.value.sofa.what' } },
		day('2025-11-15'),
		'2025-11-15',
		['s.flat'],
		'demo.anya.trace.sofa'
	),
	plain(
		't.zemun-walk',
		'actual',
		day('2025-11-22'),
		'2025-11-22',
		['s.zemun', 's.luka'],
		'demo.anya.trace.zemun-walk',
		'demo.anya.trace.zemun-walk.desc'
	),
	typed(
		't.market-2',
		ANYA_KIND_SALE_ID,
		{ amount: 350, what: { key: 'demo.anya.value.market-2.what' } },
		day('2025-11-29'),
		'2025-11-29',
		['s.desk'],
		'demo.anya.trace.market-2'
	),
	plain(
		't.renew-2-note',
		'actual',
		day('2025-12-01'),
		'2025-12-01',
		['s.jovana'],
		'demo.anya.trace.renew-2-note'
	),
	plain(
		't.gym-2',
		'actual',
		day('2025-12-09'),
		'2025-12-09',
		['s.gym', 's.luka'],
		'demo.anya.trace.gym-2',
		'demo.anya.trace.gym-2.desc'
	),
	typed(
		't.corp-order',
		ANYA_KIND_SALE_ID,
		{ amount: 900, what: { key: 'demo.anya.value.corp-order.what' } },
		day('2025-12-18'),
		'2025-12-18',
		['s.desk'],
		'demo.anya.trace.corp-order'
	),
	plain(
		't.ny-mine',
		'actual',
		minute('2025-12-31T23:00'),
		'2025-12-31T23:00',
		['s.lena', 's.milica', 's.luka', 's.flat'],
		'demo.anya.trace.ny-mine',
		'demo.anya.trace.ny-mine.desc'
	),
	plain(
		't.renew-start',
		'actual',
		day('2026-01-12'),
		'2026-01-12',
		['s.jovana', 's.legal'],
		'demo.anya.trace.renew-start'
	),
	plain(
		't.slava',
		'actual',
		day('2026-01-20'),
		'2026-01-20',
		['s.luka', 's.serbian'],
		'demo.anya.trace.slava',
		'demo.anya.trace.slava.desc'
	),
	typed(
		't.renew-submit-2',
		ANYA_KIND_VISIT_ID,
		{
			place: { key: 'demo.anya.value.card2.place' },
			wait: 110,
			result: { key: 'demo.anya.value.renew-submit-2.result' }
		},
		minute('2026-02-12T07:20'),
		'2026-02-12T07:20',
		['s.savska'],
		'demo.anya.trace.renew-submit-2'
	),
	plain(
		't.wrist',
		'actual',
		minute('2026-02-18T19:30'),
		'2026-02-18T19:30',
		['s.health', 's.gym'],
		'demo.anya.trace.wrist',
		'demo.anya.trace.wrist.desc'
	),
	typed(
		't.physio',
		ANYA_KIND_VISIT_ID,
		{
			place: { key: 'demo.anya.value.physio.place' },
			wait: 10,
			result: { key: 'demo.anya.value.physio.result' }
		},
		minute('2026-02-20T16:00'),
		'2026-02-20T16:00',
		['s.health'],
		'demo.anya.trace.physio'
	),
	plain(
		't.bday32',
		'actual',
		day('2026-03-02'),
		'2026-03-02',
		['s.lena', 's.luka'],
		'demo.anya.trace.bday32',
		'demo.anya.trace.bday32.desc'
	),
	typed(
		't.card-3',
		ANYA_KIND_VISIT_ID,
		{
			place: { key: 'demo.anya.value.card2.place' },
			wait: 30,
			result: { key: 'demo.anya.value.card-3.result' }
		},
		minute('2026-03-05T08:30'),
		'2026-03-05T08:30',
		['s.legal'],
		'demo.anya.trace.card-3'
	),
	plain(
		't.mama-visit-i',
		'intend',
		interval('day', '2026-05-09', '2026-05-23'),
		'2026-03-10',
		['s.mama'],
		'demo.anya.trace.mama-visit-i',
		'demo.anya.trace.mama-visit-i.desc'
	),
	plain(
		't.automation',
		'actual',
		day('2026-03-16'),
		'2026-03-16',
		['s.work'],
		'demo.anya.trace.automation',
		'demo.anya.trace.automation.desc'
	),
	plain(
		't.fruska',
		'actual',
		day('2026-04-19'),
		'2026-04-19',
		['s.hikes'],
		'demo.anya.trace.fruska',
		'demo.anya.trace.fruska.desc'
	),
	plain(
		't.mama-visit',
		'actual',
		interval('day', '2026-05-09', '2026-05-23'),
		'2026-05-09',
		['s.mama', 's.room'],
		'demo.anya.trace.mama-visit',
		'demo.anya.trace.mama-visit.desc'
	),
	plain(
		't.key-mama',
		'actual',
		day('2026-05-09'),
		'2026-05-09',
		['s.mama', 's.flat'],
		'demo.anya.trace.key-mama',
		'demo.anya.trace.key-mama.desc'
	),
	plain(
		't.mama-luka',
		'actual',
		day('2026-05-16'),
		'2026-05-16',
		['s.mama', 's.luka'],
		'demo.anya.trace.mama-luka',
		'demo.anya.trace.mama-luka.desc'
	),
	plain(
		't.mama-verdict',
		'actual',
		day('2026-05-23'),
		'2026-05-23',
		['s.mama'],
		'demo.anya.trace.mama-verdict',
		'demo.anya.trace.mama-verdict.desc'
	),
	plain(
		't.ada-26',
		'actual',
		day('2026-06-14'),
		'2026-06-14',
		['s.ada'],
		'demo.anya.trace.ada-26',
		'demo.anya.trace.ada-26.desc'
	),
	plain(
		't.tara',
		'actual',
		interval('day', '2026-07-10', '2026-07-13'),
		'2026-07-10',
		['s.hikes', 's.luka'],
		'demo.anya.trace.tara',
		'demo.anya.trace.tara.desc'
	),
	plain(
		't.bank-serbian',
		'actual',
		day('2026-08-11'),
		'2026-08-11',
		['s.serbian'],
		'demo.anya.trace.bank-serbian',
		'demo.anya.trace.bank-serbian.desc'
	),
	typed(
		't.workshop-1',
		ANYA_KIND_SALE_ID,
		{ amount: 160, what: { key: 'demo.anya.value.workshop-1.what' } },
		day('2026-08-22'),
		'2026-08-22',
		['s.desk', 's.dorcol'],
		'demo.anya.trace.workshop-1'
	),
	plain(
		't.luka-zemun',
		'actual',
		day('2026-08-30'),
		'2026-08-30',
		['s.luka', 's.zemun', 's.room'],
		'demo.anya.trace.luka-zemun',
		'demo.anya.trace.luka-zemun.desc'
	),
	plain(
		't.zemun-q',
		'intend',
		unknownTime,
		'2026-08-30',
		['s.zemun', 's.luka'],
		'demo.anya.trace.zemun-q',
		'demo.anya.trace.zemun-q.desc'
	),
	plain(
		't.anniv-3',
		'actual',
		day('2026-09-09'),
		'2026-09-09',
		['s.flat', 's.money'],
		'demo.anya.trace.anniv-3',
		'demo.anya.trace.anniv-3.desc'
	),
	plain(
		't.workshop-2',
		'intend',
		day('2026-10-24'),
		'2026-09-01',
		['s.desk'],
		'demo.anya.trace.workshop-2',
		'demo.anya.trace.workshop-2.desc'
	),
	plain(
		't.crown-check',
		'intend',
		day('2026-10-15'),
		'2026-09-10',
		['s.health', 's.marko'],
		'demo.anya.trace.crown-check',
		'demo.anya.trace.crown-check.desc'
	),
	plain(
		't.market-3',
		'intend',
		day('2026-11-28'),
		'2026-09-12',
		['s.desk'],
		'demo.anya.trace.market-3',
		'demo.anya.trace.market-3.desc'
	),
	plain(
		't.pmz',
		'intend',
		day('2026-11-30'),
		'2026-09-15',
		['s.legal'],
		'demo.anya.trace.pmz',
		'demo.anya.trace.pmz.desc'
	),
	plain(
		't.pmz-list',
		'intend',
		day('2026-10-05'),
		'2026-09-15',
		['s.jovana', 's.legal'],
		'demo.anya.trace.pmz-list'
	),
	plain(
		't.pmz-cert',
		'intend',
		day('2026-11-10'),
		'2026-09-15',
		['s.legal'],
		'demo.anya.trace.pmz-cert'
	),
	plain(
		't.mama-next',
		'intend',
		season(2027, 'spring'),
		'2026-05-23',
		['s.mama'],
		'demo.anya.trace.mama-next',
		'demo.anya.trace.mama-next.desc'
	),
	plain(
		't.start',
		'actual',
		day('2026-09-21'),
		'2026-09-21',
		[],
		'demo.anya.trace.start',
		'demo.anya.trace.start.desc'
	)
];

export const ANYA_TRACE_LINKS: readonly StoryTraceLink[] = [
	{ kind: 'related_to', fromId: 't.start', toId: 't.we-decided' },
	{ kind: 'related_to', fromId: 't.start', toId: 't.transfer-1' },
	{ kind: 'related_to', fromId: 't.start', toId: 't.maxim-after' },
	{ kind: 'related_to', fromId: 't.start', toId: 't.talk' },
	{ kind: 'related_to', fromId: 't.start', toId: 't.tisha-home' },
	{ kind: 'related_to', fromId: 't.start', toId: 't.key-mama' },
	{ kind: 'part_of', fromId: 't.step-card', toId: 't.get-vnz' },
	{ kind: 'part_of', fromId: 't.step-ip', toId: 't.get-vnz' },
	{ kind: 'part_of', fromId: 't.step-visarun', toId: 't.get-vnz' },
	{ kind: 'part_of', fromId: 't.step-bank', toId: 't.get-vnz' },
	{ kind: 'part_of', fromId: 't.step-submit', toId: 't.get-vnz' },
	{ kind: 'part_of', fromId: 't.wait', toId: 't.get-vnz' },
	{ kind: 'part_of', fromId: 't.step-chip', toId: 't.tisha-plan' },
	{ kind: 'part_of', fromId: 't.step-blood', toId: 't.tisha-plan' },
	{ kind: 'part_of', fromId: 't.pmz-list', toId: 't.pmz' },
	{ kind: 'part_of', fromId: 't.pmz-cert', toId: 't.pmz' },
	{ kind: 'evidence_for', fromId: 't.arrive', toId: 't.plan-move' },
	{ kind: 'evidence_for', fromId: 't.card', toId: 't.plan-vnz' },
	{ kind: 'evidence_for', fromId: 't.maxim-after', toId: 't.maxim-dec12' },
	{ kind: 'evidence_for', fromId: 't.card-hostel', toId: 't.step-card' },
	{ kind: 'evidence_for', fromId: 't.ip-decision', toId: 't.step-ip' },
	{ kind: 'evidence_for', fromId: 't.visegrad', toId: 't.step-visarun' },
	{ kind: 'evidence_for', fromId: 't.bank-ok', toId: 't.step-bank' },
	{ kind: 'evidence_for', fromId: 't.submit', toId: 't.step-submit' },
	{ kind: 'evidence_for', fromId: 't.decision-call', toId: 't.wait' },
	{ kind: 'evidence_for', fromId: 't.maxim-spring', toId: 't.maxim-jan' },
	{ kind: 'evidence_for', fromId: 't.card', toId: 't.get-vnz' },
	{ kind: 'evidence_for', fromId: 't.maxim-summer', toId: 't.maxim-spring-i' },
	{ kind: 'evidence_for', fromId: 't.renew-submit', toId: 't.renew-1' },
	{ kind: 'evidence_for', fromId: 't.maxim-sept', toId: 't.maxim-summer-i' },
	{ kind: 'evidence_for', fromId: 't.course-drop', toId: 't.course' },
	{ kind: 'evidence_for', fromId: 't.anniv-1', toId: 't.maxim-sept-i' },
	{ kind: 'evidence_for', fromId: 't.talk', toId: 't.maxim-ny-i' },
	{ kind: 'evidence_for', fromId: 't.tisha-home', toId: 't.tisha-plan' },
	{ kind: 'evidence_for', fromId: 't.chip-done', toId: 't.step-chip' },
	{ kind: 'evidence_for', fromId: 't.blood-done', toId: 't.step-blood' },
	{ kind: 'evidence_for', fromId: 't.crown', toId: 't.find-dentist' },
	{ kind: 'evidence_for', fromId: 't.offer', toId: 't.find-job' },
	{ kind: 'evidence_for', fromId: 't.salary-1', toId: 't.off-500' },
	{ kind: 'evidence_for', fromId: 't.renew-start', toId: 't.renew-2' },
	{ kind: 'evidence_for', fromId: 't.course-done', toId: 't.autotests' },
	{ kind: 'evidence_for', fromId: 't.tbilisi-back', toId: 't.tbilisi-i' },
	{ kind: 'evidence_for', fromId: 't.mama-visit', toId: 't.mama-visit-i' },
	{ kind: 'revisits', fromId: 't.bank-ok', toId: 't.pay-abroad' },
	{ kind: 'revisits', fromId: 't.dec12', toId: 't.room-empty' },
	{ kind: 'revisits', fromId: 't.room-closed', toId: 't.key' },
	{ kind: 'revisits', fromId: 't.anniv-1', toId: 't.we-decided' },
	{ kind: 'revisits', fromId: 't.autumn2', toId: 't.golden' },
	{ kind: 'revisits', fromId: 't.dark2', toId: 't.dark' },
	{ kind: 'revisits', fromId: 't.smog2', toId: 't.dec12' },
	{ kind: 'revisits', fromId: 't.ny-mama', toId: 't.ny-lena' },
	{ kind: 'revisits', fromId: 't.room-cat', toId: 't.room-empty' },
	{ kind: 'revisits', fromId: 't.salary-1', toId: 't.transfer-1' },
	{ kind: 'revisits', fromId: 't.ac', toId: 't.heat' },
	{ kind: 'revisits', fromId: 't.anniv-2', toId: 't.anniv-1' },
	{ kind: 'revisits', fromId: 't.tbilisi-back', toId: 't.threshold' },
	{ kind: 'revisits', fromId: 't.ny-mine', toId: 't.ny-mama' },
	{ kind: 'revisits', fromId: 't.automation', toId: 't.course-done' },
	{ kind: 'revisits', fromId: 't.key-mama', toId: 't.key' },
	{ kind: 'revisits', fromId: 't.ada-26', toId: 't.ada-1' },
	{ kind: 'revisits', fromId: 't.bank-serbian', toId: 't.serbian-fail' },
	{ kind: 'revisits', fromId: 't.anniv-3', toId: 't.arrive' },
	{ kind: 'revisits', fromId: 't.anniv-3', toId: 't.minus-400' },
	{ kind: 'related_to', fromId: 't.apostille-no', toId: 't.apostille-panic' },
	{ kind: 'related_to', fromId: 't.bar', toId: 't.get-vnz' },
	{ kind: 'related_to', fromId: 't.dec12', toId: 't.maxim-dec12' },
	{ kind: 'related_to', fromId: 't.no-ticket', toId: 't.maxim-dec12' },
	{ kind: 'related_to', fromId: 't.interviews', toId: 't.find-job' },
	{ kind: 'related_to', fromId: 't.gym-1', toId: 't.gym' },
	{ kind: 'related_to', fromId: 't.gym-2', toId: 't.gym' }
];

const closed = (
	factId: string,
	intentionId: string,
	outcome: StoryAssessment['outcome']
): StoryAssessment => ({
	factId,
	intentionId,
	outcome,
	open: false
});

export const ANYA_ASSESSMENTS: readonly StoryAssessment[] = [
	closed('t.arrive', 't.plan-move', 'completed'),
	closed('t.card', 't.plan-vnz', 'completed'),
	closed('t.maxim-after', 't.maxim-dec12', 'not_completed'),
	closed('t.card-hostel', 't.step-card', 'completed'),
	closed('t.ip-decision', 't.step-ip', 'completed'),
	closed('t.visegrad', 't.step-visarun', 'completed'),
	closed('t.bank-ok', 't.step-bank', 'completed'),
	closed('t.submit', 't.step-submit', 'completed'),
	closed('t.decision-call', 't.wait', 'completed'),
	closed('t.maxim-spring', 't.maxim-jan', 'not_completed'),
	closed('t.card', 't.get-vnz', 'completed'),
	closed('t.maxim-summer', 't.maxim-spring-i', 'not_completed'),
	closed('t.renew-submit', 't.renew-1', 'completed'),
	closed('t.maxim-sept', 't.maxim-summer-i', 'not_completed'),
	closed('t.course-drop', 't.course', 'partial'),
	closed('t.anniv-1', 't.maxim-sept-i', 'not_completed'),
	closed('t.talk', 't.maxim-ny-i', 'alternative'),
	closed('t.tisha-home', 't.tisha-plan', 'alternative'),
	closed('t.chip-done', 't.step-chip', 'completed'),
	closed('t.blood-done', 't.step-blood', 'completed'),
	closed('t.crown', 't.find-dentist', 'completed'),
	closed('t.offer', 't.find-job', 'completed'),
	closed('t.salary-1', 't.off-500', 'completed'),
	closed('t.renew-start', 't.renew-2', 'completed'),
	closed('t.course-done', 't.autotests', 'completed'),
	closed('t.tbilisi-back', 't.tbilisi-i', 'completed'),
	closed('t.mama-visit', 't.mama-visit-i', 'completed')
];

/**
 * The six chapters Anya divides her notebook into, by state rather than by calendar: each starts
 * where the one before it ends; the last stays open, because the notebook runs to today.
 */
export const ANYA_CHAPTERS: readonly StoryChapter[] = [
	{
		nameKey: 'demo.anya.chapter.before',
		noteKey: 'demo.anya.chapter.before.note',
		colour: { hue: 40, chroma: 35, depth: 1 },
		start: '2023-05-01',
		lineup: ['s.maxim', 's.lena', 's.jovana', 's.legal', 's.money', 's.tisha', 's.mama'],
		stages: [
			{
				nameKey: 'demo.anya.stage.before.decision',
				noteKey: 'demo.anya.stage.before.decision.note',
				start: '2023-05-01',
				lineup: ['s.maxim', 's.lena', 's.money', 's.work']
			},
			{
				nameKey: 'demo.anya.stage.before.packing',
				noteKey: 'demo.anya.stage.before.packing.note',
				start: '2023-06-01',
				lineup: ['s.jovana', 's.legal', 's.tisha', 's.mama', 's.maxim']
			}
		]
	},
	{
		nameKey: 'demo.anya.chapter.adaptation',
		noteKey: 'demo.anya.chapter.adaptation.note',
		colour: { hue: 50, chroma: 65, depth: 1 },
		start: '2023-09-09',
		lineup: [
			's.lena',
			's.dorcol',
			's.legal',
			's.jovana',
			's.flat',
			's.room',
			's.maxim',
			's.money',
			's.apr-bank',
			's.savska',
			's.milos'
		],
		stages: [
			{
				nameKey: 'demo.anya.stage.adaptation.sofa',
				noteKey: 'demo.anya.stage.adaptation.sofa.note',
				start: '2023-09-09',
				lineup: ['s.lena', 's.dorcol', 's.legal', 's.jovana', 's.apr-bank', 's.maxim']
			},
			{
				nameKey: 'demo.anya.stage.adaptation.flat',
				noteKey: 'demo.anya.stage.adaptation.flat.note',
				start: '2023-10-01',
				lineup: ['s.flat', 's.room', 's.milos', 's.money', 's.apr-bank', 's.maxim', 's.legal']
			},
			{
				nameKey: 'demo.anya.stage.adaptation.wait',
				noteKey: 'demo.anya.stage.adaptation.wait.note',
				start: '2023-11-10',
				lineup: ['s.savska', 's.legal', 's.maxim', 's.room', 's.flat']
			}
		]
	},
	{
		nameKey: 'demo.anya.chapter.plateau',
		noteKey: 'demo.anya.chapter.plateau.note',
		colour: { hue: 215, chroma: 15, depth: 1 },
		start: '2024-01-01',
		lineup: ['s.maxim', 's.legal', 's.savska', 's.serbian', 's.flat', 's.room', 's.ada', 's.money'],
		stages: [
			{
				nameKey: 'demo.anya.stage.plateau.hundred',
				noteKey: 'demo.anya.stage.plateau.hundred.note',
				start: '2024-01-01',
				lineup: ['s.maxim', 's.money', 's.jovana', 's.savska']
			},
			{
				nameKey: 'demo.anya.stage.plateau.card',
				noteKey: 'demo.anya.stage.plateau.card.note',
				start: '2024-03-02',
				lineup: ['s.savska', 's.legal', 's.lena', 's.maxim', 's.serbian', 's.ada']
			},
			{
				nameKey: 'demo.anya.stage.plateau.closed',
				noteKey: 'demo.anya.stage.plateau.closed.note',
				start: '2024-06-01',
				lineup: ['s.room', 's.flat', 's.maxim', 's.serbian']
			}
		]
	},
	{
		nameKey: 'demo.anya.chapter.depression',
		noteKey: 'demo.anya.chapter.depression.note',
		colour: { hue: 250, chroma: 30, depth: 1 },
		start: '2024-09-09',
		lineup: ['s.maxim', 's.tisha', 's.mama', 's.health', 's.money', 's.next', 's.lena'],
		stages: [
			{
				nameKey: 'demo.anya.stage.depression.autumn',
				noteKey: 'demo.anya.stage.depression.autumn.note',
				start: '2024-09-09',
				lineup: ['s.maxim', 's.tisha', 's.mama', 's.flat']
			},
			{
				nameKey: 'demo.anya.stage.depression.tooth',
				noteKey: 'demo.anya.stage.depression.tooth.note',
				start: '2024-10-09',
				lineup: ['s.health', 's.marko', 's.money', 's.next', 's.maxim']
			},
			{
				nameKey: 'demo.anya.stage.depression.fight',
				noteKey: 'demo.anya.stage.depression.fight.note',
				start: '2024-11-16',
				lineup: ['s.maxim', 's.lena', 's.money']
			},
			{
				nameKey: 'demo.anya.stage.depression.ticket',
				noteKey: 'demo.anya.stage.depression.ticket.note',
				start: '2024-12-03',
				lineup: ['s.mama-home', 's.tisha', 's.mama', 's.maxim']
			}
		]
	},
	{
		nameKey: 'demo.anya.chapter.catharsis',
		noteKey: 'demo.anya.chapter.catharsis.note',
		colour: { hue: 355, chroma: 55, depth: 1 },
		start: '2024-12-27',
		lineup: ['s.maxim', 's.mama', 's.tisha', 's.mama-home', 's.room', 's.desk', 's.work'],
		stages: [
			{
				nameKey: 'demo.anya.stage.catharsis.home',
				noteKey: 'demo.anya.stage.catharsis.home.note',
				start: '2024-12-27',
				lineup: ['s.mama-home', 's.maxim', 's.mama']
			},
			{
				nameKey: 'demo.anya.stage.catharsis.talk',
				noteKey: 'demo.anya.stage.catharsis.talk.note',
				start: '2024-12-30',
				lineup: ['s.maxim', 's.mama', 's.tisha']
			},
			{
				nameKey: 'demo.anya.stage.catharsis.tisha',
				noteKey: 'demo.anya.stage.catharsis.tisha.note',
				start: '2025-01-05',
				lineup: ['s.tisha', 's.room', 's.desk', 's.work']
			}
		]
	},
	{
		nameKey: 'demo.anya.chapter.own',
		noteKey: 'demo.anya.chapter.own.note',
		colour: { hue: 150, chroma: 50, depth: 1 },
		start: '2025-02-03',
		lineup: [
			's.work',
			's.desk',
			's.money',
			's.legal',
			's.luka',
			's.gym',
			's.milica',
			's.zemun',
			's.mama'
		],
		stages: [
			{
				nameKey: 'demo.anya.stage.own.run',
				noteKey: 'demo.anya.stage.own.run.note',
				start: '2025-02-03',
				lineup: ['s.work', 's.money', 's.desk', 's.legal', 's.office', 's.milica']
			},
			{
				nameKey: 'demo.anya.stage.own.wide',
				noteKey: 'demo.anya.stage.own.wide.note',
				start: '2025-10-01',
				lineup: ['s.gym', 's.luka', 's.hikes', 's.tbilisi', 's.desk', 's.zemun']
			},
			{
				nameKey: 'demo.anya.stage.own.steady',
				noteKey: 'demo.anya.stage.own.steady.note',
				start: '2026-02-12',
				lineup: ['s.legal', 's.work', 's.mama', 's.luka', 's.zemun', 's.serbian']
			}
		]
	}
];

export const ANYA_STORY: DemoStory = {
	scopes: ANYA_SCOPES,
	scopeLinks: ANYA_SCOPE_LINKS,
	kinds: ANYA_KINDS,
	periods: ANYA_PERIODS,
	traces: ANYA_TRACES,
	traceLinks: ANYA_TRACE_LINKS,
	assessments: ANYA_ASSESSMENTS,
	chapters: ANYA_CHAPTERS
};
