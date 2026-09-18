import type { NowQuery } from '@chronograph/shared';
import { and, asc, eq, gte, inArray, isNull, lt, or } from 'drizzle-orm';
import { db } from '../../db/client';
import { inquiries, scopePhases, scopes, traces } from '../../db/schema';
import { buildContinuityLanes } from './continuity-projection';
import { buildNowSlice, mapOpenInquiries } from './now-projection';
import { defaultInitiationPolicy } from './policy';
import { applyTriggerPolicy, evaluateTriggerCandidates } from './trigger-evaluation';
import { resolveWeekStart, weekBounds } from './week-minute';
import { nowIso } from '../time';

export const buildNowResponse = async (query: NowQuery & { evaluate: boolean }) => {
	const anchorAt = query.at ?? nowIso();
	const weekStart = resolveWeekStart(anchorAt, query.week_start);
	const policy = defaultInitiationPolicy();
	const { window } = weekBounds(weekStart, query.timezone);

	const traceRows = await db
		.select()
		.from(traces)
		.where(
			and(
				or(
					and(gte(traces.capturedAt, window.from), lt(traces.capturedAt, window.to)),
					and(gte(traces.aboutStart, window.from), lt(traces.aboutStart, window.to)),
					and(gte(traces.aboutAt, window.from), lt(traces.aboutAt, window.to))
				),
				isNull(traces.retractedAt)
			)
		)
		.orderBy(asc(traces.aboutStart), asc(traces.capturedAt));

	const openInquiryRows = await db
		.select()
		.from(inquiries)
		.where(eq(inquiries.status, 'open'))
		.orderBy(asc(inquiries.createdAt));

	let evaluation = { created: 0 };
	if (query.evaluate) {
		evaluation = await evaluateTriggerCandidates({
			anchorAt,
			timezone: query.timezone,
			weekStart,
			policy
		});
	}

	const policyResult = await applyTriggerPolicy({
		anchorAt,
		timezone: query.timezone,
		policy
	});

	const continuityRows = await db
		.select()
		.from(scopes)
		.where(and(eq(scopes.kind, 'continuity'), eq(scopes.status, 'active')))
		.orderBy(asc(scopes.name));

	const continuityUids = continuityRows.map((row) => row.uid);
	const segmentRows =
		continuityUids.length > 0
			? await db
					.select()
					.from(scopePhases)
					.where(inArray(scopePhases.continuityUid, continuityUids))
			: [];

	const lanes = buildContinuityLanes({
		continuities: continuityRows.map((row) => ({
			uid: row.uid,
			name: row.name,
			kind: row.facet ?? 'thread'
		})),
		segments: segmentRows,
		weekStart,
		timezone: query.timezone,
		anchorAt
	});

	const slice = buildNowSlice({ anchorAt, timezone: query.timezone, weekStart, traceRows });

	return {
		now: { ...slice, lanes },
		policy,
		open_inquiries: mapOpenInquiries(openInquiryRows),
		trigger_candidates: policyResult.eligible,
		runtime: {
			quiet: policyResult.quiet,
			budget_left: policyResult.budget_left,
			evaluated: query.evaluate,
			candidates_created: evaluation.created,
			tick_interval_seconds: 60 as const
		}
	};
};
