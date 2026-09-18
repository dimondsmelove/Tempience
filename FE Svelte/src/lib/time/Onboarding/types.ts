export type OnboardingStep = 'intro' | 'group';
export type OnboardingProps = {
	/** Creates the first group and finishes setup. */
	oncreate: (name: string) => Promise<void>;
	/** Finishes setup without a group; records can be kept without one. */
	onskip: () => void;
};
