import type { tags, spaceProfiles } from '../db/schema';

type TagRow = typeof tags.$inferSelect;

export const mapTag = (row: TagRow) => ({
	uid: row.uid,
	name: row.name,
	created_at: row.createdAt
});

type SpaceProfileRow = typeof spaceProfiles.$inferSelect;

export const mapSpaceProfile = (row: SpaceProfileRow) => ({
	space_uid: row.spaceUid,
	birth_date: row.birthDate ?? null,
	life_horizon_years: row.lifeHorizonYears,
	timezone: row.timezone,
	owner_uid: row.ownerUid,
	created_at: row.createdAt,
	updated_at: row.updatedAt
});
