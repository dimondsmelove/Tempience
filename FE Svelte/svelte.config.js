import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const publicBuild = process.env.PUBLIC_BUILD === '1';
const output = publicBuild ? 'build-public' : 'build';

const config = {
	preprocess: vitePreprocess(),
	kit: {
		files: { routes: publicBuild ? 'src/routes-public' : 'src/routes' },
		serviceWorker: { register: false },
		adapter: adapter({
			pages: output,
			assets: output,
			fallback: 'index.html',
			strict: false
		})
	}
};

export default config;
