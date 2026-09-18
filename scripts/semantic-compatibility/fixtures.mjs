const captured = '2026-08-17T00:00:00.000Z';

const scope = (id, name) => ({
	id,
	name,
	parentScopeId: null,
	startedAt: null,
	endedAt: null,
	isDeleted: false,
	createdAt: captured,
	updatedAt: captured
});

const trace = (value) => ({
	timezone: 'Europe/Moscow',
	aboutAt: null,
	aboutStart: null,
	aboutEnd: null,
	aboutTraceId: null,
	relation: null,
	data: null,
	isDeleted: false,
	createdAt: value.capturedAt,
	updatedAt: value.capturedAt,
	...value
});

const intersection = (id, fromId, toId, kind = 'belongs_to') => ({
	id,
	fromId,
	toId,
	kind,
	context: null,
	isDeleted: false,
	createdAt: captured,
	updatedAt: captured
});

const fixture = (value) => ({ logs: [], ...value });

export const fixtures = [
	fixture({
		id: 'short-decision',
		title: 'Five-minute decision on a project fork',
		scopes: [scope('10000000-0000-4000-8000-000000000001', 'Semantic experiment')],
		traces: [
			trace({
				id: '11000000-0000-4000-8000-000000000001',
				capturedAt: '2026-08-17T09:55:00.000Z',
				aboutKind: 'instant',
				aboutAt: '2026-08-17T09:55:00.000Z',
				content: 'Direction B has lower migration risk.',
				relation: 'remember'
			}),
			trace({
				id: '11000000-0000-4000-8000-000000000002',
				capturedAt: '2026-08-17T10:05:00.000Z',
				aboutKind: 'interval',
				aboutStart: '2026-08-17T10:00:00.000Z',
				aboutEnd: '2026-08-17T10:05:00.000Z',
				content: 'Selected direction B.',
				relation: 'actual',
				data: {
					semantic: {
						usedTraceIds: ['11000000-0000-4000-8000-000000000001'],
						result: {
							summary: 'Direction B selected',
							stateChanges: [
								{ dimension: 'direction', before: 'undecided', after: 'direction-b' }
							],
							affordances: ['implement-direction-b']
						}
					}
				}
			})
		],
		intersections: [
			intersection(
				'12000000-0000-4000-8000-000000000001',
				'11000000-0000-4000-8000-000000000002',
				'10000000-0000-4000-8000-000000000001'
			)
		],
		expect: {
			xapiStatements: 1,
			xapiFeatures: ['duration', 'scope-context', 'structured-result', 'input-reference'],
			provFeatures: ['activity-record-separation', 'result-generation', 'input-use']
		}
	}),
	fixture({
		id: 'english-practice',
		title: 'Thirty minutes of English practice',
		scopes: [scope('20000000-0000-4000-8000-000000000001', 'English')],
		traces: [
			trace({
				id: '21000000-0000-4000-8000-000000000001',
				capturedAt: '2026-08-17T11:30:00.000Z',
				aboutKind: 'interval',
				aboutStart: '2026-08-17T11:00:00.000Z',
				aboutEnd: '2026-08-17T11:30:00.000Z',
				content: 'Practised English conversation.',
				relation: 'actual'
			})
		],
		intersections: [
			intersection(
				'22000000-0000-4000-8000-000000000001',
				'21000000-0000-4000-8000-000000000001',
				'20000000-0000-4000-8000-000000000001'
			)
		],
		expect: {
			xapiStatements: 1,
			xapiFeatures: ['duration', 'scope-context'],
			provFeatures: ['activity-record-separation'],
			issues: ['actual-has-no-recorded-result']
		}
	}),
	fixture({
		id: 'several-iterations',
		title: 'Several iterations across Scopes inside one hour',
		scopes: [
			scope('30000000-0000-4000-8000-000000000001', 'Tempience'),
			scope('30000000-0000-4000-8000-000000000002', 'English')
		],
		traces: [
			trace({
				id: '31000000-0000-4000-8000-000000000001',
				capturedAt: '2026-08-17T12:10:00.000Z',
				aboutKind: 'interval',
				aboutStart: '2026-08-17T12:00:00.000Z',
				aboutEnd: '2026-08-17T12:10:00.000Z',
				content: 'Chose the projection boundary.',
				relation: 'actual'
			}),
			trace({
				id: '31000000-0000-4000-8000-000000000002',
				capturedAt: '2026-08-17T12:30:00.000Z',
				aboutKind: 'interval',
				aboutStart: '2026-08-17T12:10:00.000Z',
				aboutEnd: '2026-08-17T12:30:00.000Z',
				content: 'Reviewed English vocabulary.',
				relation: 'actual'
			}),
			trace({
				id: '31000000-0000-4000-8000-000000000003',
				capturedAt: '2026-08-17T13:00:00.000Z',
				aboutKind: 'interval',
				aboutStart: '2026-08-17T12:30:00.000Z',
				aboutEnd: '2026-08-17T13:00:00.000Z',
				content: 'Implemented the first projector.',
				relation: 'actual'
			})
		],
		intersections: [
			intersection('32000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001'),
			intersection('32000000-0000-4000-8000-000000000002', '31000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002'),
			intersection('32000000-0000-4000-8000-000000000003', '31000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000001')
		],
		expect: {
			xapiStatements: 3,
			xapiFeatures: ['iteration-cardinality', 'duration', 'scope-context'],
			provFeatures: ['iteration-cardinality', 'activity-record-separation']
		}
	}),
	fixture({
		id: 'weekly-intent',
		title: 'Weekly ten-hour intent',
		scopes: [scope('40000000-0000-4000-8000-000000000001', 'Tempience')],
		traces: [
			trace({
				id: '41000000-0000-4000-8000-000000000001',
				capturedAt: '2026-08-17T08:00:00.000Z',
				aboutKind: 'interval',
				aboutStart: '2026-08-17T00:00:00.000Z',
				aboutEnd: '2026-08-24T00:00:00.000Z',
				content: 'Allocate ten hours to Tempience this week.',
				relation: 'intend',
				data: { ledger: { kind: 'weekly_budget', targetMinutes: 600 } }
			})
		],
		intersections: [
			intersection('42000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001')
		],
		expect: {
			xapiStatements: 1,
			xapiFeatures: ['intent', 'weekly-budget', 'scope-context'],
			provFeatures: ['intent', 'weekly-budget']
		}
	}),
	fixture({
		id: 'actual-evidence',
		title: 'Actual Trace connected to an intent through evidence_for',
		scopes: [scope('50000000-0000-4000-8000-000000000001', 'Tempience')],
		traces: [
			trace({
				id: '51000000-0000-4000-8000-000000000001',
				capturedAt: '2026-08-17T13:00:00.000Z',
				aboutKind: 'interval',
				aboutStart: '2026-08-17T14:00:00.000Z',
				aboutEnd: '2026-08-17T15:00:00.000Z',
				content: 'Implement a compatibility fixture.',
				relation: 'intend'
			}),
			trace({
				id: '51000000-0000-4000-8000-000000000002',
				capturedAt: '2026-08-17T15:00:00.000Z',
				aboutKind: 'interval',
				aboutStart: '2026-08-17T14:05:00.000Z',
				aboutEnd: '2026-08-17T14:50:00.000Z',
				content: 'Implemented the compatibility fixture.',
				relation: 'actual'
			})
		],
		intersections: [
			intersection('52000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001'),
			intersection('52000000-0000-4000-8000-000000000002', '51000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000001'),
			intersection('52000000-0000-4000-8000-000000000003', '51000000-0000-4000-8000-000000000002', '51000000-0000-4000-8000-000000000001', 'evidence_for')
		],
		expect: {
			xapiStatements: 2,
			xapiFeatures: ['intent', 'evidence-reference', 'duration'],
			provFeatures: ['intent', 'evidence-reference', 'activity-record-separation']
		}
	}),
	fixture({
		id: 'corrected-record',
		title: 'Correction of an earlier record',
		scopes: [scope('60000000-0000-4000-8000-000000000001', 'Semantic experiment')],
		traces: [
			trace({
				id: '61000000-0000-4000-8000-000000000001',
				capturedAt: '2026-08-17T16:05:00.000Z',
				aboutKind: 'interval',
				aboutStart: '2026-08-17T16:00:00.000Z',
				aboutEnd: '2026-08-17T16:05:00.000Z',
				content: 'Selected direction C.',
				relation: 'actual',
				updatedAt: '2026-08-17T16:10:00.000Z'
			})
		],
		intersections: [
			intersection('62000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001')
		],
		logs: [
			{
				id: '63000000-0000-4000-8000-000000000001',
				operationId: '64000000-0000-4000-8000-000000000001',
				entityType: 'trace',
				entityId: '61000000-0000-4000-8000-000000000001',
				action: 'updated',
				patch: { content: { before: 'Selected direction B.', after: 'Selected direction C.' } },
				occurredAt: '2026-08-17T16:10:00.000Z',
				deviceId: 'device-fixture',
				actor: 'user',
				cause: 'normal'
			}
		],
		expect: {
			xapiStatements: 3,
			xapiFeatures: ['correction-void-reissue'],
			provFeatures: ['correction-lineage'],
			issues: ['correction-strategy-is-experimental']
		}
	}),
	fixture({
		id: 'felt-state',
		title: 'Activity with before/after felt-state observations',
		scopes: [scope('70000000-0000-4000-8000-000000000001', 'Recovery')],
		traces: [
			trace({
				id: '71000000-0000-4000-8000-000000000001',
				capturedAt: '2026-08-17T17:20:00.000Z',
				aboutKind: 'interval',
				aboutStart: '2026-08-17T17:00:00.000Z',
				aboutEnd: '2026-08-17T17:20:00.000Z',
				content: 'Took a walk.',
				relation: 'actual',
				data: {
					semantic: {
						observations: [
							{
								phase: 'before',
								capturedAt: '2026-08-17T16:59:00.000Z',
								dimensions: { valence: -0.4, arousal: 0.8 },
								provenance: 'self_report',
								confidence: 0.8
							},
							{
								phase: 'after',
								capturedAt: '2026-08-17T17:21:00.000Z',
								dimensions: { valence: 0.3, arousal: 0.4 },
								provenance: 'self_report',
								confidence: 0.8
							}
						]
					}
				}
			})
		],
		intersections: [
			intersection('72000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000001')
		],
		expect: {
			xapiStatements: 1,
			xapiFeatures: ['state-observations', 'duration'],
			provFeatures: ['state-observations', 'activity-record-separation'],
			issues: ['state-vocabulary-and-privacy-are-open']
		}
	})
];
