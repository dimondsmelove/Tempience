import { CodedError } from '$lib/model/Errors/CodedError';
import { parseTheme } from '$lib/theme/normalize';
import type { AppearanceDefaults, Theme } from '$lib/theme/types';
import type { TempienceTriplitClient } from './client';

export function createAppearanceRepository(client: TempienceTriplitClient) {
	return {
		subscribeThemes(
			next: (themes: Theme[], invalid: number) => void,
			fail: (error: unknown) => void
		) {
			return client.subscribe(
				client.query('uiThemes'),
				(rows) => {
					const themes = rows.map((row) => {
						const theme = parseTheme(row.data);
						return theme?.id === row.id && row.id.startsWith('custom:') ? theme : null;
					});
					next(
						themes.filter((theme): theme is Theme => theme !== null),
						themes.filter((theme) => !theme).length
					);
				},
				fail
			);
		},
		subscribeDefaults(
			next: (value: AppearanceDefaults | null) => void,
			fail: (error: unknown) => void
		) {
			return client.subscribe(
				client.query('uiAppearance').Where('id', '=', 'installation'),
				(rows) => {
					const row = rows[0];
					if (!row) {
						next(null);
						return;
					}
					if (row.mode !== 'light' && row.mode !== 'dark' && row.mode !== 'system') {
						fail(
							new CodedError('appearance_format', 'Неизвестный формат общей настройки оформления.')
						);
						return;
					}
					next({ themeId: row.themeId, mode: row.mode });
				},
				fail
			);
		},
		async saveCopy(source: Theme, name: string): Promise<Theme> {
			const theme = parseTheme({ ...source, id: 'custom:' + crypto.randomUUID(), name });
			if (!theme) throw new CodedError('theme_invalid', 'Проверьте название и параметры темы.');
			await client.insert('uiThemes', { id: theme.id, data: theme });
			return theme;
		},
		async setDefaults(value: AppearanceDefaults) {
			if (!['dark', 'light', 'system'].includes(value.mode))
				throw new CodedError('appearance_mode', 'Неизвестный режим оформления.');
			await client.transact(async (tx) => {
				const existing = await tx.fetchById('uiAppearance', 'installation');
				if (existing) await tx.update('uiAppearance', 'installation', value);
				else await tx.insert('uiAppearance', { id: 'installation', ...value });
			});
		},
		async deleteTheme(id: string) {
			if (!id.startsWith('custom:'))
				throw new CodedError('theme_builtin', 'Встроенные темы не удаляются.');
			await client.delete('uiThemes', id);
		}
	};
}
export type AppearanceRepository = ReturnType<typeof createAppearanceRepository>;
