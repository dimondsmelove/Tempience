import type { NestedSave } from '$lib/state/TraceDraft/nested.svelte';
import type { TraceDraftState } from '$lib/state/TraceDraft/TraceDraft.svelte';
import {
	saveKind,
	type KindSaveInput,
	type KindSaveRepository,
	type KindSaveResult
} from './kind-save';

/**
 * The wiring every Kind authoring caller runs: the write is `saveKind` alone, its result is
 * latched the moment the repository returns it, and everything after — telling the form,
 * reading, navigating — is the return, repeatable without a second write.
 */
export const runKindSave = (
	saving: NestedSave<KindSaveResult>,
	repository: KindSaveRepository,
	input: KindSaveInput,
	back: (result: KindSaveResult) => void | Promise<void>
): Promise<void> => saving.run(() => saveKind(repository, input), back);

/**
 * The nested Kind step of an open form: the committed Kind becomes selectable in the same
 * form (its memberships included), then the form is shown again. Nothing is chosen by itself.
 */
export const saveNestedKind = (
	saving: NestedSave<KindSaveResult>,
	repository: KindSaveRepository,
	draft: Pick<TraceDraftState, 'noteKind'>,
	input: KindSaveInput,
	onreturn: () => void | Promise<void>
): Promise<void> =>
	runKindSave(saving, repository, input, async (result) => {
		draft.noteKind(result.kind, result.version, result.scopeIds ?? []);
		await onreturn();
	});
