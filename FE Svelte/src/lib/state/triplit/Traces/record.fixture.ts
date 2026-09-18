import { TriplitClient } from '@triplit/client';
import { RepositoryError } from '../Repository/errors';
import { createTriplitRepository, type TempienceRepository } from '../repository';
import { schema } from '../schema';
import type { Trace, TraceAboutTime, TraceDraft } from '../types';
import type { TraceRecordFields } from './record';

export type RecordFixture = {
	client: TriplitClient<typeof schema>;
	repository: TempienceRepository;
	dispose: () => Promise<void>;
};

/** A fresh in-memory replica for one record test. */
export const openRecordFixture = (): RecordFixture => {
	const client = new TriplitClient({ schema, storage: { type: 'memory' }, autoConnect: false });
	return {
		client,
		repository: createTriplitRepository(client),
		dispose: async () => {
			await client.clear({ full: true });
			client.disconnect();
		}
	};
};

export const dayTime = (start: string, end: string | null = null): TraceAboutTime => ({
	basis: 'absolute',
	precision: 'day',
	certainty: 'exact',
	start,
	end
});

export const minuteTime = (start: string): TraceAboutTime => ({
	basis: 'absolute',
	precision: 'minute',
	certainty: 'exact',
	start,
	end: null
});

export const CAPTURED_AT = '2026-09-13T08:00:00.000Z';

/** Form fields of a plain dated fact; a patch overrides any of them. */
export const plainFields = (
	title: string | null,
	patch: Partial<TraceRecordFields> = {}
): TraceRecordFields => ({
	title,
	relation: 'actual',
	capturedAt: CAPTURED_AT,
	timezone: 'UTC',
	aboutKind: 'instant',
	aboutTime: dayTime('2026-09-11'),
	...patch
});

/** A generic repository draft for fixtures created outside the form save. */
export const plainDraft = (
	content: string,
	relation: 'intend' | 'actual' | null = 'actual',
	aboutTime: TraceAboutTime = dayTime('2026-09-11')
): TraceDraft => ({
	content,
	capturedAt: CAPTURED_AT,
	timezone: 'UTC',
	aboutKind: 'instant',
	aboutTime,
	relation
});

/** The refusal code of a command, or 'accepted'. */
export const outcome = async (promise: Promise<unknown>): Promise<string> => {
	try {
		await promise;
		return 'accepted';
	} catch (error) {
		return error instanceof RepositoryError ? error.code : String(error);
	}
};

/** Whole persisted state, for atomicity assertions. */
export const snapshotOf = async (repository: TempienceRepository) => ({
	traces: await repository.listTraces(true),
	intersections: await repository.listIntersections(true),
	assessments: await repository.listIntentionAssessments(true),
	logs: await repository.listLogs()
});

/** Form fields of a new supplement marker: a reference without its own time or inline address. */
export const markerFields = (title = 'Уточнение'): TraceRecordFields =>
	plainFields(title, { aboutKind: 'trace_ref', aboutTime: null, aboutTraceId: null });

/** The same marker as a generic repository draft. */
export const markerDraft = (content = 'Уточнение'): TraceDraft => ({
	...plainDraft(content),
	aboutKind: 'trace_ref',
	aboutTime: null,
	aboutTraceId: null
});

/** One save creating a supplement of the original. */
export const supplementOf = async (
	repository: TempienceRepository,
	original: Trace,
	title = 'Уточнение'
) =>
	repository.saveTraceRecord({
		fields: markerFields(title),
		links: { add: [{ kind: 'revisits', originalId: original.id }] }
	});

/** Revisits links of a Trace as [originalId, isDeleted]. */
export const revisitsOf = async (
	repository: TempienceRepository,
	traceId: string,
	includeDeleted = false
) =>
	(await repository.listIntersections(includeDeleted))
		.filter((link) => link.kind === 'revisits' && link.fromId === traceId)
		.map((link) => [link.toId, link.isDeleted] as const);
