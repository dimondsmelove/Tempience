import type { TraceRepository } from '$lib/state/triplit/Repository/types';
import type { TraceAboutTime } from '$lib/state/triplit/types';
import { freeHue, resolveEnds } from '$lib/model/Chapters';
import type { Chapter, LineupEntry } from '$lib/model/Chapters/types';

/**
 * The chapters lab's story (loop 012), kept as a fixture for the chapters' unit and e2e tests:
 * an owner-like tree of Scopes, records from June to late September 2026 in Belgrade, and three
 * chapters with their stages and lineups.
 */

export type StoryRepository = Pick<
	TraceRepository,
	| 'createScope'
	| 'createIntersection'
	| 'createTraceWithScopes'
	| 'linkTraceToTrace'
	| 'createChapter'
	| 'createChapterStage'
	| 'listChapters'
>;

/** The story's records are written in Belgrade. */
export const STORY_TIMEZONE = 'Europe/Belgrade';

/** Summer and autumn 2026 in Belgrade are CEST: every seed instant carries +02:00. */
const at = (local: string): string => `${local.replace(' ', 'T')}:00+02:00`;

const instant = (iso: string): TraceAboutTime => ({
	basis: 'absolute',
	precision: 'minute',
	certainty: 'exact',
	start: iso,
	end: null
});

type ScopeSeed = Readonly<{
	key: string;
	name: string;
	parent?: string;
	hue: number;
	chroma: number;
	depth: number;
	note?: string;
}>;

/** The owner-like tree: people, work, the body, the city, the language, the project. */
const SCOPES: readonly ScopeSeed[] = [
	{ key: 'digital', name: 'Цифровая жизнь', hue: 215, chroma: 45, depth: 0 },
	{ key: 'tempience', name: 'Tempience', parent: 'digital', hue: 195, chroma: 80, depth: 1 },
	{ key: 'people', name: 'Люди', hue: 285, chroma: 50, depth: 0 },
	{ key: 'mama', name: 'Мама', parent: 'people', hue: 285, chroma: 70, depth: 1 },
	{ key: 'lera', name: 'Лерка', parent: 'people', hue: 310, chroma: 65, depth: 1 },
	{ key: 'work', name: 'Работа', hue: 30, chroma: 60, depth: 0 },
	{ key: 'onewin', name: '1Win', parent: 'work', hue: 20, chroma: 80, depth: 1 },
	{ key: 'body', name: 'Зажимы', hue: 350, chroma: 55, depth: 0 },
	{ key: 'food', name: 'Питание', hue: 120, chroma: 55, depth: 0 },
	{ key: 'boxing', name: 'Бокс', hue: 5, chroma: 90, depth: 2 },
	{ key: 'belgrade', name: 'Белград', hue: 45, chroma: 60, depth: 0 },
	{ key: 'serbian', name: 'Сербский', hue: 170, chroma: 50, depth: 0 }
];

type FactSeed = readonly [local: string, content: string, scopes: readonly string[]];

/** Plain records, exact to the minute, 2026-06-01 … today. */
const FACTS: readonly FactSeed[] = [
	['2026-06-02 14:30', 'Прилетел в Белград, заселился на Дорчоле', ['belgrade']],
	['2026-06-03 11:00', 'Созвон с командой 1Win, передал лендинги', ['onewin']],
	['2026-06-04 09:40', 'Подал документы на боравак в МУП на Савской', ['belgrade']],
	['2026-06-06 08:15', 'Нашёл пекару у дома, беру бурек по утрам', ['food', 'belgrade']],
	['2026-06-07 19:00', 'Созвон с мамой', ['mama']],
	['2026-06-09 12:20', 'Открыл счёт в Raiffeisen', ['belgrade']],
	['2026-06-10 18:00', 'Первое занятие сербского, группа А1', ['serbian']],
	['2026-06-12 10:00', 'Первое занятие по телесной практике', ['body']],
	['2026-06-14 16:00', 'Лерка прилетела на выходные', ['lera']],
	['2026-06-16 15:00', 'Релиз лендинга для Бразилии', ['onewin']],
	['2026-06-18 17:30', 'Посмотрел квартиру на Врачаре, не взял', ['belgrade']],
	['2026-06-20 21:00', 'Перенёс сервер домой, поднял Tailscale', ['digital']],
	['2026-06-24 18:00', 'Сербский: винительный падеж', ['serbian']],
	['2026-06-27 19:30', 'Пробное занятие по боксу на Ташмайдане', ['boxing']],
	['2026-07-01 13:00', 'Переехал на Врачар, договор на год', ['belgrade']],
	['2026-07-03 09:00', 'Зажим в шее, два дня', ['body']],
	['2026-07-05 20:00', 'Созвон с мамой, рассказал про квартиру', ['mama']],
	['2026-07-07 14:00', 'Ревью A/B-теста офферов', ['onewin']],
	['2026-07-08 18:00', 'Сербский: прошедшее время', ['serbian']],
	['2026-07-11 19:30', 'Бокс, второе занятие', ['boxing']],
	['2026-07-15 10:30', 'Получил белый картон', ['belgrade']],
	['2026-07-22 18:00', 'Сербский: разговорный клуб', ['serbian']],
	['2026-07-25 20:30', 'Ужин с Леркой на Скадарлии', ['lera']],
	['2026-07-28 11:00', 'Созвон по бюджету на третий квартал', ['work']],
	['2026-08-01 19:30', 'Бокс: первый спарринг', ['boxing']],
	['2026-08-05 12:00', 'Боравак одобрен', ['belgrade']],
	['2026-08-09 17:00', 'Мама прислала посылку', ['mama']],
	['2026-08-11 16:00', 'Сдал отчёт по конверсиям за июль', ['onewin']],
	['2026-08-12 18:00', 'Сербский: будущее время', ['serbian']],
	['2026-08-15 22:00', 'Настроил бэкапы на внешний диск', ['digital']],
	['2026-08-20 18:30', 'Купил велосипед, катаюсь по Аде', ['belgrade']],
	['2026-08-22 21:00', 'Встреча экспатов в баре на Дорчоле', ['people', 'belgrade']],
	['2026-08-26 18:00', 'Сдал тест А1 на 78 из 100', ['serbian']],
	['2026-08-29 12:00', 'Договорился о частичной занятости с сентября', ['work']],
	['2026-09-01 09:00', 'Сел за Tempience на полный день', ['tempience']],
	['2026-09-01 08:00', 'Начал завтракать дома', ['food']],
	['2026-09-02 07:40', 'Практика, 20 минут', ['body']],
	['2026-09-03 16:00', 'Лента: слияние строк', ['tempience']],
	['2026-09-05 07:45', 'Практика, 20 минут', ['body']],
	['2026-09-06 19:00', 'Созвон с мамой, 40 минут', ['mama']],
	['2026-09-07 18:00', 'Экспорт в JSON работает', ['tempience']],
	['2026-09-08 12:00', 'Готовлю на три дня вперёд', ['food']],
	['2026-09-09 07:30', 'Практика, 20 минут', ['body']],
	['2026-09-10 17:00', 'Формы записи, первый проход', ['tempience']],
	['2026-09-12 07:50', 'Практика, 25 минут', ['body']],
	['2026-09-13 15:00', 'Лерка в гостях, гуляли по Калемегдану', ['lera']],
	['2026-09-14 22:10', 'Owner-версия на 8448', ['tempience']],
	['2026-09-15 08:05', 'Взвесился: 81,2 кг', ['food']],
	['2026-09-15 11:00', 'Созвон 1Win, 30 минут, передача дел', ['onewin']],
	['2026-09-16 07:35', 'Практика, 20 минут', ['body']],
	['2026-09-17 21:00', 'Разобрал 94 записи в «Моих данных»', ['tempience']],
	['2026-09-19 07:40', 'Практика, 20 минут', ['body']],
	['2026-09-19 18:00', 'Цвет Scope: цветок вместо ползунков', ['tempience']],
	['2026-09-20 19:30', 'Созвон с мамой', ['mama']],
	['2026-09-20 23:00', 'Луп 008 в master', ['tempience']],
	['2026-09-22 20:00', 'Неделя без доставки', ['food']],
	['2026-09-23 07:30', 'Практика, 20 минут', ['body']],
	['2026-09-23 20:00', 'Показал Tempience Лерке', ['tempience', 'lera']],
	['2026-09-25 18:00', 'Демо «Аня» готово', ['tempience']],
	['2026-09-26 07:45', 'Практика, 20 минут', ['body']]
];

type IntentSeed = readonly [
	captured: string,
	local: string,
	content: string,
	scopes: readonly string[]
];

/** Plans dated by when they are meant to happen, written earlier. */
const INTENTS: readonly IntentSeed[] = [
	[
		'2026-09-24 10:00',
		'2026-09-29 18:00',
		'Показать Tempience двум знакомым',
		['tempience', 'people']
	],
	['2026-09-24 10:05', '2026-10-01 19:30', 'Вернуться в бокс, пробное занятие', ['boxing']],
	['2026-09-24 10:10', '2026-10-04 19:00', 'Созвон с мамой', ['mama']],
	['2026-09-25 21:00', '2026-10-07 12:00', 'Выложить публичную версию', ['tempience']],
	['2026-09-25 21:05', '2026-10-10 10:00', 'Записаться на А2', ['serbian']]
];

/**
 * The whole story written into a space: Scopes, records (one closed intention shows a result on
 * the ribbon) and the three chapters with their stages. Returns the chapters as read back.
 */
export const seedChapterStory = async (repository: StoryRepository): Promise<Chapter[]> => {
	const ids = new Map<string, string>();
	for (const seed of SCOPES) {
		const scope = await repository.createScope({
			name: seed.name,
			note: seed.note ?? null,
			colorHue: seed.hue,
			colorChroma: seed.chroma,
			colorDepth: seed.depth
		});
		ids.set(seed.key, scope.id);
		if (seed.parent)
			await repository.createIntersection({
				fromId: scope.id,
				toId: ids.get(seed.parent)!,
				kind: 'child_of'
			});
	}
	const scopeIds = (keys: readonly string[]): string[] => keys.map((key) => ids.get(key)!);

	let released: string | null = null;
	for (const [local, content, scopes] of FACTS) {
		const iso = at(local);
		const trace = await repository.createTraceWithScopes(
			{
				content,
				capturedAt: iso,
				timezone: STORY_TIMEZONE,
				aboutKind: 'instant',
				aboutTime: instant(iso),
				relation: 'actual'
			},
			scopeIds(scopes)
		);
		if (content === 'Owner-версия на 8448') released = trace.id;
	}
	for (const [captured, local, content, scopes] of INTENTS)
		await repository.createTraceWithScopes(
			{
				content,
				capturedAt: at(captured),
				timezone: STORY_TIMEZONE,
				aboutKind: 'instant',
				aboutTime: instant(at(local)),
				relation: 'intend'
			},
			scopeIds(scopes)
		);
	const plan = await repository.createTraceWithScopes(
		{
			content: 'Выкатить owner-версию',
			capturedAt: at('2026-09-05 09:00'),
			timezone: STORY_TIMEZONE,
			aboutKind: 'instant',
			aboutTime: instant(at('2026-09-14 20:00')),
			relation: 'intend'
		},
		scopeIds(['tempience'])
	);
	if (released) await repository.linkTraceToTrace(released, plan.id, 'evidence_for');

	const scopes = SCOPES.map((seed) => ({
		id: ids.get(seed.key)!,
		name: seed.name,
		colorHue: seed.hue
	}));
	for (const chapter of storyOf(scopes)) {
		const { id } = await repository.createChapter(chapter);
		for (const stage of chapter.stages) await repository.createChapterStage(id, stage);
	}
	return repository.listChapters();
};

type Named = Readonly<{ id: string; name: string; colorHue?: number | null }>;

/**
 * The three chapters of the story as the domain holds them, their lineups found by name among
 * the Scopes given. Each
 * chapter's hue is the one farthest from every Scope hue and the chapters before it, so a
 * chapter never reads as a Scope on the band or in the lines.
 */
export const seedChapters = (scopes: readonly Named[]): Chapter[] => resolveEnds(storyOf(scopes));

const storyOf = (scopes: readonly Named[]): Chapter[] => {
	const lineup = (focus: readonly string[], support: readonly string[]): LineupEntry[] =>
		[
			...focus.map((name) => ({ name, level: 'focus' as const })),
			...support.map((name) => ({ name, level: 'support' as const }))
		].flatMap(({ name, level }) => {
			const found = scopes.find((scope) => scope.name === name);
			return found ? [{ scopeId: found.id, level }] : [];
		});
	const used = scopes.flatMap((scope) =>
		typeof scope.colorHue === 'number' ? [scope.colorHue] : []
	);
	const hues: number[] = [];
	for (let index = 0; index < 3; index++) hues.push(freeHue([...used, ...hues]));
	return [
		{
			id: 'chapter-move',
			name: 'Переезд',
			note: 'Обжиться в Белграде: документы, квартира, язык. Работа идёт фоном, лишнего не беру.',
			colorHue: hues[0],
			colorChroma: 70,
			colorDepth: 1,
			start: at('2026-06-01 00:00'),
			end: null,
			closedAt: null,
			lineup: lineup(['Белград', 'Сербский'], ['Работа']),
			stages: [
				{
					id: 'stage-move-land',
					name: 'Приземление',
					note: '',
					start: at('2026-06-01 00:00'),
					lineup: null
				},
				{
					id: 'stage-move-settle',
					name: 'Обустройство',
					note: '',
					start: at('2026-07-01 00:00'),
					lineup: null
				}
			]
		},
		{
			id: 'chapter-system',
			name: 'Собрать систему',
			note: 'Довожу Tempience до руки и живу в нём сам. Тело держу через Зажимы, ем дома. Работа — по минимуму.',
			colorHue: hues[1],
			colorChroma: 90,
			colorDepth: 2,
			start: at('2026-09-01 00:00'),
			end: null,
			closedAt: null,
			lineup: lineup(['Tempience'], ['Зажимы', 'Питание', 'Люди']),
			stages: [
				{
					id: 'stage-system-open',
					name: 'Открытие',
					note: 'Пролог, среда, первые привычки: сначала тело и еда, система следом.',
					start: at('2026-09-01 00:00'),
					lineup: lineup(['Питание', 'Зажимы'], ['Tempience'])
				},
				{
					id: 'stage-system-push',
					name: 'Рывок',
					note: 'Каждый день Tempience и практика утром.',
					start: at('2026-09-08 00:00'),
					lineup: null
				}
			]
		},
		{
			id: 'chapter-out',
			name: 'Выход наружу',
			note: 'Показываю Tempience людям и слушаю, что ломается. Возвращаю бокс.',
			colorHue: hues[2],
			colorChroma: 85,
			colorDepth: 2,
			start: at('2026-09-28 00:00'),
			end: null,
			closedAt: null,
			lineup: lineup(['Tempience', 'Бокс'], ['Люди']),
			stages: []
		}
	];
};
