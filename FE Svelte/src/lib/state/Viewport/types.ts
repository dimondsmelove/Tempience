/** Visible time window in epoch milliseconds, UTC; `end` is exclusive. */
export type TimeWindow = Readonly<{ start: number; end: number }>;

/** Hard bounds the window is kept inside. */
export type ViewportLimits = Readonly<{
	minSpanMs: number;
	maxSpanMs: number;
	minStart: number;
	maxEnd: number;
}>;

export type ViewportOptions = Readonly<{
	limits?: Partial<ViewportLimits>;
	/** Clock for «сейчас»; injectable for tests. */
	now?: () => number;
}>;
