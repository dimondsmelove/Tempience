import { copyFile, mkdir, readFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';

const catalogUrl = new URL('../src/lib/scenarios/DataPacks/catalog.json', import.meta.url);
const catalog = JSON.parse(await readFile(catalogUrl, 'utf8'));
const mode = process.argv[2] ?? 'production';
const env = loadEnv(mode, fileURLToPath(new URL('../', import.meta.url)), 'PUBLIC_');
const publicBuild = env.PUBLIC_BUILD === '1';
const enabled = (env.PUBLIC_DATA_PACKS ?? (publicBuild ? '' : 'belgrade'))
	.split(',')
	.map((id) => id.trim());
const output = new URL('../static/packs/', import.meta.url);
await mkdir(output, { recursive: true });

for (const pack of catalog) {
	if (!/^[a-z0-9-]+$/.test(pack.id)) throw new Error('Invalid data pack id.');
	const target = new URL(`${pack.id}.json`, output);
	if (!enabled.includes(pack.id) || (publicBuild && !pack.public)) {
		// Only catalog-owned generated assets are removed between build profiles.
		await rm(target, { force: true });
		continue;
	}
	const source = new URL(pack.source, catalogUrl);
	const manifest = JSON.parse(await readFile(source, 'utf8'));
	if (manifest.manifestId !== pack.manifestId) throw new Error(`Stale catalog: ${pack.id}`);
	await copyFile(source, target);
	console.log(`Data pack: ${pack.id} -> ${fileURLToPath(target)}`);
}

const unpublished = enabled.filter((id) => id && !catalog.some((pack) => pack.id === id));
if (unpublished.length) console.log(`Unpublished data packs omitted: ${unpublished.join(', ')}`);
