/**
 * Deterministic dense corpus for the `e2e-synthetic` DataSpace.
 *
 * Writes `e2e/fixtures/time-dense.synthetic.json` in the calibration manifest format
 * (`tempience.calibration-review.v2`), so the e2e harness can import it through the ordinary
 * scenario import pipeline. The generator is seeded and dependency-free (prettier only formats
 * the output), so the committed fixture is byte-stable: regenerate with
 * `npm run fixtures:synthetic` and commit both files together.
 *
 * Shape (see the counters printed at the end): 13 Scope in three levels, ~400 Trace over the two
 * years before ANCHOR — moments and intervals (some spanning months), clusters on the same day,
 * pairs on the same minute, a few records without any date, plus three month periods.
 */
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import prettier from 'prettier';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = path.join(projectRoot, 'e2e/fixtures/time-dense.synthetic.json');

const SEED = 20260906;
/** «Сейчас» фикстуры: записи ложатся в два года до этой точки. */
const ANCHOR = Date.UTC(2026, 8, 6);
const MANIFEST_ID = 'time-dense-synthetic-v1';
const TIMEZONE = 'Europe/Belgrade';
const CLAIM = 'claim:synthetic';
const DAY_MS = 86_400_000;
const YEAR_MS = 365 * DAY_MS;

const SCOPE_TREE = [
	[
		'Работа',
		[
			['Tempience', ['Фронт', 'Ядро']],
			['Клиенты', []]
		]
	],
	[
		'Дом',
		[
			['Ремонт', ['Кухня']],
			['Быт', []]
		]
	],
	[
		'Здоровье',
		[
			['Спорт', ['Бег']],
			['Сон', []]
		]
	]
];
const ACTIONS = [
	'Созвон',
	'Правка',
	'Заметка',
	'Встреча',
	'Пробежка',
	'Закупка',
	'Разбор',
	'Черновик',
	'Тест',
	'Ревью'
];
const TOPICS = [
	'оси',
	'ленты',
	'бюджета',
	'кухни',
	'сна',
	'плана',
	'релиза',
	'бэклога',
	'дизайна',
	'корпуса'
];
const LONG_SPANS = ['Отпуск', 'Спринт', 'Курс', 'Ремонт', 'Подготовка к марафону'];
const MONTHS = [
	'Январь',
	'Февраль',
	'Март',
	'Апрель',
	'Май',
	'Июнь',
	'Июль',
	'Август',
	'Сентябрь',
	'Октябрь',
	'Ноябрь',
	'Декабрь'
];

/** mulberry32: small, fast, and the same sequence on every platform. */
const mulberry32 = (seed) => () => {
	seed = (seed + 0x6d2b79f5) | 0;
	let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
	t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
	return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const random = mulberry32(SEED);
const int = (min, max) => min + Math.floor(random() * (max - min + 1));
const pick = (list) => list[int(0, list.length - 1)];

const partsIn = new Intl.DateTimeFormat('en-US', {
	timeZone: TIMEZONE,
	hourCycle: 'h23',
	year: 'numeric',
	month: '2-digit',
	day: '2-digit',
	hour: '2-digit',
	minute: '2-digit',
	timeZoneName: 'longOffset'
});
const localParts = (ms) => {
	const map = Object.fromEntries(partsIn.formatToParts(ms).map((part) => [part.type, part.value]));
	const offset = map.timeZoneName === 'GMT' ? '+00:00' : map.timeZoneName.slice(3);
	return { ...map, offset };
};
const dayValue = (ms) => {
	const p = localParts(ms);
	return `${p.year}-${p.month}-${p.day}`;
};
const minuteValue = (ms) => {
	const p = localParts(ms);
	return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:00${p.offset}`;
};
const monthValue = (ms) => dayValue(ms).slice(0, 7);

const pad = (n, width = 3) => String(n).padStart(width, '0');
const candidate = (candidateId, role, proposed) => ({
	candidateId,
	role,
	proposed,
	claimRefs: [CLAIM],
	gate: 'mapped',
	reason: null
});

// Scope tree → scope candidates and child_of links.
const scopes = [];
const links = [];
const walk = (node, parentId) => {
	const [name, children] = Array.isArray(node) ? node : [node, []];
	const id = `syn:scope:${pad(scopes.length + 1, 2)}`;
	scopes.push(candidate(id, 'scope', { name, note: null, startedAt: null, endedAt: null }));
	if (parentId) {
		links.push(
			candidate(`syn:link:scope:${pad(scopes.length, 2)}`, 'intersection', {
				fromId: id,
				toId: parentId,
				kind: 'child_of',
				context: null
			})
		);
	}
	for (const child of children) walk(child, id);
};
for (const root of SCOPE_TREE) walk(root, null);
const leafIds = scopes
	.map((scope) => scope.candidateId)
	.filter((id) => !links.some((link) => link.proposed.toId === id));

// Traces.
const traces = [];
let sequence = 0;
const absolute = (precision, certainty, start, end = null) => ({
	basis: 'absolute',
	precision,
	certainty,
	start,
	end
});
const trace = (content, aboutKind, aboutTime, scopeId) => {
	sequence += 1;
	const id = `syn:trace:${pad(sequence)}`;
	traces.push(
		candidate(id, 'trace', {
			content,
			relation: 'actual',
			aboutKind,
			aboutTime,
			timezone: TIMEZONE
		})
	);
	links.push(
		candidate(`syn:link:trace:${pad(sequence)}`, 'intersection', {
			fromId: id,
			toId: scopeId,
			kind: 'belongs_to',
			context: null
		})
	);
};
const anyScope = () => (random() < 0.7 ? pick(leafIds) : pick(scopes).candidateId);
const momentAt = () => ANCHOR - int(1, (2 * YEAR_MS) / DAY_MS) * DAY_MS + int(7, 22) * 3_600_000;
const title = () => `${pick(ACTIONS)} ${pick(TOPICS)} #${sequence + 1}`;

const counts = {
	instants: 0,
	intervals: 0,
	longIntervals: 0,
	offAxis: 0,
	samePairs: 0,
	clusters: 0
};

// Uniform moments over two years: mostly exact minutes, some approximate days.
for (let i = 0; i < 200; i += 1) {
	const at = momentAt() + int(0, 59) * 60_000;
	const exact = random() < 0.75;
	trace(
		title(),
		'instant',
		exact
			? absolute('minute', 'exact', minuteValue(at))
			: absolute('day', 'approximate', dayValue(at)),
		anyScope()
	);
	counts.instants += 1;
}

// Short intervals of one to six days, and long ones spanning a month or more.
for (let i = 0; i < 90; i += 1) {
	const start = momentAt();
	const end = start + int(1, 6) * DAY_MS;
	trace(title(), 'interval', absolute('day', 'exact', dayValue(start), dayValue(end)), anyScope());
	counts.intervals += 1;
}
for (let i = 0; i < 12; i += 1) {
	const start = ANCHOR - int(60, 700) * DAY_MS;
	const end = start + int(30, 200) * DAY_MS;
	trace(
		`${pick(LONG_SPANS)} #${sequence + 1}`,
		'interval',
		absolute('day', random() < 0.5 ? 'exact' : 'approximate', dayValue(start), dayValue(end)),
		anyScope()
	);
	counts.intervals += 1;
	counts.longIntervals += 1;
}

// Clusters: several days that gather 10–14 records each.
for (let day = 0; day < 6; day += 1) {
	const base = ANCHOR - int(2, 720) * DAY_MS;
	const size = int(10, 14);
	for (let i = 0; i < size; i += 1) {
		const at = base + int(8, 21) * 3_600_000 + int(0, 59) * 60_000;
		trace(title(), 'instant', absolute('minute', 'exact', minuteValue(at)), anyScope());
	}
	counts.clusters += 1;
	counts.instants += size;
}

// Pairs on exactly the same minute.
for (let i = 0; i < 10; i += 1) {
	const at = momentAt() + int(0, 59) * 60_000;
	const scopeId = anyScope();
	trace(title(), 'instant', absolute('minute', 'exact', minuteValue(at)), scopeId);
	trace(title(), 'instant', absolute('minute', 'exact', minuteValue(at)), anyScope());
	counts.samePairs += 1;
	counts.instants += 2;
}

// Records without any date stay off the axis.
for (let i = 0; i < 8; i += 1) {
	trace(`${pick(ACTIONS)} без даты #${sequence + 1}`, 'instant', { basis: 'unknown' }, anyScope());
	counts.offAxis += 1;
}

// Three month periods right before the anchor.
const periods = [];
for (let back = 1; back <= 3; back += 1) {
	const month = monthValue(ANCHOR - back * 30 * DAY_MS);
	periods.push(
		candidate(`syn:period:${month}`, 'period', {
			name: `${MONTHS[Number(month.slice(5)) - 1]} ${month.slice(0, 4)}`,
			time: { precision: 'month', start: month, end: month },
			timezone: TIMEZONE,
			note: back === 1 ? 'Месяц с самой плотной осью.' : null
		})
	);
}

const manifest = {
	schemaVersion: 'tempience.calibration-review.v2',
	manifestId: MANIFEST_ID,
	title: 'Synthetic dense Scope × Time corpus',
	sourceIds: ['source:synthetic'],
	claimRefs: [CLAIM],
	claimEvidence: [
		{
			claimRef: CLAIM,
			statement: 'Синтетический корпус для e2e-проверок плотности ленты и оси.',
			sourceWording: 'scripts/generate-synthetic-manifest.mjs',
			sourceRefs: [
				{ sourceId: 'source:synthetic', title: 'Synthetic generator', locator: `seed ${SEED}` }
			]
		}
	],
	candidates: [...scopes, ...periods, ...traces, ...links]
};

const formatted = await prettier.format(JSON.stringify(manifest), {
	...(await prettier.resolveConfig(outputPath)),
	filepath: outputPath
});
await writeFile(outputPath, formatted, 'utf8');
console.log(
	`${path.relative(projectRoot, outputPath)}: ${scopes.length} scope, ${traces.length} trace ` +
		`(${counts.instants} instant, ${counts.intervals} interval incl. ${counts.longIntervals} long, ` +
		`${counts.offAxis} off-axis, ${counts.samePairs} same-minute pairs, ${counts.clusters} clusters), ` +
		`${periods.length} period, ${links.length} links`
);
