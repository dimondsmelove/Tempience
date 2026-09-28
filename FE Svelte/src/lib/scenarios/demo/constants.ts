/** The structural facts every demo story shares; what differs between stories lives in `registry.ts`. */
export const DEMO_MANIFEST_VERSION = 1;
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
