import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';
import RecordList from './RecordList.svelte';
import RecordMark from './RecordMark.svelte';

const item = (traceId: string, day: number, colours: string[] = []) => ({
	traceId,
	date: `${day} сент.`,
	title: traceId,
	at: Date.UTC(2026, 8, day, 10),
	mark: { shape: 'fact' as const, colours }
});

describe('a Context record list', () => {
	it('cuts a long list into weeks under a mono header with the count', () => {
		const { body } = render(RecordList, {
			props: {
				items: [item('a', 8), item('b', 9), item('c', 14), item('d', 15)],
				testId: 'r',
				empty: 'пусто',
				group: 'week',
				onselect: vi.fn()
			}
		});
		expect(body.match(/data-testid="record-group"/g)).toHaveLength(2);
		expect(body.match(/data-testid="r"/g)).toHaveLength(4);
	});
	it('keeps a short list whole and says when it is empty', () => {
		const short = render(RecordList, {
			props: {
				items: [item('a', 8)],
				testId: 'r',
				empty: 'пусто',
				group: 'week',
				onselect: vi.fn()
			}
		});
		expect(short.body).not.toContain('record-group');
		const none = render(RecordList, {
			props: { items: [], testId: 'r', empty: 'пусто', group: 'week', onselect: vi.fn() }
		});
		expect(none.body).toContain('пусто');
	});
	it('weaves the mark of a record in several Scopes, a pixel wider', () => {
		const { body } = render(RecordMark, { props: { shape: 'fact', colours: ['red', 'blue'] } });
		expect(body).toContain('data-woven="true"');
		expect(body).toContain('width: 4px');
		expect(body).toContain('linear-gradient(180deg, red 0% 50%, blue 50% 100%)');
	});
});
