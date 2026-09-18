import type { TimeInputState } from './TimeInputState.svelte';
export type RailMode = 'day' | 'minute';
export type DurationUnit = 'minute' | 'hour' | 'day';
export type DurationAmount = { amount: number; unit: DurationUnit };
export type TimeDetail = 'clock' | 'duration';
export type TimeSelection = {
	start: number;
	end: number | null;
	timed: boolean;
	duration?: DurationAmount;
	date?: 'unknown' | 'preserved' | 'month' | 'year' | 'season';
	approximate?: boolean;
	/** End bounds the possible start, rather than the end of the event. */
	window?: boolean;
};
export type RailTick = { value: number; label: string; detail: string; major?: boolean };
export type DragKind = 'pan' | 'start' | 'end' | 'move' | 'extend';
export type RailProps = { picker: TimeInputState; overlay?: boolean };
export type WheelOption = { value: number | null; label: string; disabled?: boolean };
export type WheelProps = {
	label: string;
	options: WheelOption[];
	value: number | null;
	onchange: (value: number | null) => void;
	numeric?: boolean;
	numericDigits?: number;
	onnumber?: (value: number) => void;
	compact?: boolean;
	list?: boolean;
};
