import { describe, expect, it } from 'vitest';
import { nowPlacement, undatedPlacement } from './placement';
import {
	EMPTY_INPUT,
	addTarget,
	createLinks,
	editLinks,
	removeTarget,
	sameTargets,
	setTargetFeature
} from './targets';
import type { DraftValues, ResultTarget } from './types';

const values = (targets: readonly ResultTarget[], dated = true): DraftValues => ({
	title: 'F',
	description: null,
	relation: 'actual',
	placement: dated ? nowPlacement(new Date('2026-09-13T10:00:00Z')) : undatedPlacement(),
	kindId: null,
	versionId: null,
	data: null,
	scopeIds: [],
	targets
});

const target = (
	otherId: string,
	linkId: string | null = null,
	input = EMPTY_INPUT
): ResultTarget => ({
	otherId,
	linkId,
	input
});

describe('result targets', () => {
	it('adds once, keeps the saved link of a re-chosen record, removes explicitly', () => {
		const baseline = [target('a', 'link-a')];
		let targets = addTarget([], 'b', baseline);
		targets = addTarget(targets, 'b', baseline);
		expect(targets).toEqual([target('b')]);
		targets = addTarget(targets, 'a', baseline);
		expect(targets[1]).toEqual(target('a', 'link-a'));
		expect(removeTarget(targets, 'b')).toEqual([target('a', 'link-a')]);
	});

	it('writes a feature only when stated: absent is untouched, null clears, values restate', () => {
		const untouched = [target('a')];
		const closed = setTargetFeature(untouched, 'a', 'open', false);
		expect(closed[0].input).toEqual({ open: false });
		expect(Object.hasOwn(closed[0].input, 'outcome')).toBe(false);
		const reset = setTargetFeature(closed, 'a', 'open', undefined);
		expect(Object.keys(reset[0].input)).toEqual([]);
		expect(JSON.stringify(reset[0].input)).toBe('{}');
		const cleared = setTargetFeature(reset, 'a', 'outcome', null);
		expect(JSON.parse(JSON.stringify(cleared[0].input))).toEqual({ outcome: null });
		const stated = setTargetFeature(cleared, 'a', 'outcome', 'completed');
		expect(stated[0].input).toEqual({ outcome: 'completed' });
		expect(sameTargets(untouched, reset)).toBe(true);
		expect(sameTargets(untouched, closed)).toBe(false);
		expect(sameTargets(cleared, stated)).toBe(false);
	});

	it('compares chosen records as a set with their input', () => {
		const left = [target('a'), target('b', null, { open: false })];
		const right = [target('b', null, { open: false }), target('a')];
		expect(sameTargets(left, right)).toBe(true);
		expect(sameTargets(left, [target('a')])).toBe(false);
		expect(sameTargets(left, [target('a'), target('b', null, { open: null })])).toBe(false);
	});

	it('maps a new record to evidence links with only the statements made', () => {
		const links = createLinks(
			values([target('a', null, { outcome: 'completed', open: false }), target('b')]),
			'intention'
		);
		expect(links).toEqual([
			{ kind: 'evidence_for', intentionId: 'a', assessment: { outcome: 'completed', open: false } },
			{ kind: 'evidence_for', intentionId: 'b' }
		]);
		expect(createLinks(values([target('f', null, { open: true })]), 'fact')).toEqual([
			{ kind: 'evidence_for', factId: 'f', assessment: { open: true } }
		]);
	});

	it('maps an edit to added links, withdrawn links and statements for saved ones only', () => {
		const baseline = values([target('a', 'link-a'), target('b', 'link-b')]);
		const current = values([
			target('a', 'link-a', { outcome: null }),
			target('c', null, { open: false })
		]);
		expect(editLinks(current, baseline, 'intention')).toEqual({
			links: {
				add: [{ kind: 'evidence_for', intentionId: 'c', assessment: { open: false } }],
				remove: ['link-b']
			},
			assessments: [{ evidenceId: 'link-a', values: { outcome: null } }]
		});
		expect(editLinks(baseline, baseline, 'intention')).toEqual({});
	});
});
