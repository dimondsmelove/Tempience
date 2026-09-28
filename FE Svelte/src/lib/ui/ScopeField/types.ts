import type { Snippet } from 'svelte';
import type { ChipScope } from '$lib/ui/ScopeChip/types';
import type { ScopeOption, ScopePickerGroups } from '$lib/ui/ScopePicker';

export type ScopeFieldProps = Readonly<{
	/** The field's name, above the picker. */
	label: string;
	/** Every Scope that may be chosen, in its tree. */
	options: readonly ScopeOption[];
	/** The Scopes chosen, in their order. */
	ids: readonly string[];
	/** Scopes the picker does not offer again; the chosen ones by default. */
	exclude?: readonly string[];
	/** A chosen Scope's name and colour; absent — the field names it unavailable. */
	scopeOf: (id: string) => ChipScope | undefined;
	/** The picker's own name and its placeholder. */
	pickerLabel: string;
	placeholder: string;
	/** What the × of a chip says. */
	removeLabel: (name: string) => string;
	/** The chips' list, for a reader. */
	listLabel: string;
	/** Lead the picker's list with these groups. */
	groups?: ScopePickerGroups | null;
	onadd: (id: string) => void;
	onremove: (id: string) => void;
	/** The order means something: a chip is dragged to its place inside the field. */
	onreorder?: (ids: string[]) => void;
	/** After the picker, on its row (a «new Scope» button). */
	after?: Snippet;
	testId?: string;
}>;
