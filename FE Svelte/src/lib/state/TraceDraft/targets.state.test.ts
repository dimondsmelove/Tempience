import { describe, expect, it } from 'vitest';
import { dayTime } from '$lib/state/triplit/Traces/record.fixture';
import { nowPlacement } from './placement';
import { resultRows } from './results';
import { plainTrace } from './results.fixture';
import type { ResultRole } from './results';
import {
	blocksStatement,
	targetIssues,
	targetRefusal,
	targetState,
	type TargetState
} from './targets';
import type { DraftValues, EvidenceRole, ResultTarget } from './types';

const traces = [
	plainTrace('plan', 'План', 'intend'),
	plainTrace('gone', 'Удалённый план', 'intend', undefined, { isDeleted: true }),
	plainTrace('fact', 'Факт', 'actual', dayTime('2026-09-11'))
];
const rows = resultRows(traces, [], []);

const role = (linkId: string, source: EvidenceRole['source'], otherId = 'plan'): EvidenceRole => ({
	linkId,
	direction: 'outgoing',
	otherId,
	otherTitle: otherId,
	source,
	own: source === 'current' ? { outcome: 'completed', open: null } : null
});

const context = (
	patch: Partial<{ roles: EvidenceRole[]; dated: boolean; role: ResultRole }> = {}
) => ({
	rows,
	role: patch.role ?? ('intention' as ResultRole),
	dated: patch.dated ?? true,
	roles: patch.roles ?? []
});

const target = (
	otherId: string,
	linkId: string | null = null,
	input: ResultTarget['input'] = {}
): ResultTarget => ({ otherId, linkId, input });

const values = (targets: readonly ResultTarget[]): DraftValues => ({
	title: 'F',
	description: null,
	relation: 'actual',
	placement: nowPlacement(new Date('2026-09-13T10:00:00Z')),
	kindId: null,
	versionId: null,
	data: null,
	scopeIds: [],
	targets
});

const issues = (targets: readonly ResultTarget[], patch = {}) =>
	targetIssues(values(targets), context(patch)).map((issue) => issue.key);

describe('target state and what a save refuses', () => {
	it('keeps an existing reference whose record went away: it is shown, never written', () => {
		const saved = target('gone', 'link-gone');
		expect(targetState(saved, context())).toBe('deleted');
		// The save touches nothing of it, so it cannot hold an unrelated field edit hostage.
		expect(targetRefusal(saved, context())).toBeNull();
		expect(issues([saved])).toEqual([]);
	});

	it('refuses a reference this input adds to a record that cannot hold it', () => {
		expect(targetRefusal(target('gone'), context())).toBe('deleted');
		expect(targetRefusal(target('missing'), context())).toBe('missing');
		// A fact offered where an intention belongs, and the reverse.
		expect(targetRefusal(target('fact'), context())).toBe('role');
		expect(targetRefusal(target('plan'), context({ role: 'fact' }))).toBe('role');
		expect(issues([target('gone')])).toEqual(['draft.targetDeleted']);
	});

	it('refuses a statement this input makes through a reference that cannot carry it', () => {
		const stated = target('gone', 'link-gone', { outcome: 'completed' });
		expect(targetRefusal(stated, context())).toBe('deleted');
		expect(issues([stated])).toEqual(['draft.targetDeleted']);
		// Taking the statement back leaves the reference and nothing else refuses.
		expect(issues([target('gone', 'link-gone')])).toEqual([]);
	});

	it('says a moved or unreadable source from the start and refuses only a statement through it', () => {
		for (const [source, key] of [
			['detached', 'draft.targetDetached'],
			['unavailable', 'draft.targetUnavailable']
		] as const) {
			const roles = [role('link-a', source)];
			const untouched = target('plan', 'link-a');
			expect(targetState(untouched, context({ roles }))).toBe(source);
			expect(targetRefusal(untouched, context({ roles }))).toBeNull();
			expect(issues([untouched], { roles })).toEqual([]);
			const stated = target('plan', 'link-a', { open: false });
			expect(targetRefusal(stated, context({ roles }))).toBe(source);
			expect(issues([stated], { roles })).toEqual([key]);
		}
	});

	it('locks the controls of states no statement can ever pass, but not of a missing date', () => {
		const blocked: TargetState[] = ['missing', 'deleted', 'role', 'detached', 'unavailable'];
		expect(blocked.map(blocksStatement)).toEqual([true, true, true, true, true]);
		expect(blocksStatement('undated')).toBe(false);
		expect(blocksStatement(null)).toBe(false);
	});

	it('needs the fact date only for a statement that would create a source', () => {
		const undated = context({ dated: false });
		// The link itself never needs a date, whether it is new or already saved.
		expect(targetRefusal(target('plan'), undated)).toBeNull();
		expect(targetRefusal(target('plan', 'link-a'), undated)).toBeNull();
		expect(targetState(target('plan'), undated)).toBe('undated');
		expect(targetRefusal(target('plan', null, { outcome: 'partial' }), undated)).toBe('undated');
		// A current source is corrected in place, where the fact's date no longer decides.
		const roles = [role('link-a', 'current')];
		const stated = target('plan', 'link-a', { outcome: 'partial' });
		expect(targetState(stated, { ...undated, roles })).toBeNull();
		expect(targetRefusal(stated, { ...undated, roles })).toBeNull();
	});
});
