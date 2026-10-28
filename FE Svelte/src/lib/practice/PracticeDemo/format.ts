import type { Locale } from '$lib/state/Locale/types';
import { formatTraceDuration } from '$lib/state/triplit/trace-duration';

export const minutesLabel = (minutes: number, language: Locale): string =>
	formatTraceDuration({ amount: minutes, unit: 'minute' }, language);

export const dateLabel = (
	date: string,
	language: Locale,
	options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
): string =>
	new Intl.DateTimeFormat(language, { ...options, timeZone: 'UTC' }).format(
		new Date(`${date}T12:00:00Z`)
	);
