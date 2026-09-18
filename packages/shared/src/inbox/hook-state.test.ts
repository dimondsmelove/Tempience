import { describe, expect, it } from 'vitest';
import { computeHookEnrichmentState, inboxStateMatches } from './hook-state';

describe('computeHookEnrichmentState', () => {
	it('bare when no memberships', () => {
		expect(
			computeHookEnrichmentState({
				memberships: 0,
				relates_to: 0,
				has_task_ref: false,
				revisit_count: 0,
				has_salience_word: false
			})
		).toBe('bare');
	});

	it('scoped with membership only', () => {
		expect(
			computeHookEnrichmentState({
				memberships: 2,
				relates_to: 0,
				has_task_ref: false,
				revisit_count: 0,
				has_salience_word: false
			})
		).toBe('scoped');
	});

	it('woven with revisit child', () => {
		expect(
			computeHookEnrichmentState({
				memberships: 1,
				relates_to: 0,
				has_task_ref: false,
				revisit_count: 1,
				has_salience_word: false
			})
		).toBe('woven');
	});

	it('interpreted with salience revisit', () => {
		expect(
			computeHookEnrichmentState({
				memberships: 1,
				relates_to: 0,
				has_task_ref: false,
				revisit_count: 1,
				has_salience_word: true
			})
		).toBe('interpreted');
	});
});

describe('inboxStateMatches', () => {
	it('needs includes bare and scoped', () => {
		expect(inboxStateMatches('bare', 'needs')).toBe(true);
		expect(inboxStateMatches('scoped', 'needs')).toBe(true);
		expect(inboxStateMatches('woven', 'needs')).toBe(false);
	});
});
