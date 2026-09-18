import { insertLog } from '../Repository/log';
import { now, requireActiveEntity, requireEntity, tupleId } from '../Repository/transaction';
import type { RepositoryClient, TraceRepository, Transaction } from '../Repository/types';
import { entityId, nullableText } from '../Repository/validation';
import { normalizeSource } from '../Sources/Sources';
import { createId } from '../ids';
import { buildFieldPatches } from '../operations';
import type { Citation, CitationDraft, LogActor } from '../types';

const citationFields = ['label', 'isDeleted'] as const;

const normalizeCitation = (value: Record<string, unknown>): Citation => ({
	id: String(value.id),
	assertionId: String(value.assertionId),
	sourceId: String(value.sourceId),
	startOffset: Number(value.startOffset),
	endOffset: Number(value.endOffset),
	label: nullableText(value.label, 'Stored Citation label'),
	isDeleted: Boolean(value.isDeleted),
	createdAt: String(value.createdAt),
	updatedAt: String(value.updatedAt)
});

const citationIdFor = (
	draft: Pick<Citation, 'assertionId' | 'sourceId' | 'startOffset' | 'endOffset'>
) => tupleId('citation', [draft.assertionId, draft.sourceId, draft.startOffset, draft.endOffset]);

const assertCitationDraft = async (
	transaction: Transaction,
	draft: CitationDraft
): Promise<Pick<Citation, 'assertionId' | 'sourceId' | 'startOffset' | 'endOffset'>> => {
	const assertionId = entityId(draft.assertionId, 'Citation assertionId');
	const sourceId = entityId(draft.sourceId, 'Citation sourceId');
	await requireActiveEntity(transaction, 'assertions', assertionId);
	const source = normalizeSource(await requireActiveEntity(transaction, 'sources', sourceId));
	if (
		!Number.isInteger(draft.startOffset) ||
		!Number.isInteger(draft.endOffset) ||
		draft.startOffset < 0 ||
		draft.endOffset <= draft.startOffset ||
		draft.endOffset > source.content.length
	) {
		throw new Error('Citation offsets must address a non-empty range inside Source.content');
	}
	return {
		assertionId,
		sourceId,
		startOffset: draft.startOffset,
		endOffset: draft.endOffset
	};
};

const upsertCitationInTransaction = async (
	transaction: Transaction,
	draft: CitationDraft,
	actor: LogActor
): Promise<Citation> => {
	const anchor = await assertCitationDraft(transaction, draft);
	const id = citationIdFor(anchor);
	const existing = await transaction.fetchById('citations', id);
	if (existing && !existing.isDeleted) return normalizeCitation(existing);
	const timestamp = now();
	const row = {
		id,
		...anchor,
		label: nullableText(draft.label, 'Citation label'),
		isDeleted: false,
		createdAt: typeof existing?.createdAt === 'string' ? existing.createdAt : timestamp,
		updatedAt: timestamp
	};
	if (existing) await transaction.update('citations', id, row);
	else await transaction.insert('citations', row);
	await insertLog(transaction, {
		operationId: createId(),
		entityType: 'citation',
		entityId: id,
		action: 'linked',
		patch: existing ? buildFieldPatches(existing, row, citationFields) : { snapshot: row },
		actor,
		cause: existing ? 'restore' : 'normal'
	});
	return normalizeCitation(row);
};

export const createCitationRepository = (
	client: RepositoryClient
): Pick<
	TraceRepository,
	'createCitation' | 'editCitationLabel' | 'setCitationDeleted' | 'listCitations'
> => ({
	createCitation: async (draft, actor = 'user') =>
		client.transact((transaction) => upsertCitationInTransaction(transaction, draft, actor)),
	editCitationLabel: async (id, label, actor = 'user') =>
		client.transact(async (transaction) => {
			const before = normalizeCitation(await requireActiveEntity(transaction, 'citations', id));
			const normalizedLabel = nullableText(label, 'Citation label');
			if (before.label === normalizedLabel) return before;
			const after = { ...before, label: normalizedLabel, updatedAt: now() };
			await transaction.update('citations', id, {
				label: after.label,
				updatedAt: after.updatedAt
			});
			await insertLog(transaction, {
				operationId: createId(),
				entityType: 'citation',
				entityId: id,
				action: 'updated',
				patch: buildFieldPatches(before, after, citationFields),
				actor
			});
			return after;
		}),
	setCitationDeleted: async (id, isDeleted, actor = 'user') =>
		client.transact(async (transaction) => {
			const before = normalizeCitation(await requireEntity(transaction, 'citations', id));
			if (before.isDeleted === isDeleted) return before;
			if (!isDeleted) await assertCitationDraft(transaction, before);
			const after = { ...before, isDeleted, updatedAt: now() };
			await transaction.update('citations', id, { isDeleted, updatedAt: after.updatedAt });
			await insertLog(transaction, {
				operationId: createId(),
				entityType: 'citation',
				entityId: id,
				action: isDeleted ? 'unlinked' : 'linked',
				patch: buildFieldPatches(before, after, citationFields),
				actor,
				cause: isDeleted ? 'normal' : 'restore'
			});
			return after;
		}),
	listCitations: async (includeDeleted = false) => {
		const values = await client.fetch('citations');
		return values
			.map(normalizeCitation)
			.filter((citation) => includeDeleted || !citation.isDeleted)
			.toSorted(
				(left, right) =>
					left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id)
			);
	}
});
