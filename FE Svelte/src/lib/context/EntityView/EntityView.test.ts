import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import type { ExplorerSnapshot } from '$lib/model/Snapshot/types';
import type { WorkbenchState } from '$lib/state/Workbench/Workbench.svelte';
import EntityView from './EntityView.svelte';

describe('EntityView', () => {
	it('keeps a persisted connection visible when both endpoints are missing', () => {
		const view: ExplorerSnapshot = {
			traces: [],
			scopes: [],
			periods: [],
			scopeSegments: [],
			intersections: [
				{
					id: 'link',
					fromId: 'a',
					toId: 'b',
					kind: 'related_to',
					context: 'Причина связи',
					origin: { kind: 'canonical', sourceId: 'test' }
				}
			]
		};
		const result = render(EntityView, {
			props: { workbench: { view } as WorkbenchState, entityId: 'link' }
		});
		expect(result.body).toContain('Причина связи');
		expect(result.body).toContain('Объект недоступен: a');
		expect(result.body).toContain('Объект недоступен: b');
		expect(result.body).toContain('data-entity-role="intersection"');
	});
});
