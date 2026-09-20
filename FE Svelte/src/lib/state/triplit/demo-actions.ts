import { type DataSpace, dismissDemoDataSpace, restoreDemoDataSpace } from './data-space';

type DemoResetTarget = Parameters<typeof dismissDemoDataSpace>[1];
const reloadPage = (): void => window.location.reload();

/**
 * «Открыть записную книжку Ватсона» from any host — the tour's card, the link on the first
 * Scope, the local-data menu: the space is offered again if it was dismissed, becomes active,
 * and the app reloads into it; the seed runs on boot and asks the workbench to open on the
 * notebook's first page. A host that may hold an open form asks the draft guard before calling
 * this.
 */
export const openDemoAndReload = (reload: () => void = reloadPage): void => {
	restoreDemoDataSpace();
	reload();
};

/**
 * «Удалить демо» from any host — the space menu, the local-data menu: the replica goes whole,
 * the space stops being offered, and the app reloads into «Мои данные». A refusal is thrown
 * to the host, which shows it in its own place.
 */
export const deleteDemoAndReload = async (
	dataSpace: DataSpace,
	target: DemoResetTarget,
	reload: () => void = reloadPage
): Promise<void> => {
	await dismissDemoDataSpace(dataSpace, target);
	reload();
};
