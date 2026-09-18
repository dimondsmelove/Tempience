import { insertLog } from '../Repository/log';
import { now, requireEntity } from '../Repository/transaction';
import type { RepositoryClient, TraceRepository } from '../Repository/types';
import { createId } from '../ids';
import { buildFieldPatches, logActionForDeleted } from '../operations';
import { assertTimeZone, parsePeriodTime, periodTimeBounds } from '../period-time';
import type { Period, PeriodPatch } from '../types';

const periodFields = ['name', 'time', 'timezone', 'note'] as const;

const periodName = (value: unknown, label = 'Period name'): string => {
	if (typeof value !== 'string' || value.trim().length === 0) {
		throw new Error(`${label} is required`);
	}
	return value.trim();
};

const periodTimezone = (value: unknown, label = 'Period timezone'): string => {
	if (typeof value !== 'string') throw new Error(`${label} must be a string`);
	assertTimeZone(value, label);
	return value;
};

const normalizePeriodNote = (value: unknown): string | null => {
	if (value === null || value === undefined) return null;
	if (typeof value !== 'string') throw new Error('Period note must be a string');
	return value.trim().length > 0 ? value : null;
};

const samePeriodTime = (left: Period['time'], right: Period['time']): boolean =>
	left.precision === right.precision && left.start === right.start && left.end === right.end;

const normalizePeriod = (value: Record<string, unknown>): Period => ({
	id: String(value.id),
	name: periodName(value.name, 'Stored Period name'),
	time: parsePeriodTime(value.time, 'Stored Period time'),
	timezone: periodTimezone(value.timezone, 'Stored Period timezone'),
	note: normalizePeriodNote(value.note),
	isDeleted: Boolean(value.isDeleted),
	createdAt: String(value.createdAt),
	updatedAt: String(value.updatedAt)
});

export const createPeriodRepository = (
	client: RepositoryClient
): Pick<TraceRepository, 'createPeriod' | 'editPeriod' | 'setPeriodDeleted' | 'listPeriods'> => ({
	createPeriod: async (draft, actor = 'user') => {
		const name = periodName(draft.name);
		const time = parsePeriodTime(draft.time);
		const timezone = periodTimezone(draft.timezone);
		periodTimeBounds(time, timezone);
		return client.transact(async (transaction) => {
			const timestamp = now();
			const id = createId();
			const row = {
				id,
				name,
				time,
				timezone,
				note: normalizePeriodNote(draft.note),
				isDeleted: false,
				createdAt: timestamp,
				updatedAt: timestamp
			};
			await transaction.insert('periods', row);
			await insertLog(transaction, {
				operationId: createId(),
				entityType: 'period',
				entityId: id,
				action: 'created',
				patch: { snapshot: row },
				actor
			});
			return normalizePeriod(row);
		});
	},
	editPeriod: async (id, patch, actor = 'user') =>
		client.transact(async (transaction) => {
			const before = normalizePeriod(await requireEntity(transaction, 'periods', id));
			const requested: PeriodPatch = {};
			if (Object.hasOwn(patch, 'name')) requested.name = periodName(patch.name);
			if (Object.hasOwn(patch, 'time')) {
				const time = parsePeriodTime(patch.time);
				requested.time = samePeriodTime(before.time, time) ? before.time : time;
			}
			if (Object.hasOwn(patch, 'timezone')) {
				requested.timezone = periodTimezone(patch.timezone);
			}
			if (Object.hasOwn(patch, 'note')) requested.note = normalizePeriodNote(patch.note);
			const after = { ...before, ...requested, updatedAt: now() };
			periodTimeBounds(after.time, after.timezone);
			const fieldPatches = buildFieldPatches({ ...before }, { ...after }, periodFields);
			if (Object.keys(fieldPatches).length === 0) return before;
			await transaction.update('periods', id, { ...requested, updatedAt: after.updatedAt });
			await insertLog(transaction, {
				operationId: createId(),
				entityType: 'period',
				entityId: id,
				action: 'updated',
				patch: fieldPatches,
				actor
			});
			return after;
		}),
	setPeriodDeleted: async (id, isDeleted, actor = 'user') =>
		client.transact(async (transaction) => {
			const before = await requireEntity(transaction, 'periods', id);
			if (Boolean(before.isDeleted) === isDeleted) return normalizePeriod(before);
			const after = { ...before, isDeleted, updatedAt: now() };
			await transaction.update('periods', id, { isDeleted, updatedAt: after.updatedAt });
			await insertLog(transaction, {
				operationId: createId(),
				entityType: 'period',
				entityId: id,
				action: logActionForDeleted(isDeleted),
				patch: buildFieldPatches(before, after, ['isDeleted']),
				actor,
				cause: isDeleted ? 'normal' : 'restore'
			});
			return normalizePeriod(after);
		}),
	listPeriods: async (includeDeleted = false) => {
		const values = await client.fetch('periods');
		return values
			.map(normalizePeriod)
			.filter((period) => includeDeleted || !period.isDeleted)
			.toSorted((left, right) => {
				const leftBounds = periodTimeBounds(left.time, left.timezone);
				const rightBounds = periodTimeBounds(right.time, right.timezone);
				return (
					leftBounds.start - rightBounds.start ||
					leftBounds.end - rightBounds.end ||
					left.name.localeCompare(right.name) ||
					left.id.localeCompare(right.id)
				);
			});
	}
});
