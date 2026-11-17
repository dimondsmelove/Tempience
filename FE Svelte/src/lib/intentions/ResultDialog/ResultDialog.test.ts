import { render } from 'svelte/server';
import { expect, it } from 'vitest';
import ResultDialog from './ResultDialog.svelte';
const props = {
	zone: 'UTC',
	weekStart: 0,
	title: 'Тестовая задача',
	cancel: () => {},
	save: async () => true
};
it('starts with an empty required result and disabled save', () => {
	const body = render(ResultDialog, { props: { ...props, outcome: 'partial' } }).body;
	expect(body).toContain('<textarea');
	expect(body).toContain('Тестовая задача');
	expect(body).toContain('required');
	expect(body).toContain('disabled');
	expect(body).toContain('Перенести остаток');
});
it('omits move controls for alternative', () => {
	const body = render(ResultDialog, { props: { ...props, outcome: 'alternative' } }).body;
	expect(body).toContain('Записать и закрыть');
	expect(body).not.toContain('Перенести остаток');
});
