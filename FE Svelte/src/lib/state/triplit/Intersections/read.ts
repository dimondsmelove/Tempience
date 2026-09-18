import type { Intersection, IntersectionDraft, IntersectionKind } from '../types';

/** The order every reader of the links shows them in: the latest changed first. */
export const byNewestUpdated = (a: Intersection, b: Intersection): number =>
	b.updatedAt.localeCompare(a.updatedAt);

export const normalizeIntersection = (value: Record<string, unknown>): Intersection => ({
	id: String(value.id),
	fromId: String(value.fromId),
	toId: String(value.toId),
	kind: value.kind as IntersectionKind,
	context: (value.context as string | null | undefined) ?? null,
	fromEntityType: (value.fromEntityType as 'traceKind' | null | undefined) ?? null,
	activationId: String(value.activationId ?? `${value.id}:${value.createdAt}`),
	lifecycleId: String(value.lifecycleId ?? `${value.id}:${value.updatedAt}`),
	scopeDeletionOperationId: (value.scopeDeletionOperationId as string | null | undefined) ?? null,
	assessmentId: (value.assessmentId as string | null | undefined) ?? null,
	isDeleted: Boolean(value.isDeleted),
	createdAt: String(value.createdAt),
	updatedAt: String(value.updatedAt)
});

/** Legacy rows without a stored activation use the stable creation identity. */
export const intersectionActivationId = (
	link: Pick<Intersection, 'id' | 'activationId' | 'createdAt'>
): string => link.activationId ?? `${link.id}:${link.createdAt}`;

export const intersectionIdFor = (fromId: string, toId: string, kind: IntersectionKind): string =>
	`${fromId}:${toId}:${kind}`;

export const normalizeContext = (context: string | null | undefined): string | null => {
	const normalized = context?.trim() ?? '';
	return normalized.length > 0 ? normalized : null;
};

export const canonicalIntersectionDraft = (draft: IntersectionDraft): IntersectionDraft =>
	draft.kind === 'related_to' && draft.fromId.localeCompare(draft.toId) > 0
		? { ...draft, fromId: draft.toId, toId: draft.fromId }
		: draft;
