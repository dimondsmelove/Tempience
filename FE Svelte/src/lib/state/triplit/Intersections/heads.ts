import type { TempienceTriplitClient } from '../client';
import type { Intersection, IntersectionKind } from '../types';

/**
 * A link as the timeline, a list and the result picker read it: its two ends, its kind, its
 * context, whether it stands, and what names its source — the activation it was created
 * with and the binding a retarget left on it — which the eligibility of an assessment is
 * decided by. Its lifecycle stamps and its last change are left to whoever acts on the link.
 */
export type LinkHead = Pick<
	Intersection,
	| 'id'
	| 'fromId'
	| 'toId'
	| 'kind'
	| 'context'
	| 'fromEntityType'
	| 'activationId'
	| 'assessmentId'
	| 'isDeleted'
	| 'createdAt'
>;

export type LinkHeadsRequest = Readonly<{
	/** The standing links, or every one, withdrawn included. */
	deleted: 'active' | 'all';
}>;

export const LINK_HEAD_FIELDS = [
	'id',
	'fromId',
	'toId',
	'kind',
	'context',
	'fromEntityType',
	'activationId',
	'assessmentId',
	'isDeleted',
	'createdAt'
] as const;

export const linkHeadsQuery = (client: TempienceTriplitClient, request: LinkHeadsRequest) => {
	let query = client.query('intersections');
	if (request.deleted === 'active') query = query.Where('isDeleted', '=', false);
	return query.Select([...LINK_HEAD_FIELDS] as never);
};

export const normalizeLinkHead = (value: Record<string, unknown>): LinkHead => ({
	id: String(value.id),
	fromId: String(value.fromId),
	toId: String(value.toId),
	kind: value.kind as IntersectionKind,
	context: (value.context as string | null | undefined) ?? null,
	fromEntityType: (value.fromEntityType as 'traceKind' | null | undefined) ?? null,
	...(typeof value.activationId === 'string' ? { activationId: value.activationId } : {}),
	assessmentId: (value.assessmentId as string | null | undefined) ?? null,
	isDeleted: Boolean(value.isDeleted),
	createdAt: String(value.createdAt)
});
