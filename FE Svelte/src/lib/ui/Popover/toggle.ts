/** Forward native state changes without requiring callers to inspect DOM events. */
export function notifyToggle(
	event: Pick<ToggleEvent, 'newState'>,
	callback?: (open: boolean) => void
) {
	callback?.(event.newState === 'open');
}
