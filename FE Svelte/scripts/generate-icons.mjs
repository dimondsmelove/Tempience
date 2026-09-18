import { execFileSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const staticDir = path.join(root, 'static');
const source = await readFile(path.join(staticDir, 'icons/icon.svg'), 'utf8');
const exportIndex = process.argv.indexOf('--export-dir');
const exportDir = exportIndex === -1 ? null : process.argv[exportIndex + 1];
if (exportIndex !== -1 && (!exportDir || exportDir.startsWith('--'))) {
	throw new Error('Usage: node scripts/generate-icons.mjs [--export-dir <directory>]');
}
const background = / {2}<rect id="background"[^>]*\/>\n/;
if (!background.test(source) || !source.includes('width="512" height="512"')) {
	throw new Error('Expected the canonical icon.svg canvas and background element');
}
const square = source.replace(' rx="70"', '');
const mark = source.replace(background, '');
// Keep the entire mark inside the maskable safe circle (radius: 40% of canvas).
const maskable = square
	.replace('  <g id="mark"', '  <g transform="translate(36 36) scale(0.82)">\n  <g id="mark"')
	.replace('</svg>', '  </g>\n</svg>');
const sized = (svg, size) =>
	svg.replace('width="512" height="512"', `width="${size}" height="${size}"`);
const render = (svg, destination, size, opaque = false) => {
	execFileSync(
		'magick',
		['-background', 'none', 'svg:-', '-strip', `${opaque ? 'PNG24' : 'PNG32'}:${destination}`],
		{ input: sized(svg, size), stdio: ['pipe', 'ignore', 'inherit'] }
	);
};

await writeFile(path.join(staticDir, 'favicon.svg'), sized(source, 16));
for (const size of [192, 512]) {
	render(source, path.join(staticDir, `icons/icon-${size}.png`), size);
	render(maskable, path.join(staticDir, `icons/icon-maskable-${size}.png`), size, true);
}
render(square, path.join(staticDir, 'icons/apple-touch-icon.png'), 180, true);
const temporary = await mkdtemp(path.join(os.tmpdir(), 'tempience-icons-'));
try {
	const frames = [16, 32, 48].map((size) => {
		const frame = path.join(temporary, `${size}.png`);
		render(source, frame, size);
		return frame;
	});
	execFileSync('magick', [...frames, path.join(staticDir, 'favicon.ico')]);
} finally {
	await rm(temporary, { recursive: true, force: true });
}

if (exportDir) {
	await mkdir(exportDir, { recursive: true });
	for (const [name, svg] of [
		['icon', source],
		['avatar', square],
		['mark', mark]
	]) {
		await writeFile(path.join(exportDir, `tempience-${name}.svg`), svg);
		for (const size of name === 'icon' ? [256, 512, 1024, 2048] : [512, 1024]) {
			render(svg, path.join(exportDir, `tempience-${name}-${size}.png`), size, name === 'avatar');
		}
	}
	for (const name of ['favicon.svg', 'favicon.ico']) {
		await copyFile(path.join(staticDir, name), path.join(exportDir, name));
	}
	await mkdir(path.join(exportDir, 'app'), { recursive: true });
	for (const name of [
		'apple-touch-icon.png',
		'icon-192.png',
		'icon-512.png',
		'icon-maskable-192.png',
		'icon-maskable-512.png'
	]) {
		await copyFile(path.join(staticDir, 'icons', name), path.join(exportDir, 'app', name));
	}
	await writeFile(
		path.join(exportDir, 'README.md'),
		`# Tempience — выбранный логотип №09

Источник: вариант 09, верхний правый на sheet-02.png.
Вектор сохраняет центральный узел, излом правого плеча и дополнительную грань ножки.
Канонический исходник: FE Svelte/static/icons/icon.svg.

- tempience-avatar-1024.png — для GitHub и других площадок; непрозрачный квадратный фон, знак помещается в круглую обрезку.
- tempience-icon-{256,512,1024,2048}.png — иконка на тёмной подложке со скруглёнными углами; снаружи подложки прозрачность.
- tempience-mark-{512,1024}.png — только знак, прозрачный фон.
- tempience-{icon,avatar,mark}.svg — масштабируемые векторные версии.
- favicon.svg / favicon.ico — вкладка браузера; ICO содержит 16, 32 и 48 px.
- app/ — PNG 192/512, maskable 192/512 и Apple Touch Icon 180 px.

Все размеры получены из одного SVG. Maskable имеет сплошной фон и дополнительное поле под системную маску.

Повторная сборка из FE Svelte (нужен ImageMagick 7):
npm run icons:generate -- --export-dir /путь/к/папке
`
	);
}
console.log(
	`Generated Tempience variant 09 browser/app icons${exportDir ? ` and exports in ${exportDir}` : ''}`
);
