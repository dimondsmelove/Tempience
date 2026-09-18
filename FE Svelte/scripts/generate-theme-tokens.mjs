import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import prettier from 'prettier';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(projectRoot, 'src/theme/design-tokens.json');
const outputPath = path.join(projectRoot, 'src/theme/tokens.generated.css');
const jsonOutputPath = path.join(projectRoot, 'src/theme/tokens.generated.json');
const referencePattern = /^\{([^{}]+)\}$/;

const commonTokenMap = [
	['--cg-font-sans', 'semantic.font.ui'],
	['--cg-font-mono', 'semantic.font.time'],
	['--cg-space-1', 'semantic.spacing.1'],
	['--cg-space-2', 'semantic.spacing.2'],
	['--cg-space-3', 'semantic.spacing.3'],
	['--cg-space-4', 'semantic.spacing.4'],
	['--cg-space-6', 'semantic.spacing.6'],
	['--cg-space-8', 'semantic.spacing.8'],
	['--cg-radius-mark', 'semantic.radius.mark'],
	['--cg-radius-control', 'semantic.radius.control'],
	['--cg-radius-surface', 'semantic.radius.surface'],
	['--cg-radius-sm', 'semantic.radius.control'],
	['--cg-radius-md', 'semantic.radius.surface'],
	['--cg-radius-lg', 'primitive.radius.legacy-large'],
	['--cg-radius-xl', 'primitive.radius.legacy-xlarge'],
	['--cg-text-size-caption', 'semantic.text.size.caption'],
	['--cg-text-size-body-sm', 'semantic.text.size.body-sm'],
	['--cg-text-size-body', 'semantic.text.size.body'],
	['--cg-text-size-section', 'semantic.text.size.section'],
	['--cg-text-size-screen', 'semantic.text.size.screen'],
	['--cg-text-weight-regular', 'semantic.text.weight.regular'],
	['--cg-text-weight-medium', 'semantic.text.weight.medium'],
	['--cg-text-weight-semibold', 'semantic.text.weight.semibold'],
	['--cg-ease-out', 'semantic.motion.ease.out'],
	['--cg-duration-fast', 'semantic.motion.duration.fast'],
	['--cg-duration-normal', 'semantic.motion.duration.normal']
];

const themeTokenMap = [
	['--cg-bg-canvas', 'canvas'],
	['--cg-bg-surface', 'surface'],
	['--cg-bg-raised', 'raised'],
	['--cg-border-default', 'border'],
	['--cg-text-primary', 'ink'],
	['--cg-text-muted', 'muted'],
	['--cg-text-on-accent', 'accent-ink'],
	['--cg-accent', 'accent'],
	['--cg-danger', 'danger'],
	['--cg-success', 'success'],
	['--cg-event', 'event'],
	['--cg-warning', 'warning'],
	['--cg-info', 'info']
];

const genericFontFamilies = new Set([
	'serif',
	'sans-serif',
	'monospace',
	'cursive',
	'fantasy',
	'system-ui',
	'ui-serif',
	'ui-sans-serif',
	'ui-monospace',
	'ui-rounded',
	'emoji',
	'math',
	'fangsong'
]);

const tokenAt = (document, tokenPath) => {
	const token = tokenPath.split('.').reduce((node, segment) => node?.[segment], document);
	if (!token || typeof token !== 'object' || !('$value' in token)) {
		throw new Error(`Missing DTCG token: ${tokenPath}`);
	}
	return token;
};

const resolveValue = (document, value, stack = []) => {
	if (typeof value === 'string') {
		const reference = value.match(referencePattern)?.[1];
		if (!reference) return value;
		if (stack.includes(reference)) {
			throw new Error(`Circular DTCG reference: ${[...stack, reference].join(' -> ')}`);
		}
		return resolveValue(document, tokenAt(document, reference).$value, [...stack, reference]);
	}
	return value;
};

const colorHexFromComponents = (components) =>
	`#${components
		.map((component) =>
			Math.round(component * 255)
				.toString(16)
				.padStart(2, '0')
		)
		.join('')}`.toUpperCase();

const formatFontFamily = (family) =>
	genericFontFamilies.has(family) || !/\s/.test(family)
		? family
		: `'${family.replaceAll("'", "\\'")}'`;

const cssValue = (document, tokenPath) => {
	const value = resolveValue(document, tokenAt(document, tokenPath).$value, [tokenPath]);

	if (typeof value === 'number') return String(value);
	if (typeof value === 'string') return value;
	if (Array.isArray(value)) {
		if (value.every((part) => typeof part === 'string')) {
			return value.map(formatFontFamily).join(', ');
		}
		if (value.length === 4 && value.every((part) => typeof part === 'number')) {
			return `cubic-bezier(${value.join(', ')})`;
		}
	}
	if (value && typeof value === 'object') {
		if (value.colorSpace === 'srgb' && Array.isArray(value.components)) {
			if (
				value.components.length !== 3 ||
				value.components.some((part) => typeof part !== 'number')
			) {
				throw new Error(`Invalid sRGB components at ${tokenPath}`);
			}
			const componentHex = colorHexFromComponents(value.components);
			if (value.hex && value.hex.toUpperCase() !== componentHex) {
				throw new Error(`DTCG color mismatch at ${tokenPath}: ${value.hex} != ${componentHex}`);
			}
			if (value.alpha === undefined || value.alpha === 1) return value.hex ?? componentHex;
			const rgb = value.components.map((component) => Math.round(component * 255)).join(' ');
			return `rgb(${rgb} / ${value.alpha})`;
		}
		if (typeof value.value === 'number' && typeof value.unit === 'string') {
			return `${value.value}${value.unit}`;
		}
	}

	throw new Error(`Unsupported DTCG value at ${tokenPath}`);
};

const mix = (foreground, percentage, background) =>
	`color-mix(in srgb, var(${foreground}) ${percentage}%, ${background.startsWith('--') ? `var(${background})` : background})`;

const primaryScale = (mode) => {
	if (mode === 'light') {
		return {
			50: mix('--cg-accent', 6, '--cg-bg-surface'),
			100: mix('--cg-accent', 12, '--cg-bg-surface'),
			200: mix('--cg-accent', 22, '--cg-bg-surface'),
			300: mix('--cg-accent', 36, '--cg-bg-surface'),
			400: mix('--cg-accent', 65, '--cg-bg-surface'),
			500: 'var(--cg-accent)',
			600: mix('--cg-accent', 85, '--cg-text-primary'),
			700: mix('--cg-accent', 65, '--cg-text-primary'),
			800: mix('--cg-accent', 50, '--cg-text-primary'),
			900: mix('--cg-accent', 35, '--cg-text-primary')
		};
	}

	return {
		50: mix('--cg-text-primary', 90, '--cg-accent'),
		100: mix('--cg-text-primary', 78, '--cg-accent'),
		200: mix('--cg-text-primary', 60, '--cg-accent'),
		300: mix('--cg-accent', 75, '--cg-text-primary'),
		400: mix('--cg-accent', 88, '--cg-text-primary'),
		500: 'var(--cg-accent)',
		600: mix('--cg-accent', 35, '--cg-bg-canvas'),
		700: mix('--cg-accent', 26, '--cg-bg-canvas'),
		800: mix('--cg-accent', 42, '--cg-bg-canvas'),
		900: mix('--cg-accent', 12, '--cg-bg-raised')
	};
};

const secondaryScale = (mode) => {
	if (mode === 'light') {
		return {
			50: 'var(--cg-bg-surface)',
			100: 'var(--cg-bg-canvas)',
			200: 'var(--cg-bg-raised)',
			300: 'var(--cg-border-default)',
			400: mix('--cg-text-muted', 55, '--cg-border-default'),
			500: 'var(--cg-text-muted)',
			600: mix('--cg-text-muted', 75, '--cg-text-primary'),
			700: mix('--cg-text-muted', 55, '--cg-text-primary'),
			800: mix('--cg-text-muted', 35, '--cg-text-primary'),
			900: 'var(--cg-text-primary)'
		};
	}

	return {
		50: 'var(--cg-text-primary)',
		100: mix('--cg-text-primary', 85, '--cg-text-muted'),
		200: mix('--cg-text-primary', 65, '--cg-text-muted'),
		300: mix('--cg-text-primary', 45, '--cg-text-muted'),
		400: 'var(--cg-text-muted)',
		500: mix('--cg-text-muted', 75, '--cg-border-default'),
		600: mix('--cg-text-muted', 55, '--cg-border-default'),
		700: 'var(--cg-border-default)',
		800: 'var(--cg-bg-raised)',
		900: 'var(--cg-bg-surface)'
	};
};

const themeDeclarations = (document, mode) => {
	const oppositeMode = mode === 'light' ? 'dark' : 'light';
	const declarations = [
		['color-scheme', mode],
		...themeTokenMap.map(([variable, token]) => [
			variable,
			cssValue(document, `mode.${mode}.color.${token}`)
		]),
		['--cg-bg-sidebar', 'var(--cg-bg-canvas)'],
		['--cg-bg-overlay', mix('--cg-bg-canvas', 92, 'transparent')],
		['--cg-bg-inverse', cssValue(document, `mode.${oppositeMode}.color.canvas`)],
		['--cg-border-subtle', mix('--cg-border-default', 45, 'transparent')],
		['--cg-border-strong', mix('--cg-border-default', 85, 'transparent')],
		['--cg-text-secondary', mix('--cg-text-primary', 65, '--cg-text-muted')],
		['--cg-text-inverse', cssValue(document, `mode.${oppositeMode}.color.ink`)],
		[
			'--cg-accent-strong',
			mix('--cg-accent', 82, mode === 'light' ? '--cg-text-primary' : '--cg-bg-canvas')
		],
		['--cg-accent-muted', mix('--cg-accent', 14, 'transparent')],
		['--cg-accent-subtle', mix('--cg-accent', 6, 'transparent')]
	];

	for (const [shade, value] of Object.entries(primaryScale(mode))) {
		declarations.push([`--cg-primary-${shade}`, value]);
	}
	for (const [shade, value] of Object.entries(secondaryScale(mode))) {
		declarations.push([`--cg-secondary-${shade}`, value]);
	}

	declarations.push(
		['--cg-temporal-grid', mix('--cg-border-default', 55, 'transparent')],
		['--cg-temporal-lane', mix('--cg-border-default', 25, 'transparent')],
		['--cg-temporal-now', 'var(--cg-accent)'],
		['--cg-temporal-now-glow', mix('--cg-accent', 35, 'transparent')],
		['--cg-temporal-past', mix('--cg-text-muted', 35, 'transparent')],
		['--cg-temporal-future', mix('--cg-accent', 20, 'transparent')],
		['--cg-temporal-trace', 'var(--cg-accent-strong)'],
		['--cg-temporal-intent-fill', mix('--cg-accent', 8, 'transparent')],
		['--cg-temporal-intent-stroke', mix('--cg-accent', 45, 'transparent')],
		['--cg-temporal-fact-fill', mix('--cg-accent-strong', 12, 'transparent')],
		['--cg-temporal-fact-stroke', mix('--cg-accent-strong', 65, 'transparent')],
		['--cg-temporal-event-stroke', mix('--cg-event', 70, 'transparent')],
		['--cg-temporal-open-stroke', mix('--cg-border-default', 90, 'transparent')],
		['--cg-temporal-cue-bg', mix('--cg-accent', 8, 'transparent')],
		['--cg-temporal-cue-border', mix('--cg-accent', 28, 'transparent')]
	);

	return declarations;
};

const renderDeclarations = (declarations, indent = '\t') =>
	declarations.map(([property, value]) => `${indent}${property}: ${value};`).join('\n');

const renderThemeBlock = (selector, declarations, indent = '') =>
	`${indent}${selector} {\n${renderDeclarations(declarations, `${indent}\t`)}\n${indent}}`;

const buildRawCss = (document) => {
	if (document.$schema !== 'https://www.designtokens.org/schemas/2025.10/format.json') {
		throw new Error(`Unsupported DTCG schema: ${document.$schema ?? 'missing'}`);
	}

	const common = commonTokenMap.map(([variable, token]) => [variable, cssValue(document, token)]);
	const dark = themeDeclarations(document, 'dark');
	const light = themeDeclarations(document, 'light');

	return `/* Generated by scripts/generate-theme-tokens.mjs from design-tokens.json. */
/* Do not edit this file directly. */

${renderThemeBlock(':root', common)}

:root,
${renderThemeBlock("[data-theme='dark']", dark)}

${renderThemeBlock("[data-theme='light']", light)}

@media (prefers-color-scheme: dark) {
${renderThemeBlock(':root:not([data-theme])', dark, '\t')}
}

@media (prefers-color-scheme: light) {
${renderThemeBlock(':root:not([data-theme])', light, '\t')}
}

:root,
[data-theme='dark'],
[data-theme='light'] {
	--cg-bg-elevated: var(--cg-bg-raised);
	--cg-border: var(--cg-border-default);
}

@media (prefers-reduced-motion: reduce) {
	:root {
		--cg-duration-fast: 0ms;
		--cg-duration-normal: 0ms;
	}
}
`;
};

export const buildTokens = (document) => ({
	common: Object.fromEntries(
		commonTokenMap.map(([variable, token]) => [variable, cssValue(document, token)])
	),
	light: Object.fromEntries(themeDeclarations(document, 'light')),
	dark: Object.fromEntries(themeDeclarations(document, 'dark'))
});

export const buildCss = async (document) => {
	const rawCss = buildRawCss(document);
	const prettierConfig = (await prettier.resolveConfig(outputPath)) ?? {};
	return prettier.format(rawCss, { ...prettierConfig, parser: 'css' });
};

const main = async () => {
	const document = JSON.parse(await readFile(sourcePath, 'utf8'));
	const css = await buildCss(document);
	const json = JSON.stringify(buildTokens(document), null, 2) + '\n';

	if (process.argv.includes('--check')) {
		const current = await readFile(outputPath, 'utf8').catch(() => '');
		const currentJson = await readFile(jsonOutputPath, 'utf8').catch(() => '');
		if (current !== css || currentJson !== json) {
			console.error('Generated theme CSS is stale. Run npm run tokens:generate.');
			process.exitCode = 1;
		}
		return;
	}

	await writeFile(outputPath, css);
	await writeFile(jsonOutputPath, json);
	console.log(`Generated ${path.relative(projectRoot, outputPath)}`);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	await main();
}
