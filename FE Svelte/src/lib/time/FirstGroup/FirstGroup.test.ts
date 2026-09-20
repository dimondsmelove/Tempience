import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';
import { CodedError } from '$lib/model/Errors/CodedError';
import { errorText } from '$lib/state/Locale/errors';
import FirstGroup from './FirstGroup.svelte';

const textOf = (body: string): string => body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');

describe('first Scope setup', () => {
	it('offers an optional first Scope, named as such, without a demo link by default', () => {
		const oncreate = vi.fn(async () => {});
		const onskip = vi.fn();
		const { body } = render(FirstGroup, { props: { oncreate, onskip } });
		const text = textOf(body);
		expect(body).toContain('aria-label="Первый Scope"');
		expect(text).toContain('Записи можно собирать в Scope');
		expect(text).toContain('Название Scope');
		expect(text).toContain('Создать Scope');
		expect(text).toContain('Начать без Scope');
		expect(text).not.toContain('Открыть записную книжку Ватсона');
		expect(text).not.toMatch(/групп/);
		expect(oncreate).not.toHaveBeenCalled();
		expect(onskip).not.toHaveBeenCalled();
	});

	it('shows the demo link only when a demo is offered', () => {
		const { body } = render(FirstGroup, {
			props: { oncreate: vi.fn(async () => {}), onskip: vi.fn(), ondemo: vi.fn() }
		});
		expect(textOf(body)).toContain('Открыть записную книжку Ватсона');
	});

	it('names the Scope in its refusals', () => {
		expect(errorText(new CodedError('onboarding_group_name', 'log'))).toBe(
			'Введите название Scope.'
		);
		expect(errorText(new CodedError('onboarding_group', 'log'))).toBe('Не удалось создать Scope.');
	});
});
