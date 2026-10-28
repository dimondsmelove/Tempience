/**
 * One weekly budget statement of a practice activity (append-only). The budget of week W is the
 * latest row with `effectiveFromWeek <= W`; a null budget clears it from that week on.
 */
export type PracticeTarget = Readonly<{
	id: string;
	sourceId: 'source';
	scopeId: string;
	minutesPerWeek: number | null;
	/** Local Monday, YYYY-MM-DD, of the first week the budget applies to. */
	effectiveFromWeek: string;
	createdAt: string;
	isDeleted: boolean;
}>;

export type PracticeTargetInput = Readonly<{ scopeId: string; minutesPerWeek: number | null }>;
