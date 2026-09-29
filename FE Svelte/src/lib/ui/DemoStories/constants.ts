/** The catalog as a whole, one card per story and the button that opens it. */
export const DEMO_STORIES_TEST_ID = 'demo-stories';
export const demoStoryTestId = (id: string): string => `demo-story-${id}`;
export const demoStoryOpenTestId = (id: string): string => `demo-story-${id}-open`;

/** A choice card of the first launch: the whole card is the button (owner 2026-09-29). */
export const CHOICE_CARD_CLASS =
	'cg-panel flex cursor-pointer flex-col items-start border border-outline bg-raised text-left transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-default disabled:opacity-50 disabled:hover:border-outline';
