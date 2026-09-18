export const noop = (): void => {};

export const sortedUnique = (values: Iterable<string>): string[] => [...new Set(values)].toSorted();

export const idsKey = (ids: readonly string[]): string => ids.join('\u0000');

export const errorMessage = (cause: unknown): string =>
	cause instanceof Error ? cause.message : String(cause);

export const pathKey = (path: readonly string[]): string => path.join('.');
