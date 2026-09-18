import { TriplitClient } from '@triplit/client';
import { createTriplitRepository } from '../repository';
import { schema } from '../schema';
import type { TempienceRepository } from '../Repository/types';
import type { Intersection, Trace, TraceAboutTime, TraceDraft } from '../types';

export type AssessmentFixture = {
	client: TriplitClient<typeof schema>;
	repository: TempienceRepository;
	intention: Trace;
	fact: Trace;
	link: Intersection;
	dispose: () => Promise<void>;
};

export const dayTime = (day: string): TraceAboutTime => ({
	basis: 'absolute',
	precision: 'day',
	certainty: 'exact',
	start: day,
	end: null
});

export const traceDraft = (
	content: string,
	relation: 'intend' | 'actual',
	aboutTime: TraceAboutTime = dayTime('2026-09-11')
): TraceDraft => ({
	content,
	capturedAt: '2026-09-13T08:00:00.000Z',
	timezone: 'UTC',
	aboutKind: 'instant',
	aboutTime,
	relation
});

/** A dated fact linked as evidence for an intention in a fresh in-memory replica. */
export const createAssessmentFixture = async (): Promise<AssessmentFixture> => {
	const client = new TriplitClient({ schema, storage: { type: 'memory' }, autoConnect: false });
	const repository = createTriplitRepository(client);
	const intention = await repository.createTrace(traceDraft('Взвеситься', 'intend'));
	const fact = await repository.createTrace(traceDraft('80 кг', 'actual'));
	const link = await repository.createIntersection({
		fromId: fact.id,
		toId: intention.id,
		kind: 'evidence_for'
	});
	return {
		client,
		repository,
		intention,
		fact,
		link,
		dispose: async () => {
			await client.clear({ full: true });
			client.disconnect();
		}
	};
};
