import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import Dialog from './DeleteIntentionDialog.svelte';
import { locale } from '$lib/state/Locale/Locale.svelte';
import type { DeletePlan } from './types';

const plan: DeletePlan = {
	deleteIds: ['root', 'child'],
	descendantCount: 1,
	keptShared: [{ id: 'shared', otherParentIds: ['live-parent'] }]
};

describe('DeleteIntentionDialog SSR', () => {
	it('shows all choices, shared-parent text and accessible dialog label', () => {
		locale.set('ru');
		const { body } = render(Dialog, {
			props: {
				title: 'Корень',
				plan,
				sharedChild: 'Общая',
				sharedParent: 'Живая',
				cancel: () => {},
				confirm: async () => {}
			}
		});
		expect(body).toContain('Удалить «Корень»?');
		expect(body).toContain('Удалить задачу и 1 подзадачу');
		expect(body).toContain('Общая');
		expect(body).toContain('Живая');
		expect(body).toContain('Удалить только задачу');
		expect(body).toContain('Отмена');
		expect(body).toContain('aria-labelledby');
		expect(body).toContain('data-sheet-initial-focus');
	});
	it('renders the mobile sheet with English labels and accessible close label', () => {
		locale.set('en');
		const { body } = render(Dialog, {
			props: {
				title: 'Root',
				plan,
				initialWidth: 390,
				sharedChild: 'Shared',
				sharedParent: 'Live',
				cancel: () => {},
				confirm: async () => {}
			}
		});
		expect(body).toContain('Delete “Root”?');
		expect(body).toContain('Delete only the task, subtasks will remain');
		expect(body).toContain('Cancel');
		expect(body).toContain('aria-label');
		expect(body).toContain('data-sheet-initial-focus');
		locale.set('ru');
	});
});
