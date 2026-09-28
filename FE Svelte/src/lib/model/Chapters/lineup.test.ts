import { describe, expect, it } from 'vitest';
import { lineup as levels } from './Chapters.fixture';
import { idsAt, levelsOf, lineupFromIds, lineupOf, ordered } from './lineup';

describe('a lineup and its two fields', () => {
	it('reads focus first, then support, each in the owner’s order', () => {
		const list = levels(['tempience'], ['people', 'body']).toReversed();
		expect(ordered(list).map((entry) => entry.scopeId)).toEqual(['tempience', 'body', 'people']);
		expect(idsAt(list, 'support')).toEqual(['body', 'people']);
	});
	it('splits into «Фокус» and «Поддержка» and comes back whole', () => {
		const list = levels(['tempience', 'mama'], ['people']);
		expect(levelsOf(list)).toEqual({ focus: ['tempience', 'mama'], support: ['people'] });
		expect(lineupOf(['mama', 'tempience'], ['people'])).toEqual(
			levels(['mama', 'tempience'], ['people'])
		);
		// A Scope moved between the fields is taken from one and added to the other; in both, the focus keeps it.
		expect(lineupOf(['tempience'], ['tempience', 'people'])).toEqual(
			levels(['tempience'], ['people'])
		);
		expect(lineupOf([], [])).toEqual([]);
	});
});

describe('one lineup', () => {
	it('puts every Scope in front, each once', () => {
		expect(lineupFromIds(['a', 'b', 'a'])).toEqual([
			{ scopeId: 'a', level: 'focus' },
			{ scopeId: 'b', level: 'focus' }
		]);
	});
});
