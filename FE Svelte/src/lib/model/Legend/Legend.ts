import type { Mark } from '$lib/model/Projection/types';
import { LEGEND_KEYS } from './constants';
import type { LegendFilter, LegendKey } from './types';

/** What the legend reads from a mark; everything else about a mark is geometry. */
export type LegendMarkInput = Pick<
	Mark,
	'kind' | 'intent' | 'rollup' | 'proposal' | 'closed' | 'multi' | 'open' | 'end' | 'until'
>;

/** What the filter reads of a mark beyond its kinds: whether it is the closing result of an intention. */
export type LegendFollowInput = Pick<Mark, 'result'>;

/**
 * The legend kinds a mark answers to (research п. 11–14, 17; the mock's
 * `kindsOf`). One silhouette per mark — proposal, fuzzy intention, intention,
 * fuzzy date, open interval («длится»: `open` and `interval` both), interval,
 * fact — plus the additive kinds: a roll-up, a record in several Scopes,
 * «закрытое намерение» for an intention that is closed now, and «просроченное»
 * for an open intention whose whole window ends before «сейчас». «Намерение»
 * is every intention, open or closed (owner, 2026-09-19, L1): a solo of it
 * keeps the closed ones and hiding it hides them too, while a solo of
 * «закрытое намерение» shows the closed ones alone. An open interval is never
 * overdue: its window reaches «сейчас» by definition.
 */
export const legendKeysOf = (mark: LegendMarkInput, now: number): LegendKey[] => {
	const keys: LegendKey[] = [];
	if (mark.rollup) keys.push('rollup');
	if (mark.multi) keys.push('multi');
	if (mark.proposal) keys.push('proposal');
	else if (mark.intent) {
		if (mark.kind === 'fuzzy') keys.push('fuzzyIntent');
		if (mark.closed) keys.push('closed');
		keys.push('intent');
	} else if (mark.kind === 'fuzzy') keys.push('fuzzy');
	else if (mark.kind === 'interval' && mark.open) keys.push('open', 'interval');
	else if (mark.kind === 'interval') keys.push('interval');
	else keys.push('fact');
	if (mark.intent && !mark.closed && !mark.proposal && (mark.until ?? mark.end) < now)
		keys.push('overdue');
	return keys;
};

/**
 * The kinds a mark follows without being one of them (loop 008, C4): the fact that closed an
 * intention stays with the intentions under a solo of «намерение» or «закрытое намерение»,
 * so the result is read next to what it closed. It is still a fact: hiding «намерение»
 * leaves it, and a solo of «факт» keeps it as any fact.
 */
export const legendFollows = (mark: LegendFollowInput): LegendKey[] =>
	mark.result ? ['intent', 'closed'] : [];

/**
 * Whether a mark with these kinds stays on the ribbon: the solo kind alone while set — a
 * mark that follows it too — else all but the hidden.
 */
export const legendShown = (
	keys: readonly LegendKey[],
	filter: LegendFilter,
	follows: readonly LegendKey[] = []
): boolean =>
	filter.soloLegend
		? keys.includes(filter.soloLegend) || follows.includes(filter.soloLegend)
		: !keys.some((key) => filter.hiddenLegend.has(key));

/**
 * The kinds the legend lists, in its order: those at least one mark of the
 * view answers to, and those hidden or soloed right now, so they can be undone.
 */
export const listedLegendKeys = (
	present: ReadonlySet<LegendKey>,
	filter: LegendFilter
): LegendKey[] =>
	LEGEND_KEYS.filter(
		(key) => present.has(key) || filter.hiddenLegend.has(key) || filter.soloLegend === key
	);
