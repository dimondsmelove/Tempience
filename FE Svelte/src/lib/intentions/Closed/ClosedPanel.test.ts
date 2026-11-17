import { render } from 'svelte/server';
import { expect, it } from 'vitest';
import type { ExplorerTrace } from '$lib/model/Snapshot/types';
import ClosedPanel from './ClosedPanel.svelte';

it('renders all outcomes, only strikes completed and shows an alternative result', () => {
	const outcomes = ['completed', 'partial', 'alternative', 'not_completed', null] as const;
	const items = outcomes.map(
		(outcome, index) =>
			({ id: `${index}`, content: `Task ${index}`, intentOutcome: outcome }) as ExplorerTrace
	);
	const fact = {
		...items[0],
		id: 'fact',
		content: 'Another result',
		closesIntentionIds: ['2']
	} as ExplorerTrace;
	const html = render(ClosedPanel, {
		props: {
			closed: { groups: [{ day: null, items }], total: 5 },
			doneLimit: 50,
			today: '2026-11-17',
			traces: [...items, fact],
			links: [{ kind: 'evidence_for', fromId: 'fact', toId: '2' }] as never,
			assessments: [
				{
					intentionId: '2',
					source: 'evidence',
					outcome: 'alternative',
					factId: 'fact',
					isDeleted: false
				}
			] as never,
			search: '',
			reopen: () => {},
			edit: () => {},
			more: () => {}
		}
	}).body;
	expect(html).toContain('→ Another result');
	expect(html).toMatch(/class="[^"]*completed[^"]*">Task 0<\/span>/);
	expect(html).not.toMatch(/class="[^"]*completed[^"]*">Task [1-4]<\/span>/);
	expect(html).toContain('partial');
	expect(html).toContain('alternative');
	expect(html).toContain('×');
});
