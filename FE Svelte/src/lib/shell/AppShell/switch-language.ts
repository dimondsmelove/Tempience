import type { LocaleState } from '$lib/state/Locale/Locale.svelte';
import { isLocale } from '$lib/state/Locale/messages';
import type { DraftExitGuard } from '$lib/state/TraceDraft/guard.svelte';
import type { DataSpace, DataSpaceStorage } from '$lib/state/triplit/data-space';
import { DEMO_DATA_SPACE_ID } from '$lib/state/triplit/data-space';
import {
	type DemoResetTarget,
	demoSeedLocale,
	isDemoUntouched
} from '$lib/state/triplit/demo-actions';
import type { TraceRepository } from '$lib/state/triplit/Repository/types';

export type SwitchLanguageDeps = Readonly<{
	locale: Pick<LocaleState, 'set'>;
	activeDataSpace: Pick<DataSpace, 'id'>;
	repository: Pick<TraceRepository, 'listLogs'>;
	triplit: DemoResetTarget;
	storage: DataSpaceStorage | null;
	draftGuard: Pick<DraftExitGuard, 'confirmReloading'>;
	/** `reseedDemoAndReload`: clears the demo replica, drops the seed marker, reloads. */
	reseed: (target: DemoResetTarget, storage: DataSpaceStorage | null) => Promise<void>;
}>;

/**
 * The header's language picker. The choice itself is set (and persisted) at once, whatever
 * the space. In the demo, when the notebook was seeded in another language and the reader
 * has changed nothing in it, the notebook follows: the same reloading question as a
 * DataSpace switch, then the replica is reseeded in the chosen language on the reload. A
 * demo with the reader's own entries is left alone — the header offers the rebuild instead.
 */
export const switchLanguage = async (next: string, deps: SwitchLanguageDeps): Promise<void> => {
	const { locale, activeDataSpace, repository, triplit, storage, draftGuard, reseed } = deps;
	if (!isLocale(next)) return;
	locale.set(next);
	if (activeDataSpace.id !== DEMO_DATA_SPACE_ID) return;
	const seeded = demoSeedLocale(storage);
	if (seeded === null || seeded === next) return;
	if (!(await isDemoUntouched(repository))) return;
	if (!(await draftGuard.confirmReloading())) return;
	await reseed(triplit, storage);
};
