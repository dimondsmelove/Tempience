import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import type { WhenTrace } from '../WhenModel/types';
import WhenPopover from './WhenPopover.svelte';

describe('WhenPopover SSR', () => {
	const renderWhen = (trace: WhenTrace, disabled = false) =>
		render(WhenPopover, {
			props: {
				trace,
				zone: 'UTC',
				now: Date.parse('2026-11-18T10:00:00Z'),
				weekStart: Date.parse('2026-11-16T00:00:00Z'),
				onpick: () => {},
				disabled
			}
		});

	it('renders the accessible trigger, disabled state, and stable panel selector', () => {
		const trace = {
			aboutKind: 'point',
			aboutTime: null,
			statedDuration: null
		} as unknown as WhenTrace;
		const { body } = renderWhen(trace, true);
		expect(body).toContain('aria-label="Выбрать дату"');
		expect(body).toContain('disabled');
		expect(body).toContain('data-testid="when-panel"');
		expect(body).toContain('data-day-key="2026-11-18"');
	});

	it('highlights the matching today chip', () => {
		const trace = {
			aboutKind: 'point',
			aboutTime: {
				basis: 'absolute',
				precision: 'day',
				certainty: 'exact',
				start: '2026-11-18',
				end: null
			},
			statedDuration: null
		} as unknown as WhenTrace;
		const { body } = renderWhen(trace);
		expect(body).toMatch(/<button\b[^>]*aria-pressed="true"[^>]*>\s*Сегодня\s*<\/button>/);
	});

	it('explains why time is disabled for an inexact date', () => {
		const trace = {
			aboutKind: 'point',
			aboutTime: { basis: 'relative', value: 'sometime' },
			statedDuration: null
		} as unknown as WhenTrace;
		const { body } = renderWhen(trace);
		expect(body).not.toMatch(/<button\b[^>]*aria-pressed="true"[^>]*>\s*Сегодня\s*<\/button>/);
		expect(body).toContain('title="Сначала выберите точный день"');
		expect(body).toContain('data-when-placement="inexact"');
	});
});
