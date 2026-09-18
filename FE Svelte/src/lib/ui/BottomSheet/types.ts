import type { Snippet } from 'svelte';

export type SheetPosition = 'peek' | 'half' | 'full';
export type BottomSheetProps = Readonly<{
	label: string;
	position?: SheetPosition;
	modal?: boolean;
	heading?: boolean;
	measuredHeight?: number;
	onposition?: (position: SheetPosition) => void;
	onclose: () => void;
	children: Snippet;
}>;

export type SheetDragOptions = Readonly<{
	getLimit: () => number;
	ondrag: (height: number | null) => void;
	onrelease: (height: number, velocity: number) => void;
}>;
