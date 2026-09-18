import { normalizeAssertion } from '../Assertions/read';
import { insertLog } from '../Repository/log';
import { now, requireActiveEntity, requireEntity, tupleId } from '../Repository/transaction';
import type {
	Collection,
	Entity,
	RepositoryClient,
	TraceRepository,
	Transaction
} from '../Repository/types';
import { entityId, enumValue } from '../Repository/validation';
import { createId } from '../ids';
import { buildFieldPatches } from '../operations';
import type { LogActor, ProvenanceLink, ProvenanceLinkDraft, ProvenanceTargetType } from '../types';

const provenanceLinkFields = ['isDeleted'] as const;

const provenanceTargetTypes = [
	'trace',
	'scope',
	'scopeSegment',
	'period',
	'intersection'
] as const satisfies readonly ProvenanceTargetType[];

const normalizeProvenanceLink = (value: Record<string, unknown>): ProvenanceLink => ({
	id: String(value.id),
	assertionId: String(value.assertionId),
	targetType: enumValue(
		value.targetType,
		provenanceTargetTypes,
		'Stored ProvenanceLink targetType'
	),
	targetId: String(value.targetId),
	targetPath: (value.targetPath as string | null | undefined) ?? null,
	isDeleted: Boolean(value.isDeleted),
	createdAt: String(value.createdAt),
	updatedAt: String(value.updatedAt)
});

const provenanceLinkIdFor = (draft: ProvenanceLinkDraft): string =>
	tupleId('provenance-link', [
		draft.assertionId,
		draft.targetType,
		draft.targetId,
		draft.targetPath ?? ''
	]);

const provenanceTargetCollections: Record<ProvenanceTargetType, Collection> = {
	trace: 'traces',
	scope: 'scopes',
	scopeSegment: 'scopeSegments',
	period: 'periods',
	intersection: 'intersections'
};

const jsonPointerSegments = (targetPath: string): string[] => {
	if (targetPath.length === 0 || !targetPath.startsWith('/')) {
		throw new Error('ProvenanceLink targetPath must be a non-empty JSON Pointer');
	}
	return targetPath
		.slice(1)
		.split('/')
		.map((segment) => {
			if (/~(?:[^01]|$)/.test(segment)) {
				throw new Error('ProvenanceLink targetPath contains an invalid JSON Pointer escape');
			}
			return segment.replaceAll('~1', '/').replaceAll('~0', '~');
		});
};

const assertJsonPointerResolves = (target: Entity, targetPath: string): void => {
	let current: unknown = target;
	for (const segment of jsonPointerSegments(targetPath)) {
		if (current === null || typeof current !== 'object' || !Object.hasOwn(current, segment)) {
			throw new Error(`ProvenanceLink targetPath does not resolve: ${targetPath}`);
		}
		current = (current as Record<string, unknown>)[segment];
	}
};

const assertProvenanceLinkDraft = async (
	transaction: Transaction,
	draft: ProvenanceLinkDraft
): Promise<ProvenanceLinkDraft & { targetPath: string | null }> => {
	const assertionId = entityId(draft.assertionId, 'ProvenanceLink assertionId');
	const assertion = normalizeAssertion(
		await requireActiveEntity(transaction, 'assertions', assertionId)
	);
	if (assertion.reviewStatus !== 'accepted') {
		throw new Error('Only an accepted Assertion can be linked to a canonical target');
	}
	const targetType = enumValue(
		draft.targetType,
		provenanceTargetTypes,
		'ProvenanceLink targetType'
	);
	const targetId = entityId(draft.targetId, 'ProvenanceLink targetId');
	const target = await requireActiveEntity(
		transaction,
		provenanceTargetCollections[targetType],
		targetId
	);
	const targetPath = draft.targetPath ?? null;
	if (targetPath !== null) {
		if (typeof targetPath !== 'string') {
			throw new Error('ProvenanceLink targetPath must be a string or null');
		}
		assertJsonPointerResolves(target, targetPath);
	}
	return { assertionId, targetType, targetId, targetPath };
};

const upsertProvenanceLinkInTransaction = async (
	transaction: Transaction,
	draft: ProvenanceLinkDraft,
	actor: LogActor
): Promise<ProvenanceLink> => {
	const validated = await assertProvenanceLinkDraft(transaction, draft);
	const id = provenanceLinkIdFor(validated);
	const existing = await transaction.fetchById('provenanceLinks', id);
	if (existing && !existing.isDeleted) return normalizeProvenanceLink(existing);
	const timestamp = now();
	const row = {
		id,
		...validated,
		isDeleted: false,
		createdAt: typeof existing?.createdAt === 'string' ? existing.createdAt : timestamp,
		updatedAt: timestamp
	};
	if (existing) await transaction.update('provenanceLinks', id, row);
	else await transaction.insert('provenanceLinks', row);
	await insertLog(transaction, {
		operationId: createId(),
		entityType: 'provenanceLink',
		entityId: id,
		action: 'linked',
		patch: existing ? buildFieldPatches(existing, row, provenanceLinkFields) : { snapshot: row },
		actor,
		cause: existing ? 'restore' : 'normal'
	});
	return normalizeProvenanceLink(row);
};

export const createProvenanceRepository = (
	client: RepositoryClient
): Pick<
	TraceRepository,
	'linkAssertionToTarget' | 'setProvenanceLinkDeleted' | 'listProvenanceLinks'
> => ({
	linkAssertionToTarget: async (draft, actor = 'user') =>
		client.transact((transaction) => upsertProvenanceLinkInTransaction(transaction, draft, actor)),
	setProvenanceLinkDeleted: async (id, isDeleted, actor = 'user') =>
		client.transact(async (transaction) => {
			const before = normalizeProvenanceLink(
				await requireEntity(transaction, 'provenanceLinks', id)
			);
			if (before.isDeleted === isDeleted) return before;
			if (!isDeleted) await assertProvenanceLinkDraft(transaction, before);
			const after = { ...before, isDeleted, updatedAt: now() };
			await transaction.update('provenanceLinks', id, {
				isDeleted,
				updatedAt: after.updatedAt
			});
			await insertLog(transaction, {
				operationId: createId(),
				entityType: 'provenanceLink',
				entityId: id,
				action: isDeleted ? 'unlinked' : 'linked',
				patch: buildFieldPatches(before, after, provenanceLinkFields),
				actor,
				cause: isDeleted ? 'normal' : 'restore'
			});
			return after;
		}),
	listProvenanceLinks: async (includeDeleted = false) => {
		const values = await client.fetch('provenanceLinks');
		return values
			.map(normalizeProvenanceLink)
			.filter((link) => includeDeleted || !link.isDeleted)
			.toSorted(
				(left, right) =>
					left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id)
			);
	}
});
