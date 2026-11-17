import { render } from 'svelte/server';
import { expect, it } from 'vitest';
import OutcomeIcon from './OutcomeIcon.svelte';

it.each([
	['partial', 'partial'],
	['alternative', 'alternative'],
	['completed', 'completed'],
	['not_completed', '×'],
	[null, 'icon']
] as const)('renders %s outcome', (outcome, marker) => {
	expect(render(OutcomeIcon, { props: { outcome } }).body).toContain(marker);
});
