import { expect, it } from 'vitest';
import { defaultDevice } from '../constants';
import { parseDevice } from '../normalize';

it('restores old device caches and validates the new local row height', () => {
	const { rowHeightPx, ...old } = defaultDevice;
	expect(parseDevice(old)?.rowHeightPx).toBe(rowHeightPx);
	for (const height of [52, 600, 1200])
		expect(parseDevice({ ...defaultDevice, rowHeightPx: height })?.rowHeightPx).toBe(height);
	for (const height of [0, 1201, Infinity, null])
		expect(parseDevice({ ...old, rowHeightPx: height })).toBeNull();
});
