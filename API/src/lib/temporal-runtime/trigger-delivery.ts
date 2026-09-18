import { and, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { triggerCandidates, triggerDeliveries } from '../../db/schema';
import { mapTriggerCandidate, mapTriggerDelivery } from './mappers';
import { newUid, nowIso } from '../time';

export const deliverTriggerCandidate = async (input: {
	candidateUid: string;
	channel: 'in_app' | 'local_notification';
	idempotencyKey?: string;
}) => {
	const ts = nowIso();
	const [candidate] = await db
		.select()
		.from(triggerCandidates)
		.where(eq(triggerCandidates.uid, input.candidateUid));

	if (!candidate) return { error: 'Trigger candidate not found' as const };
	if (!['pending', 'eligible'].includes(candidate.status)) {
		return { error: 'Trigger candidate is not deliverable' as const };
	}

	const minuteBucket = ts.slice(0, 16);
	const idempotencyKey =
		input.idempotencyKey ?? `${candidate.uid}:${input.channel}:${minuteBucket}`;

	const [existing] = await db
		.select()
		.from(triggerDeliveries)
		.where(eq(triggerDeliveries.idempotencyKey, idempotencyKey));

	if (existing) {
		return {
			candidate: mapTriggerCandidate(candidate),
			delivery: mapTriggerDelivery(existing),
			idempotent: true as const
		};
	}

	const deliveryRow = {
		uid: newUid(),
		candidateUid: candidate.uid,
		channel: input.channel,
		deliveredAt: ts,
		dismissedAt: null,
		idempotencyKey,
		createdAt: ts,
		updatedAt: ts
	};

	await db.insert(triggerDeliveries).values(deliveryRow);
	await db
		.update(triggerCandidates)
		.set({ status: 'delivered', updatedAt: ts })
		.where(eq(triggerCandidates.uid, candidate.uid));

	const [updated] = await db
		.select()
		.from(triggerCandidates)
		.where(eq(triggerCandidates.uid, candidate.uid));

	return {
		candidate: mapTriggerCandidate(updated!),
		delivery: mapTriggerDelivery(deliveryRow),
		idempotent: false as const
	};
};

export const dismissTriggerCandidate = async (candidateUid: string) => {
	const ts = nowIso();
	const result = await db
		.update(triggerCandidates)
		.set({ status: 'dismissed', updatedAt: ts })
		.where(
			and(
				eq(triggerCandidates.uid, candidateUid),
				eq(triggerCandidates.status, 'eligible')
			)
		);

	if (result.changes === 0) return null;

	const [row] = await db
		.select()
		.from(triggerCandidates)
		.where(eq(triggerCandidates.uid, candidateUid));

	return row ? mapTriggerCandidate(row) : null;
};
