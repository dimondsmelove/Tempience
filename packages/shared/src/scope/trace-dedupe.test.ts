import { describe, expect, it } from 'vitest';
import { dedupeTraceCandidates } from './trace-dedupe';

describe('dedupeTraceCandidates', () => {
	it('keeps membership over task_ref for same trace', () => {
		const result = dedupeTraceCandidates([
			{ trace_uid: 't1', attachment: 'task_ref', via_task_uid: 'task-a' },
			{ trace_uid: 't1', attachment: 'membership' }
		]);
		expect(result).toHaveLength(1);
		expect(result[0]?.attachment).toBe('membership');
	});
});
