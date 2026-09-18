import { performance } from 'node:perf_hooks';

/** The process memory in MiB, per kind, at the moment of asking. */
export const memory = (): Record<string, number> =>
	Object.fromEntries(
		Object.entries(process.memoryUsage()).map(([key, value]) => [
			key,
			Math.round(value / 1024 / 1024)
		])
	);

/** The serialized size of what a read answered with: the payload the reader holds. */
export const bytes = (value: unknown): number => Buffer.byteLength(JSON.stringify(value));

export const timed = async <T>(run: () => Promise<T>): Promise<{ value: T; ms: number }> => {
	const started = performance.now();
	const value = await run();
	return { value, ms: Math.round(performance.now() - started) };
};

/** One measured read: how long it took and how much it answered with. */
export type Measured = { ms: number; bytes: number; rows?: number };

export const measured = async (run: () => Promise<unknown>): Promise<Measured> => {
	const { value, ms } = await timed(run);
	return {
		ms,
		bytes: bytes(value),
		...(Array.isArray(value) ? { rows: value.length } : {})
	};
};
