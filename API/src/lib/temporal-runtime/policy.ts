import type { InitiationPolicy } from '@chronograph/shared';

/** v1 hardcoded policy — not persisted until human confirms notification scope. */
export const defaultInitiationPolicy = (): InitiationPolicy => ({
	require_app_open: true,
	max_interruptions_per_day: 8,
	cooldown_per_subject_minutes: 60,
	quiet_hours_start: '22:00',
	quiet_hours_end: '07:00'
});

const parseHm = (value: string): number => {
	const [h, m] = value.split(':').map(Number);
	return h * 60 + m;
};

/** Local quiet-hours check using IANA timezone when available. */
export const isQuietHour = (anchorAt: string, timezone: string, policy: InitiationPolicy): boolean => {
	try {
		const formatter = new Intl.DateTimeFormat('en-GB', {
			timeZone: timezone,
			hour: '2-digit',
			minute: '2-digit',
			hourCycle: 'h23'
		});
		const parts = formatter.formatToParts(new Date(anchorAt));
		const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
		const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
		const nowMinutes = hour * 60 + minute;
		const start = parseHm(policy.quiet_hours_start);
		const end = parseHm(policy.quiet_hours_end);
		if (start < end) return nowMinutes >= start && nowMinutes < end;
		return nowMinutes >= start || nowMinutes < end;
	} catch {
		return false;
	}
};
