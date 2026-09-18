import { describe, expect, it } from 'vitest';
import type { Intersection } from '$lib/state/triplit/types';
import { KindMembershipsLoader } from './memberships.svelte';

const link = (fromId: string, toId: string): Intersection =>
	({
		id: `${fromId}-${toId}`,
		fromId,
		toId,
		kind: 'belongs_to',
		fromEntityType: 'traceKind',
		isDeleted: false
	}) as unknown as Intersection;

/** A repository whose reads answer when the test says so. */
const controlled = () => {
	const pending: { resolve: (links: Intersection[]) => void; reject: (cause: Error) => void }[] =
		[];
	const repository = {
		listKindMemberships: () =>
			new Promise<Intersection[]>((resolve, reject) => {
				pending.push({ resolve, reject });
			})
	};
	return { pending, repository };
};

describe('KindMembershipsLoader', () => {
	it('only the latest choice may land: a slow read of an earlier Kind is dropped', async () => {
		const { pending, repository } = controlled();
		const loader = new KindMembershipsLoader(repository);
		const first = loader.load('A');
		const second = loader.load('B');
		expect(loader.for('A')).toBeNull();
		expect(loader.for('B')).toBeNull();
		// The read is bounded by the chosen Kind: it answers with that Kind's memberships only.
		pending[1].resolve([link('B', 'scope-b')]);
		await second;
		expect(loader.for('B')).toEqual(['scope-b']);
		// The earlier read answers late with A's memberships; the chosen Kind is B.
		pending[0].resolve([link('A', 'scope-a')]);
		await first;
		expect(loader.for('B')).toEqual(['scope-b']);
		expect(loader.for('A')).toBeNull();
		expect(loader.error).toBeNull();
	});

	it('a refused read is shown for the current Kind and cleared by a retry; a stale refusal is ignored', async () => {
		const { pending, repository } = controlled();
		const loader = new KindMembershipsLoader(repository);
		const failing = loader.load('A');
		pending[0].reject(new Error('Хранилище недоступно.'));
		await failing;
		expect([loader.error, loader.for('A')]).toEqual([
			'Непредвиденная ошибка: Хранилище недоступно.',
			null
		]);
		const retry = loader.load('A');
		expect(loader.error).toBeNull();
		pending[1].resolve([]);
		await retry;
		expect(loader.for('A')).toEqual([]);
		const stale = loader.load('A');
		const fresh = loader.load('B');
		pending[3].resolve([link('B', 'scope-b')]);
		await fresh;
		pending[2].reject(new Error('поздний отказ'));
		await stale;
		expect([loader.error, loader.for('B')]).toEqual([null, ['scope-b']]);
		await loader.load(undefined);
		expect(loader.value).toBeNull();
	});
});
