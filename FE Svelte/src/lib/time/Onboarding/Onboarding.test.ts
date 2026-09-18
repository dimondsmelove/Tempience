import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';
import Onboarding from './Onboarding.svelte';

describe('first-launch introduction', () => {
	it('explains local ownership and the next action without ontology terms', () => {
		const oncreate = vi.fn(async () => {});
		const { body } = render(Onboarding, { props: { oncreate } });
		const text = body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
		expect(text).toContain('Начать');
		expect(text).toContain('Данные хранятся в браузере на этом устройстве');
		expect(text).toContain('Экспортировать данные');
		expect(text).not.toMatch(/\b(Trace|Scope|Intersection|DataSpace)\b/);
		expect(oncreate).not.toHaveBeenCalled();
	});
});
