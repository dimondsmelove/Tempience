import type { CanvasMetrics, CanvasPalette } from './types';

export type CanvasAppearance = Readonly<{ palette: CanvasPalette; metrics: CanvasMetrics }>;

/**
 * Reads the `--cg-*` tokens the ribbon draws with, probe-style as the axis
 * does: a hidden span resolves each variable to a computed colour or size.
 * The result is cached by `signature` (appearance style + root font size).
 */
export const createAppearanceReader = () => {
	let signature = '';
	let cache: CanvasAppearance | null = null;
	return (element: HTMLElement, nextSignature: string): CanvasAppearance => {
		if (cache && signature === nextSignature) return cache;
		const style = getComputedStyle(element);
		const probe = document.createElement('span');
		probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none';
		probe.setAttribute('aria-hidden', 'true');
		(element.parentElement ?? element).append(probe);
		const color = (name: string): string => {
			probe.style.color = `var(${name})`;
			return getComputedStyle(probe).color;
		};
		const px = (name: string): number => {
			probe.style.fontSize = `var(${name})`;
			return Number.parseFloat(getComputedStyle(probe).fontSize) || 12;
		};
		cache = {
			palette: {
				ink: color('--cg-text-primary'),
				inkSecondary: color('--cg-text-secondary'),
				muted: color('--cg-text-muted'),
				accent: color('--cg-accent'),
				accentMuted: color('--cg-accent-muted'),
				border: color('--cg-border-default'),
				borderStrong: color('--cg-border-strong'),
				surface: color('--cg-bg-surface'),
				secondaryInk: color('--cg-text-on-secondary'),
				sans: style.getPropertyValue('--cg-font-sans').trim() || 'sans-serif',
				mono: style.getPropertyValue('--cg-font-mono').trim() || 'monospace'
			},
			metrics: { captionPx: px('--cg-text-size-caption') }
		};
		probe.remove();
		signature = nextSignature;
		return cache;
	};
};
