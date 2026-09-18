export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const resolveTheme = (
	preference: ThemePreference,
	systemPrefersDark: boolean
): ResolvedTheme => {
	if (preference === 'system') return systemPrefersDark ? 'dark' : 'light';
	return preference;
};

export const themeAttributeValue = (preference: ThemePreference): ResolvedTheme | null => {
	if (preference === 'system') return null;
	return preference;
};
