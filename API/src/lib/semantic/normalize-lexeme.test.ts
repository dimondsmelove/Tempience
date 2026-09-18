import { describe, expect, it } from 'vitest';
import { normalizeLexeme, tokenizeQuery } from './normalize-lexeme';

describe('normalizeLexeme', () => {
	it('lowercases and collapses spaces', () => {
		expect(normalizeLexeme('  Дом   ')).toBe('дом');
	});
});

describe('tokenizeQuery', () => {
	it('splits multi-word query', () => {
		expect(tokenizeQuery('дом, море')).toEqual(['дом', 'море']);
	});
});
