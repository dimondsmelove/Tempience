import type { GroupUnit, RecordShape } from '$lib/model/RecordGroups/types';

/** The ribbon's mark before a record's title, in the colours of all its Scopes; none is ink. */
export type RecordMarkProps = Readonly<{ shape: RecordShape; colours: readonly string[] }>;

export type RecordItem = Readonly<{
	traceId: string;
	/** The record's day as the Context shows it. */
	date: string;
	title: string;
	/** The mark the ribbon draws it with; none — the row has no mark. */
	mark?: RecordMarkProps;
	/** When the record is about: a grouped list is cut by it. */
	at?: number;
}>;

export type RecordRowProps = Readonly<{
	item: RecordItem;
	/** `data-testid` of the row's button. */
	testId: string;
	/** Linked with what the pointer rests on elsewhere in the Context. */
	lit?: boolean;
	/** The title's own text size; a period's list leaves it to the row, a Scope's and a chapter's set it. */
	titleClass?: string;
	onselect: (traceId: string) => void;
}>;

export type RecordListProps = Readonly<{
	items: readonly RecordItem[];
	testId: string;
	/** What the list says when it has no records. */
	empty: string;
	/** The calendar unit the list is cut by, under a header each; none — one plain list. */
	group?: GroupUnit | null;
	onselect: (traceId: string) => void;
}>;
