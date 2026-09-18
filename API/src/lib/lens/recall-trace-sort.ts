import type { Trace } from '@chronograph/shared';

const traceSortKey = (trace: Trace): number => {
	const iso = trace.about_at ?? trace.about_start ?? trace.captured_at;
	return new Date(iso).getTime();
};

export const sortRecallTraces = (traces: Trace[]): Trace[] =>
	[...traces].sort((a, b) => traceSortKey(a) - traceSortKey(b));
