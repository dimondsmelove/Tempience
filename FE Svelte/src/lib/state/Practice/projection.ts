import { Temporal } from 'temporal-polyfill';
import { isIntentionRelation } from '$lib/state/triplit/Traces/roles';
import { practiceFields, samePath } from '$lib/state/triplit/PracticeSettings/source';
import type { PracticeSource } from '$lib/state/triplit/PracticeSettings/types';
import type { Intersection, Trace, TraceKindV } from '$lib/state/triplit/types';
import type { PracticeProjection, PracticeIssue } from './types';
import type { PracticeEntry } from '$lib/practice/PracticeDemo/types';

export const projectPractice = (
	source: PracticeSource,
	traces: readonly Trace[],
	versions: readonly TraceKindV[],
	links: readonly Intersection[],
	activeScopeIds: readonly string[],
	timezone: string
): PracticeProjection => {
	const entries: PracticeEntry[] = [],
		issues: PracticeIssue[] = [];
	const scopeIds = new Set(source.scopeIds.filter((id) => activeScopeIds.includes(id)));
	const memberships = new Map<string, Set<string>>();
	for (const link of links) {
		if (
			link.isDeleted ||
			link.kind !== 'belongs_to' ||
			link.fromEntityType === 'traceKind' ||
			!scopeIds.has(link.toId)
		)
			continue;
		const ids = memberships.get(link.fromId) ?? new Set<string>();
		ids.add(link.toId);
		memberships.set(link.fromId, ids);
	}
	const validVersions = new Set(
		versions
			.filter(
				(version) =>
					version.kindId === source.kindId &&
					practiceFields(version).some((leaf) => samePath(leaf.path, source.path))
			)
			.map((version) => version.id)
	);
	for (const trace of traces) {
		if (trace.isDeleted || trace.kindId !== source.kindId || isIntentionRelation(trace.relation))
			continue;
		const reject = (reason: PracticeIssue['reason']) => issues.push({ id: trace.id, reason });
		if (!trace.kindVId || !validVersions.has(trace.kindVId)) {
			reject('version');
			continue;
		}
		let value: unknown = trace.data;
		for (const key of source.path)
			value =
				value && typeof value === 'object' && !Array.isArray(value)
					? (value as Record<string, unknown>)[key]
					: undefined;
		if (!Number.isSafeInteger(value) || (value as number) <= 0) {
			reject('value');
			continue;
		}
		const scopes = [...(memberships.get(trace.id) ?? [])];
		if (scopes.length !== 1) {
			reject('scope');
			continue;
		}
		const time = trace.aboutTime;
		if (
			!time ||
			time.basis !== 'absolute' ||
			time.certainty !== 'exact' ||
			(time.precision !== 'day' && time.precision !== 'minute')
		) {
			reject('time');
			continue;
		}
		let date: string,
			hour: number | null = null;
		if (time.precision === 'day') {
			if (time.end && time.end !== time.start) {
				reject('time');
				continue;
			}
			date = time.start.slice(0, 10);
		} else {
			const start = Temporal.Instant.from(time.start).toZonedDateTimeISO(timezone);
			if (
				time.end &&
				Temporal.Instant.from(time.end).toZonedDateTimeISO(timezone).toPlainDate().toString() !==
					start.toPlainDate().toString()
			) {
				reject('time');
				continue;
			}
			date = start.toPlainDate().toString();
			hour = start.hour;
		}
		entries.push({
			id: trace.id,
			kindId: source.kindId,
			scopeIds: scopes,
			date,
			hour,
			data: { minutes: value as number },
			note: trace.description ?? trace.content
		});
	}
	return { entries, issues };
};
