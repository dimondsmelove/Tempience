import type { HoverTarget } from '$lib/model/Hover/types';
import { periodRecordRef } from '$lib/model/PeriodContext/PeriodContext';
import type { ExplorerEntity } from '$lib/model/Snapshot/types';

/**
 * What a named entity lights on the ribbon (loop 008, C3): the record, the Scope's records,
 * a link's ends, a period's time; nothing for the rest.
 */
export const entityLens = (entity: ExplorerEntity): HoverTarget => {
	switch (entity.role) {
		case 'trace':
			return { kind: 'trace', traceId: entity.record.id };
		case 'scope':
			return { kind: 'scope', scopeId: entity.record.id };
		case 'intersection':
			return { kind: 'traces', traceIds: [entity.record.fromId, entity.record.toId] };
		case 'period': {
			const period = periodRecordRef(entity.record);
			return period ? { kind: 'period', period } : null;
		}
		default:
			return null;
	}
};
