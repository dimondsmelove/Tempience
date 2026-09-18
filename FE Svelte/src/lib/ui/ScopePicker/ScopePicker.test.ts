import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import ScopePicker from './ScopePicker.svelte';
import { scopeAncestors, scopeOptionsOf, scopePath, scopeRows } from './tree';

const scopes = [
	{ id: 'people', name: 'Люди', parentId: null },
	{ id: 'mom', name: 'Мама', parentId: 'people' },
	{ id: 'work', name: 'Работа', parentId: null },
	{ id: 'win', name: '1 Win', parentId: 'work' },
	{ id: 'orphan', name: 'Сирота', parentId: 'gone' }
];

describe('scopeRows', () => {
	it('lists the tree depth-first in list order, children of a missing parent as roots', () => {
		expect(scopeRows(scopes).map((row) => [row.id, row.depth, row.hasChildren])).toEqual([
			['people', 0, true],
			['mom', 1, false],
			['work', 0, true],
			['win', 1, false],
			['orphan', 0, false]
		]);
		expect(scopeRows(scopes).find((row) => row.id === 'win')?.path).toEqual(['Работа']);
	});

	it('leaves the children of a folded Scope out, the Scope itself stays', () => {
		expect(scopeRows(scopes, '', new Set(['work'])).map((row) => row.id)).toEqual([
			'people',
			'mom',
			'work',
			'orphan'
		]);
	});

	it('keeps the tree while searching: matches with the way to them, nothing else', () => {
		expect(scopeRows(scopes, 'мам').map((row) => [row.id, row.match])).toEqual([
			['people', false],
			['mom', true]
		]);
		expect(scopeRows(scopes, 'РАБОТ').map((row) => [row.id, row.match])).toEqual([['work', true]]);
		expect(scopeRows(scopes, 'win').map((row) => [row.id, row.depth, row.match])).toEqual([
			['work', 0, false],
			['win', 1, true]
		]);
		expect(scopeRows(scopes, 'нет такого')).toEqual([]);
	});

	it('breaks a cycle by listing its members as roots', () => {
		const cyclic = [
			{ id: 'a', name: 'A', parentId: 'b' },
			{ id: 'b', name: 'B', parentId: 'a' }
		];
		expect(scopeRows(cyclic).map((row) => [row.id, row.depth])).toEqual([
			['a', 0],
			['b', 0]
		]);
		expect(scopePath(cyclic, 'a')).toEqual(['B']);
		expect(scopeAncestors(scopes, 'win')).toEqual([{ id: 'work', name: 'Работа', parentId: null }]);
	});
});

describe('scopeOptionsOf', () => {
	it('reads the first child_of link of every Scope and ignores the rest', () => {
		const options = scopeOptionsOf(
			[
				{ id: 'p', name: 'P' },
				{ id: 'c', name: 'C' }
			],
			[
				{ kind: 'belongs_to', fromId: 'c', toId: 'p' },
				{ kind: 'child_of', fromId: 'c', toId: 'p' },
				{ kind: 'child_of', fromId: 'c', toId: 'missing' }
			]
		);
		expect(options).toEqual([
			{ id: 'p', name: 'P', parentId: null },
			{ id: 'c', name: 'C', parentId: 'p' }
		]);
	});
});

describe('ScopePicker', () => {
	it('renders the chosen path in the control and offers the tree, the taken ones disabled', () => {
		const body = render(ScopePicker, {
			props: { scopes, label: 'Scope', value: 'mom', exclude: ['work'], onpick: () => {} }
		}).body;
		expect(body).toContain('role="combobox"');
		expect(body).toContain('Люди › ');
		expect(body).toContain('aria-disabled="true"');
		expect(body).toContain('>Сирота</span>');
	});

	it('names the no-Scope line first when one is given', () => {
		const body = render(ScopePicker, {
			props: { scopes, label: 'Scope', none: 'Любой', onpick: () => {} }
		}).body;
		expect(body.indexOf('Любой')).toBeLessThan(body.indexOf('Люди'));
	});
});
