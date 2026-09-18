import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NestedSave } from '$lib/state/TraceDraft/nested.svelte';
import {
	numberKind,
	openDraftFixture,
	type DraftFixture
} from '$lib/state/TraceDraft/TraceDraft.fixture';
import type { KindSaveResult } from './kind-save';
import { runKindSave, saveNestedKind } from './nested-kind';

let fx: DraftFixture;
beforeEach(() => {
	fx = openDraftFixture();
});
afterEach(async () => {
	await fx.dispose();
});

const kindNames = async () => (await fx.repository.listTraceKinds()).map((row) => row.name);

describe('the nested Kind step as the form runs it', () => {
	it('latches the committed Kind as the repository returns it; a failed return is repeated, never rewritten', async () => {
		const scope = await fx.scope('Работа');
		const draft = await fx.open({ mode: 'create', scopeIds: [scope.id] });
		draft.title = 'Пока обычная';
		draft.nested = 'kind';
		const held: Promise<void>[] = [];
		const saving = new NestedSave<KindSaveResult>((run) => {
			held.push(run);
			void draft.hold(run);
		});
		let returns = 0;
		const onreturn = async () => {
			returns += 1;
			if (returns === 1) throw new Error('Не удалось вернуться к форме.');
			draft.nested = null;
		};
		const input = {
			name: 'Пульс',
			definition: numberKind('Пульс', 'pulse'),
			memberships: { scopeIds: [scope.id], explicit: false }
		};
		await saveNestedKind(saving, fx.repository, draft, input, onreturn);
		// The write is done and latched with the rows the repository returned; the form was told.
		expect(saving.failure?.stage).toBe('return');
		expect(saving.committed?.kind.name).toBe('Пульс');
		expect(saving.committed?.version.kindId).toBe(saving.committed?.kind.id);
		expect(await kindNames()).toEqual(['Пульс']);
		expect(draft.createdKind?.id).toBe(saving.committed?.kind.id);
		expect(draft.kindScopes.get(saving.committed!.kind.id)).toEqual([scope.id]);
		expect([draft.nested, draft.kindId, draft.title]).toEqual(['kind', '', 'Пока обычная']);
		// The pending step is the form's own pending work.
		expect(draft.pending).toBeNull();
		expect(held).toHaveLength(1);
		// A second Save click on the same step repeats only the return.
		await saveNestedKind(saving, fx.repository, draft, input, onreturn);
		expect([saving.failure, draft.nested, returns]).toEqual([null, null, 2]);
		expect(await kindNames()).toEqual(['Пульс']);
		expect(held).toHaveLength(2);
	});

	it('a refused write is reported, nothing is latched, and the form keeps its input', async () => {
		const scope = await fx.scope('Работа');
		await fx.repository.setScopeDeleted(scope.id, true);
		const draft = await fx.open({ mode: 'create' });
		draft.title = 'Черновик';
		draft.nested = 'kind';
		const saving = new NestedSave<KindSaveResult>();
		await saveNestedKind(
			saving,
			fx.repository,
			draft,
			{
				name: 'Пульс',
				definition: numberKind('Пульс', 'pulse'),
				memberships: { scopeIds: [scope.id], explicit: true }
			},
			() => {}
		);
		expect(saving.failure?.stage).toBe('write');
		expect(saving.failure?.message).toContain('Scope');
		expect(saving.committed).toBeNull();
		expect(await kindNames()).toEqual([]);
		expect([draft.nested, draft.title, draft.createdKind]).toEqual(['kind', 'Черновик', null]);
	});
});

describe('the catalog save as the catalog runs it', () => {
	it('a failed navigation or reload after the commit is repeated without a second Kind or version', async () => {
		const saving = new NestedSave<KindSaveResult>();
		let shown = 0;
		const back = async (result: KindSaveResult) => {
			shown += 1;
			if (shown === 1) throw new Error('Не удалось открыть вид записи.');
			expect(result.outcome).toBe('created');
		};
		const input = {
			name: 'Замер',
			definition: numberKind('Замер', 'value'),
			memberships: { scopeIds: [], explicit: false }
		};
		await runKindSave(saving, fx.repository, input, back);
		expect(saving.failure?.stage).toBe('return');
		expect(await kindNames()).toEqual(['Замер']);
		await saving.retry();
		expect([saving.failure, shown]).toEqual([null, 2]);
		expect(await kindNames()).toEqual(['Замер']);
		// A new version of that Kind: the same boundary.
		const [kind] = await fx.repository.listTraceKinds();
		const [published] = await fx.repository.listTraceKindVersions(kind.id);
		const versioning = new NestedSave<KindSaveResult>();
		let reloaded = 0;
		await runKindSave(
			versioning,
			fx.repository,
			{
				kind,
				published,
				name: kind.name,
				definition: numberKind('Замер', 'other'),
				memberships: { scopeIds: [], explicit: false }
			},
			async () => {
				reloaded += 1;
				if (reloaded === 1) throw new Error('Не удалось прочитать Scope вида записи.');
			}
		);
		expect(versioning.failure?.stage).toBe('return');
		expect(await fx.repository.listTraceKindVersions(kind.id)).toHaveLength(2);
		await versioning.retry();
		expect(versioning.failure).toBeNull();
		expect(await fx.repository.listTraceKindVersions(kind.id)).toHaveLength(2);
	});
});
