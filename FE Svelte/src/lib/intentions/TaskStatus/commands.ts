import { t } from '$lib/state/Locale/Locale.svelte';
import { errorText } from '$lib/state/Locale/errors';
import type { MessageKey } from '$lib/state/Locale/types';
import { tempienceRepository } from '$lib/state/triplit';
import { activeDataSpace } from '$lib/state/triplit/client';
import type { UndoState } from '$lib/state/Undo/Undo.svelte';
import { setOpen } from '../Outcome/Outcome';

export const panelCommands = (options: {
	undo: UndoState;
	refresh: () => Promise<void>;
	failure: (message: string) => void;
	close: () => void;
}) => {
	const changeStatus = async (id: string, open: boolean) => {
		try {
			const result = await setOpen(tempienceRepository, id, open, { now: Date.now() });
			if (!result.ok) {
				options.failure(t(`intentions.${result.reason}` as MessageKey));
				return;
			}
			options.failure('');
			options.undo.offer({
				label: () => t(open ? 'intentions.reopened' : 'intentions.panelClosed'),
				space: activeDataSpace.id,
				invert: async () => {
					await tempienceRepository.undoOperation(result.operationId, 'user');
				},
				read: options.refresh
			});
			await options.refresh();
		} catch (cause) {
			options.failure(errorText(cause));
		}
	};
	const deleteTask = async (id: string) => {
		try {
			const { operation } = await tempienceRepository.setTraceDeleted(id, true, 'user');
			if (operation)
				options.undo.offer({
					label: () => t('overview.deleted'),
					space: activeDataSpace.id,
					invert: async () => {
						await tempienceRepository.undoOperation(operation.id, 'user');
					},
					read: options.refresh
				});
			options.close();
			options.failure('');
			await options.refresh();
		} catch (cause) {
			options.failure(errorText(cause));
		}
	};
	return { changeStatus, deleteTask };
};
