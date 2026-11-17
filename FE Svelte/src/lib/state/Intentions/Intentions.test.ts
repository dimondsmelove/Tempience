import { afterEach, expect, it, vi } from 'vitest';
import { openRecordFixture, type RecordFixture } from '$lib/state/triplit/Traces/record.fixture';
import { createIntention } from '$lib/intentions/CreateIntention/CreateIntention';
import {
	completeIntention,
	revertCompletion
} from '$lib/intentions/CompleteIntention/CompleteIntention';
import { createIntentionOrdersRepository } from '$lib/state/triplit/IntentionOrders/IntentionOrders';
import { IntentionsState } from './Intentions.svelte';
let fixture: RecordFixture;
afterEach(async () => {
	await fixture?.dispose();
});
it('projects the repository and reflects completion and its reversal', async () => {
	fixture = openRecordFixture();
	const now = Date.parse('2026-09-16T12:00:00Z');
	const created = await createIntention(fixture.repository, {
		title: 'Task',
		target: { kind: 'day', dayKey: '2026-09-16' },
		zone: 'UTC',
		now
	});
	if (!created.ok) throw new Error('creation failed');
	await createIntention(fixture.repository, {
		title: 'Undated',
		target: { kind: 'undated' },
		zone: 'UTC',
		now
	});
	const state = new IntentionsState(fixture.repository, { now, zone: 'UTC' });
	const stop = state.start();
	await state.refresh();
	expect(state.buckets.days[2].items.map((item) => item.content)).toEqual(['Task']);
	expect(state.buckets.undated.map((item) => item.content)).toEqual(['Undated']);
	const completed = await completeIntention(fixture.repository, created.trace.id, {
		now,
		zone: 'UTC'
	});
	if (!completed.ok) throw new Error(completed.reason);
	await state.refresh();
	expect(state.buckets.days[2].items[0].intentOpen).toBe(false);
	expect(await revertCompletion(fixture.repository, completed.factId)).toEqual({ ok: true });
	await state.refresh();
	expect(state.buckets.days[2].items[0].intentOpen).toBe(true);
	stop();
});

it('refreshes its snapshot when the repository changes', async () => {
	fixture = openRecordFixture();
	const now = Date.parse('2026-09-16T12:00:00Z');
	const state = new IntentionsState(fixture.repository, { now, zone: 'UTC' });
	const stop = state.start();
	await vi.waitFor(() => expect(state.loading).toBe(false));
	await createIntention(fixture.repository, {
		title: 'Subscribed',
		target: { kind: 'day', dayKey: '2026-09-16' },
		zone: 'UTC',
		now
	});
	await vi.waitFor(() =>
		expect(state.buckets.days[2].items.map((item) => item.content)).toContain('Subscribed')
	);
	stop();
});

it('refreshes orders together with the snapshot and reacts to remote order updates', async () => {
	fixture = openRecordFixture();
	const now = Date.parse('2026-09-16T12:00:00Z');
	for (const title of ['One', 'Two'])
		await createIntention(fixture.repository, {
			title,
			target: { kind: 'day', dayKey: '2026-09-16' },
			zone: 'UTC',
			now
		});
	const orders = createIntentionOrdersRepository(fixture.client);
	const state = new IntentionsState(fixture.repository, { now, zone: 'UTC', orders });
	const stop = state.start();
	await vi.waitFor(() => expect(state.buckets.days[2].items).toHaveLength(2));
	const ids = state.buckets.days[2].items.map((item) => item.id).reverse();
	await orders.save('day:2026-09-16', ids);
	await vi.waitFor(() => expect(state.buckets.days[2].items.map((item) => item.id)).toEqual(ids));
	state.shift(7);
	state.shift(-7);
	expect(state.buckets.days[2].items.map((item) => item.id)).toEqual(ids);
	stop();
});
