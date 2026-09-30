import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';
import type { StageWindow } from '$lib/model/Chapters/types';
import StageStrip from './StageStrip.svelte';
import { nowIn } from './strip';
import type { StageStripProps } from './types';

const at = (day: number): number => Date.UTC(2026, 8, day);
const window = (id: string, start: number, end: number | null): StageWindow => ({
	stage: { id, name: id, note: '', start: new Date(start).toISOString(), lineup: null },
	start,
	end
});
const windows = [window('Открытие', at(1), at(8)), window('Рывок', at(8), null)];
const props = (over: Partial<StageStripProps> = {}): StageStripProps => ({
	windows,
	inForceId: 'Рывок',
	nowId: 'Рывок',
	now: at(15),
	stripEnd: at(22),
	colour: 'red',
	spanOf: (item: StageWindow) => `span ${item.stage.name}`,
	onchoose: vi.fn(),
	...over
});

describe('the stage strip', () => {
	it('places «сейчас» inside its stage and nowhere else', () => {
		expect(nowIn(windows[1], at(15), at(22))).toBeCloseTo(50);
		expect(nowIn(windows[0], at(15), at(22))).toBeNull();
	});
	it('gives every segment one width, whatever its time', () => {
		const { body } = render(StageStrip, { props: props() });
		expect(body).not.toContain('flex-grow');
	});
	it('presses the stage in force and draws «сейчас» in it', () => {
		const { body } = render(StageStrip, { props: props() });
		expect(body.match(/aria-pressed="true"/g)).toHaveLength(1);
		expect(body).toMatch(/aria-pressed="true"[^>]*data-testid="strip-stage"[^>]*>Рывок/);
		expect(body).toContain('strip-now');
		expect(body).toContain('title="Открытие · span Открытие"');
	});
	it('presses «Вся глава» when no stage is in force, and says so when there are none', () => {
		expect(render(StageStrip, { props: props({ inForceId: null }) }).body).toMatch(
			/aria-pressed="true"[^>]*data-testid="strip-whole"/
		);
		expect(render(StageStrip, { props: props({ windows: [] }) }).body).toContain('без этапов');
	});
});
