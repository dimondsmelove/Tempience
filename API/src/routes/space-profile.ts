import { updateSpaceProfileSchema } from '@chronograph/shared';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { db } from '../db/client';
import { spaceProfiles } from '../db/schema';
import { mapSpaceProfile } from '../lib/mappers';
import { nowIso } from '../lib/time';

const DEFAULT_SPACE_UID = 'personal';
const DEFAULT_OWNER_UID = 'local-user';
const DEFAULT_TIMEZONE = 'UTC';

export const spaceProfileRoutes = new Hono();

const defaultProfileRow = (ts: string) => ({
	spaceUid: DEFAULT_SPACE_UID,
	birthDate: null,
	lifeHorizonYears: 100,
	timezone: DEFAULT_TIMEZONE,
	ownerUid: DEFAULT_OWNER_UID,
	createdAt: ts,
	updatedAt: ts
});

spaceProfileRoutes.get('/', async (c) => {
	const spaceUid = c.req.query('space_uid') ?? DEFAULT_SPACE_UID;
	const [row] = await db.select().from(spaceProfiles).where(eq(spaceProfiles.spaceUid, spaceUid));

	if (!row) {
		const ts = nowIso();
		return c.json(mapSpaceProfile(defaultProfileRow(ts)));
	}

	return c.json(mapSpaceProfile(row));
});

spaceProfileRoutes.patch('/', async (c) => {
	const body = updateSpaceProfileSchema.parse(await c.req.json());
	const spaceUid = body.space_uid ?? DEFAULT_SPACE_UID;
	const ts = nowIso();

	const [existing] = await db.select().from(spaceProfiles).where(eq(spaceProfiles.spaceUid, spaceUid));

	if (!existing) {
		const row = {
			spaceUid,
			birthDate: body.birth_date ?? null,
			lifeHorizonYears: body.life_horizon_years ?? 100,
			timezone: body.timezone ?? DEFAULT_TIMEZONE,
			ownerUid: body.owner_uid ?? DEFAULT_OWNER_UID,
			createdAt: ts,
			updatedAt: ts
		};
		await db.insert(spaceProfiles).values(row);
		return c.json(mapSpaceProfile(row));
	}

	const updated = {
		...existing,
		birthDate: body.birth_date !== undefined ? body.birth_date : existing.birthDate,
		lifeHorizonYears: body.life_horizon_years ?? existing.lifeHorizonYears,
		timezone: body.timezone ?? existing.timezone,
		updatedAt: ts
	};

	await db.update(spaceProfiles).set(updated).where(eq(spaceProfiles.spaceUid, spaceUid));
	return c.json(mapSpaceProfile(updated));
});
