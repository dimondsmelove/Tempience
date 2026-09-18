import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { numberKind, openDraftFixture, type DraftFixture } from './TraceDraft.fixture';

let fx: DraftFixture;
beforeEach(() => {
	fx = openDraftFixture();
});
afterEach(async () => {
	await fx.dispose();
});

describe('TraceDraftState — a nested Scope or Kind inside the open form', () => {
	it('keeps the form’s input while a nested step is open and blocks its save until the return', async () => {
		const draft = await fx.open({ mode: 'create' });
		draft.title = 'Незавершённая запись';
		expect(draft.canSave).toBe(true);
		draft.nested = 'scope';
		expect(draft.canSave).toBe(false);
		expect([draft.title, draft.dirty]).toEqual(['Незавершённая запись', true]);
		// The Scope saved in the nested step is selected in this same form on return.
		const created = await fx.scope('Созданный внутри');
		draft.addScope(created.id);
		draft.nested = null;
		expect(draft.selectedScopeIds).toEqual([created.id]);
		expect(draft.canSave).toBe(true);
	});

	it('a Kind saved inside the form becomes selectable with its memberships, and is not chosen by itself', async () => {
		const work = await fx.scope('Работа');
		const home = await fx.scope('Дом');
		const draft = await fx.open({ mode: 'create', scopeIds: [work.id] });
		draft.title = 'Пока обычная';
		draft.nested = 'kind';
		const { kind, version } = await fx.kind('Пульс', numberKind('Пульс', 'pulse'), [home.id]);
		draft.noteKind(kind, version, [home.id]);
		draft.nested = null;
		expect(draft.createdKind?.id).toBe(kind.id);
		expect([draft.kindId, draft.title, draft.typed]).toEqual(['', 'Пока обычная', false]);
		expect(draft.kinds.map((entry) => entry.id)).toContain(kind.id);
		expect(draft.versions.map((entry) => entry.id)).toContain(version.id);
		expect(draft.scopedKinds).toEqual([]);
		// An explicit choice applies the ordinary Kind rules: content reset, its Scopes added.
		draft.chooseKind(kind.id);
		expect([draft.typed, draft.versionId, draft.title]).toEqual([true, version.id, '']);
		expect(draft.selectedScopeIds).toEqual([work.id, home.id]);
		expect(draft.scopedKinds.map((entry) => entry.id)).toEqual([kind.id]);
		expect(draft.createdKind).toBe(kind);
	});

	it('lists the Kinds directly bound to the selected Scopes without their subtrees', async () => {
		const health = await fx.scope('Здоровье');
		const sport = await fx.scope('Спорт');
		const weight = await fx.kind('Вес', numberKind('Вес', 'weight'), [health.id]);
		const pulse = await fx.kind('Пульс', numberKind('Пульс', 'pulse'), [sport.id]);
		await fx.kind('Сон', numberKind('Сон', 'hours'));
		const draft = await fx.open({ mode: 'create' });
		expect(draft.scopedKinds).toEqual([]);
		draft.addScope(health.id);
		expect(draft.scopedKinds.map((entry) => entry.id)).toEqual([weight.kind.id]);
		draft.addScope(sport.id);
		expect(draft.scopedKinds.map((entry) => entry.id).toSorted()).toEqual(
			[weight.kind.id, pulse.kind.id].toSorted()
		);
		expect(draft.kinds).toHaveLength(3);
	});
});
