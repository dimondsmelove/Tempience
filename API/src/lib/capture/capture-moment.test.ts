import { describe, expect, it } from 'vitest';
import { captureMomentSchema, orientNowSliceSchema } from '@chronograph/shared';
import { continuityPole, segmentActiveAt } from '@chronograph/shared';

describe('captureMomentSchema', () => {
	it('parses broken-leg multi-thread capture', () => {
		const parsed = captureMomentSchema.parse({
			idempotency_key: 'cap-broken-leg-1',
			trace: {
				timezone: 'Europe/Belgrade',
				about_kind: 'instant',
				about_at: '2026-07-14T11:30:00.000Z',
				hook_text:
					'Лежу дома со сломанной ногой. Пока друзья в Черногории, на фоне тревоги в регионе мысль о переезде стала направлением.',
				hook_kind: 'pulse',
				relation: 'observe'
			},
			scopes: [
				{ mode: 'existing', continuity_uid: '550e8400-e29b-41d4-a716-446655440001' },
				{ mode: 'existing', continuity_uid: '550e8400-e29b-41d4-a716-446655440002' },
				{ mode: 'existing', continuity_uid: '550e8400-e29b-41d4-a716-446655440003' },
				{ mode: 'create', name: 'переезд', kind: 'thread' }
			],
			segment_bumps: [
				{
					continuity_uid: '550e8400-e29b-41d4-a716-446655440004',
					label: 'направление внимания'
				}
			]
		});

		expect(parsed.scopes).toHaveLength(4);
		expect(parsed.segment_bumps).toHaveLength(1);
	});
});

describe('orientNowSliceSchema', () => {
	it('accepts orient slice with cards', () => {
		const parsed = orientNowSliceSchema.parse({
			preset: 'orient-now',
			timezone: 'Europe/Belgrade',
			anchor_at: '2026-07-14T11:30:00.000Z',
			focal_trace: null,
			cards: [],
			summary: {
				linked_count: 0,
				ambient_count: 0,
				inner_count: 0,
				outer_count: 0
			}
		});
		expect(parsed.preset).toBe('orient-now');
	});
});

describe('life-slice projection', () => {
	it('classifies relationship as outer pole', () => {
		expect(continuityPole('relationship')).toBe('outer');
		expect(continuityPole('thread')).toBe('inner');
	});

	it('detects active segment at anchor', () => {
		expect(
			segmentActiveAt(
				{ start_at: '2026-07-01T00:00:00.000Z', end_at: null },
				'2026-07-14T11:30:00.000Z'
			)
		).toBe(true);
		expect(
			segmentActiveAt(
				{ start_at: '2026-07-01T00:00:00.000Z', end_at: '2026-07-10T00:00:00.000Z' },
				'2026-07-14T11:30:00.000Z'
			)
		).toBe(false);
	});
});


describe('captureMomentSchema legacy threads alias', () => {
	it('accepts deprecated threads alias', () => {
		const parsed = captureMomentSchema.parse({
			idempotency_key: 'cap-legacy-threads',
			trace: {
				timezone: 'Europe/Belgrade',
				about_kind: 'instant',
				hook_text: 'test',
				hook_kind: 'pulse'
			},
			threads: [{ mode: 'create', name: 'tmp', kind: 'thread' }]
		});
		expect(parsed.scopes).toHaveLength(1);
	});
});
