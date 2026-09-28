import type { Lineup } from '$lib/model/Chapters/types';
import type { ExplorerSnapshot } from '$lib/model/Snapshot/types';

export type LineupFieldsProps = Readonly<{
	lineup: Lineup;
	view: Pick<ExplorerSnapshot, 'scopes' | 'intersections'>;
	onchange: (next: Lineup) => void;
	/** The lineup of the chapter before: its Scopes lead both pickers, offered, not inherited. */
	offered?: Readonly<{ label: string; ids: readonly string[] }> | null;
	testId: string;
}>;
