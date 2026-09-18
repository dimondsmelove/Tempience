import { expect, it } from 'vitest';
import { assessmentIdFor, normalizeIntentionAssessment } from './read';
import { context, dated, day, evidence, link, stamp, trace } from './result.fixture';
import { evaluateIntention, traceEventKey } from './result';

const intention = trace('I', 'intend');

it('derives the event key from the fact placement, not from capture or display geometry', () => {
	expect(traceEventKey(dated('a', day('2026-09-11')))).toBe('2026-09-11T00:00:00.000Z');
	expect(
		traceEventKey(dated('b', day('2026-09-10', '2026-09-11'), { aboutKind: 'interval' }))
	).toBe('2026-09-11T00:00:00.000Z');
	// A stated duration locates the start; the end of the amount is never inferred.
	expect(
		traceEventKey(
			dated('c', day('2026-09-10', '2026-09-12'), {
				aboutKind: 'interval',
				statedDuration: { amount: 2, unit: 'day' }
			})
		)
	).toBe('2026-09-10T00:00:00.000Z');
	// An approximate instant window keeps its start.
	expect(
		traceEventKey(
			dated('d', {
				basis: 'absolute',
				precision: 'day',
				certainty: 'approximate',
				start: '2026-09-10',
				end: '2026-09-12'
			})
		)
	).toBe('2026-09-10T00:00:00.000Z');
	expect(
		traceEventKey(
			dated('e', {
				basis: 'absolute',
				precision: 'month',
				certainty: 'exact',
				start: '2026-09',
				end: null
			})
		)
	).toBe('2026-09-01T00:00:00.000Z');
	expect(
		traceEventKey(
			dated('f', {
				basis: 'absolute',
				precision: 'minute',
				certainty: 'exact',
				start: '2026-09-11T10:00:00+02:00',
				end: null
			})
		)
	).toBe('2026-09-11T08:00:00.000Z');
	expect(traceEventKey(dated('g', { basis: 'unknown' }))).toBeNull();
	expect(
		traceEventKey(
			dated('h', { basis: 'relative', precision: 'day', anchorTraceId: 'a', relation: 'after' })
		)
	).toBeNull();
	expect(
		traceEventKey(
			trace('m', 'actual', { aboutKind: 'trace_ref', aboutTime: null, aboutTraceId: 'a' })
		)
	).toBeNull();
});

it('lets a later event date win regardless of entry order, and an interval end beats an earlier instant', () => {
	const a = dated('A', day('2026-09-10'));
	const b = dated('B', day('2026-09-11'));
	const sources = [
		evidence('B', 'I', '2026-09-13T07:00:00.000Z', { outcome: 'completed' }),
		evidence('A', 'I', '2026-09-13T09:00:00.000Z', { outcome: 'partial' })
	];
	const result = evaluateIntention(
		'I',
		sources,
		context([intention, a, b], [link('A', 'I'), link('B', 'I')])
	);
	expect(result.outcome).toEqual({ value: 'completed', sourceId: assessmentIdFor('act-B-I') });
	expect(result.open).toEqual({ value: true, sourceId: null });
	expect(result.sources.map((source) => source.assessment.factId)).toEqual(['A', 'B']);

	const interval = dated('P', day('2026-09-10', '2026-09-11'), { aboutKind: 'interval' });
	const instant = dated('Q', day('2026-09-12'));
	const ordered = evaluateIntention(
		'I',
		[
			evidence('P', 'I', stamp, { outcome: 'completed' }),
			evidence('Q', 'I', stamp, { outcome: 'partial' })
		],
		context([intention, interval, instant], [link('P', 'I'), link('Q', 'I')])
	);
	expect(ordered.outcome.value).toBe('partial');
});

it('breaks a same-day tie by the stable first time: a late candidate keeps F at 10:00 so G wins', () => {
	const f = dated('F', day('2026-09-11'));
	const g = dated('G', day('2026-09-11'));
	const fSource = evidence(
		'F',
		'I',
		'2026-09-11T10:00:00.000Z',
		{ outcome: 'completed' },
		{
			initial: {
				'op-F-first': { at: '2026-09-11T10:00:00.000Z', outcome: 'completed' },
				'op-F-late': { at: '2026-09-11T12:00:00.000Z', outcome: 'partial' }
			}
		}
	);
	const gSource = evidence('G', 'I', '2026-09-11T11:00:00.000Z', { outcome: 'not_completed' });
	const ctx = context([intention, f, g], [link('F', 'I'), link('G', 'I')]);
	expect(fSource.firstAssessedAt).toBe('2026-09-11T10:00:00.000Z');
	expect(evaluateIntention('I', [fSource, gSource], ctx).outcome).toEqual({
		value: 'not_completed',
		sourceId: assessmentIdFor('act-G-I')
	});
	// A later correction of the older F does not move it either.
	const corrected = evidence(
		'F',
		'I',
		'2026-09-11T10:00:00.000Z',
		{ outcome: 'completed' },
		{
			values: { outcome: { value: 'alternative', operationId: 'op-F-edit' } },
			updatedAt: '2026-09-11T16:00:00.000Z'
		}
	);
	expect(evaluateIntention('I', [corrected, gSource], ctx).outcome.sourceId).toBe(
		assessmentIdFor('act-G-I')
	);
	// Equal first times fall back to identity, never to locale collation.
	const gTied = evidence('G', 'I', '2026-09-11T10:00:00.000Z', { outcome: 'not_completed' });
	const tie = evaluateIntention('I', [fSource, gTied], ctx);
	expect(tie.outcome.sourceId).toBe(
		[assessmentIdFor('act-F-I'), assessmentIdFor('act-G-I')].toSorted((x, y) => (x < y ? -1 : 1))[1]
	);
});

it('keeps a transferred source at its original first time on the new intention', () => {
	const f = dated('F', day('2026-09-11'));
	const g = dated('G', day('2026-09-11'));
	const b = trace('B', 'intend');
	const transferred = normalizeIntentionAssessment({
		id: assessmentIdFor('act-F-A'),
		source: 'evidence',
		origin: {
			factId: 'F',
			intentionId: 'A',
			evidenceId: 'F:A:evidence_for',
			activationId: 'act-F-A'
		},
		placement: { intentionId: 'B', evidenceId: 'F:B:evidence_for', activationId: 'act-F-B' },
		initial: { 'op-F-first': { at: '2026-09-11T10:00:00.000Z', outcome: 'completed' } },
		lifecycleId: 'op-retarget',
		updatedAt: '2026-09-11T16:00:00.000Z'
	});
	const gSource = evidence('G', 'B', '2026-09-11T13:00:00.000Z', { outcome: 'partial' });
	const result = evaluateIntention(
		'B',
		[transferred, gSource],
		context(
			[b, f, g],
			[link('F', 'B', { assessmentId: assessmentIdFor('act-F-A') }), link('G', 'B')]
		)
	);
	expect(transferred.intentionId).toBe('B');
	expect(
		result.sources.map((source) => [source.assessment.id, source.eligibility.eligible])
	).toEqual([
		[assessmentIdFor('act-F-A'), true],
		[assessmentIdFor('act-G-B'), true]
	]);
	expect(result.outcome.sourceId).toBe(assessmentIdFor('act-G-B'));
	// Without the transfer binding the moved source is not the link's current source.
	const unbound = evaluateIntention('B', [transferred], context([b, f], [link('F', 'B')]));
	expect(unbound.sources[0].eligibility).toEqual({ eligible: false, reason: 'binding_mismatch' });
});
