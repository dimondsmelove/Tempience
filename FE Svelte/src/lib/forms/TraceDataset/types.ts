import type { TraceDatasetScalarType } from '$lib/state/triplit/trace-dataset';

/** One field a value filter may name, by its stable key across the Kind's versions. */
export type FilterField = Readonly<{
	key: string;
	path: readonly string[];
	label: string;
	type: TraceDatasetScalarType;
	/** The titles of a choice field's values, by value. */
	choices?: Readonly<Record<string, string>>;
}>;
