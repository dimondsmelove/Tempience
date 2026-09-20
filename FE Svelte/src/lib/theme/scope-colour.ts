import type { ResolvedTheme } from './resolve-theme';

/**
 * The colour of a Scope from its own coordinates (owner review 2026-09-19, R1; depth — loop
 * 008, C6): a free **hue**, 0 ≤ h < 360, a **saturation** 0–100 — the user's position between
 * pastel and the most vivid sRGB can show for that hue — and a **depth** 0–2, the third ring of
 * the flower: the same hue a step deeper, where a red is a real red and not the salmon the
 * light ring's gamut allows. The theme adds nothing but its canvas, which sets the **base
 * lightness** (`scopeBase`), so every Scope of one depth reads the same weight on the ribbon —
 * 3 px capsules, 30 % bands, rail dots, chip tints — and the twelve slot tables of loop 005 are
 * gone: every theme, custom or preset, colours a Scope by this one rule.
 */
export type ScopeColour = Readonly<{
	/** An integer degree on the hue circle. */
	hue: number;
	/** Saturation 0–100; `null` is the default, 100 — the ceiling of the gamut for the hue. */
	chroma: number | null;
	/** Depth 0–2; absent is `DEFAULT_DEPTH`, the light ring — every Scope stored before C6. */
	depth?: number;
}>;

/**
 * What the theme gives a Scope colour: the polarity of its canvas and the OKLCH lightness of
 * each depth on it. Derived from the canvas alone (`scopeBase`), so a custom theme with a pale
 * canvas — paler than Стоун, closer to the marks — gets deeper, less pale Scope colours than
 * the stock one, and no light canvas ever gets paler ones; the stock canvases give the pinned
 * tables — Графит 0.80 / 0.68 / 0.56, Стоун 0.55 / 0.45 / 0.36.
 */
export type ScopeBase = Readonly<{
	/** `dark` for a canvas below OKLCH L 0.5, whatever the theme calls its mode. */
	mode: ResolvedTheme;
	/** The lightness of depths 0, 1, 2, rounded to 0.01. */
	lightness: readonly [number, number, number];
}>;

/** The depths a Scope can take: the light ring, a step deeper, the deep ring. */
export const DEPTH_COUNT = 3;
export const DEFAULT_DEPTH = 0;
/** The base on a dark canvas: the canvas lifted by this, at most `BASE_MAX_DARK`. */
export const DARK_LIFT = 0.61;
export const BASE_MAX_DARK = 0.85;
/**
 * The base on a light canvas: the canvas dropped by this, at least `BASE_MIN_LIGHT` and at
 * most `BASE_MAX_LIGHT` — Стоун's own 0.55, so a canvas lighter than Стоун (near white) keeps
 * Стоун's table and never pales the marks (primary review 2026-09-19).
 */
export const LIGHT_DROP = 0.37;
export const BASE_MIN_LIGHT = 0.4;
export const BASE_MAX_LIGHT = 0.55;
/** A canvas below this OKLCH lightness is a dark ground; light marks go on it. */
export const CANVAS_DARK_BELOW = 0.5;
/**
 * How far each depth sits below the base: −0.12 a step on a dark canvas; on a light one −0.10
 * and then −0.09, so Стоун lands on 0.55 / 0.45 / 0.36 exactly (owner 2026-09-19).
 */
export const DEPTH_STEPS: Record<ResolvedTheme, readonly [number, number, number]> = {
	dark: [0, 0.12, 0.24],
	light: [0, 0.1, 0.19]
};
/** The stock canvases: Графит and Стоун (`DESIGN.md` §2). */
export const STOCK_CANVAS: Record<ResolvedTheme, string> = { dark: '#0F1418', light: '#E7E5DF' };
/** Saturation 0: a pastel that still reads as its hue, not as grey. */
export const CHROMA_MIN = 0.04;
/**
 * Saturation 100: the largest OKLCH chroma up to this that sRGB holds at the depth's lightness
 * for the hue (`chromaCeiling`). Raised from the fixed 0.11 of loop 005 so 3 px marks read as
 * colour; hues the gamut narrows (blues at L 0.80, yellows and teals at L 0.55) stop at their
 * own ceiling, the hue and the lightness untouched — a step deeper, a red holds its full red.
 */
export const CHROMA_MAX = 0.18;
/** The saturation a Scope gets when it names none. */
export const DEFAULT_CHROMA = 100;

/** A hue as the Scope stores it: an integer degree, 0 ≤ h < 360; anything else is «без цвета». */
export const normalizeHue = (value: unknown): number | null => {
	if (typeof value !== 'number' || !Number.isFinite(value)) return null;
	return ((Math.round(value) % 360) + 360) % 360;
};
/** A saturation as the Scope stores it: an integer 0–100; anything else is the default (`null`). */
export const normalizeChroma = (value: unknown): number | null => {
	if (typeof value !== 'number' || !Number.isFinite(value)) return null;
	return Math.max(0, Math.min(100, Math.round(value)));
};
/** A depth as the Scope stores it: an integer 0–2; anything else is unsaid (`null`, read as 0). */
export const normalizeDepth = (value: unknown): number | null => {
	if (typeof value !== 'number' || !Number.isFinite(value)) return null;
	const depth = Math.round(value);
	return depth >= 0 && depth < DEPTH_COUNT ? depth : null;
};

const srgbToLinear = (value: number): number =>
	value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
const linearToSrgb = (value: number): number =>
	value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055;

/** OKLCH → linear sRGB channels, unclamped, so a caller can tell in-gamut from clipped. */
const oklchToLinear = (l: number, c: number, hueDeg: number): [number, number, number] => {
	const hue = (hueDeg * Math.PI) / 180;
	const a = c * Math.cos(hue);
	const b = c * Math.sin(hue);
	const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
	const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
	const s_ = l - 0.0894841775 * a - 1.291485548 * b;
	const [lc, mc, sc] = [l_ ** 3, m_ ** 3, s_ ** 3];
	return [
		4.0767416621 * lc - 3.3077115913 * mc + 0.2309699292 * sc,
		-1.2684380046 * lc + 2.6097574011 * mc - 0.3413193965 * sc,
		-0.0041960863 * lc - 0.7034186147 * mc + 1.707614701 * sc
	];
};
/** Linear sRGB → OKLCH lightness. */
const linearToOklchL = (r: number, g: number, b: number): number =>
	0.2104542553 * Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b) +
	0.793617785 * Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b) -
	0.0040720468 * Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
/** Inside sRGB, with a hair of slack for the arithmetic. */
const inGamut = (rgb: readonly number[]): boolean =>
	rgb.every((channel) => channel >= -1e-6 && channel <= 1 + 1e-6);

const hslChannel = (h: number, s: number, l: number, n: number): number => {
	const k = (n + h / 30) % 12;
	const a = s * Math.min(l, 1 - l);
	return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
};

/**
 * The OKLCH lightness of a theme colour as the theme editor accepts it — hex (3, 4, 6 or 8
 * digits), `rgb()`, `hsl()`, `oklch()` or `oklab()`; `null` for anything else.
 */
export const colourLightness = (colour: string): number | null => {
	const value = colour.trim();
	const hex = /^#([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i.exec(value)?.[1];
	if (hex !== undefined) {
		const wide = hex.length <= 4 ? [...hex].map((digit) => digit + digit).join('') : hex;
		const [r, g, b] = [0, 2, 4].map((i) => Number.parseInt(wide.slice(i, i + 2), 16) / 255);
		return linearToOklchL(srgbToLinear(r), srgbToLinear(g), srgbToLinear(b));
	}
	const match = /^(rgba?|hsla?|oklch|oklab)\((.+)\)$/i.exec(value);
	if (!match) return null;
	const fn = match[1].toLowerCase();
	const parts = match[2]
		.split('/')[0]
		.split(/[\s,]+/)
		.filter(Boolean);
	if (parts.length < 3) return null;
	const numbers = parts.map((part) => Number.parseFloat(part));
	if (numbers.some((n) => !Number.isFinite(n))) return null;
	if (fn.startsWith('ok'))
		return numbers[0] > 1 || parts[0].endsWith('%') ? numbers[0] / 100 : numbers[0];
	const channels = fn.startsWith('rgb')
		? numbers.slice(0, 3).map((n, i) => (parts[i].endsWith('%') ? n / 100 : n / 255))
		: [0, 8, 4].map((n) => hslChannel(numbers[0], numbers[1] / 100, numbers[2] / 100, n));
	return linearToOklchL(...(channels.map(srgbToLinear) as [number, number, number]));
};

const round2 = (value: number): number => Math.round(value * 100) / 100;

/**
 * The base lightness a canvas gives a Scope colour: on a dark canvas the canvas lifted by
 * `DARK_LIFT` (at most 0.85); on a light one dropped by `LIGHT_DROP`, clamped to 0.40 … 0.55 —
 * a fixed distance from the ground below Стоун's, Стоун's own table above it — so the stock
 * canvases give 0.80 and 0.55, a pale canvas gets deeper marks than Стоун and a near-white one
 * the same.
 */
export const scopeBaseLightness = (canvasL: number): number =>
	round2(
		canvasL < CANVAS_DARK_BELOW
			? Math.min(BASE_MAX_DARK, canvasL + DARK_LIFT)
			: Math.min(BASE_MAX_LIGHT, Math.max(BASE_MIN_LIGHT, canvasL - LIGHT_DROP))
	);

const baseOf = (canvasL: number): ScopeBase => {
	const mode: ResolvedTheme = canvasL < CANVAS_DARK_BELOW ? 'dark' : 'light';
	const base = scopeBaseLightness(canvasL);
	const [d0, d1, d2] = DEPTH_STEPS[mode].map((step) => round2(base - step));
	return { mode, lightness: [d0, d1, d2] };
};

/** The bases of the stock canvases: what a caller that knows only the mode gets. */
export const STOCK_BASE: Record<ResolvedTheme, ScopeBase> = {
	dark: baseOf(colourLightness(STOCK_CANVAS.dark)!),
	light: baseOf(colourLightness(STOCK_CANVAS.light)!)
};

/**
 * What a theme's canvas gives every Scope colour on it: the polarity and the lightness of the
 * three depths (`scopeBaseLightness`, then `DEPTH_STEPS` down). A canvas the rule cannot read
 * falls back on the stock base of `fallback`.
 */
export const scopeBase = (canvas: string, fallback: ResolvedTheme = 'dark'): ScopeBase => {
	const canvasL = colourLightness(canvas);
	return canvasL === null ? STOCK_BASE[fallback] : baseOf(canvasL);
};

/** A base as callers name it: the base itself, or a bare mode for the stock base. */
export type ScopeGround = ScopeBase | ResolvedTheme;
const groundOf = (ground: ScopeGround): ScopeBase =>
	typeof ground === 'string' ? STOCK_BASE[ground] : ground;
/** The lightness of a depth on this ground. */
export const depthLightness = (ground: ScopeGround, depth: number | null | undefined): number =>
	groundOf(ground).lightness[normalizeDepth(depth) ?? DEFAULT_DEPTH];

/**
 * The largest chroma at this lightness and hue that sRGB still holds, up to `c`: the gamut
 * clamp keeps L and the hue and gives up only saturation, so a clipping hue stays that hue,
 * a shade less vivid — never grey, never a neighbouring hue (R1, п. 5). Twelve halvings
 * place the boundary within `c` / 4096.
 */
export const gamutChroma = (l: number, c: number, hueDeg: number): number => {
	if (inGamut(oklchToLinear(l, c, hueDeg))) return c;
	let low = 0;
	let high = c;
	for (let i = 0; i < 12; i++) {
		const mid = (low + high) / 2;
		if (inGamut(oklchToLinear(l, mid, hueDeg))) low = mid;
		else high = mid;
	}
	return low;
};

/** What saturation 100 means for this hue at this depth on this ground: the gamut ceiling, at most `CHROMA_MAX`. */
export const chromaCeiling = (
	hue: number,
	ground: ScopeGround,
	depth: number | null = DEFAULT_DEPTH
): number => Math.max(CHROMA_MIN, gamutChroma(depthLightness(ground, depth), CHROMA_MAX, hue));

/** The OKLCH chroma of a saturation 0–100 for this hue and depth: linear from the floor to the ceiling. */
export const chromaOf = (
	hue: number,
	chroma: number | null,
	ground: ScopeGround,
	depth: number | null = DEFAULT_DEPTH
): number => {
	const share = (normalizeChroma(chroma) ?? DEFAULT_CHROMA) / 100;
	return CHROMA_MIN + (chromaCeiling(hue, ground, depth) - CHROMA_MIN) * share;
};

const hex2 = (channel: number): string =>
	Math.round(Math.max(0, Math.min(1, linearToSrgb(Math.max(0, Math.min(1, channel))))) * 255)
		.toString(16)
		.padStart(2, '0');

/** OKLCH → sRGB hex, the chroma first brought into gamut for this L and hue (`gamutChroma`). */
export const oklchToHex = (l: number, c: number, hueDeg: number): string =>
	'#' +
	oklchToLinear(l, gamutChroma(l, c, hueDeg), hueDeg)
		.map(hex2)
		.join('');

const cache = new Map<string, string>();

/**
 * The colour of a Scope with this hue, saturation and depth on this ground: OKLCH at the
 * depth's lightness, the saturation mapped between the pastel floor and the hue's gamut
 * ceiling there. Pure and memoised by lightness, hue and saturation — the ribbon asks per mark.
 */
export const scopeColour = (
	hue: number,
	chroma: number | null,
	ground: ScopeGround,
	depth: number | null = DEFAULT_DEPTH
): string => {
	const h = normalizeHue(hue) ?? 0;
	const s = normalizeChroma(chroma) ?? DEFAULT_CHROMA;
	const l = depthLightness(ground, depth);
	const key = `${l}:${h}:${s}`;
	const hit = cache.get(key);
	if (hit) return hit;
	const colour = oklchToHex(l, chromaOf(h, s, ground, depth), h);
	cache.set(key, colour);
	return colour;
};

/** `scopeColour` of a Scope that may have none: `null` stays `null` for the caller's ink. */
export const scopeColourOf = (
	colour: ScopeColour | null | undefined,
	ground: ScopeGround
): string | null =>
	colour == null ? null : scopeColour(colour.hue, colour.chroma, ground, colour.depth);

/** The colour of a stored Scope — hue, saturation and depth — or `null` when it has no hue. */
export const scopeColourPair = (
	scope: Readonly<{
		colorHue: number | null;
		colorChroma: number | null;
		colorDepth?: number | null;
	}>
): ScopeColour | null =>
	scope.colorHue === null
		? null
		: {
				hue: scope.colorHue,
				chroma: scope.colorChroma,
				depth: normalizeDepth(scope.colorDepth) ?? DEFAULT_DEPTH
			};

/** One key per distinct colour, for weaving without repeats. */
export const scopeColourKey = (colour: ScopeColour): string =>
	`${colour.hue}/${colour.chroma ?? DEFAULT_CHROMA}/${colour.depth ?? DEFAULT_DEPTH}`;

/**
 * The hues the picker offers as quick picks: twelve, evenly spaced, in the order of the hue
 * bar so each sits under its place on it (R1, п. 4).
 */
export const QUICK_HUES: readonly number[] = Array.from({ length: 12 }, (_, i) => i * 30);
