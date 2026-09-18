import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { saveNestedKind } from '$lib/forms/TraceForms/nested-kind';
import type { KindSaveResult } from '$lib/forms/TraceForms/kind-save';
import type { TraceKindDraft } from '$lib/state/triplit/types';
import { DraftExitGuard } from './guard.svelte';
import { NestedSave } from './nested.svelte';
import { flush, numberKind, openDraftFixture, type DraftFixture } from './TraceDraft.fixture';

let fx: DraftFixture;
beforeEach(() => {
	fx = openDraftFixture();
});
afterEach(async () => {
	await fx.dispose();
});

describe('nested steps and the one exit owner', () => {
	it('an exit waits for a deferred nested Scope write and its return, then proceeds once', async () => {
		const guard = new DraftExitGuard();
		const draft = await fx.open({ mode: 'create' });
		guard.register(draft);
		draft.nested = 'scope';
		let release!: () => void;
		const pending = new Promise<void>((resolve) => (release = resolve));
		const saving = new NestedSave<string>((run) => void draft.hold(run));
		const events: string[] = [];
		const run = saving.run(
			async () => {
				await pending;
				return (await fx.repository.createScope({ name: 'Созданный внутри' })).id;
			},
			(id) => {
				draft.addScope(id);
				draft.nested = null;
				events.push('return');
			}
		);
		expect([guard.busy, guard.dirty]).toEqual([true, false]);
		guard.exit(() => events.push('leave'));
		await flush();
		expect(events).toEqual([]);
		release();
		await run;
		await flush();
		// The write and the return settled first; the Scope they selected made the form dirty,
		// so the exit now asks instead of overtaking anything.
		expect(events).toEqual(['return']);
		expect(draft.selectedScopeIds).toHaveLength(1);
		expect(guard.request).not.toBeNull();
		guard.discard();
		await flush();
		expect(events).toEqual(['return', 'leave']);
		expect((await fx.repository.listScopes()).map((row) => row.name)).toEqual(['Созданный внутри']);
	});

	it('an exit waits for a deferred nested Kind write and its return as the form runs them', async () => {
		const guard = new DraftExitGuard();
		const draft = await fx.open({ mode: 'create' });
		draft.title = 'Родительская запись';
		guard.register(draft);
		draft.nested = 'kind';
		let release!: () => void;
		const pending = new Promise<void>((resolve) => (release = resolve));
		const repository = {
			...fx.repository,
			createTraceKind: async (input: TraceKindDraft) => {
				await pending;
				return fx.repository.createTraceKind(input);
			}
		};
		const saving = new NestedSave<KindSaveResult>((run) => void draft.hold(run));
		const events: string[] = [];
		const run = saveNestedKind(
			saving,
			repository,
			draft,
			{
				name: 'Пульс',
				definition: numberKind('Пульс', 'pulse'),
				memberships: { scopeIds: [], explicit: false }
			},
			() => {
				draft.nested = null;
				events.push('return');
			}
		);
		expect([guard.busy, guard.dirty]).toEqual([true, true]);
		guard.exit(() => events.push('leave'));
		await flush();
		expect(events).toEqual([]);
		release();
		await run;
		await flush();
		// The write and the return settled first; the parent was dirty, so the exit then asks.
		expect(events).toEqual(['return']);
		expect(guard.request).not.toBeNull();
		expect(draft.createdKind?.name).toBe('Пульс');
		guard.discard();
		await flush();
		expect(events).toEqual(['return', 'leave']);
		expect((await fx.repository.listTraceKinds()).map((row) => row.name)).toEqual(['Пульс']);
	});

	it('edited nested input is unsaved input of the form; a pristine parent still asks, and only while edited', async () => {
		const guard = new DraftExitGuard();
		const draft = await fx.open({ mode: 'create' });
		guard.register(draft);
		draft.nested = 'scope';
		expect(guard.dirty).toBe(false);
		draft.nestedInput = () => true;
		let left = 0;
		guard.exit(() => (left += 1));
		await flush();
		expect([left, guard.request === null]).toEqual([0, false]);
		guard.keep();
		await flush();
		expect([left, draft.nested, draft.phase]).toEqual([0, 'scope', 'editing']);
		draft.nestedInput = null;
		draft.nested = null;
		guard.exit(() => (left += 1));
		expect(left).toBe(1);
	});
});
