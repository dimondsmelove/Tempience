import type { DraftPreset } from '$lib/state/TraceDraft/types';

/** The Kind whose history is in the centre, and the version «Записать» fills; the current one when unnamed. */
export type FormTarget = { kindId: string; versionId?: string };
/** What «Записать» starts with: a Kind and Scope of the entry, or a Context action's start. */
export type FormCapturePreset = {
	kindId?: string;
	versionId?: string;
	scopeId?: string;
	start?: DraftPreset;
};
