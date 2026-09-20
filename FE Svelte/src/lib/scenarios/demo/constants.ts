export { DEMO_DATA_SPACE_ID, DEMO_SEED_MARKER_KEY } from '$lib/state/triplit/data-space';

/** The manifest id is `watson-v1:<locale>`: a seed written in one language is never re-seeded in another. */
export const DEMO_MANIFEST_PREFIX = 'watson-v1';
export const DEMO_MANIFEST_VERSION = 1;
/** Record ids are deterministic per story id: `demo-` plus the story id with dots as dashes. */
export const DEMO_RECORD_PREFIX = 'demo-';
/** Every date of the notebook is London time, whatever zone the browser is in. */
export const DEMO_TIMEZONE = 'Europe/London';
/** Records are captured at this local wall-clock time of their day. */
export const CAPTURE_TIME = '12:00';
/** A season is a normalized start/end month window at season precision. */
export const SEASON_MONTHS = {
	spring: [3, 5],
	summer: [6, 8],
	autumn: [9, 11]
} as const satisfies Record<string, readonly [number, number]>;

export const DEMO_KIND_CASE_ID = 'demo-kind-case';
export const DEMO_KIND_CASE_V_ID = 'demo-kind-case-v1';
export const DEMO_KIND_WIRE_ID = 'demo-kind-wire';
export const DEMO_KIND_WIRE_V_ID = 'demo-kind-wire-v1';

/** The record the demo opens on: Watson's preface, whose links are the table of contents. */
export const DEMO_START_STORY_ID = 'w.start';
