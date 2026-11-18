import type { ExplorerTrace } from '$lib/model/Snapshot/types';
import type { panelRelations } from '../Board/panel';
import type { TaskOutcomeChoice } from '../TaskStatus/types';

export type TaskOverviewProps = {
	trace: ExplorerTrace;
	relations: ReturnType<typeof panelRelations>;
	zone: string;
	complete: (id: string) => void;
	preset: (id: string, value: TaskOutcomeChoice) => void;
	repeat?: (id: string, day: string, now: number) => void;
	setStatus: (id: string, open: boolean) => void;
	setPanelOutcome: (id: string, value: TaskOutcomeChoice) => void;
	ondelete: (id: string) => void;
	move: (id: string, day: string | null) => void;
	onnavigate: (id: string) => void;
	onedit: () => void;
	onrefresh: () => void;
	collapsed: boolean;
	ontoggle: () => void;
};
