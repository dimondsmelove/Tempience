import { deliverTriggerSchema, dismissTriggerSchema } from '@chronograph/shared';
import { Hono } from 'hono';
import { listTriggerCandidates } from '../lib/temporal-runtime/trigger-evaluation';
import {
	deliverTriggerCandidate,
	dismissTriggerCandidate
} from '../lib/temporal-runtime/trigger-delivery';

export const triggerRoutes = new Hono();

triggerRoutes.get('/candidates', async (c) => {
	const status = c.req.query('status') ?? undefined;
	return c.json({ trigger_candidates: await listTriggerCandidates(status) });
});

triggerRoutes.post('/:uid/deliver', async (c) => {
	const uid = c.req.param('uid');
	const body = deliverTriggerSchema.parse(await c.req.json().catch(() => ({})));
	const result = await deliverTriggerCandidate({
		candidateUid: uid,
		channel: body.channel,
		idempotencyKey: body.idempotency_key
	});

	if ('error' in result) return c.json({ error: result.error }, 404);
	return c.json(result);
});

triggerRoutes.post('/:uid/dismiss', async (c) => {
	dismissTriggerSchema.parse(await c.req.json().catch(() => ({})));
	const candidate = await dismissTriggerCandidate(c.req.param('uid'));
	if (!candidate) return c.json({ error: 'Trigger candidate not found or not eligible' }, 404);
	return c.json(candidate);
});
