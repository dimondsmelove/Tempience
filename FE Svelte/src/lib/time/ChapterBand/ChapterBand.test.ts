import { describe, expect, it } from 'vitest';
import { chapterLabel, labelRoom } from './label';

describe('the band’s labels', () => {
	it('leaves the band’s right end to the «+» and pads the text', () => {
		expect(labelRoom(0, 500, 1000)).toBe(488);
		expect(labelRoom(900, 2000, 1000)).toBe(60);
		expect(labelRoom(-50, 300, 1000)).toBe(338);
	});
	it('shows the dates only beside the whole name, and the name down to a stub', () => {
		expect(chapterLabel(200, 100, 60)).toEqual({ name: true, extra: true });
		expect(chapterLabel(150, 100, 60)).toEqual({ name: true, extra: false });
		expect(chapterLabel(20, 100, 60)).toEqual({ name: false, extra: false });
	});
});
