import { Temporal } from 'temporal-polyfill';
import type { MoveTarget } from '../MoveIntention/types';

export type OrderTarget = MoveTarget | { kind: 'later' };
export const orderKey = (target: OrderTarget, zone: string): string => {
	switch (target.kind) {
		case 'day':
			return `day:${target.dayKey}`;
		case 'week':
			return `week:${Temporal.Instant.fromEpochMilliseconds(target.weekStart).toZonedDateTimeISO(zone).toPlainDate()}`;
		case 'later':
			return 'later';
		case 'undated':
			return 'undated';
	}
};
export const applyOrder = <T extends { id: string }>(
	items: readonly T[],
	ids: readonly string[]
): T[] => {
	const byId = new Map(items.map((item) => [item.id, item]));
	const result: T[] = [];
	for (const id of ids) {
		const item = byId.get(id);
		if (item) {
			result.push(item);
			byId.delete(id);
		}
	}
	return result.concat(items.filter((item) => byId.has(item.id)));
};
export const placeAt = (
	ids: readonly string[],
	movingId: string,
	beforeId: string | null
): string[] => {
	if (beforeId === movingId && ids.includes(movingId)) return [...ids];
	const result = ids.filter((id) => id !== movingId);
	const index = beforeId === null ? -1 : result.indexOf(beforeId);
	result.splice(index < 0 ? result.length : index, 0, movingId);
	return result;
};

/** Resolve the next list entry from the half of the hovered card. */
export const beforeForPosition = (
	ids: readonly string[],
	targetId: string,
	after: boolean
): string | null => {
	if (!after) return targetId;
	const index = ids.indexOf(targetId);
	return index < 0 ? null : (ids[index + 1] ?? null);
};
