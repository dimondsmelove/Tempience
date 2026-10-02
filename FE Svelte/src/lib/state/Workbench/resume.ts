import { WORKBENCH_RESUME_KEY } from './constants';

export type ResumeStorage = Pick<Storage, 'getItem' | 'setItem'>;

const keyOf = (dataSpaceId: string): string => `${WORKBENCH_RESUME_KEY}:${dataSpaceId}`;

/** The record this DataSpace was last on, or null; storage that refuses reads as nothing. */
export const readResume = (storage: ResumeStorage | null, dataSpaceId: string): string | null => {
	try {
		return storage?.getItem(keyOf(dataSpaceId)) || null;
	} catch {
		return null;
	}
};

/** Keeps the record this DataSpace is on; storage that refuses keeps it for this page only. */
export const writeResume = (
	storage: ResumeStorage | null,
	dataSpaceId: string,
	traceId: string
): void => {
	try {
		storage?.setItem(keyOf(dataSpaceId), traceId);
	} catch {
		// Nothing to keep: the next load opens the notebook at its start.
	}
};
