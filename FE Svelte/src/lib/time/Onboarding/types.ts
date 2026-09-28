import type { DemoStoryEntry } from '$lib/scenarios/demo/registry';
import type { ONBOARDING_STEPS } from './constants';

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];
export type OnboardingProps = {
	/** Ends the tour and goes on to the user's own records (the second card of «Попробовать»). */
	onstart: () => void;
	/** Opens one story of the demo catalog; without it the cards are shown but disabled. */
	ondemo?: (entry: DemoStoryEntry) => void;
	/** Shows «Закрыть» when the tour is opened from the menu over existing records. */
	onclose?: () => void;
};
