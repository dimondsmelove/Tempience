import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';
import Onboarding from './Onboarding.svelte';

const textOf = (body: string): string => body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');

describe('first-launch tour', () => {
	it('opens on «Что такое Tempience» naming the three words', () => {
		const onstart = vi.fn();
		const { body } = render(Onboarding, { props: { onstart } });
		const text = textOf(body);
		expect(text).toContain('1 из 5');
		expect(text).toContain('Что такое Tempience');
		expect(text).toMatch(/\bTrace\b/);
		expect(text).toMatch(/\bScope\b/);
		expect(text).toMatch(/\bIntersection\b/);
		expect(text).toContain('Далее');
		expect(text).toContain('Пропустить');
		expect(text).not.toContain('Назад');
		expect(text).not.toContain('Закрыть');
		expect(onstart).not.toHaveBeenCalled();
	});

	it('renders the marks of the copy as elements, never as text or HTML', () => {
		const { body } = render(Onboarding, { props: { onstart: vi.fn() } });
		expect(body).toContain('<strong class="font-semibold text-ink">Trace</strong>');
		expect(body).not.toContain('**');
		expect(body).not.toContain('{@html');
	});

	it('offers «Закрыть» only when opened from the menu', () => {
		const { body } = render(Onboarding, { props: { onstart: vi.fn(), onclose: vi.fn() } });
		expect(textOf(body)).toContain('Закрыть');
	});
});
