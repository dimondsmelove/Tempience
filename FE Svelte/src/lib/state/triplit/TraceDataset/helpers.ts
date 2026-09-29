export const noop = (): void => {};

export const sortedUnique = (values: Iterable<string>): string[] => [...new Set(values)].toSorted();

export const idsKey = (ids: readonly string[]): string => ids.join('\u0000');

export const errorMessage = (cause: unknown): string =>
	cause instanceof Error ? cause.message : String(cause);

export const pathKey = (path: readonly string[]): string => path.join('.');

/**
 * The path of a nested repeat's enclosing item, ending in its `[]`: `uprazhneniya/[]` for the
 * sets of an exercise. A parent column's path continues from it.
 */
export const parentItemPath = (repeatPath: readonly string[]): string[] =>
	repeatPath.slice(0, repeatPath.lastIndexOf('[]') + 1);
