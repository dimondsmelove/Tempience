import { defineConfig } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export default defineConfig({
	testDir: './e2e',
	testMatch: /appearance.*\.spec\.ts/,
	timeout: 45_000,
	workers: 1,
	fullyParallel: false,
	reporter: [['list']],
	outputDir: 'test-results/appearance-e2e',
	use: {
		baseURL: 'http://127.0.0.1:4324',
		viewport: { width: 1225, height: 760 },
		trace: 'retain-on-failure'
	},
	webServer: [
		{
			command: 'node ../scripts/triplit-server.mjs',
			url: 'http://127.0.0.1:6545/healthz',
			reuseExistingServer: false,
			env: {
				TRIPLIT_PORT: '6545',
				TRIPLIT_HOST: '127.0.0.1',
				TRIPLIT_PROJECT_ID: 'appearance-tests',
				TRIPLIT_JWT_SECRET: 'appearance-test-only-secret',
				TRIPLIT_PAIRING_CODE: 'appearance-test',
				TRIPLIT_DATABASE_PATH: join(
					tmpdir(),
					`tempience-appearance-test-${process.pid}-${Date.now()}.sqlite`
				)
			}
		},
		{
			command: 'npm run dev -- --host 127.0.0.1 --port 4324 --strictPort',
			url: 'http://127.0.0.1:4324/time',
			reuseExistingServer: false,
			env: { PUBLIC_TRIPLIT_SERVER_URL: 'http://127.0.0.1:6545' }
		}
	]
});
