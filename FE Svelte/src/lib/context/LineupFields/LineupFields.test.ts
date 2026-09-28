import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';
import LineupFields from './LineupFields.svelte';

const view = {
	scopes: [
		{ id: 'money', name: 'Заработок денег' },
		{ id: 'captain', name: 'Курс капитана' }
	],
	intersections: [{ kind: 'child_of', fromId: 'captain', toId: 'money' }]
} as never;

describe('the lineup field', () => {
	it('lists each Scope with its path above its name and a ×, no order to keep', () => {
		const { body } = render(LineupFields, {
			props: {
				lineup: [{ scopeId: 'captain', level: 'focus' }],
				view,
				onchange: vi.fn(),
				testId: 'lineup'
			}
		});
		expect(body.match(/data-testid="lineup-entry"/g)).toHaveLength(1);
		expect(body).toContain('Заработок денег ›');
		expect(body).toContain('Курс капитана');
		expect(body).not.toContain('draggable');
		expect(body).toContain('Добавить в состав');
	});
});
