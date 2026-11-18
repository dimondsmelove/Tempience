import type { DeleteMode, DeletePlan, DeleteResult } from './types';

import { t } from '$lib/state/Locale/Locale.svelte';
import { errorText } from '$lib/state/Locale/errors';
import type { MessageKey } from '$lib/state/Locale/types';
import { tempienceRepository } from '$lib/state/triplit';
import { activeDataSpace } from '$lib/state/triplit/client';
import type { UndoState } from '$lib/state/Undo/Undo.svelte';

export const deleteChoiceForPlan = (plan: DeletePlan): 'delete' | 'confirm' =>
	plan.descendantCount === 0 ? 'delete' : 'confirm';

export const deleteToast = (mode: DeleteMode, title: string, plan: DeletePlan): string =>
	mode === 'only'
		? t('intentions.deletedOnly', { title })
		: plan.descendantCount === 0
			? t('intentions.deletedTitle', { title })
			: t('intentions.deletedTree', { count: plan.descendantCount });

export const deleteIntentionWithUndo = async (options: {
	id: string;
	title: string;
	mode: DeleteMode;
	plan: DeletePlan;
	undo: UndoState;
	refresh: () => Promise<void>;
	failure: (message: string) => void;
	close: () => void;
}) => {
	try {
		const result =
			options.mode === 'all'
				? await tempienceRepository.deleteIntention(options.id, 'all', {
						expectedDeleteIds: options.plan.deleteIds
					})
				: await tempienceRepository.deleteIntention(options.id, 'only');
		if (!result.ok) {
			options.failure(
				result.reason === 'plan_changed' ? '' : t(`intentions.${result.reason}` as MessageKey)
			);
			return result;
		}
		const label = () => deleteToast(options.mode, options.title, options.plan);
		options.undo.offer({
			label,
			space: activeDataSpace.id,
			invert: async () => {
				await tempienceRepository.undoOperation(result.operationId, 'user');
			},
			read: options.refresh
		});
		options.close();
		options.failure('');
		await options.refresh();
		return result;
	} catch (cause) {
		options.failure(errorText(cause));
		return null;
	}
};

type CommandOutcome =
	| { kind: 'deleted'; result: Extract<DeleteResult, { ok: true }> }
	| { kind: 'confirm'; plan: DeletePlan }
	| { kind: 'refused'; result: Extract<DeleteResult, { ok: false }> }
	| { kind: 'stopped' }
	| { kind: 'failed' };

/** Execute a deletion choice and allow one fresh confirmation after a changed plan. */
export const deleteCommand = async (options: {
	id: string;
	mode: DeleteMode;
	plan: DeletePlan;
	retries?: number;
	execute: (mode: DeleteMode, plan: DeletePlan) => Promise<DeleteResult | null>;
	refresh: () => Promise<void>;
	getPlan: () => DeletePlan | null;
}): Promise<CommandOutcome> => {
	const first = await options.execute(options.mode, options.plan);
	if (!first) return { kind: 'failed' };
	if (first.ok) return { kind: 'deleted', result: first };
	if (first.reason !== 'plan_changed') return { kind: 'refused', result: first };
	await options.refresh();
	const fresh = options.getPlan();
	if (!fresh) return { kind: 'failed' };
	if ((options.retries ?? 0) >= 1) return { kind: 'stopped' };
	if (fresh.descendantCount > 0) return { kind: 'confirm', plan: fresh };
	const retry = await options.execute('all', fresh);
	if (!retry) return { kind: 'failed' };
	if (retry.ok) return { kind: 'deleted', result: retry };
	return retry.reason === 'plan_changed' ? { kind: 'stopped' } : { kind: 'refused', result: retry };
};
