export type ThemeColourFieldProps = Readonly<{
	/** The role's name — «Основной акцент»: the field's visible label and the swatch's name. */
	label: string;
	/** The theme's colour text as stored: a hex, or whatever the user is typing. */
	value: string;
	/** Every pick and every keystroke in the hex field, as the text to store. */
	onchange: (value: string) => void;
	/** `${testId}-swatch`, `${testId}-popover`, `${testId}-blossom` (its petals) and `${testId}-hex`. */
	testId?: string;
}>;
