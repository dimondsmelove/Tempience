import type { Scope } from '$lib/state/triplit/types';
export type ScopeEditorProps = {
	scope?: Pick<Scope, 'id' | 'name' | 'note'>;
	parentId?: string | null;
	onsaved: (id: string) => void | Promise<void>;
	oncancel: () => void;
	/** The owner of a nested step holds the save (write and return) as its pending work. */
	hold?: (run: Promise<void>) => void;
	/** Hands the owner of a nested step a reader of whether the editor holds unsaved input. */
	watch?: (dirty: () => boolean) => void;
};
