import { describe, expect, it } from 'vitest';
import { writeThenRead } from './write';

describe('a Context command and the reading that follows it', () => {
	it('reports a refused command and never reads after it', async () => {
		let read = 0;
		const outcome = await writeThenRead(
			() => Promise.reject(new Error('Связь не относится к записи.')),
			async () => void read++
		);
		expect(outcome).toEqual({
			written: false,
			refusal: new Error('Связь не относится к записи.'),
			readFailure: null
		});
		expect(read).toBe(0);
	});

	it('keeps an accepted command accepted when its result cannot be read', async () => {
		const outcome = await writeThenRead(
			() => Promise.resolve(),
			() => Promise.reject(new Error('Не удалось прочитать данные.'))
		);
		// The write stands: only the reading is worth offering again.
		expect(outcome.written).toBe(true);
		expect(outcome.refusal).toBeNull();
		expect(outcome.readFailure).toEqual(new Error('Не удалось прочитать данные.'));
	});

	it('reports nothing when both steps succeed', async () => {
		const outcome = await writeThenRead(
			() => Promise.resolve(),
			() => Promise.resolve()
		);
		expect(outcome).toEqual({ written: true, refusal: null, readFailure: null });
	});
});
