/** An id dropped before another, or at the end: the field's new order. */
export const moveBefore = (
	ids: readonly string[],
	moved: string,
	before: string | null
): string[] => {
	if (moved === before || !ids.includes(moved)) return [...ids];
	const rest = ids.filter((id) => id !== moved);
	const at = before === null ? -1 : rest.indexOf(before);
	return at < 0 ? [...rest, moved] : [...rest.slice(0, at), moved, ...rest.slice(at)];
};
