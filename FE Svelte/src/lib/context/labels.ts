import type { NeighborLinkKind, NeighborReason } from '$lib/model/Neighborhood/types';
import { INTERSECTION_KEYS } from '$lib/context/EntityView/constants';
import type { ExplorerEntity, ExplorerTrace } from '$lib/model/Snapshot/types';
import { formatDay as formatDayIn } from '$lib/state/Locale/format';
import { locale, t } from '$lib/state/Locale/Locale.svelte';
import type { MessageKey } from '$lib/state/Locale/types';
import type { TemporalPrecision, TraceRelation } from '$lib/state/triplit/types';

// Every label reads the language of the moment; a template that shows one follows a switch.
export const RELATIONS: readonly TraceRelation[] = [
	'actual',
	'intend',
	'observe',
	'remember',
	'revisit'
];
export const relationLabel = (relation: TraceRelation): string => t(`relation.${relation}`);

export const precisionLabel = (precision: TemporalPrecision | 'unknown'): string =>
	t(`precision.${precision}`);

const RELATIVE_KEYS: Record<string, MessageKey> = {
	before: 'relative.before',
	after: 'relative.after',
	during: 'relative.during',
	around: 'relative.around'
};

/** Chips of the Overview: kind, relation, basis, precision, certainty (DESIGN.md §8). */
export const traceChips = (trace: ExplorerTrace): string[] => {
	const chips = [trace.aboutKind === 'interval' ? t('chip.interval') : t('chip.moment')];
	if (trace.relation) chips.push(relationLabel(trace.relation));
	if (trace.aboutKind === 'trace_ref') return [...chips, t('chip.traceRef')];
	const time = trace.aboutTime;
	if (!time || time.basis === 'unknown') return [...chips, t('chip.timeUnknown')];
	if (time.basis === 'relative') {
		const relative = RELATIVE_KEYS[time.relation];
		return [
			...chips,
			t('chip.relativeTime'),
			relative ? t(relative) : time.relation,
			precisionLabel(time.precision)
		];
	}
	chips.push(precisionLabel(time.precision));
	chips.push(time.certainty === 'approximate' ? t('chip.approximate') : t('chip.exact'));
	return chips;
};

/** Group heading of a record link seen from the selected record. */
export const linkGroupLabel = (kind: NeighborLinkKind, outgoing: boolean): string => {
	switch (kind) {
		case 'part_of':
			return outgoing ? t('linkGroup.partOfOut') : t('linkGroup.partOfIn');
		case 'evidence_for':
			return outgoing ? t('linkGroup.evidenceOut') : t('linkGroup.evidenceIn');
		case 'revisits':
			return outgoing ? t('linkGroup.revisitsOut') : t('linkGroup.revisitsIn');
		case 'trace_ref':
			return outgoing ? t('linkGroup.refOut') : t('linkGroup.refIn');
		case 'temporal_anchor':
			return outgoing ? t('linkGroup.anchorOut') : t('linkGroup.anchorIn');
		case 'related_to':
			return t('linkGroup.related');
		default:
			return outgoing ? t('linkGroup.otherOut') : t('linkGroup.otherIn');
	}
};

/** `after` says which side of the anchor a distance lies on: later in time, or earlier. */
export const reasonLabel = (
	reason: NeighborReason,
	scopeName: (id: string) => string,
	after = false
): string => {
	switch (reason.kind) {
		case 'link':
			return linkGroupLabel(reason.link, reason.direction === 'outgoing').toLowerCase();
		case 'sameDay':
			return t('reason.sameDay');
		case 'distance':
			return t(after ? 'reason.daysAfter' : 'reason.daysBefore', { count: reason.days });
		case 'sharedScope':
			return reason.scopeIds.map(scopeName).join(', ');
		case 'sharedSource':
			return t('reason.sharedSource');
	}
};

/** A calendar day as the language of the moment writes it. */
export const formatDay = (ms: number): string => formatDayIn(locale.current, ms);

/** A stable key for a reason inside one neighbour, so `{#each}` never keys by index. */
export const reasonKey = (reason: NeighborReason): string => {
	switch (reason.kind) {
		case 'link':
			return `link:${reason.link}:${reason.direction}`;
		case 'distance':
			return `distance:${reason.days}`;
		case 'sharedScope':
			return `scope:${reason.scopeIds.join(',')}`;
		case 'sharedSource':
			return `source:${reason.sourceId}`;
		default:
			return reason.kind;
	}
};

export const entityLabel = (entity: ExplorerEntity): string =>
	entity.role === 'trace'
		? entity.record.content
		: entity.role === 'intersection'
			? t(INTERSECTION_KEYS[entity.record.kind])
			: entity.role === 'scopeSegment'
				? (entity.record.label ?? entity.record.id)
				: entity.record.name;
