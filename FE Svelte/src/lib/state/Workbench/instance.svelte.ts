import { DAY_MS, INITIAL_FUTURE_DAYS, INITIAL_PAST_DAYS } from '$lib/state/Viewport/constants';
import { ViewportState } from '$lib/state/Viewport/Viewport.svelte';
import { activeDataSpace } from '$lib/state/triplit/client';
import { draftGuard } from '$lib/state/TraceDraft/guard.svelte';
import { appearance } from '$lib/theme/appearance.svelte';
import { WorkbenchState } from './Workbench.svelte';

const startedAt = Date.now();

/** The one Time workbench of the app: the surface and the header counters read the same state. */
export const workbench = new WorkbenchState(
	new ViewportState({
		start: startedAt - INITIAL_PAST_DAYS * DAY_MS,
		end: startedAt + INITIAL_FUTURE_DAYS * DAY_MS
	})
);
// The row arrangement is a view setting of this device, kept with `railOpen` / `legendOpen` (Q3-A).
workbench.arrangement.store = {
	read: () => appearance.device.rowArrangement,
	write: (next) => appearance.applyDevice({ ...appearance.savedDevice, rowArrangement: next })
};
// A changed Trace form asks before any command replaces what the Context shows.
workbench.exitGuard = draftGuard;
// An offer to take an action back belongs to the space whose records it would act on.
workbench.undo.space = () => activeDataSpace.id;
