import { render } from 'svelte/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/state/triplit/client', () => ({
	activeDataSpace: { id: 'canonical', syncEnabled: true },
	triplit: { startSession: vi.fn(), endSession: vi.fn() }
}));

const load = async () => (await import('./PairDevice.svelte')).default;

describe('PairDevice', () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it('asks for the server address when the build has none', async () => {
		vi.stubEnv('PUBLIC_BUILD', '1');
		vi.stubEnv('PUBLIC_TRIPLIT_SERVER_URL', '');
		const { body } = render(await load());
		expect(body).toContain('id="server-url"');
		expect(body).toContain('id="pairing-code"');
	});

	it('keeps the owner address fixed', async () => {
		vi.stubEnv('PUBLIC_BUILD', '');
		vi.stubEnv('PUBLIC_TRIPLIT_SERVER_URL', 'https://sync.example.test:8449');
		const { body } = render(await load());
		expect(body).not.toContain('id="server-url"');
		expect(body).toContain('https://sync.example.test:8449');
	});
});
