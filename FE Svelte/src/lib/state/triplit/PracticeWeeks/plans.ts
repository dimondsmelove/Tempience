import { Temporal } from 'temporal-polyfill';
import { CodedError } from '$lib/model/Errors/CodedError';
import { MAX_WEEKLY_MINUTES } from '../PracticeTargets/targets';
import type { PracticeWeekPlan } from './types';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

const isMonday = (value: unknown): value is string => {
	if (typeof value !== 'string' || !DATE.test(value)) return false;
	try {
		const date = Temporal.PlainDate.from(value);
		return date.toString() === value && date.dayOfWeek === 1;
	} catch {
		return false;
	}
};

const fail = (message: string): never => {
	throw new CodedError('practice_week_plan_format', message);
};

export const parsePracticeWeekPlan = (input: unknown): PracticeWeekPlan => {
	if (!input || typeof input !== 'object' || Array.isArray(input))
		return fail('A weekly practice plan is malformed');
	const row = input as Record<string, unknown>;
	if (!isMonday(row.id)) return fail('A weekly practice plan must use an ISO Monday as its ID');
	if (!Array.isArray(row.scopeIds)) return fail('A weekly practice plan must contain Scope IDs');
	const scopeIds = row.scopeIds;
	if (
		scopeIds.some((id) => typeof id !== 'string' || !id || id.trim() !== id) ||
		new Set(scopeIds).size !== scopeIds.length
	)
		return fail('A weekly practice plan contains an invalid or duplicate Scope ID');
	if (!row.goals || typeof row.goals !== 'object' || Array.isArray(row.goals))
		return fail('A weekly practice plan must contain a goal map');
	const goals = row.goals as Record<string, unknown>;
	for (const [scopeId, minutes] of Object.entries(goals)) {
		if (minutes === null) continue;
		if (!scopeIds.includes(scopeId))
			return fail('A weekly practice goal must belong to a selected Scope');
		if (
			typeof minutes !== 'number' ||
			!Number.isInteger(minutes) ||
			minutes < 1 ||
			minutes > MAX_WEEKLY_MINUTES
		)
			return fail('A weekly practice goal must be whole minutes within one week');
	}
	if (typeof row.updatedAt !== 'string' || Number.isNaN(Date.parse(row.updatedAt)))
		return fail('A weekly practice plan has an invalid update time');
	return {
		week: row.id,
		scopeIds: [...scopeIds] as string[],
		goals: Object.fromEntries(
			Object.entries(goals).filter(([, minutes]) => minutes !== null)
		) as Record<string, number>,
		updatedAt: row.updatedAt
	};
};
