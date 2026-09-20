import { describe, expect, it } from 'vitest';
import { HoverState } from './Hover.svelte';

describe('HoverState', () => {
	it('keeps the same target object while the pointer stays on the same thing', () => {
		const hover = new HoverState();
		hover.trace('a');
		const first = hover.target;
		hover.trace('a');
		expect(hover.target).toBe(first);
		hover.row('r');
		expect(hover.target).toEqual({ kind: 'row', rowId: 'r' });
		hover.clear();
		expect(hover.target).toBeNull();
	});
});
