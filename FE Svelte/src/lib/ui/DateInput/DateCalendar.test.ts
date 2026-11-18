import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import DateCalendar from './DateCalendar.svelte';

describe('DateCalendar SSR', () => {
	it('marks every day with its key and distinguishes selected and today', () => {
		const { body } = render(DateCalendar, {
			props: {
				value: new Date(2026, 10, 18, 12),
				todayKey: '2026-11-19',
				onselect: () => {}
			}
		});
		expect(body).toContain('data-day-key="2026-11-18"');
		expect(body).toContain('aria-selected="true"');
		expect(body).toContain('data-day-key="2026-11-19"');
		expect(body).toContain('aria-current="date"');
	});

	it('opens the supplied zone month when no day is selected', () => {
		const { body } = render(DateCalendar, {
			props: { todayKey: '2026-11-19', onselect: () => {} }
		});
		expect(body).toContain('data-day-key="2026-11-01"');
		expect(body).toContain('data-day-key="2026-11-30"');
	});
});
