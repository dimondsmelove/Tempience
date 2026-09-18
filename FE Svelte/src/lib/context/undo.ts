import { contextWork } from '$lib/context/pending';
import { writeThenRead, type WriteOutcome } from '$lib/context/write';
import type { UndoState } from '$lib/state/Undo/Undo.svelte';
import type { DataSpaceId } from '$lib/state/triplit/data-space';
import type { TempienceRepository } from '$lib/state/triplit/repository';

export type UndoableAction = Readonly<{
	undo: UndoState;
	/** The space the committed operation belongs to, taken at the command. */
	space: DataSpaceId;
	repository: Pick<TempienceRepository, 'undoOperation'>;
	label: string | (() => string);
	/** The command; its result names the operation it committed, when the row can say. */
	write: () => Promise<{ operationId: string | null | undefined }>;
	read: () => Promise<void>;
	/** What the caller releases the moment the command is accepted, before anything is read. */
	committed?: () => void;
	/** What the view does once the action has been taken back and read again. */
	restored?: () => void;
}>;

/**
 * One action of the Context that can be taken back: the command answers with the operation it
 * committed, the offer names that operation, and taking it back is the causal inverse of it —
 * a new operation whose journal says so, never a second action that happens to look like one.
 *
 * The operation is taken at the commit, before anything is read again, so a refresh that fails
 * or a selection that moves cannot make the offer name something else. A command whose row
 * cannot name its operation is offered nothing, because an inverse must know what it undoes.
 * The inverse and the reading that follows it are handed to the owner as two steps, so a
 * reading that fails after a committed inverse asks only to be read again.
 */
export const offerUndo = async (action: UndoableAction): Promise<WriteOutcome> => {
	let operation: string | null | undefined = null;
	return writeThenRead(
		async () => {
			operation = (await action.write()).operationId;
		},
		action.read,
		() => {
			// What the command consumed is released here and nowhere earlier: a refusal never
			// reaches this point, so what the user entered is still exactly what they entered.
			action.committed?.();
			if (!operation) return;
			const operationId = operation;
			action.undo.offer({
				label: action.label,
				space: action.space,
				// Both steps are the Context's own pending work, so an app-owned reload waits.
				invert: () =>
					contextWork.hold(action.repository.undoOperation(operationId, 'user')).then(() => {}),
				read: () =>
					contextWork.hold(
						(async () => {
							await action.read();
							action.restored?.();
						})()
					)
			});
		}
	);
};
