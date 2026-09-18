import type { InitiationPolicy } from '@chronograph/shared';
import { and, asc, eq, gte, inArray, lt, or } from 'drizzle-orm';
import { db } from '../../db/client';
import { inquiries, traces, triggerCandidates, triggerDeliveries } from '../../db/schema';
import { newUid, nowIso } from '../time';
import { isQuietHour } from './policy';
import { mapTriggerCandidate, parseDeliveryCountToday } from './mappers';
import { weekWindowForZone } from '@chronograph/shared';

const INTENT_GRACE_MS = 15 * 60_000;
const INTENT_LOOKBACK_MS = 24 * 60 * 60_000;

const isIntentTrace = (row: typeof traces.$inferSelect) =>
	row.hookKind === 'intent' || row.relation === 'intend';

export const evaluateTriggerCandidates = async (input: {
	anchorAt: string;
	timezone: string;
	weekStart: string;
	policy: InitiationPolicy;
}) => {
	const ts = nowIso();
	const anchorMs = new Date(input.anchorAt).getTime();
	const { from, to } = weekWindowForZone(input.weekStart, input.timezone);

	const traceRows = await db
		.select()
		.from(traces)
		.where(
			or(
				and(gte(traces.capturedAt, from), lt(traces.capturedAt, to)),
				and(gte(traces.aboutStart, from), lt(traces.aboutStart, to)),
				and(gte(traces.aboutAt, from), lt(traces.aboutAt, to))
			)
		);

	const openInquiries = await db
		.select()
		.from(inquiries)
		.where(eq(inquiries.status, 'open'));

	const openInquirySubjects = new Set(openInquiries.map((row) => row.subjectUid));

	let created = 0;

	for (const intent of traceRows.filter(isIntentTrace)) {
		const aboutAt = intent.aboutAt ?? intent.aboutStart;
		if (!aboutAt) continue;

		const aboutMs = new Date(aboutAt).getTime();
		if (aboutMs >= anchorMs - INTENT_GRACE_MS) continue;
		if (aboutMs < anchorMs - INTENT_LOOKBACK_MS) continue;
		if (openInquirySubjects.has(intent.uid)) continue;

		const [existing] = await db
			.select()
			.from(triggerCandidates)
			.where(
				and(
					eq(triggerCandidates.subjectUid, intent.uid),
					inArray(triggerCandidates.status, ['pending', 'eligible', 'delivered'])
				)
			);

		if (existing) continue;

		await db.insert(triggerCandidates).values({
			uid: newUid(),
			kind: 'intent_window',
			subjectKind: 'trace',
			subjectUid: intent.uid,
			proposedAction: 'show_now_cue',
			wording: `Намерение «${intent.hookText}» уже прошло. Оставить след?`,
			evidenceJson: JSON.stringify([{ kind: 'trace', uid: intent.uid }]),
			earliestAt: new Date(aboutMs + INTENT_GRACE_MS).toISOString(),
			expiresAt: new Date(aboutMs + INTENT_LOOKBACK_MS).toISOString(),
			priority: 'quiet',
			status: 'pending',
			ownerUid: 'local-user',
			spaceUid: 'personal',
			createdAt: ts,
			updatedAt: ts
		});
		created += 1;
	}

	return { created };
};

export const applyTriggerPolicy = async (input: {
	anchorAt: string;
	timezone: string;
	policy: InitiationPolicy;
}) => {
	const quiet = isQuietHour(input.anchorAt, input.timezone, input.policy);
	const deliveries = await db.select().from(triggerDeliveries);
	const deliveredToday = parseDeliveryCountToday(deliveries, input.anchorAt);
	const budgetLeft = Math.max(0, input.policy.max_interruptions_per_day - deliveredToday);

	const candidates = await db
		.select()
		.from(triggerCandidates)
		.where(inArray(triggerCandidates.status, ['pending', 'eligible']));

	const ts = nowIso();
	const anchorMs = new Date(input.anchorAt).getTime();
	const eligible: ReturnType<typeof mapTriggerCandidate>[] = [];

	for (const row of candidates) {
		if (row.expiresAt && new Date(row.expiresAt).getTime() < anchorMs) {
			await db
				.update(triggerCandidates)
				.set({ status: 'expired', updatedAt: ts })
				.where(eq(triggerCandidates.uid, row.uid));
			continue;
		}

		if (new Date(row.earliestAt).getTime() > anchorMs) continue;
		if (quiet) continue;
		if (budgetLeft === 0 && row.status !== 'eligible') continue;

		if (row.status !== 'eligible') {
			await db
				.update(triggerCandidates)
				.set({ status: 'eligible', updatedAt: ts })
				.where(eq(triggerCandidates.uid, row.uid));
			row.status = 'eligible';
		}

		eligible.push(mapTriggerCandidate(row));
	}

	return { eligible, quiet, budget_left: budgetLeft };
};

export const listTriggerCandidates = async (status?: string) => {
	const rows = status
		? await db
				.select()
				.from(triggerCandidates)
				.where(eq(triggerCandidates.status, status))
				.orderBy(asc(triggerCandidates.createdAt))
		: await db.select().from(triggerCandidates).orderBy(asc(triggerCandidates.createdAt));

	return rows.map(mapTriggerCandidate);
};
