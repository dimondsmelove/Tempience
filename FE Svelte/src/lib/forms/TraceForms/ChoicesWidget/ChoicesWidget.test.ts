import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import ChoicesWidget from './ChoicesWidget.svelte';

const option = (id: string, label: string) => ({ id, value: id, label, disabled: false });
const props = (value: string[] | undefined) =>
	({
		type: 'widget',
		config: { title: 'Упражнения', schema: {} },
		value,
		handlers: {},
		errors: [],
		uiOption: () => undefined,
		options: [option('pull', 'Подтягивания'), option('dips', 'Брусья'), option('push', 'Отжимания')]
	}) as never;

describe('ChoicesWidget', () => {
	it('shows the chosen options as chips and offers every option in one list, never as checkboxes', () => {
		const body = render(ChoicesWidget, { props: props(['dips', 'pull']) }).body;
		expect(body).not.toContain('type="checkbox"');
		expect(body).toContain('role="combobox"');
		// Chips keep the Kind's order of options, whatever order they were chosen in.
		const chips = [...body.matchAll(/aria-label="Убрать «([^»]+)»"/g)].map((match) => match[1]);
		expect(chips).toEqual(['Подтягивания', 'Брусья']);
		// The chosen ones stay in the list as taken; the rest can be picked.
		expect(body).toMatch(/aria-label="Брусья"[^>]*aria-disabled="true"/);
		expect(body).not.toMatch(/aria-label="Отжимания"[^>]*aria-disabled/);
		expect(body).toContain('Поиск варианта…');
	});

	it('shows no chips while nothing is chosen', () => {
		const body = render(ChoicesWidget, { props: props(undefined) }).body;
		expect(body).not.toContain('Убрать «');
		expect(body).toContain('Выбрать вариант');
	});
});
