import type { Intersection, Trace, TraceAboutTime } from '../types';
import { assessmentIdFor, normalizeIntentionAssessment } from './read';
import type { IntentionContext } from './result';
import type { IntentionAssessment } from './types';

/** Pure fixtures for the intention result calculation; storage rows go through the codec. */
export const stamp = '2026-09-13T08:00:00.000Z';

export const trace = (
	id: string,
	relation: 'intend' | 'actual',
	overrides: Partial<Trace> = {}
): Trace => ({
	id,
	capturedAt: stamp,
	timezone: 'UTC',
	aboutKind: 'instant',
	aboutTime: {
		basis: 'absolute',
		precision: 'day',
		certainty: 'exact',
		start: '2026-09-11',
		end: null
	},
	statedDuration: null,
	aboutAt: null,
	aboutStart: null,
	aboutEnd: null,
	aboutTraceId: null,
	content: id,
	description: null,
	relation,
	kindId: null,
	kindVId: null,
	data: null,
	isDeleted: false,
	lifecycleId: null,
	createdAt: stamp,
	updatedAt: stamp,
	...overrides
});

export const dated = (id: string, time: TraceAboutTime, overrides: Partial<Trace> = {}): Trace =>
	trace(id, 'actual', { aboutTime: time, ...overrides });

export const day = (start: string, end: string | null = null): TraceAboutTime => ({
	basis: 'absolute',
	precision: 'day',
	certainty: 'exact',
	start,
	end
});

export const link = (
	factId: string,
	intentionId: string,
	overrides: Partial<Intersection> = {}
): Intersection => ({
	id: `${factId}:${intentionId}:evidence_for`,
	fromId: factId,
	toId: intentionId,
	kind: 'evidence_for',
	context: null,
	fromEntityType: null,
	activationId: `act-${factId}-${intentionId}`,
	lifecycleId: 'op-link',
	scopeDeletionOperationId: null,
	isDeleted: false,
	createdAt: stamp,
	updatedAt: stamp,
	...overrides
});

/** An evidence source in stored form so the codec decides identity, first time and values. */
export const evidence = (
	factId: string,
	intentionId: string,
	at: string,
	values: { outcome?: string; open?: boolean },
	extra: Record<string, unknown> = {}
): IntentionAssessment =>
	normalizeIntentionAssessment({
		id: assessmentIdFor(`act-${factId}-${intentionId}`),
		source: 'evidence',
		origin: {
			factId,
			intentionId,
			evidenceId: `${factId}:${intentionId}:evidence_for`,
			activationId: `act-${factId}-${intentionId}`
		},
		initial: { [`op-${factId}-first`]: { at, ...values } },
		updatedAt: at,
		...extra
	});

export const direct = (
	id: string,
	intentionId: string,
	at: string,
	values: { outcome?: string; open?: boolean }
) =>
	normalizeIntentionAssessment({
		id,
		source: 'direct',
		origin: { intentionId },
		initial: { [`op-${id}`]: { at, ...values } },
		updatedAt: at
	});

export const context = (traces: Trace[], links: Intersection[]): IntentionContext => ({
	tracesById: new Map(traces.map((row) => [row.id, row])),
	intersectionsById: new Map(links.map((row) => [row.id, row]))
});
