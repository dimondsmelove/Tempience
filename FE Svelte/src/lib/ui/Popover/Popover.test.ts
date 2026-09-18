import { expect, it } from 'vitest';
import { popoverPosition } from './position';
it('keeps a panel within the viewport and flips above a trigger near the bottom', () => {
	const viewport = { width: 400, height: 300 };
	expect(
		popoverPosition(
			{ left: 350, right: 390, top: 260, bottom: 290 },
			{ width: 200, height: 180 },
			viewport
		)
	).toEqual({ left: 192, top: 76 });
	expect(
		popoverPosition(
			{ left: 20, right: 80, top: 10, bottom: 40 },
			{ width: 200, height: 180 },
			viewport
		)
	).toEqual({ left: 20, top: 44 });
});
