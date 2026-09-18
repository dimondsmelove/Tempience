import { describe, expect, it } from 'vitest';
import { RepositoryError } from '../Repository/errors';
import type { Log } from '../types';
import { planInverse } from './plan';

const log = (patch: Partial<Log> & Pick<Log, 'entityType' | 'entityId' | 'action'>): Log => ({
	id: `log:${patch.entityId}:${patch.action}`,
	operationId: 'op',
	patch: {},
	occurredAt: '2026-09-13T10:00:00.000Z',
	deviceId: 'device',
	actor: 'user',
	cause: 'normal',
	...patch
});

const code = (run: () => unknown): string => {
	try {
		run();
		return 'planned';
	} catch (error) {
		return error instanceof RepositoryError ? error.code : String(error);
	}
};

describe('planInverse', () => {
	it('reads the owned consequences of one operation from its journal', () => {
		const plan = planInverse(
			[
				log({
					entityType: 'trace',
					entityId: 't',
					action: 'updated',
					patch: {
						content: { before: 'A', after: 'B' },
						aboutStart: { before: '2026-09-10', after: null },
						aboutTime: { before: { basis: 'absolute' }, after: { basis: 'unknown' } }
					}
				}),
				log({
					entityType: 'intersection',
					entityId: 'l1',
					action: 'deleted',
					patch: { isDeleted: { before: false, after: true } }
				}),
				log({
					entityType: 'intersection',
					entityId: 'l2',
					action: 'linked',
					patch: { snapshot: { activationId: 'act', kind: 'evidence_for' } } as never
				}),
				log({
					entityType: 'intentionAssessment',
					entityId: 's',
					action: 'updated',
					patch: {
						intentionId: { before: 'a', after: 'b' },
						evidenceId: { before: 'l1', after: 'l2' },
						activationId: { before: 'old', after: 'act' },
						outcome: { before: 'partial', after: 'completed' },
						outcomeRevision: { before: 'first', after: 'op' }
					}
				}),
				log({
					entityType: 'intentionAssessment',
					entityId: 'd',
					action: 'deleted',
					patch: { isDeleted: { before: false, after: true } }
				}),
				// A revival that restates a value under its own revision, without changing it.
				log({
					entityType: 'intentionAssessment',
					entityId: 'r',
					action: 'restored',
					patch: {
						isDeleted: { before: true, after: false },
						lifecycleId: { before: 'w', after: 'op' },
						openRevision: { before: 'e', after: 'op' }
					}
				}),
				log({ entityType: 'scope', entityId: 'sc', action: 'deleted', patch: {} }),
				// A membership hidden by this Scope deletion belongs to the Scope step.
				log({
					entityType: 'intersection',
					entityId: 'm',
					action: 'deleted',
					patch: { scopeDeletionOperationId: { before: null, after: 'op' } }
				}),
				log({ entityType: 'trace', entityId: 'other', action: 'updated', operationId: 'another' })
			],
			'op'
		);
		expect(plan.operationId).toBe('op');
		expect(plan.steps).toEqual([
			{
				kind: 'trace.fields',
				traceId: 't',
				fields: {
					content: { before: 'A', after: 'B' },
					aboutTime: { before: { basis: 'absolute' }, after: { basis: 'unknown' } }
				}
			},
			{ kind: 'link.lifecycle', linkId: 'l1', deleted: true },
			{ kind: 'link.created', linkId: 'l2', activationId: 'act', linkKind: 'evidence_for' },
			{
				kind: 'assessment.placement',
				assessmentId: 's',
				before: { intentionId: 'a', evidenceId: 'l1', activationId: 'old' },
				after: { intentionId: 'b', evidenceId: 'l2', activationId: 'act' }
			},
			{
				kind: 'assessment.values',
				assessmentId: 's',
				features: { outcome: { before: 'partial', after: 'completed', ownerBefore: 'first' } },
				restated: []
			},
			{ kind: 'assessment.lifecycle', assessmentId: 'd', deleted: true },
			{ kind: 'assessment.lifecycle', assessmentId: 'r', deleted: false },
			{
				kind: 'assessment.values',
				assessmentId: 'r',
				features: {},
				restated: [{ feature: 'open', ownerBefore: 'e' }]
			},
			{ kind: 'scope.lifecycle', scopeId: 'sc' }
		]);
	});

	it('withdraws a newly created evidence link only as the return of a transferred source', () => {
		const linked = (id: string, kind: string) =>
			log({
				entityType: 'intersection',
				entityId: id,
				action: 'linked',
				patch: { snapshot: { activationId: `${id}:act`, kind } } as never
			});
		// Non-evidence relations and memberships are withdrawn back as before.
		expect(planInverse([linked('r', 'related_to'), linked('m', 'belongs_to')], 'op').steps).toEqual(
			[
				{ kind: 'link.created', linkId: 'r', activationId: 'r:act', linkKind: 'related_to' },
				{ kind: 'link.created', linkId: 'm', activationId: 'm:act', linkKind: 'belongs_to' }
			]
		);
		// A new evidence link, assessed or not, is not withdrawn by an inverse: a first assessment
		// or correction of another replica may still be on its way to it.
		let refused: unknown;
		try {
			planInverse([linked('e', 'evidence_for')], 'op');
		} catch (error) {
			refused = error;
		}
		expect(refused).toMatchObject({
			code: 'undo_unsupported',
			details: { entityId: 'e', reason: 'evidence_link' }
		});
		expect(
			code(() =>
				planInverse(
					[
						linked('e', 'evidence_for'),
						log({ entityType: 'intentionAssessment', entityId: 's', action: 'created' })
					],
					'op'
				)
			)
		).toBe('undo_unsupported');
		// The transferred source returning from that link makes the withdrawal the accepted return.
		const placement = log({
			entityType: 'intentionAssessment',
			entityId: 's',
			action: 'updated',
			patch: {
				intentionId: { before: 'a', after: 'b' },
				evidenceId: { before: 'old', after: 'e' },
				activationId: { before: 'old:act', after: 'e:act' }
			}
		});
		expect(
			planInverse([linked('e', 'evidence_for'), placement], 'op').steps.map((s) => s.kind)
		).toEqual(['link.created', 'assessment.placement']);
		// A link restore is not withdrawn again through an inverse.
		expect(
			code(() =>
				planInverse([log({ entityType: 'intersection', entityId: 'l', action: 'restored' })], 'op')
			)
		).toBe('undo_unsupported');
	});

	it('refuses unknown operations and every unsupported or already compensating entry whole', () => {
		expect(code(() => planInverse([], 'op'))).toBe('undo_unknown');
		expect(
			code(() =>
				planInverse([log({ entityType: 'trace', entityId: 't', action: 'created' })], 'op')
			)
		).toBe('undo_unsupported');
		expect(
			code(() =>
				planInverse([log({ entityType: 'period', entityId: 'p', action: 'deleted' })], 'op')
			)
		).toBe('undo_unsupported');
		expect(
			code(() =>
				planInverse([log({ entityType: 'scope', entityId: 's', action: 'restored' })], 'op')
			)
		).toBe('undo_unsupported');
		expect(
			code(() =>
				planInverse(
					[log({ entityType: 'trace', entityId: 't', action: 'deleted', cause: 'undo' })],
					'op'
				)
			)
		).toBe('undo_unsupported');
		expect(
			code(() =>
				planInverse(
					[log({ entityType: 'trace', entityId: 't', action: 'restored', cause: 'restore' })],
					'op'
				)
			)
		).toBe('undo_unsupported');
		expect(
			code(() =>
				planInverse(
					[
						log({
							entityType: 'trace',
							entityId: 't',
							action: 'updated',
							patch: { kindId: { before: null, after: 'k' } }
						})
					],
					'op'
				)
			)
		).toBe('undo_unsupported');
		// A correction journaled without its revision (older journal) cannot name the previous owner.
		expect(
			code(() =>
				planInverse(
					[
						log({
							entityType: 'intentionAssessment',
							entityId: 's',
							action: 'updated',
							patch: { outcome: { before: 'partial', after: 'completed' } }
						})
					],
					'op'
				)
			)
		).toBe('undo_unsupported');
	});
});
