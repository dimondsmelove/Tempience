import type { JsonObject, Scope, TraceKindVDraft } from '$lib/state/triplit/types';
import type { TraceFormDraft } from '$lib/model/TraceForm/types';

export type DataFormProps = {
	definition: TraceKindVDraft;
	initialValue?: JsonObject;
	submitLabel?: string;
	submitDisabled?: boolean;
	label?: string;
	onsubmit: (value: JsonObject) => Promise<void> | void;
};

/**
 * The Kind's direct Scope memberships as the user left them: `explicit` once the user
 * touched the choice, including the deliberate «Без Scope»; untouched means «not sent».
 */
export type MembershipIntent = { scopeIds: string[]; explicit: boolean };

export type BuilderProps = {
	initial: TraceFormDraft;
	published?: TraceKindVDraft;
	compact?: boolean;
	/** The Scopes offered for direct membership; the picker is shown when given. */
	scopes?: readonly Scope[];
	/** The memberships shown at first: the Kind's current ones, or a new Kind's context. */
	memberships?: readonly string[];
	onsave: (
		name: string,
		definition: TraceKindVDraft,
		memberships: MembershipIntent
	) => Promise<void>;
	/** «Отмена» beside the save, when the owner has somewhere to return to. */
	oncancel?: () => void | Promise<void>;
	cancelTestId?: string;
	/** Hands the owner of a nested step a reader of whether the Builder holds unsaved input. */
	watch?: (dirty: () => boolean) => void;
	/** The owner holds a nested Scope save (write and return) as its own pending work. */
	hold?: (run: Promise<void>) => void;
};
