import { describe, expect, it } from 'vitest';
import { RepositoryError } from '../Repository/errors';
import { isTypedTrace, storedTraceText, traceRecordText } from './fields';

const code = (run: () => unknown): string => {
	try {
		run();
		return 'accepted';
	} catch (error) {
		return error instanceof RepositoryError ? error.code : String(error);
	}
};

describe('traceRecordText', () => {
	it('reads a plain record as title plus description and a typed one as description only', () => {
		expect(traceRecordText({ kindId: null, content: 'Прогулка', description: 'по парку' })).toEqual(
			{
				title: 'Прогулка',
				description: 'по парку'
			}
		);
		expect(traceRecordText({ kindId: null, content: 'Прогулка', description: null })).toEqual({
			title: 'Прогулка',
			description: null
		});
		expect(traceRecordText({ kindId: 'k', content: 'после сна', description: null })).toEqual({
			title: null,
			description: 'после сна'
		});
		expect(traceRecordText({ kindId: 'k', content: '', description: null })).toEqual({
			title: null,
			description: null
		});
		expect(isTypedTrace({ kindId: 'k' })).toBe(true);
		expect(isTypedTrace({ kindId: null })).toBe(false);
	});

	it('reads a legacy row whole without splitting its content', () => {
		expect(
			traceRecordText({ kindId: null, content: 'Заголовок\n\nтекст записи', description: null })
		).toEqual({ title: 'Заголовок\n\nтекст записи', description: null });
	});
});

describe('storedTraceText', () => {
	it('requires and trims the plain title and keeps a blank description as null', () => {
		expect(
			storedTraceText(false, { title: ' Прогулка ', description: ' по парку ' }, true)
		).toEqual({ content: 'Прогулка', description: 'по парку' });
		expect(storedTraceText(false, { title: 'Прогулка', description: '  ' }, true)).toEqual({
			content: 'Прогулка',
			description: null
		});
		expect(storedTraceText(false, { title: 'Прогулка' }, true)).toEqual({
			content: 'Прогулка',
			description: null
		});
		expect(code(() => storedTraceText(false, { description: 'без названия' }, true))).toBe(
			'title_required'
		);
		expect(code(() => storedTraceText(false, { title: '   ' }, true))).toBe('title_required');
	});

	it('stores the typed description in content, keeps description null and refuses a title', () => {
		expect(storedTraceText(true, { description: ' после сна ' }, true)).toEqual({
			content: 'после сна',
			description: null
		});
		expect(storedTraceText(true, {}, true)).toEqual({ content: '', description: null });
		expect(storedTraceText(true, { title: null, description: null }, true)).toEqual({
			content: '',
			description: null
		});
		expect(code(() => storedTraceText(true, { title: 'Замер' }, true))).toBe('typed_title');
	});

	it('maps only the present keys of an edit', () => {
		expect(storedTraceText(false, {}, false)).toEqual({});
		expect(storedTraceText(false, { description: ' ' }, false)).toEqual({ description: null });
		expect(storedTraceText(false, { title: 'Новое' }, false)).toEqual({ content: 'Новое' });
		expect(code(() => storedTraceText(false, { title: '' }, false))).toBe('title_required');
		expect(storedTraceText(true, {}, false)).toEqual({});
		expect(storedTraceText(true, { title: '' }, false)).toEqual({});
		expect(storedTraceText(true, { description: 'x' }, false)).toEqual({
			content: 'x',
			description: null
		});
		expect(code(() => storedTraceText(true, { title: 'Замер' }, false))).toBe('typed_title');
	});
});
