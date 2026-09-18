export type OnboardingStep = 'intro' | 'group';
export type OnboardingProps = { oncreate: (name: string) => Promise<void> };
