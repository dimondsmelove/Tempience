import { describe, expect, it } from 'vitest';
import { now, out, story3, system } from './Chapters.fixture';
import { driverOf, historyOf } from './driving';
import { stageInForce } from './stages';
import { ms } from './time';

describe('the driving rule', () => {
	const early = ms('2026-09-03T12:00:00+02:00');
	const ids = (lineup: readonly { scopeId: string }[]) => lineup.map((entry) => entry.scopeId);
	it('with nothing chosen, the current stage is in force: its own lineup drives', () => {
		const driver = driverOf(system, null, early);
		expect(driver.stage?.id).toBe('open');
		expect(ids(driver.lineup)).toEqual(['body', 'tempience']);
	});
	it('with nothing chosen and a current stage of no lineup of its own, the chapter’s drives', () => {
		const driver = driverOf(system, null, now);
		expect(driver.stage?.id).toBe('push');
		expect(driver.lineup).toBe(system.lineup);
	});
	it('«Вся глава» drives by the chapter even when the current stage has its own lineup', () => {
		const driver = driverOf(system, 'whole', early);
		expect(driver.stage).toBeNull();
		expect(driver.lineup).toBe(system.lineup);
		expect(stageInForce(system, 'whole', early)).toBeNull();
	});
	it('a chosen stage drives by its own lineup, or by the chapter’s without one', () => {
		expect(ids(driverOf(system, 'open', now).lineup)).toEqual(['body', 'tempience']);
		const push = driverOf(system, 'push', early);
		expect(push.stage?.id).toBe('push');
		expect(push.lineup).toBe(system.lineup);
	});
	it('a chapter with no current stage: nothing in force, the chapter’s lineup', () => {
		const driver = driverOf(out, null, now);
		expect(driver.stage).toBeNull();
		expect(driver.lineup).toBe(out.lineup);
		expect(stageInForce(system, null, ms('2026-10-05T00:00:00+02:00'))).toBeNull();
	});
	it('a stage that no longer exists is not in force', () => {
		expect(stageInForce(system, 'gone', now)).toBeNull();
	});
});

describe('a Scope’s chapter history', () => {
	const [a, b, c] = story3;
	it('gives a Scope its chapter history, the given chapter last', () => {
		expect(historyOf(story3, c, 'people').map((tick) => [tick.chapter.id, tick.driving])).toEqual([
			['a', false],
			['b', false],
			['c', true]
		]);
		expect(historyOf(story3, b, 'people').map((tick) => tick.chapter.id)).toEqual(['a', 'b']);
		expect(historyOf(story3, c, 'work').map((tick) => [tick.chapter.id, tick.driving])).toEqual([
			[a.id, false]
		]);
	});
});
