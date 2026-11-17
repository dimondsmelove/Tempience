import type { LegendKey } from '$lib/model/Legend/types';

export type LegendView = { hiddenLegend: LegendKey[]; soloLegend: LegendKey | null };
