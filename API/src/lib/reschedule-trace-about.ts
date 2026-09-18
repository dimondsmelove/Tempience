import type { RescheduleTraceAboutInput } from '@chronograph/shared';
import { rescheduleTraceAboutSchema } from '@chronograph/shared';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { traces } from '../db/schema';
import { mapTrace } from './temporal-mappers';

export class RescheduleTraceAboutError extends Error {
	constructor(
		message: string,
		readonly status: 400 | 404 = 400
	) {
		super(message);
	}
}

export const rescheduleTraceAbout = async (uid: string, input: unknown) => {
	const body: RescheduleTraceAboutInput = rescheduleTraceAboutSchema.parse(input);

	const [row] = await db.select().from(traces).where(eq(traces.uid, uid));
	if (!row) throw new RescheduleTraceAboutError('Trace not found', 404);
	if (row.retractedAt) throw new RescheduleTraceAboutError('Trace is retracted');
	if (row.relation !== 'intend') {
		throw new RescheduleTraceAboutError('Only intent traces can be rescheduled');
	}

	await db
		.update(traces)
		.set({
			aboutKind: 'interval',
			aboutAt: null,
			aboutStart: body.about_start,
			aboutEnd: body.about_end
		})
		.where(eq(traces.uid, uid));

	const [updated] = await db.select().from(traces).where(eq(traces.uid, uid));
	return mapTrace(updated!);
};
