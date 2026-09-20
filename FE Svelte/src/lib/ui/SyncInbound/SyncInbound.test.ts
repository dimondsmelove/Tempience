import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import ServerRead from './ServerRead.svelte';
import SyncInbound from './SyncInbound.svelte';

describe('the inbound notice', () => {
	it('offers «Обновить» only while a read is owed', () => {
		const quiet = render(SyncInbound, { props: { pending: false, onrefresh: () => {} } });
		expect(quiet.body).not.toContain('sync-inbound-refresh');
		const owed = render(SyncInbound, { props: { pending: true, onrefresh: () => {} } });
		expect(owed.body).toContain('data-testid="sync-inbound-refresh"');
		expect(owed.body).toContain('Есть изменения с других устройств · Обновить');
	});
});

describe('the last server read', () => {
	it('states the time the server was last read, and that it was not yet', () => {
		const never = render(ServerRead, { props: { lastReadAt: null } });
		expect(never.body).toContain('С сервера в этой сессии ещё не читалось');
		expect(never.body).not.toContain('data-read-at');
		const read = render(ServerRead, { props: { lastReadAt: '2026-09-20T09:05:00.000Z' } });
		expect(read.body).toContain('data-read-at="2026-09-20T09:05:00.000Z"');
		expect(read.body).toMatch(/Последнее обновление с сервера: \d{2}:\d{2}/);
	});
});
