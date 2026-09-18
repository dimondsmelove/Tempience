import { offerUndo } from '$lib/context/undo';
import { writeThenRead, type WriteOutcome } from '$lib/context/write';
import { resultInput } from '$lib/state/ResultInput/ResultInput.svelte';
import type { DataSpaceId } from '$lib/state/triplit/data-space';
import type { TempienceRepository } from '$lib/state/triplit/repository';
import type { IntentionAssessmentValues } from '$lib/state/triplit/IntentionAssessments/types';
import type { UndoState } from '$lib/state/Undo/Undo.svelte';

export type ResultRepository = Pick<
	TempienceRepository,
	'createDirectAssessment' | 'correctEvidenceTarget' | 'undoOperation'
>;

/** Who is told about the correction, and in which words, when it can be taken back. */
export type RetargetOffer = Readonly<{ undo: UndoState; label: string | (() => string) }>;

/**
 * An explicit assessment of the intention itself, independent of any fact: a new statement
 * every time, even when it repeats a value the result already shows, because that is a new
 * decision and not a restatement of what was derived. Only what the user entered is sent.
 * The entered values are released only once the repository has taken them, and only in the
 * space this command was issued for — that space is taken here, before the write, so an
 * answer arriving later cannot clear input entered somewhere else.
 */
export const assessDirectly = (
	repository: ResultRepository,
	space: DataSpaceId,
	intentionId: string,
	values: IntentionAssessmentValues,
	read: () => Promise<void>
): Promise<WriteOutcome> =>
	resultInput.hold(
		writeThenRead(
			() => repository.createDirectAssessment(intentionId, values, 'user').then(() => {}),
			read,
			() => resultInput.clear(space, intentionId)
		)
	);

/**
 * An explicit correction of one evidence link's address: the link moves to the chosen
 * intention and takes the statement made through it, if there is one, keeping its identity
 * and its first time. It is not an unlink followed by a new link, and an intention this fact
 * already stands for refuses the whole correction without changing either side. The step it
 * closes on success is the one of the space it was issued for.
 *
 * It is offered back only where an inverse exists: the correction must have moved the link,
 * and the link must have carried a statement that moved with it. A correction that only
 * activated a new evidence link is deliberately not invertible — a first assessment made on
 * another device may still be on its way to that link, and withdrawing it would take that
 * statement's effect with it — so the command names its operation only when it can be undone.
 */
export const correctTarget = (
	repository: ResultRepository,
	space: DataSpaceId,
	evidenceId: string,
	intentionId: string,
	read: () => Promise<void>,
	offer: RetargetOffer
): Promise<WriteOutcome> =>
	resultInput.hold(
		offerUndo({
			undo: offer.undo,
			space,
			repository,
			label: offer.label,
			write: async () => {
				const { assessment, operation } = await repository.correctEvidenceTarget(
					evidenceId,
					intentionId,
					'user'
				);
				// An operation was written only if the link moved; the statement must have moved with it.
				return { operationId: operation !== null && assessment !== null ? operation.id : null };
			},
			committed: () => resultInput.closeRetarget(space),
			read
		})
	);
