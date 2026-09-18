/** One Scope as the picker sees it: a name under a parent, or a root. */
export type ScopeOption = Readonly<{ id: string; name: string; parentId: string | null }>;

/** A line of the picker's list: the Scope with its place in the tree and how it got there. */
export type ScopeRow = Readonly<{
	id: string;
	name: string;
	depth: number;
	/** Ancestor names, root first. */
	path: readonly string[];
	hasChildren: boolean;
	/** False for a line shown only because something under it matched the search. */
	match: boolean;
}>;

export type ScopePickerProps = Readonly<{
	scopes: readonly ScopeOption[];
	/** Accessible name of the control; also the name of its list. */
	label: string;
	/** The chosen Scope of a single-choice picker; a multi-choice picker leaves it null. */
	value?: string | null;
	/** Scopes already chosen elsewhere: listed, but not offered again. */
	exclude?: readonly string[];
	/** A first choice that stands for no Scope at all: «Корневой Scope», «Любой Scope». */
	none?: string;
	/** What the closed control says while nothing is chosen. */
	placeholder?: string;
	onpick: (scopeId: string | null) => void;
	/** Offered under the list when given: a Scope by the typed name, made elsewhere. */
	oncreate?: (name: string) => void;
	disabled?: boolean;
	size?: 'sm' | 'md';
	/** A small «+ …» control among chips instead of a field. */
	inline?: boolean;
	testId?: string;
	class?: string;
}>;
