import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import WhenDayPicker from './WhenDayPicker.svelte';

const props = {
	value: '2026-11-20',
	today: '2026-11-18',
	label: 'Дата',
	onpick: () => {}
};

describe('WhenDayPicker SSR', () => {
	it('renders only a calendar with selected day and today', () => {
		const body = render(WhenDayPicker, { props }).body;
		expect(body).toContain('data-testid="date-calendar"');
		expect(body).toMatch(/data-day-key="2026-11-20"[^>]*aria-selected="true"/);
		expect(body).toMatch(/data-day-key="2026-11-18"[^>]*aria-current="date"/);
		expect(body).not.toContain('Время');
		expect(body).not.toContain('Завтра');
		expect(body).not.toContain('Убрать дату');
	});
	it('offers clearing only when there is a value and a callback', () => {
		expect(render(WhenDayPicker, { props: { ...props, onclear: () => {} } }).body).toContain(
			'Убрать дату'
		);
		expect(
			render(WhenDayPicker, { props: { ...props, value: '', onclear: () => {} } }).body
		).not.toContain('Убрать дату');
	});
});
