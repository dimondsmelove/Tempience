export const normalizeLexeme = (raw: string): string =>
	raw.trim().toLowerCase().replace(/\s+/g, ' ');

export const tokenizeQuery = (raw: string): string[] =>
	normalizeLexeme(raw)
		.split(/[\s,;]+/)
		.map((part) => part.trim())
		.filter((part) => part.length > 1);
