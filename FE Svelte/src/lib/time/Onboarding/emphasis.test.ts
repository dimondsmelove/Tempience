import { describe, expect, it } from 'vitest';
import { parseEmphasis } from './emphasis';

describe('emphasis runs', () => {
	it('keeps plain copy as one text run', () => {
		expect(parseEmphasis('Ни одна связь не обязательна.')).toEqual([
			{ start: 0, kind: 'text', text: 'Ни одна связь не обязательна.' }
		]);
		expect(parseEmphasis('')).toEqual([]);
	});

	it('splits strong, em and code marks in source order with their offsets', () => {
		expect(parseEmphasis('Три слова: **Trace** — запись, *через неделю*, `belongs_to`.')).toEqual([
			{ start: 0, kind: 'text', text: 'Три слова: ' },
			{ start: 11, kind: 'strong', text: 'Trace' },
			{ start: 20, kind: 'text', text: ' — запись, ' },
			{ start: 31, kind: 'em', text: 'через неделю' },
			{ start: 45, kind: 'text', text: ', ' },
			{ start: 47, kind: 'code', text: 'belongs_to' },
			{ start: 59, kind: 'text', text: '.' }
		]);
	});

	it('takes the model copy literally inside a code mark, braces and bars included', () => {
		const runs = parseEmphasis(
			'`Trace { relation: intend | actual }`. `capturedAt` — когда записано'
		);
		expect(runs.map((run) => run.kind)).toEqual(['code', 'text', 'code', 'text']);
		expect(runs[0].text).toBe('Trace { relation: intend | actual }');
	});

	it('leaves a mark without its closing twin as text', () => {
		expect(parseEmphasis('5 * 3 и `open')).toEqual([
			{ start: 0, kind: 'text', text: '5 * 3 и `open' }
		]);
		expect(parseEmphasis('**Kind.** и *одна* звезда *')).toEqual([
			{ start: 0, kind: 'strong', text: 'Kind.' },
			{ start: 9, kind: 'text', text: ' и ' },
			{ start: 12, kind: 'em', text: 'одна' },
			{ start: 18, kind: 'text', text: ' звезда *' }
		]);
	});

	it('keys every run uniquely by its offset', () => {
		const runs = parseEmphasis('**a** *b* `c` **d**');
		expect(new Set(runs.map((run) => run.start)).size).toBe(runs.length);
	});
});
