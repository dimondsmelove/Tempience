import { DAY_MS, INITIAL_FUTURE_DAYS, INITIAL_PAST_DAYS } from '$lib/state/Viewport/constants';
import { ViewportState } from '$lib/state/Viewport/Viewport.svelte';
import { activeDataSpace } from '$lib/state/triplit/client';
import { draftGuard } from '$lib/state/TraceDraft/guard.svelte';
import { E2E_SYNTHETIC_ENABLED_KEY } from '$lib/state/triplit/data-space';

/** Where the e2e harness keeps its opening window (see `e2eOpening`). */
const E2E_OPENING_WINDOW_KEY = 'tempience.e2e.opening-window';
import { appearance } from '$lib/theme/appearance.svelte';
import { WorkbenchState } from './Workbench.svelte';

const startedAt = Date.now();

/**
 * The e2e harness's opening window — days back and ahead of «сейчас» — and Live's share, behind
 * its flag: every load and reload of a spec opens and follows where the spec was written,
 * whatever the app's own choice (owner 2026-09-29: a quarter).
 */
const e2eOpening = (): { past: number; future: number; followRatio?: number } | null => {
	try {
		if (localStorage.getItem(E2E_SYNTHETIC_ENABLED_KEY) !== '1') return null;
		const stored = JSON.parse(localStorage.getItem(E2E_OPENING_WINDOW_KEY) ?? 'null') as {
			past?: unknown;
			future?: unknown;
			followRatio?: unknown;
		} | null;
		return typeof stored?.past === 'number' && typeof stored.future === 'number'
			? {
					past: stored.past,
					future: stored.future,
					followRatio: typeof stored.followRatio === 'number' ? stored.followRatio : undefined
				}
			: null;
	} catch {
		return null;
	}
};
const opening = e2eOpening() ?? { past: INITIAL_PAST_DAYS, future: INITIAL_FUTURE_DAYS };

/** The one Time workbench of the app: the surface and the header counters read the same state. */
export const workbench = new WorkbenchState(
	new ViewportState(
		{
			start: startedAt - opening.past * DAY_MS,
			end: startedAt + opening.future * DAY_MS
		},
		'followRatio' in opening && opening.followRatio !== undefined
			? { followNowRatio: opening.followRatio }
			: {}
	)
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
// The e2e harness's handle on the window: since the desktop overview is off (owner 2026-09-29)
// the desktop has no scale or zoom control of its own, so specs set them here — only when the
// harness has switched its flag on.
try {
	if (localStorage.getItem(E2E_SYNTHETIC_ENABLED_KEY) === '1')
		(globalThis as { tempienceE2E?: unknown }).tempienceE2E = { viewport: workbench.viewport };
} catch {
	// No storage, no harness.
}
