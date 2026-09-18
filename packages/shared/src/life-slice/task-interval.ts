import type { Task } from '../schemas/task';

type TaskInterval = Pick<Task, 'started_at' | 'ended_at'>;
type SegmentInterval = { start_at: string | null; end_at: string | null };

export const segmentWithinTask = (task: TaskInterval, segment: SegmentInterval): boolean => {
	if (!segment.start_at) return false;
	if (task.started_at && segment.start_at < task.started_at) return false;
	if (segment.end_at && task.ended_at && segment.end_at > task.ended_at) return false;
	if (segment.end_at && segment.start_at > segment.end_at) return false;
	return true;
};
