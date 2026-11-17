import { LEGEND_KEYS } from '$lib/model/Legend/constants';
import type { LegendKey } from '$lib/model/Legend/types';
import type { TempienceTriplitClient } from '../client';
import { fetchReplica } from '../replica-fetch';
import type { LegendView } from './types';

const ID = 'legend';
const isKey = (value: unknown): value is LegendKey =>
	typeof value === 'string' && (LEGEND_KEYS as readonly string[]).includes(value);
const normalize = (row?: { hiddenLegend: unknown; soloLegend: unknown }): LegendView => ({
	hiddenLegend: Array.isArray(row?.hiddenLegend)
		? [...new Set(row.hiddenLegend.filter(isKey))]
		: [],
	soloLegend: isKey(row?.soloLegend) ? row.soloLegend : null
});

export function createLegendViewRepository(client: TempienceTriplitClient) {
	const query = () => client.query('legendView').Id(ID);
	return {
		subscribeLegendView(next: (view: LegendView) => void, fail: (error: unknown) => void) {
			return client.subscribe(query(), (rows) => next(normalize(rows[0])), fail);
		},
		async getLegendView(): Promise<LegendView> {
			return normalize((await fetchReplica(client, query()))[0]);
		},
		async setLegendView(view: LegendView): Promise<void> {
			const normalized = normalize(view);
			const values = { ...normalized, soloLegend: normalized.soloLegend ?? '' };
			await client.transact(async (tx) => {
				if (await tx.fetchById('legendView', ID)) await tx.update('legendView', ID, values);
				else await tx.insert('legendView', { id: ID, ...values });
			});
		}
	};
}
export type LegendViewRepository = ReturnType<typeof createLegendViewRepository>;
