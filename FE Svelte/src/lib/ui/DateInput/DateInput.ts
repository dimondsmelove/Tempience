export function localDateValue(date: Date, withTime = false): string {
	const pad = (value: number) => String(value).padStart(2, '0');
	const day = `${String(date.getFullYear()).padStart(4, '0')}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
	return withTime ? `${day}T${pad(date.getHours())}:${pad(date.getMinutes())}` : day;
}

export function calendarDate(value: string): Date | undefined {
	if (!/^\d{4}-\d{2}-\d{2}/.test(value)) return undefined;
	const day = value.slice(0, 10);
	const date = new Date(`${day}T12:00:00`);
	return Number.isFinite(date.getTime()) && localDateValue(date) === day ? date : undefined;
}

export function selectedDateValue(date: Date, previous: string, withTime: boolean): string {
	const day = localDateValue(date);
	return withTime ? `${day}T${previous.slice(11) || '00:00'}` : day;
}
