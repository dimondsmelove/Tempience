import { expect, it } from 'vitest';
import { assessmentIdFor } from './read';
import { context, dated, day, direct, evidence, link, stamp, trace } from './result.fixture';
import { evaluateIntention } from './result';

const intention = trace('I', 'intend');

it('resolves features independently: a direct closure outlives unlinked evidence and a cleared value reveals the previous source', () => {
	const a = dated('A', day('2026-09-10'));
	const aSource = evidence('A', 'I', '2026-09-10T12:00:00.000Z', {
		outcome: 'partial',
		open: true
	});
	const closure = direct('direct-1', 'I', '2026-09-12T12:00:00.000Z', { open: false });
	const ctx = context([intention, a], [link('A', 'I')]);
	expect(evaluateIntention('I', [aSource, closure], ctx)).toMatchObject({
		outcome: { value: 'partial', sourceId: aSource.id },
		open: { value: false, sourceId: 'direct-1' }
	});
	const unlinked = context([intention, a], [link('A', 'I', { isDeleted: true })]);
	const afterUnlink = evaluateIntention('I', [aSource, closure], unlinked);
	expect(afterUnlink).toMatchObject({
		outcome: { value: null, sourceId: null },
		open: { value: false, sourceId: 'direct-1' }
	});
	expect(
		afterUnlink.sources.find((source) => source.assessment.id === aSource.id)?.eligibility
	).toEqual({
		eligible: false,
		reason: 'link_inactive'
	});
	expect(evaluateIntention('I', [], ctx)).toMatchObject({
		outcome: { value: null, sourceId: null },
		open: { value: true, sourceId: null }
	});

	const b = dated('B', day('2026-09-11'));
	const bSource = evidence(
		'B',
		'I',
		stamp,
		{ outcome: 'completed' },
		{
			values: { outcome: { value: null, operationId: 'op-clear' } }
		}
	);
	const two = context([intention, a, b], [link('A', 'I'), link('B', 'I')]);
	expect(evaluateIntention('I', [aSource, bSource], two).outcome).toEqual({
		value: 'partial',
		sourceId: aSource.id
	});
	expect(
		evaluateIntention('I', [aSource, evidence('B', 'I', stamp, { outcome: 'completed' })], two)
			.outcome.sourceId
	).toBe(assessmentIdFor('act-B-I'));
});

it('excludes undated, detached, deleted or role-broken sources and reports why', () => {
	const a = dated('A', day('2026-09-10'));
	const undated = dated('U', { basis: 'unknown' });
	const aSource = evidence('A', 'I', stamp, { outcome: 'partial' });
	const uSource = evidence('U', 'I', stamp, { outcome: 'completed' });
	const detached = evidence(
		'A',
		'I',
		stamp,
		{ outcome: 'alternative' },
		{
			id: assessmentIdFor('act-old'),
			origin: {
				factId: 'A',
				intentionId: 'I',
				evidenceId: 'A:I:evidence_for',
				activationId: 'act-old'
			}
		}
	);
	const deletedIntention = trace('I', 'intend', { isDeleted: true });
	const result = evaluateIntention(
		'I',
		[aSource, uSource, detached],
		context([intention, a, undated], [link('A', 'I'), link('U', 'I')])
	);
	expect(result.outcome.sourceId).toBe(aSource.id);
	expect(
		result.sources.map((source) => [source.assessment.id, source.eligibility, source.orderedAt])
	).toEqual([
		[aSource.id, { eligible: true }, '2026-09-10T00:00:00.000Z'],
		[uSource.id, { eligible: false, reason: 'fact_undated' }, null],
		[detached.id, { eligible: false, reason: 'activation_mismatch' }, '2026-09-10T00:00:00.000Z']
	]);
	expect(
		evaluateIntention('I', [aSource], context([deletedIntention, a], [link('A', 'I')])).sources[0]
			.eligibility
	).toEqual({ eligible: false, reason: 'intention_deleted' });
});
