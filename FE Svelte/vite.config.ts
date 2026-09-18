import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const nm = (...segments: string[]) => path.join(rootDir, 'node_modules', ...segments);

export default defineConfig({
	envPrefix: ['VITE_', 'PUBLIC_'],
	server: {
		host: true,
		port: 5173,
		allowedHosts: true,
		proxy: {
			'/api': {
				target: 'http://localhost:3100',
				changeOrigin: true
			}
		}
	},
	preview: {
		host: true,
		proxy: {
			'/api': {
				target: 'http://127.0.0.1:3100',
				changeOrigin: true
			}
		}
	},
	plugins: [tailwindcss(), sveltekit()],
	resolve: {
		alias: {
			tslib: nm('tslib'),
			'temporal-polyfill': nm('temporal-polyfill')
		}
	},
	optimizeDeps: {
		include: ['tslib', 'temporal-polyfill']
	},
	test: {
		expect: { requireAssertions: true },
		include: ['src/**/*.{test,spec}.{js,ts}']
	}
});
