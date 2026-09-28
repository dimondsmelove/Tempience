import { describe, expect, it } from 'vitest';
import { now, system } from './Chapters.fixture';
import { removeStage, stageAt, stageBounds } from './stages';
import { ms } from './time';

describe('stages', () => {
	it('finds the stage at an instant', () => {
		expect(stageAt(system, now)?.id).toBe('push');
		expect(stageAt(system, ms('2026-09-03T00:00:00+02:00'))?.id).toBe('open');
		expect(stageAt(system, ms('2026-10-01T00:00:00+02:00'))).toBeNull();
	});
	it('bounds a stage between its neighbours and removes one keeping the rest contiguous', () => {
		expect(stageBounds(system, 'open')).toMatchObject({ locked: true, first: true });
		expect(stageBounds(system, 'push')).toMatchObject({
			min: ms(system.start),
			max: ms(system.end!),
			locked: false
		});
		const firstGone = removeStage(system, 'open');
		expect(firstGone.stages).toHaveLength(1);
		expect(firstGone.stages[0]).toMatchObject({ id: 'push', start: system.start });
		expect(removeStage(system, 'push').stages.map((stage) => stage.id)).toEqual(['open']);
	});
});
