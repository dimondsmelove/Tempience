import { describe, expect, it } from 'vitest';
import type { ExplorerIntersection, ExplorerScope } from '$lib/model/Snapshot/types';
import {
	dateLabel,
	formParentId,
	inheritedScopes,
	initialFormTarget,
	effectiveScopes,
	scopeIdsForCreate,
	whenTarget,
	submitCreateForm
} from './createForm';
const scope = (id: string, name: string) => ({ id, name }) as ExplorerScope;
describe('creation form projections', () => {
	it('keeps errors visible and closes on success', async () => {
		expect(await submitCreateForm(async () => 'Parent missing')).toEqual({
			error: 'Parent missing',
			close: false
		});
		expect(await submitCreateForm(async () => null)).toEqual({ error: '', close: true });
	});
	it('locks the parent, starts undated, and inherits the parent scope by default', () => {
		const scopes = [scope('s', 'Scope')];
		const links = [{ kind: 'belongs_to', fromId: 'parent', toId: 's' } as ExplorerIntersection];
		const parent = formParentId('parent', 'other');
		expect(parent).toBe('parent');
		expect(inheritedScopes(parent, scopes, links)).toEqual(scopes);
		expect(initialFormTarget({ kind: 'day', dayKey: '2026-11-18' }, parent)).toEqual({
			kind: 'undated'
		});
		expect(formParentId(undefined, 'other')).toBe('other');
	});
	it('inherits until edited and sends explicit choices including an empty array', () => {
		expect(effectiveScopes(null, ['a', 'b'])).toEqual(['a', 'b']);
		expect(scopeIdsForCreate(null)).toBeUndefined();
		expect(effectiveScopes(['b'], ['a', 'b'])).toEqual(['b']);
		expect(scopeIdsForCreate(['a', 'b'])).toEqual(['a', 'b']);
		expect(effectiveScopes([], ['a'])).toEqual([]);
		expect(scopeIdsForCreate([])).toEqual([]);
	});
	it('labels all targets and maps relative choices to targets', () => {
		const today = '2026-11-18',
			weekStart = 123;
		expect(dateLabel({ kind: 'day', dayKey: today }, 'ru', 'Week', 'None')).toContain('18');
		expect(dateLabel({ kind: 'week', weekStart }, 'ru', 'Week', 'None')).toBe('Week');
		expect(dateLabel({ kind: 'undated' }, 'ru', 'Week', 'None')).toBe('None');
		expect(whenTarget('today', today, weekStart)).toEqual({ kind: 'day', dayKey: today });
		expect(whenTarget('tomorrow', today, weekStart)).toEqual({ kind: 'day', dayKey: '2026-11-19' });
		expect(whenTarget('week', today, weekStart)).toEqual({ kind: 'week', weekStart });
		expect(whenTarget('undated', today, weekStart)).toEqual({ kind: 'undated' });
	});
});
