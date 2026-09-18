import type { LensPresetInfo } from '../schemas/lens';

export const BUILTIN_LENS_PRESETS: LensPresetInfo[] = [
	{
		id: 'atlas-week',
		label: 'Неделя',
		description: 'Следы и нити на видимой неделе (режим Atlas по умолчанию).',
		requires_continuity: false
	},
	{
		id: 'week-traces-only',
		label: 'Только следы',
		description: 'Неделя без полос нитей — плотность следов.',
		requires_continuity: false
	},
	{
		id: 'orient-now',
		label: 'Сейчас',
		description: 'Срез момента: след и активное поле (Inner / Outer).',
		requires_continuity: false
	},
	{
		id: 'thread-recall',
		label: 'Нить целиком',
		description: 'Все фазы и привязанные следы выбранной нити, без ограничения неделей.',
		requires_continuity: true
	}
];
