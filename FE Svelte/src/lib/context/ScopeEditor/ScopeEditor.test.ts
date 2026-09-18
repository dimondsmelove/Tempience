import { TriplitClient } from '@triplit/client';
import { expect, it } from 'vitest';
import { createTriplitRepository } from '$lib/state/triplit/repository';
import { schema } from '$lib/state/triplit/schema';

it('edits name, note and hierarchy together, retaining the previous state if a parent creates a cycle', async () => {
	const client = new TriplitClient({ schema, storage: { type: 'memory' }, autoConnect: false });
	const repo = createTriplitRepository(client);
	try {
		const root = await repo.createScope({ name: 'Здоровье' });
		const child = await repo.createScope({ name: 'Вес', parentScopeId: root.id });
		await expect(
			repo.editScope(root.id, { name: 'Не сохранять', parentScopeId: child.id })
		).rejects.toThrow();
		expect((await repo.listScopes()).find((scope) => scope.id === root.id)?.name).toBe('Здоровье');
		await repo.editScope(child.id, { name: 'Замеры', note: 'По утрам', parentScopeId: null });
		expect((await repo.listScopes()).find((scope) => scope.id === child.id)).toMatchObject({
			name: 'Замеры',
			note: 'По утрам'
		});
	} finally {
		await client.disconnect();
	}
});
