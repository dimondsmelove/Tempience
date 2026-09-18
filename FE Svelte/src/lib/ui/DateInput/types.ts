import type { HTMLInputAttributes } from 'svelte/elements';

export type DateInputProps = Omit<HTMLInputAttributes, 'value' | 'type'> & {
	value?: string;
	type?: 'date' | 'datetime-local';
	inline?: boolean;
	calendarLabel?: string;
};
