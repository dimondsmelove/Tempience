import { now } from '../Repository/transaction';
import type { LedgerIntervalDraft, RepositoryClient, TraceRepository } from '../Repository/types';
import type { JsonObject, Trace, TraceDraft } from '../types';
import { createTraceInTransaction } from './create';

const assertLedgerInterval = (draft: LedgerIntervalDraft): void => {
	if (draft.content.trim().length === 0) throw new Error('Ledger trace content is required');
	const start = Date.parse(draft.aboutStart);
	const end = Date.parse(draft.aboutEnd);
	if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
		throw new Error('Ledger interval must have a valid end after its start');
	}
};

const ledgerTraceDraft = (
	draft: LedgerIntervalDraft,
	relation: Trace['relation'],
	data: JsonObject | null = draft.data ?? null
): TraceDraft => {
	assertLedgerInterval(draft);
	return {
		content: draft.content,
		capturedAt: draft.capturedAt ?? now(),
		timezone: draft.timezone,
		aboutKind: 'interval',
		aboutTime: {
			basis: 'absolute',
			precision: 'minute',
			certainty: 'exact',
			start: draft.aboutStart,
			end: draft.aboutEnd
		},
		relation,
		data
	};
};

export const createLedgerRepository = (
	client: RepositoryClient
): Pick<TraceRepository, 'createWeeklyBudget' | 'createFixedTimeIntent' | 'createActual'> => ({
	createWeeklyBudget: async (draft, actor = 'user') => {
		if (!Number.isInteger(draft.targetMinutes) || draft.targetMinutes <= 0) {
			throw new Error('targetMinutes must be a positive integer');
		}
		return client.transact((transaction) =>
			createTraceInTransaction(
				transaction,
				ledgerTraceDraft(draft, 'intend', {
					...(draft.data ?? {}),
					ledger: { kind: 'weekly_budget', targetMinutes: draft.targetMinutes }
				}),
				draft.scopeId,
				actor
			)
		);
	},
	createFixedTimeIntent: async (draft, actor = 'user') =>
		client.transact((transaction) =>
			createTraceInTransaction(transaction, ledgerTraceDraft(draft, 'intend'), draft.scopeId, actor)
		),
	createActual: async (draft, actor = 'user') =>
		client.transact((transaction) =>
			createTraceInTransaction(transaction, ledgerTraceDraft(draft, 'actual'), draft.scopeId, actor)
		)
});
