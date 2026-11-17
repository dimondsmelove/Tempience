import type { ExplorerTrace, ExplorerIntersection } from '$lib/model/Snapshot/types';
import type { IntentionAssessment } from '$lib/state/triplit/IntentionAssessments/types';
import type { UndoState } from '$lib/state/Undo/Undo.svelte';

export type TaskRecordsProps = {
	taskId: string;
	traces: readonly ExplorerTrace[];
	links: readonly ExplorerIntersection[];
	assessments: readonly IntentionAssessment[];
	zone: string;
	undo: UndoState;
	reload: () => Promise<void>;
	collapsed: boolean;
	ontoggle: () => void;
};
