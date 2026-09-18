import { RepositoryError, type RepositoryErrorCode } from '../Repository/errors';
import type { Entity, Transaction } from '../Repository/types';
import type { Trace } from '../types';
import { normalizeTrace } from './read';
import { isIntentionRelation } from './roles';

/**
 * A new supplement is a separate actual Trace that revisits one original: aboutKind
 * `trace_ref` without its own time and without the legacy inline address. Its only anchor
 * is exactly one active `revisits` link. Legacy inline references (aboutTraceId set) and
 * historical generic revisits of ordinary records are outside this rule.
 */
export const isSupplementMarker = (
	trace: Pick<Trace, 'aboutKind' | 'aboutTime' | 'aboutTraceId'>
): boolean =>
	trace.aboutKind === 'trace_ref' && trace.aboutTime === null && trace.aboutTraceId === null;

/** Stored rows decode first: a rewritten time sits in its encoded shape, not as a bare null. */
const isStoredMarker = (row: Entity): boolean => isSupplementMarker(normalizeTrace(row));

/** Active `revisits` links of a Trace as stored rows. */
export const activeRevisitsFrom = (rows: readonly Entity[], traceId: string): Entity[] =>
	rows.filter((row) => row.kind === 'revisits' && row.fromId === traceId && row.isDeleted !== true);

/**
 * Integrity of one active supplement as a pure diagnostic shared by the transaction check,
 * backup validation and a later visible recovery path: `valid` names the one original;
 * `intention` is a marker saved as a plan; `orphan` has no active link; `ambiguous` keeps
 * every recorded link (for example after two offline relinks merged) and names them all so
 * an explicit withdrawal can restore one original; `self` is a recorded pair whose only
 * original is the supplement itself, which the link command never creates and no existing
 * row makes valid; `unavailable` points at a missing row.
 */
export type SupplementState =
	| { status: 'valid'; originalId: string; linkIds: [string] }
	| { status: 'intention'; linkIds: string[] }
	| { status: 'orphan'; linkIds: [] }
	| { status: 'ambiguous'; linkIds: string[]; originalIds: string[] }
	| { status: 'self'; originalId: string; linkIds: [string] }
	| { status: 'unavailable'; originalId: string; linkIds: [string] };

export const supplementState = (
	supplementId: string,
	relation: unknown,
	activeLinks: readonly Entity[],
	originalExists: (id: string) => boolean
): SupplementState => {
	const linkIds = activeLinks.map((link) => String(link.id));
	if (isIntentionRelation(relation)) return { status: 'intention', linkIds };
	if (activeLinks.length === 0) return { status: 'orphan', linkIds: [] };
	if (activeLinks.length > 1) {
		return { status: 'ambiguous', linkIds, originalIds: activeLinks.map((l) => String(l.toId)) };
	}
	const originalId = String(activeLinks[0].toId);
	if (originalId === supplementId) return { status: 'self', originalId, linkIds: [linkIds[0]] };
	return originalExists(originalId)
		? { status: 'valid', originalId, linkIds: [linkIds[0]] }
		: { status: 'unavailable', originalId, linkIds: [linkIds[0]] };
};

const refusals: Record<
	Exclude<SupplementState['status'], 'valid'>,
	[RepositoryErrorCode, string]
> = {
	intention: ['supplement_relation', 'Дополнение — состоявшаяся запись, а не намерение.'],
	orphan: ['supplement_orphan', 'Дополнение должно относиться к одной существующей записи.'],
	ambiguous: ['supplement_cardinality', 'У дополнения может быть только один оригинал.'],
	self: ['supplement_self', 'Дополнение не может относиться к самому себе.'],
	unavailable: ['supplement_orphan', 'Оригинал дополнения недоступен.']
};

/**
 * Cross-record rule for one persisted state: an ACTIVE supplement is a completed record,
 * never an intention, with exactly one active revisits link whose original exists (deleted
 * originals stay valid anchors). Commands check it after their writes so a transaction's
 * intermediate state is never judged.
 */
export const assertSupplementIntegrity = async (
	transaction: Transaction,
	traceId: string
): Promise<void> => {
	const trace = await transaction.fetchById('traces', traceId);
	if (!trace || trace.isDeleted === true || !isStoredMarker(trace)) return;
	const links = activeRevisitsFrom(await transaction.fetch('intersections'), traceId);
	const originals = new Map<string, boolean>();
	for (const link of links) {
		const id = String(link.toId);
		originals.set(id, (await transaction.fetchById('traces', id)) != null);
	}
	const state = supplementState(traceId, trace.relation, links, (id) => originals.get(id) === true);
	if (state.status === 'valid') return;
	const [code, message] = refusals[state.status];
	throw new RepositoryError(code, message, { traceId, reason: state.status, ...state });
};

/** Whether a Trace row is an active supplement marker whose links are governed by the rule above. */
export const isActiveStoredSupplement = async (
	transaction: Transaction,
	traceId: string
): Promise<boolean> => {
	const trace = await transaction.fetchById('traces', traceId);
	return !!trace && trace.isDeleted !== true && isStoredMarker(trace);
};
