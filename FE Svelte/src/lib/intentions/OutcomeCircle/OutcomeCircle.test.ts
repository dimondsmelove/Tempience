import { render } from 'svelte/server';
import { expect, it } from 'vitest';
import OutcomeCircle from './OutcomeCircle.svelte';
import { locale } from '$lib/state/Locale/Locale.svelte';

it('renders the open action, menu and disabled completed preset', () => {
	const body = render(OutcomeCircle, {
		props: { outcome: 'completed', open: true, activate: () => {}, preset: () => {} }
	}).body;
	expect(body).toContain('Выполнить');
	expect(body).toContain('Меню итога');
	expect(body).toContain('disabled');
	expect(body).toContain('Частично');
	expect(body).toContain('Выполнено и повторить');
	expect(body).toContain('Завтра');
	expect(body).toContain('Через неделю');
	expect(body).not.toContain('По зоне доски');
	expect(body).not.toContain('Board time zone');
	expect(body.indexOf('Выполнено и повторить')).toBeGreaterThan(body.indexOf('Выполнено</span>'));
	expect(body).not.toContain('repeat-trigger');
	expect(body).toContain('repeat-date-trigger');
	expect(body).toContain('repeat-separator');
	expect(body).toContain('repeat-back');
	expect(body.indexOf('Выполнено и повторить')).toBeLessThan(body.indexOf('Частично'));
	expect(body.indexOf('Завтра')).toBeLessThan(body.indexOf('Через неделю'));
	expect(body.indexOf('Через неделю')).toBeLessThan(body.indexOf('Дата…'));
	const dayHints = [...body.matchAll(/<small class="svelte-[^"]*">([^<]+)<\/small>/g)].map(
		(match) => match[1]
	);
	expect(dayHints).toHaveLength(2);
	for (const hint of dayHints) {
		expect(hint).toMatch(/\d{1,2}/);
		expect(hint).not.toContain(',');
		expect(hint).not.toMatch(
			/янв|фев|мар|апр|май|июн|июл|авг|сен|окт|ноя|дек|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/i
		);
	}
});
it('labels a closed circle as reopening', () => {
	const body = render(OutcomeCircle, {
		props: { open: false, activate: () => {}, preset: () => {} }
	}).body;
	expect(body).toContain('Вернуть в работу');
});

it.each([
	['ru', ['закроет', 'закроет', 'закроет, без итога']],
	['en', ['closes task', 'closes task', 'closes task, no outcome']]
] as const)('renders only the three meaningful hints in %s', (language, hints) => {
	locale.set(language);
	try {
		const body = render(OutcomeCircle, {
			props: { open: true, activate: () => {}, preset: () => {} }
		}).body;
		const actual = [...body.matchAll(/<small class="preset-hint[^"]*"[^>]*>(.*?)<\/small>/g)].map(
			(match) => match[1]
		);
		expect(actual).toEqual(hints);
	} finally {
		locale.set('ru');
	}
});
