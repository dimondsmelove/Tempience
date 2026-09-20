export type ScopeDotProps = Readonly<{
	/** The Scope's hue; `null` draws nothing — a Scope without a colour has no dot. */
	colorHue: number | null | undefined;
	/** The Scope's saturation 0–100; `null` is the default. */
	colorChroma?: number | null;
	/** The Scope's depth 0–2; `null` is 0. */
	colorDepth?: number | null;
	/** The dot's diameter in px: 12 beside a heading, 10 in a list row. */
	size?: number;
	testId?: string;
}>;
