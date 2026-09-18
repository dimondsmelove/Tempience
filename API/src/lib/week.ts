/** ISO date YYYY-MM-DD → Monday of that ISO week. */
export const weekStartISO = (dateISO: string): string => {
	const d = new Date(`${dateISO}T12:00:00.000Z`);
	const day = d.getUTCDay();
	const diff = day === 0 ? -6 : 1 - day;
	d.setUTCDate(d.getUTCDate() + diff);
	return d.toISOString().slice(0, 10);
};

export const addDaysISO = (dateISO: string, days: number): string => {
	const d = new Date(`${dateISO}T12:00:00.000Z`);
	d.setUTCDate(d.getUTCDate() + days);
	return d.toISOString().slice(0, 10);
};

export const weekEndISO = (weekStart: string): string => addDaysISO(weekStart, 6);

/** Inclusive week window as UTC instants for DB filtering. */
export const weekWindowUtc = (weekStart: string): { from: string; to: string } => {
	const from = `${weekStart}T00:00:00.000Z`;
	const end = weekEndISO(weekStart);
	const to = `${addDaysISO(end, 1)}T00:00:00.000Z`;
	return { from, to };
};
