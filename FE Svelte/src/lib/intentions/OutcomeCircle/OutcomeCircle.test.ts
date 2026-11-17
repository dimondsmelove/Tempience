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
		const actual = [...body.matchAll(/<small[^>]*>(.*?)<\/small>/g)].map((match) => match[1]);
		expect(actual).toEqual(hints);
	} finally {
		locale.set('ru');
	}
});
