import { TriplitClient } from '@triplit/client';
import { describe, expect, it } from 'vitest';
import { baseline } from '$lib/theme/catalog';
import { createAppearanceRepository } from './appearance-repository';
import { schema } from './schema';

describe('appearance repository', () => {
	it('stores independent copies and never overwrites their source', async () => {
		const client = new TriplitClient({ schema, autoConnect: false });
		const repo = createAppearanceRepository(client);
		const first = await repo.saveCopy(baseline, 'Первая');
		const second = await repo.saveCopy(
			{ ...first, metrics: { ...first.metrics, controlRadius: 12 } },
			'Вторая'
		);
		expect(first.id).not.toBe(second.id);
		const rows = await client.fetch(client.query('uiThemes'));
		expect(rows).toHaveLength(2);
		expect(
			(rows.find((row) => row.id === first.id)!.data as typeof baseline).metrics.controlRadius
		).toBe(3);
		await repo.setDefaults({ themeId: first.id, mode: 'dark' });
		await repo.setDefaults({ themeId: second.id, mode: 'system' });
		expect((await client.fetchById('uiAppearance', 'installation'))?.themeId).toBe(second.id);
		await expect(repo.deleteTheme('graphite')).rejects.toThrow('Встроенные');
		await repo.deleteTheme(first.id);
		expect(await client.fetch(client.query('uiThemes'))).toHaveLength(1);
	});
	it('does not write an invalid or incompatible theme', async () => {
		const client = new TriplitClient({ schema, autoConnect: false });
		const repo = createAppearanceRepository(client);
		await expect(repo.saveCopy(baseline, '  ')).rejects.toThrow();
		await expect(
			repo.saveCopy({ ...baseline, metrics: { ...baseline.metrics, gap: -1 } }, 'bad')
		).rejects.toThrow();
		expect(await client.fetch(client.query('uiThemes'))).toHaveLength(0);
	});
});
