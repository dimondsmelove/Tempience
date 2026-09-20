import { PETAL_LABEL_HUE, PETAL_SELECTOR } from './constants';
import type { FlowerWords, Petal } from './types';

/** The petal Blossom names by the HSL hue it read from the petal's hex. */
export const petalByBlossomHue = (
	petals: readonly Petal[],
	blossomHue: number
): Petal | undefined => petals.find((petal) => petal.hsl.h === blossomHue);

/**
 * Names and marks the library's DOM after it renders: the group in our words, the core inert
 * (it opens nothing — the flower is always open), every petal button labelled by our words and
 * given `--petal`, the colour it shows now (`shown[index]`; the skin paints it over the
 * library's inline colour), `aria-pressed` and a test id on the clickable one, `data-selected`
 * on the visible copies of the current petal (the ring's bottom petal is three visual halves
 * and one transparent button), and `inert` on the decorative copies so the keyboard meets each
 * petal once. The petal's identity is the HSL hue the library wrote at the end of its own
 * label, kept in `data-blossom-hue` once the label is ours.
 */
export const decorateFlower = (
	root: HTMLElement,
	petals: readonly Petal[],
	shown: readonly string[],
	selected: number | null,
	words: FlowerWords,
	testId: string | undefined
): void => {
	root.querySelector('.bcp-root')?.setAttribute('aria-label', words.group);
	root.querySelector('.bcp-core')?.setAttribute('inert', '');
	for (const element of root.querySelectorAll<HTMLElement>(PETAL_SELECTOR)) {
		const kept = element.dataset.blossomHue;
		const read = kept ?? element.getAttribute('aria-label')?.match(PETAL_LABEL_HUE)?.[1];
		if (read === undefined) continue;
		if (kept === undefined) element.dataset.blossomHue = read;
		const petal = petalByBlossomHue(petals, Number(read));
		if (petal === undefined) continue;
		const current = petal.index === selected;
		element.dataset.petal = String(petal.index);
		element.style.setProperty('--petal', shown[petal.index]);
		element.setAttribute('aria-label', words.petal(petal.index));
		element.toggleAttribute('data-selected', current);
		if (element.style.pointerEvents === 'none') element.setAttribute('inert', '');
		else {
			element.setAttribute('aria-pressed', String(current));
			if (testId !== undefined) element.dataset.testid = `${testId}-petal-${petal.index}`;
		}
	}
};
