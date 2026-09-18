import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';

/** @type {import('@sveltejs/kit').Config} */
const publicBuild = process.env.PUBLIC_BUILD === '1';
const output = publicBuild ? 'build-public' : 'build';

/**
 * The build's version is the commit it was built from, not the moment it was built: the
 * service worker carries this string, and a new string is what makes the browser install a
 * new worker and show «Обновить». Rebuilding the same commit — every restart of the owner
 * service builds — must not look like an update (owner, 2026-09-18).
 *
 * A dirty checkout is versioned by what is uncommitted, not by the moment: this file is
 * evaluated more than once per `vite build`, and a per-evaluation timestamp gave the fallback
 * page and the client runtime different `__sveltekit_*` globals, so the app died on start.
 */
const commitVersion = () => {
	try {
		const git = (command) => execSync(command, { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
		const hash = git('git rev-parse --short HEAD').trim();
		const dirty = git('git status --porcelain -- . ":!research"').trim();
		if (!dirty) return hash;
		const digest = createHash('sha1')
			.update(dirty)
			.update(git('git diff HEAD -- . ":!research"'))
			.digest('hex')
			.slice(0, 7);
		return `${hash}-dirty-${digest}`;
	} catch {
		return undefined;
	}
};
const version = commitVersion();

const config = {
	preprocess: vitePreprocess(),
	kit: {
		files: { routes: publicBuild ? 'src/routes-public' : 'src/routes' },
		serviceWorker: { register: false },
		...(version ? { version: { name: version } } : {}),
		adapter: adapter({
			pages: output,
			assets: output,
			fallback: 'index.html',
			strict: false
		})
	}
};

export default config;
