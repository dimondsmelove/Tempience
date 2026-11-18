import { Temporal } from 'temporal-polyfill';
import type { MoveTarget } from '../MoveIntention/types';

export const hasResultText = (text: string) => text.trim().length > 0;
export type ResultPlacement = { carry: MoveTarget | null; copyDay: string | null };
export const selectCarry = (carry: MoveTarget | null): ResultPlacement => ({
	carry,
	copyDay: null
});
export const toggleCopyDay = (state: ResultPlacement, day: string): ResultPlacement => ({
	carry: null,
	copyDay: state.copyDay === day ? null : day
});
export const savesAndCloses = (outcome: 'partial' | 'alternative', copyDay: string | null) =>
	outcome === 'alternative' || Boolean(copyDay);
export const tomorrowTarget = (
	zone: string,
	now = Date.now()
): Extract<MoveTarget, { kind: 'day' }> => ({
	kind: 'day',
	dayKey: Temporal.Instant.fromEpochMilliseconds(now)
		.toZonedDateTimeISO(zone)
		.toPlainDate()
		.add({ days: 1 })
		.toString()
});

/** Once the fact exists, subsequent failures must never cause it to be recorded again. */
export async function finishResult(
	factId: string,
	target: MoveTarget | null,
	move: (target: MoveTarget) => Promise<string | null>,
	undoMove: (operation: string) => Promise<void>,
	undoFact: (factId: string) => Promise<void>
): Promise<{ moveFailure: unknown; invert: () => Promise<void> }> {
	let operation: string | null = null;
	let moveFailure: unknown = null;
	if (target) {
		try {
			operation = await move(target);
		} catch (cause) {
			moveFailure = cause ?? new Error();
		}
	}
	let moveUndone = false;
	return {
		moveFailure,
		invert: async () => {
			if (operation && !moveUndone) {
				await undoMove(operation);
				moveUndone = true;
			}
			await undoFact(factId);
		}
	};
}
