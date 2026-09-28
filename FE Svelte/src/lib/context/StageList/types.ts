import type { StageWindow } from '$lib/model/Chapters/types';
import type { ChipScope } from '$lib/ui/ScopeChip/types';

export type StageListProps = Readonly<{
	windows: readonly StageWindow[];
	/** The stage in force: its row is tinted with the chapter's colour. */
	inForceId: string | null;
	/** The stage «сейчас» stands in: its name is bold. */
	nowId: string | null;
	colour: string;
	spanOf: (window: StageWindow) => string;
	scopeOf: (id: string) => ChipScope | undefined;
	onchoose: (stageId: string) => void;
	onedit: (stageId: string) => void;
	onremove: (stageId: string) => Promise<void>;
}>;
