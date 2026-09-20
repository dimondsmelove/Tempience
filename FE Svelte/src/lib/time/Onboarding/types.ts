import type { ONBOARDING_STEPS } from './constants';

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];
export type OnboardingProps = {
	/** Ends the tour and goes on to the user's own records (the second card of «Попробовать»). */
	onstart: () => void;
	/** Opens the demo space (Watson's notebook); without it the first card is shown but disabled. */
	ondemo?: () => void;
	/** Shows «Закрыть» when the tour is opened from the menu over existing records. */
	onclose?: () => void;
};
