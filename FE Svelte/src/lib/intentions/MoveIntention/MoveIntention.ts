import { Temporal } from 'temporal-polyfill';
import type { ExplorerTrace } from '$lib/model/Snapshot/types';
import { buildRepositoryExplorerSnapshot } from '$lib/state/Workbench/snapshot';
import type { TempienceRepository } from '$lib/state/triplit/repository';
import { isIntentionRelation } from '$lib/state/triplit/Traces/roles';
import type { MoveResult, MoveSavedResult, MoveTarget } from './types';

export const planMove = (trace: ExplorerTrace, target: MoveTarget, zone: string): MoveResult => {
	if (!isIntentionRelation(trace.relation)) return { ok: false, reason: 'not_intention' };
	if (trace.intentOpen === false) return { ok: false, reason: 'closed' };
	return planPlacement(trace, target, zone);
};

/** Shared placement rules for moving and creating an intention. */
export const planPlacement = (
	trace: Pick<ExplorerTrace, 'statedDuration' | 'aboutTime'>,
	target: MoveTarget,
	zone: string
): MoveResult => {
	const statedDuration = trace.statedDuration ?? null;
	const aboutKind = statedDuration ? 'interval' : 'instant';
	if (target.kind === 'undated')
		return { ok: true, fields: { aboutKind, aboutTime: { basis: 'unknown' }, statedDuration } };
	try {
		const date =
			target.kind === 'day'
				? Temporal.PlainDate.from(target.dayKey)
				: Temporal.Instant.fromEpochMilliseconds(target.weekStart)
						.toZonedDateTimeISO(zone)
						.toPlainDate();
		if (target.kind === 'week') {
			if (date.dayOfWeek !== 1 || date.toZonedDateTime(zone).epochMilliseconds !== target.weekStart)
				return { ok: false, reason: 'invalid_target' };
			return {
				ok: true,
				fields: {
					aboutKind: 'interval',
					statedDuration: null,
					aboutTime: {
						basis: 'absolute',
						precision: 'day',
						certainty: 'exact',
						start: date.toString(),
						end: date.add({ days: 6 }).toString()
					}
				}
			};
		}
		if (trace.aboutTime?.basis === 'absolute' && trace.aboutTime.precision === 'minute') {
			const time = Temporal.Instant.from(trace.aboutTime.start)
				.toZonedDateTimeISO(zone)
				.toPlainTime();
			const destination = date.toPlainDateTime(time).toZonedDateTime(zone);
			if (!destination.toPlainTime().equals(time)) return { ok: false, reason: 'invalid_target' };
			const start = destination.toString({ timeZoneName: 'never' });
			return {
				ok: true,
				fields: {
					aboutKind,
					statedDuration,
					aboutTime: {
						basis: 'absolute',
						precision: 'minute',
						certainty: 'exact',
						start,
						end: null
					}
				}
			};
		}
		return {
			ok: true,
			fields: {
				aboutKind,
				statedDuration,
				aboutTime: {
					basis: 'absolute',
					precision: 'day',
					certainty: 'exact',
					start: date.toString(),
					end: null
				}
			}
		};
	} catch {
		return { ok: false, reason: 'invalid_target' };
	}
};

/** Read the existing snapshot's openness and perform one journalled record edit. */
export const moveIntention = async (
	repository: TempienceRepository,
	traceId: string,
	target: MoveTarget,
	zone: string
): Promise<MoveSavedResult> => {
	const snapshot = await buildRepositoryExplorerSnapshot(repository, 'intentions');
	const trace = snapshot.traces.find((item) => item.id === traceId);
	if (!trace) return { ok: false, reason: 'not_found' };
	const result = planMove(trace, target, zone);
	if (!result.ok) return result;
	const saved = await repository.saveTraceRecord({
		id: traceId,
		fields: {
			...result.fields,
			...(trace.aboutTraceId !== null ? { aboutTraceId: null } : {})
		}
	});
	return { ...result, operationId: saved.operation.id };
};
