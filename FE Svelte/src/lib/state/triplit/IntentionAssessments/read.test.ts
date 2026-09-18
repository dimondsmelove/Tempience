import { expect, it } from 'vitest';
import { RepositoryError } from '../Repository/errors';
import { assessmentIdFor, normalizeIntentionAssessment, parseStoredAssessment } from './read';

const evidenceRow = (
	activationId: string,
	initial: Record<string, unknown>,
	extra: Record<string, unknown> = {}
): Record<string, unknown> => ({
	id: assessmentIdFor(activationId),
	source: 'evidence',
	origin: {
		factId: `fact-${activationId}`,
		intentionId: 'I',
		evidenceId: `link-${activationId}`,
		activationId
	},
	initial,
	updatedAt: '2026-09-11T13:00:00.000Z',
	...extra
});

const corruptionOf = (row: Record<string, unknown>): string => {
	try {
		parseStoredAssessment(row);
		return 'accepted';
	} catch (error) {
		return error instanceof RepositoryError ? error.code : String(error);
	}
};

it('keeps the earliest first time of an activation while a late concurrent creation supplies its value', () => {
	// F and G share the event date. F first assessed I at 10:00, G at 11:00; a disconnected
	// client first-assessed the same activation of F->I at 12:00. F->I stays at 10:00, so G
	// remains the later source; F's own value follows its latest explicit first statement.
	const f = normalizeIntentionAssessment(
		evidenceRow('act-f', {
			'op-f-late': { at: '2026-09-11T12:00:00.000Z', outcome: 'partial' },
			'op-f-first': { at: '2026-09-11T10:00:00.000Z', outcome: 'completed' }
		})
	);
	const g = normalizeIntentionAssessment(
		evidenceRow('act-g', {
			'op-g': { at: '2026-09-11T11:00:00.000Z', outcome: 'not_completed' }
		})
	);
	expect(f).toMatchObject({
		firstAssessedAt: '2026-09-11T10:00:00.000Z',
		createdAt: '2026-09-11T10:00:00.000Z',
		outcome: 'partial',
		outcomeRevision: 'op-f-late',
		open: null,
		openRevision: null
	});
	expect(g.firstAssessedAt).toBe('2026-09-11T11:00:00.000Z');
	const [latest] = [f, g].toSorted((a, b) => b.firstAssessedAt.localeCompare(a.firstAssessedAt));
	expect(latest.id).toBe(g.id);
});

it('lets corrections override every first creation and keeps explicit false', () => {
	const row = normalizeIntentionAssessment(
		evidenceRow(
			'act',
			{
				'op-first': { at: '2026-09-11T10:00:00.000Z', outcome: 'completed', open: false },
				'op-late': { at: '2026-09-11T12:00:00.000Z', outcome: 'partial' }
			},
			{
				values: {
					outcome: { value: 'alternative', operationId: 'op-edit' },
					open: { value: null, operationId: 'op-clear' }
				}
			}
		)
	);
	expect(row).toMatchObject({
		outcome: 'alternative',
		outcomeRevision: 'op-edit',
		open: null,
		openRevision: 'op-clear',
		firstAssessedAt: '2026-09-11T10:00:00.000Z'
	});
	const explicitFalse = normalizeIntentionAssessment(
		evidenceRow('act', { 'op-first': { at: '2026-09-11T10:00:00.000Z', open: false } })
	);
	expect(explicitFalse).toMatchObject({ open: false, openRevision: 'op-first', outcome: null });
});

it('compares first times as instants, whatever ISO spelling the candidates use', () => {
	// A at 10:00+02:00 is 08:00Z, earlier than B at 09:00Z although it sorts after it lexically.
	const row = normalizeIntentionAssessment(
		evidenceRow('act', {
			'op-a': { at: '2026-09-13T10:00:00+02:00', outcome: 'completed' },
			'op-b': { at: '2026-09-13T09:00:00Z', outcome: 'partial', open: false }
		})
	);
	expect(row).toMatchObject({
		firstAssessedAt: '2026-09-13T08:00:00.000Z',
		createdAt: '2026-09-13T08:00:00.000Z',
		outcome: 'partial',
		outcomeRevision: 'op-b',
		open: false,
		openRevision: 'op-b'
	});
});

it('breaks equal instants with differing spellings by code-unit identity on every replica', () => {
	// 'Z' sorts before 'a' by code unit, the opposite of locale collation.
	const row = normalizeIntentionAssessment(
		evidenceRow('act', {
			'op-a': { at: '2026-09-13T08:00:00.000Z', outcome: 'partial', open: false },
			'op-Z': { at: '2026-09-13T10:00:00+02:00', outcome: 'completed' }
		})
	);
	expect(row).toMatchObject({
		firstAssessedAt: '2026-09-13T08:00:00.000Z',
		outcome: 'partial',
		outcomeRevision: 'op-a',
		open: false,
		openRevision: 'op-a'
	});
});

it('reads the corrected placement as the current address and keeps the origin', () => {
	const row = normalizeIntentionAssessment(
		evidenceRow(
			'act',
			{ 'op-first': { at: '2026-09-11T10:00:00.000Z', outcome: 'completed' } },
			{
				placement: { intentionId: 'B', evidenceId: 'link-b', activationId: 'act-b' },
				lifecycleId: 'op-retarget',
				isDeleted: false
			}
		)
	);
	expect(row).toMatchObject({
		intentionId: 'B',
		evidenceId: 'link-b',
		activationId: 'act-b',
		originIntentionId: 'I',
		factId: 'fact-act',
		lifecycleId: 'op-retarget',
		isDeleted: false
	});
	const direct = normalizeIntentionAssessment({
		id: 'direct-1',
		source: 'direct',
		origin: { intentionId: 'I' },
		initial: { 'op-direct': { at: '2026-09-11T10:00:00.000Z', open: false } },
		updatedAt: '2026-09-11T10:00:00.000Z'
	});
	expect(direct).toMatchObject({
		intentionId: 'I',
		factId: null,
		evidenceId: null,
		activationId: null,
		lifecycleId: 'direct-1'
	});
});

it('reports corrupt rows instead of normalizing them', () => {
	const valid = evidenceRow('act', {
		'op-first': { at: '2026-09-11T10:00:00.000Z', outcome: 'completed' }
	});
	expect(corruptionOf(valid)).toBe('accepted');
	expect(corruptionOf({ ...valid, id: 'assessment:other' })).toBe('assessment_corrupt');
	expect(corruptionOf({ ...valid, source: 'guess' })).toBe('assessment_corrupt');
	expect(corruptionOf({ ...valid, initial: {} })).toBe('assessment_corrupt');
	expect(
		corruptionOf({ ...valid, initial: { 'op-first': { at: '2026-09-11T10:00:00.000Z' } } })
	).toBe('assessment_corrupt');
	expect(
		corruptionOf({ ...valid, initial: { 'op-first': { at: 'yesterday', outcome: 'completed' } } })
	).toBe('assessment_corrupt');
	expect(
		corruptionOf({
			...valid,
			initial: { 'op-first': { at: '2026-09-11T10:00:00.000Z', outcome: 'done' } }
		})
	).toBe('assessment_corrupt');
	expect(
		corruptionOf({
			...valid,
			initial: { 'op-first': { at: '2026-09-11T10:00:00.000Z', open: false, mood: 'good' } }
		})
	).toBe('assessment_corrupt');
	expect(corruptionOf({ ...valid, values: { outcome: { value: 'partial' } } })).toBe(
		'assessment_corrupt'
	);
	expect(corruptionOf({ ...valid, values: { rating: { value: 1, operationId: 'op' } } })).toBe(
		'assessment_corrupt'
	);
	expect(corruptionOf({ ...valid, placement: { intentionId: 'B' } })).toBe('assessment_corrupt');
	expect(corruptionOf({ ...valid, updatedAt: 42 })).toBe('assessment_corrupt');
	expect(
		corruptionOf({
			id: 'direct-1',
			source: 'direct',
			origin: { intentionId: 'I' },
			initial: { 'op-direct': { at: '2026-09-11T10:00:00.000Z', open: false } },
			placement: { intentionId: 'B', evidenceId: 'l', activationId: 'a' },
			updatedAt: '2026-09-11T10:00:00.000Z'
		})
	).toBe('assessment_corrupt');
});
