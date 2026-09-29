import { describe, expect, it } from 'vitest';
import { now, system } from './Chapters.fixture';
import { removeStage, stageAt, stageBounds, stageStep } from './stages';
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
	it('steps through «Вся глава» and the stages in time, and never out of the chapter', () => {
		const [open, push] = ['open', 'push'].map((id) => system.stages.find((s) => s.id === id)!);
		expect(stageStep(system, null, -1)).toBeUndefined();
		expect(stageStep(system, null, 1)).toBe('open');
		expect(stageStep(system, open, -1)).toBe('whole');
		expect(stageStep(system, open, 1)).toBe('push');
		expect(stageStep(system, push, 1)).toBeUndefined();
		expect(stageStep({ ...system, stages: [push, open] }, open, 1)).toBe('push');
		expect(stageStep({ ...system, stages: [] }, null, 1)).toBeUndefined();
	});
});
