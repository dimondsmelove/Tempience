import {
	lifeMapDensityQuerySchema,
	lifeMapProfileQuerySchema,
	lifeMapQuerySchema
} from "@chronograph/shared";
import { Hono } from "hono";
import { buildLifeMapDensity } from "../lib/life-map/build-life-map-density";
import { buildLifeMapProjection } from "../lib/life-map/build-life-map-projection";
import { LifeMapProfileMissingError } from "../lib/life-map/errors";
import { buildLifeMapProfile } from "../lib/life-map/build-life-map-profile";

export const lifeMapRoutes = new Hono();

lifeMapRoutes.get("/profile", async (c) => {
	const query = lifeMapProfileQuerySchema.parse({
		space_uid: c.req.query("space_uid") ?? undefined
	});

	try {
		const profile = await buildLifeMapProfile(query.space_uid);
		return c.json(profile);
	} catch (err) {
		if (err instanceof LifeMapProfileMissingError) {
			return c.json({ error: err.message }, 400);
		}
		throw err;
	}
});

lifeMapRoutes.get("/density", async (c) => {
	const query = lifeMapDensityQuerySchema.parse({
		from: c.req.query("from") ?? undefined,
		to: c.req.query("to") ?? undefined,
		space_uid: c.req.query("space_uid") ?? undefined,
		resolution: c.req.query("resolution") ?? undefined,
		layer: c.req.query("layer") ?? undefined,
		scope_kind: c.req.query("scope_kind") ?? undefined,
		scope_uid: c.req.query("scope_uid") ?? undefined,
		scope_include_future: c.req.query("scope_include_future") ?? undefined
	});

	try {
		const density = await buildLifeMapDensity(query);
		return c.json(density);
	} catch (err) {
		if (err instanceof LifeMapProfileMissingError) {
			return c.json({ error: err.message }, 400);
		}
		throw err;
	}
});

lifeMapRoutes.get("/", async (c) => {
	const query = lifeMapQuerySchema.parse({
		from: c.req.query("from") ?? undefined,
		to: c.req.query("to") ?? undefined,
		space_uid: c.req.query("space_uid") ?? undefined
	});

	try {
		const projection = await buildLifeMapProjection({
			spaceUid: query.space_uid,
			from: query.from,
			to: query.to
		});
		return c.json(projection);
	} catch (err) {
		if (err instanceof LifeMapProfileMissingError) {
			return c.json({ error: err.message }, 400);
		}
		throw err;
	}
});
