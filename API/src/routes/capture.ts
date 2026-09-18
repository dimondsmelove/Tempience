import { captureMomentSchema } from "@chronograph/shared";
import { Hono } from "hono";
import { captureMoment } from "../lib/capture/capture-moment";
import { materializeCooccurrenceForTrace } from "../lib/search/materialize-cooccurrence";

export const captureRoutes = new Hono();

captureRoutes.post("/moment", async (c) => {
	const body = captureMomentSchema.parse(await c.req.json());
	try {
		// const result = captureMoment(body);
		await materializeCooccurrenceForTrace(result.trace.uid);
		return c.json(result, 201);
	} catch (err) {
		const message = err instanceof Error ? err.message : "Capture failed";
		if (message.startsWith("Continuity not found")) {
			return c.json({ error: message }, 404);
		}
		throw err;
	}
});
