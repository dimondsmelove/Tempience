import { PARKED_STORAGE_KEY } from './constants';

/** Whether «Без даты» shows its chips: open unless the user folded it; unreachable storage reads as open. */
export const readParkedOpen = (storage: Storage | undefined = globalThis.localStorage): boolean => {
	try {
		return storage?.getItem(PARKED_STORAGE_KEY) !== 'false';
	} catch {
		return true;
	}
};

export const writeParkedOpen = (
	open: boolean,
	storage: Storage | undefined = globalThis.localStorage
): void => {
	try {
		storage?.setItem(PARKED_STORAGE_KEY, String(open));
	} catch {
		// Storage can be absent or blocked; the state still lives in the component.
	}
};
