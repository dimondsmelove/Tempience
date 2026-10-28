import type { PracticeActivity, PracticePeriod } from './types';

export const DEMO_TODAY = '2026-10-28';
export const DEMO_START = '2026-09-07';
export const DEMO_KIND_ID = 'demo-invested-time';
export const DEMO_BASE_SCOPE = 'demo-practice';
export const PRACTICE_PERIODS: readonly PracticePeriod[] = ['day', 'week', 'month'];

// Fixture names are authored data, like the Scope and Kind names in the real application.
export const DEMO_ACTIVITIES = [
	{
		id: 'development',
		name: 'Разработка',
		weeklyMinutes: 720,
		note: 'Работа над проектом',
		colour: { hue: 210, chroma: 80 }
	},
	{
		id: 'clients',
		name: 'Поиск клиентов',
		weeklyMinutes: 240,
		note: 'Контакты и предложения',
		colour: { hue: 60, chroma: 80 }
	},
	{ id: 'job', name: 'Поиск работы', weeklyMinutes: 180, note: 'Вакансии и отклики', colour: null },
	{
		id: 'linkedin',
		name: 'Продвижение · LinkedIn',
		weeklyMinutes: 120,
		note: 'Публикация и общение',
		colour: null
	},
	{
		id: 'serbian',
		name: 'Сербский',
		weeklyMinutes: 120,
		note: 'Грамматика и разговорная практика',
		colour: { hue: 300, chroma: 75 }
	},
	{
		id: 'english',
		name: 'Английский',
		weeklyMinutes: 120,
		note: 'Чтение и разговорная практика',
		colour: { hue: 150, chroma: 80 }
	}
] satisfies readonly PracticeActivity[];
