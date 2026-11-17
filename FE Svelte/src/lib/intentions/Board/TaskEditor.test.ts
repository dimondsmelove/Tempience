import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';
import TraceEditor from '$lib/context/TraceEditor/TraceEditor.svelte';
import { openDraftFixture } from '$lib/state/TraceDraft/TraceDraft.fixture';
import { plainFields } from '$lib/state/triplit/Traces/record.fixture';

vi.mock('$lib/state/triplit/client', () => ({ activeDataSpace: { id: 'canonical' }, triplit: {} }));

describe('task editor', () => {
	it('hides mode selection and preserves relation when saving a changed field', async () => {
		const fx = openDraftFixture();
		try {
			const { trace } = await fx.repository.saveTraceRecord({
				fields: plainFields('Task', { relation: 'intend' })
			});
			const draft = await fx.open({ mode: 'edit', traceId: trace.id });
			const body = render(TraceEditor, {
				props: { draft, taskMode: true, onopen: async () => {}, oncancel: () => {} }
			}).body;
			expect(body).not.toContain('data-testid="draft-mode"');
			expect(body).toContain('data-testid="draft-description"');
			draft.description = 'Changed';
			await draft.save(async () => {});
			expect((await fx.repository.getTrace(trace.id))?.relation).toBe('intend');
		} finally {
			await fx.dispose();
		}
	});
});
