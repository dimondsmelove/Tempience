import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';
import type { StageWindow } from '$lib/model/Chapters/types';
import StageList from './StageList.svelte';

const window = (id: string, note = '', own = false): StageWindow => ({
	stage: {
		id,
		name: id,
		note,
		start: '2026-09-01T00:00:00Z',
		lineup: own ? [{ scopeId: 'health', level: 'focus' }] : null
	},
	start: 0,
	end: null
});

describe('the stage rows', () => {
	const { body } = render(StageList, {
		props: {
			windows: [window('Открытие', 'Сначала тело'), window('Рывок', '', true)],
			inForceId: 'Рывок',
			nowId: 'Открытие',
			colour: 'red',
			spanOf: (item: StageWindow) => `даты ${item.stage.name}`,
			scopeOf: () => ({ id: 'health', name: 'Здоровье', colorHue: 345 }),
			onchoose: vi.fn(),
			onedit: vi.fn(),
			onremove: vi.fn(async () => {})
		}
	});
	it('names each stage with its dates and note, the one in force marked', () => {
		expect(body.match(/data-testid="chapter-stage-item"/g)).toHaveLength(2);
		expect(body).toContain('даты Открытие');
		expect(body).toContain('Сначала тело');
		expect(body.match(/aria-current="true"/g)).toHaveLength(1);
		expect(body).toMatch(/aria-current="true"[^>]*>[\s\S]*Рывок/);
	});
	it('edits and removes each stage from its own row, and dots a lineup of its own', () => {
		expect(body.match(/data-testid="stage-edit"/g)).toHaveLength(2);
		expect(body.match(/data-testid="stage-row-delete"/g)).toHaveLength(2);
		expect(body.match(/data-testid="stage-own-lineup"/g)).toHaveLength(1);
	});
});
