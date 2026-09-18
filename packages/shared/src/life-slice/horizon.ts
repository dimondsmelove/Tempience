/** Add years to a calendar date (YYYY-MM-DD) at noon UTC. */
export const horizonDateISO = (birthDate: string, years: number): string => {
	const [y, m, d] = birthDate.split('-').map(Number);
	const dt = new Date(Date.UTC(y + years, m - 1, d, 12, 0, 0));
	return dt.toISOString().slice(0, 10);
};

export const DEFAULT_LIFE_HORIZON_YEARS = 100;
