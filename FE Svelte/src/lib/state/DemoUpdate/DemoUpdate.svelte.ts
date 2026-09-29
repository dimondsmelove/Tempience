/**
 * Whether the active demo holds an older notebook than this build ships and the reader's own
 * entries kept it from being rebuilt on boot: the header then offers the rebuild. Set once by
 * the demo boot (`scenarios/demo`); a rebuild reloads the app.
 */
export class DemoUpdateState {
	available = $state(false);
}

export const demoUpdate = new DemoUpdateState();
