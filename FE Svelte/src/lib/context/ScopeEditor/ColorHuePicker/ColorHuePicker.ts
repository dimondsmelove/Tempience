import { scopeColour, type ScopeGround } from '$lib/theme/scope-colour';
import { BAR_STOP_DEG, CHROMA_MAX_PERCENT, CHROMA_STOP_PERCENT } from './constants';

const gradient = (stops: readonly string[]): string =>
	`linear-gradient(to right, ${stops.join(', ')})`;

/**
 * The track of the hue bar: the circle 0–360° as a left-to-right gradient of the colours the
 * hues take in this mode at the saturation chosen, one stop every `BAR_STOP_DEG`, so what the
 * thumb points at is what the Scope gets. The first and last stops are the same hue (0° ≡ 360°).
 */
export const hueBarGradient = (
	chroma: number | null,
	ground: ScopeGround,
	depth: number | null = null
): string => {
	const stops: string[] = [];
	for (let hue = 0; hue <= 360; hue += BAR_STOP_DEG)
		stops.push(
			`${scopeColour(hue % 360, chroma, ground, depth)} ${((hue / 360) * 100).toFixed(2)}%`
		);
	return gradient(stops);
};

/** The track of the saturation bar: the hue chosen from its pastel (0) to its vivid end (100). */
export const chromaBarGradient = (
	hue: number,
	ground: ScopeGround,
	depth: number | null = null
): string => {
	const stops: string[] = [];
	for (let chroma = 0; chroma <= CHROMA_MAX_PERCENT; chroma += CHROMA_STOP_PERCENT)
		stops.push(`${scopeColour(hue, chroma, ground, depth)} ${chroma}%`);
	return gradient(stops);
};
