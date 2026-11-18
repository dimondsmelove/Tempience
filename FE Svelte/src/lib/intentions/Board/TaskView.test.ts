import { render } from 'svelte/server';
import { expect, it, vi } from 'vitest';
import type { ExplorerTrace } from '$lib/model/Snapshot/types';
import { buildHierarchy } from '../Hierarchy/Hierarchy';
import TaskView from './TaskView.svelte';
import { UndoState } from '$lib/state/Undo/Undo.svelte';

vi.mock('$lib/state/triplit/client', () => ({ activeDataSpace: { id: 'canonical' }, triplit: {} }));

it('shows empty records while omitting empty parent and scope placeholders', () => {
	const trace: ExplorerTrace = {
		id: 'task',
		content: 'Task\ncontinued',
		relation: 'intend',
		timezone: 'UTC',
		aboutKind: 'instant',
		aboutTime: null,
		aboutTraceId: null,
		kindId: null,
		kindVId: null,
		data: null,
		origin: { kind: 'canonical', sourceId: 'test' }
	};
	const body = render(TaskView, {
		props: {
			trace,
			traces: [trace],
			scopes: [],
			links: [],
			assessments: [],
			undo: new UndoState(),
			reload: async () => {},
			hierarchy: buildHierarchy([trace], []),
			zone: 'UTC',
			weekStart: 1,
			today: '2026-11-16',
			add: async () => null,
			complete: () => {},
			preset: () => {},
			setStatus: () => {},
			setPanelOutcome: () => {},
			ondelete: () => {},
			onnavigate: () => {},
			onedit: () => {},
			onrefresh: () => {}
		}
	}).body;
	expect(body).toContain('Открыто');
	expect(body).toContain('Без итога');
	expect(body).toContain('Удалить');
	expect(body).toContain('+ Описание');
	expect(body).toContain('continued');
	expect(body).not.toContain('Нет описания');
	expect(body).not.toContain('нет родителя');
	expect(body).not.toContain('Scope: нет');
	expect(body).toContain('context-section-task-results');
	expect(body).toContain('Записей нет.');
});
