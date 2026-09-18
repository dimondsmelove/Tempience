import { describe, expect, it } from 'vitest';
import { WheelSourceReader } from './wheelSource';

const wheel = (deltaY: number, deltaX = 0, deltaMode = 0) => ({ deltaX, deltaY, deltaMode });

describe('WheelSourceReader', () => {
	it('reads a lone notch as the mouse, whole or fractional, in any delta mode', () => {
		const reader = new WheelSourceReader();
		expect(reader.read(wheel(120), 0)).toBe('mouse');
		expect(reader.read(wheel(-53.333332061767578), 400)).toBe('mouse');
		expect(reader.read(wheel(100), 800)).toBe('mouse');
		expect(reader.read(wheel(3, 0, 1), 1200)).toBe('mouse');
	});

	it('reads small or two-dimensional deltas as a trackpad, and a fast flick that follows them too', () => {
		const reader = new WheelSourceReader();
		expect(reader.read(wheel(4), 0)).toBe('trackpad');
		expect(reader.read(wheel(18), 16)).toBe('trackpad');
		expect(reader.read(wheel(96), 32)).toBe('trackpad');
		expect(reader.read(wheel(160), 48)).toBe('trackpad');
		expect(reader.read(wheel(60, 12), 500)).toBe('trackpad');
	});

	it('forgets a swipe after the gap: the next lone notch is the mouse again', () => {
		const reader = new WheelSourceReader();
		expect(reader.read(wheel(6), 0)).toBe('trackpad');
		expect(reader.read(wheel(120), 150)).toBe('trackpad');
		expect(reader.read(wheel(120), 150 + 201)).toBe('mouse');
	});
});
