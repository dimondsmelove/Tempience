import type { MessageKey } from '$lib/state/Locale/types';
import type { OnboardingStep } from './types';

export const STEP_TITLE_KEY = {
	welcome: 'onboarding.welcome.title',
	trace: 'onboarding.trace.title',
	scope: 'onboarding.scope.title',
	links: 'onboarding.links.title',
	try: 'onboarding.try.title'
} as const satisfies Record<OnboardingStep, MessageKey>;

/** One key per paragraph, read from the catalog at display time; «Попробовать» has cards instead. */
const PARAGRAPH_KEYS = {
	welcome: ['onboarding.welcome.p1', 'onboarding.welcome.p2'],
	trace: ['onboarding.trace.p1', 'onboarding.trace.p2', 'onboarding.trace.p3'],
	scope: ['onboarding.scope.p1'],
	links: [
		'onboarding.links.p1',
		'onboarding.links.p2',
		'onboarding.links.p3',
		'onboarding.links.p4'
	],
	try: []
} as const satisfies Record<OnboardingStep, readonly MessageKey[]>;

export const paragraphKeys = (step: OnboardingStep): readonly MessageKey[] => PARAGRAPH_KEYS[step];
