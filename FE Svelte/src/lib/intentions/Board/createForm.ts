import { Temporal } from 'temporal-polyfill';
import type { ExplorerIntersection, ExplorerScope } from '$lib/model/Snapshot/types';
import type { MoveTarget } from '../MoveIntention/types';

export function dateLabel(target: MoveTarget, locale: string, week: string, undated: string) {
	if (target.kind === 'week') return week;
	if (target.kind === 'undated') return undated;
	return new Intl.DateTimeFormat(locale, {
		weekday: 'short',
		day: 'numeric',
		month: 'short',
		timeZone: 'UTC'
	}).format(new Date(`${target.dayKey}T12:00:00Z`));
}
export function whenTarget(
	choice: 'today' | 'tomorrow' | 'week' | 'undated',
	today: string,
	weekStart: number
): MoveTarget {
	if (choice === 'week') return { kind: 'week', weekStart };
	if (choice === 'undated') return { kind: 'undated' };
	return {
		kind: 'day',
		dayKey: choice === 'today' ? today : Temporal.PlainDate.from(today).add({ days: 1 }).toString()
	};
}

export const formParentId = (locked: string | undefined, selected: string | undefined) =>
	locked ?? selected;
export const initialFormTarget = (target: MoveTarget, locked: string | undefined): MoveTarget =>
	locked ? { kind: 'undated' } : target;
export const inheritedScopes = (
	parentId: string | undefined,
	scopes: readonly ExplorerScope[],
	links: readonly ExplorerIntersection[]
) =>
	scopes.filter((scope) =>
		links.some(
			(link) => link.kind === 'belongs_to' && link.fromId === parentId && link.toId === scope.id
		)
	);

export const effectiveScopes = (chosen: readonly string[] | null, inherited: readonly string[]) =>
	chosen ?? inherited;
export const scopeIdsForCreate = (chosen: readonly string[] | null) => chosen ?? undefined;

/** An unsuccessful submission keeps the form open and exposes its message. */
export const submitCreateForm = async (create: () => Promise<string | null>) => {
	const error = await create();
	return { error: error ?? '', close: error === null };
};
