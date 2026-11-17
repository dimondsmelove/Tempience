import { Temporal } from 'temporal-polyfill';
import type { ExplorerSnapshot, ExplorerTrace } from '$lib/model/Snapshot/types';
import { isIntentionRelation } from '$lib/state/triplit/Traces/roles';
import { traceMarkTime } from '$lib/model/Projection/marks';
import type { IntentionAssessment } from '$lib/state/triplit/IntentionAssessments/types';

export type ClosedGroup = { day: string | null; items: ExplorerTrace[] };

/** Group closed intentions by the date of their effective completion evidence. */
export const closedIntentions = (
	snapshot: Pick<ExplorerSnapshot, 'traces'>,
	assessments: readonly IntentionAssessment[],
	zone: string,
	limit = 50,
	search = '',
	locale = 'en'
): { groups: ClosedGroup[]; total: number } => {
	const completed = new Set(
		assessments
			.filter(
				(item) =>
					item.source === 'evidence' &&
					item.factId &&
					item.outcome === 'completed' &&
					item.open === false &&
					!item.isDeleted
			)
			.map((item) => JSON.stringify([item.intentionId, item.factId]))
	);
	const evidence = new Map<string, number | null>();
	for (const fact of snapshot.traces) {
		for (const id of fact.closesIntentionIds ?? []) {
			if (completed.has(JSON.stringify([id, fact.id])))
				evidence.set(id, traceMarkTime(fact)?.start ?? null);
		}
	}
	const items = snapshot.traces
		.filter(
			(trace) =>
				isIntentionRelation(trace.relation) &&
				trace.intentOpen === false &&
				trace.content
					.split('\n')[0]
					.toLocaleLowerCase(locale)
					.includes(search.trim().toLocaleLowerCase(locale))
		)
		.map((trace) => {
			const projected = trace.intentClosedAt ? Date.parse(trace.intentClosedAt) : NaN;
			const instant = evidence.get(trace.id) ?? (Number.isFinite(projected) ? projected : null);
			return { trace, instant };
		})
		.toSorted(
			(a, b) =>
				(b.instant ?? -Infinity) - (a.instant ?? -Infinity) || a.trace.id.localeCompare(b.trace.id)
		);
	const groups: ClosedGroup[] = [];
	for (const item of items.slice(0, Math.max(0, limit))) {
		const day =
			item.instant === null
				? null
				: Temporal.Instant.fromEpochMilliseconds(item.instant)
						.toZonedDateTimeISO(zone)
						.toPlainDate()
						.toString();
		if (groups.at(-1)?.day !== day || !groups.length) groups.push({ day, items: [] });
		groups.at(-1)!.items.push(item.trace);
	}
	return { groups, total: items.length };
};

export const closedDayLabel = (day: string, today: string, locale: string): string =>
	new Intl.DateTimeFormat(locale, {
		weekday: 'short',
		day: 'numeric',
		month: 'short',
		...(day.slice(0, 4) !== today.slice(0, 4) ? { year: 'numeric' } : {}),
		timeZone: 'UTC'
	})
		.format(new Date(`${day}T12:00:00Z`))
		.replace(/^([^,]+),\s*/, '$1 ');
