import { Temporal } from 'temporal-polyfill';
import { buildRepositoryExplorerSnapshot } from '$lib/state/Workbench/snapshot';
import type { TempienceRepository } from '$lib/state/triplit/repository';
import { isIntentionRelation } from '$lib/state/triplit/Traces/roles';
import { planWhen } from './WhenModel';
import type { WhenChoice, WhenContext, WhenResult } from './types';

type Saved = Extract<WhenResult, { ok: true }> & { operationId?: string };

/** Plan against the current snapshot and journal only an actual placement change. */
export async function moveWhen(
	repository: TempienceRepository,
	traceId: string,
	choice: WhenChoice,
	context: WhenContext
): Promise<Saved | Extract<WhenResult, { ok: false }>> {
	const snapshot = await buildRepositoryExplorerSnapshot(repository, 'intentions');
	const trace = snapshot.traces.find((item) => item.id === traceId);
	if (!trace) return { ok: false, reason: 'not_found' };
	if (!isIntentionRelation(trace.relation)) return { ok: false, reason: 'not_intention' };
	if (trace.intentOpen === false) return { ok: false, reason: 'closed' };
	const result = planWhen(trace, choice, context);
	if (!result.ok) return result;
	const current = {
		aboutKind: trace.aboutKind,
		aboutTime: trace.aboutTime,
		statedDuration: trace.statedDuration ?? null
	};
	// Compare individual values: property order in persisted objects is not significant.
	const equal = (a: unknown, b: unknown): boolean => {
		if (Object.is(a, b)) return true;
		if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
		const left = Object.keys(a as object).sort();
		const right = Object.keys(b as object).sort();
		return (
			left.length === right.length &&
			left.every(
				(key, i) =>
					key === right[i] &&
					equal((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])
			)
		);
	};
	const normalizeTime = (value: typeof current.aboutTime) => {
		if (value?.basis !== 'absolute' || value.precision !== 'minute') return value;
		try {
			return {
				...value,
				start: Temporal.Instant.from(value.start).epochNanoseconds.toString(),
				end: value.end ? Temporal.Instant.from(value.end).epochNanoseconds.toString() : null
			};
		} catch {
			return value;
		}
	};
	if (
		equal(
			{ ...current, aboutTime: normalizeTime(current.aboutTime) },
			{ ...result.fields, aboutTime: normalizeTime(result.fields.aboutTime) }
		)
	)
		return result;
	const saved = await repository.saveTraceRecord({
		id: traceId,
		fields: { ...result.fields, ...(trace.aboutTraceId !== null ? { aboutTraceId: null } : {}) }
	});
	return { ...result, operationId: saved.operation.id };
}
