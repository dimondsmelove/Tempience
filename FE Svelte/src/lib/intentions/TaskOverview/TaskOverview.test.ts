import { render } from 'svelte/server';
import { expect, it, vi } from 'vitest';
import type { ExplorerTrace } from '$lib/model/Snapshot/types';
import { buildHierarchy } from '../Hierarchy/Hierarchy';
import { panelRelations } from '../Board/panel';
import TaskOverview from './TaskOverview.svelte';

vi.mock('$lib/state/triplit/client', () => ({ activeDataSpace: { id: 'canonical' }, triplit: {} }));

it('shows independent controls and the muted, struck-through title for a completed task', () => {
	const trace: ExplorerTrace = {
		id: 'task',
		content: 'Задача',
		relation: 'intend',
		timezone: 'UTC',
		aboutKind: 'instant',
		aboutTime: null,
		aboutTraceId: null,
		kindId: null,
		kindVId: null,
		data: null,
		origin: { kind: 'canonical', sourceId: 'test' },
		intentOpen: false,
		intentOutcome: 'completed'
	};
	const body = render(TaskOverview, {
		props: {
			trace,
			relations: panelRelations(trace.id, buildHierarchy([trace], []), [trace]),
			zone: 'UTC',
			complete: () => {},
			preset: () => {},
			setStatus: () => {},
			setPanelOutcome: () => {},
			ondelete: () => {},
			move: () => {},
			onnavigate: () => {},
			onedit: () => {},
			onrefresh: () => {},
			collapsed: false,
			ontoggle: () => {}
		}
	}).body;
	expect(body).toContain('closed completed');
	expect(body).toContain('Закрыто');
	expect(body).toContain('Выполнено');
	expect(body).toContain('Удалить');
});
