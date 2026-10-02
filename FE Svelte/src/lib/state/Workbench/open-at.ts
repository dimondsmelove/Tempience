import { WORKBENCH_OPEN_AT_KEY } from './constants';
import type { WorkbenchState } from './Workbench.svelte';

export type OpenAtStorage = Pick<Storage, 'getItem' | 'removeItem'>;

/**
 * Consumes the one-shot opening request once the workbench has loaded: the record the key
 * names becomes the Context and the ribbon travels to its time (a choice made off the canvas
 * reveals, DP7); the key is removed whether or not the record is known. Without a key the
 * first known `fallback` opens the same way — a demo's last record, then its start — so a
 * reload never leaves a notebook on an empty «сейчас» (owner 2026-10-02). A missing key, an
 * unknown id and storage that refuses are all ignored silently.
 */
export const consumeOpenAt = (
	workbench: WorkbenchState,
	storage: OpenAtStorage | null,
	fallback: readonly (string | null)[] = []
): void => {
	let id: string | null;
	try {
		id = storage?.getItem(WORKBENCH_OPEN_AT_KEY) ?? null;
		if (id !== null) storage?.removeItem(WORKBENCH_OPEN_AT_KEY);
	} catch {
		return;
	}
	const known = (candidate: string | null): candidate is string =>
		!!candidate && workbench.snapshot.traces.some((trace) => trace.id === candidate);
	const target = id ?? fallback.find(known) ?? null;
	if (known(target)) workbench.selectTrace(target, 'context');
};
