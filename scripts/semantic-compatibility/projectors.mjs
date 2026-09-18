const BASE = 'https://tempience.app/semantic-compatibility/v1';
const PROV = 'http://www.w3.org/ns/prov#';

export const vocabulary = {
	xapi: {
		verbs: {
			iterated: `${BASE}/verbs/iterated`,
			planned: `${BASE}/verbs/planned`,
			intended: `${BASE}/verbs/intended`
		},
		extensions: {
			sourceTraceId: `${BASE}/extensions/source-trace-id`,
			sourceTraceContent: `${BASE}/extensions/source-trace-content`,
			capturedAt: `${BASE}/extensions/captured-at`,
			projectionVersion: `${BASE}/extensions/projection-version`,
			resultState: `${BASE}/extensions/result-state`,
			usedTraceIds: `${BASE}/extensions/used-trace-ids`,
			stateObservations: `${BASE}/extensions/state-observations`,
			weeklyTargetMinutes: `${BASE}/extensions/weekly-target-minutes`,
			correctionOf: `${BASE}/extensions/correction-of`
		}
	},
	prov: {
		records: `${BASE}/vocab/records`,
		describesPlan: `${BASE}/vocab/describes-plan`,
		scope: `${BASE}/vocab/scope`,
		evidenceFor: `${BASE}/vocab/evidence-for`,
		affordance: `${BASE}/vocab/affordance`,
		weeklyTargetMinutes: `${BASE}/vocab/weekly-target-minutes`,
		confidence: `${BASE}/vocab/confidence`,
		observationPhase: `${BASE}/vocab/observation-phase`
	}
};

const actor = {
	objectType: 'Agent',
	name: 'Tempience self',
	account: {
		homePage: 'https://tempience.app',
		name: 'self'
	}
};

const activityId = (traceId) => `${BASE}/activities/${traceId}`;
const scopeId = (id) => `${BASE}/scopes/${id}`;
const recordId = (traceId) => `${BASE}/records/${traceId}`;
const activityNodeId = (traceId) => `${BASE}/prov/activities/${traceId}`;
const resultId = (traceId) => `${BASE}/prov/entities/${traceId}/result`;
const planId = (traceId) => `${BASE}/prov/plans/${traceId}`;

const semanticOf = (trace) => trace.data?.semantic ?? {};
const isProjectedTrace = (trace) => !trace.isDeleted && ['actual', 'intend'].includes(trace.relation);

const duration = (trace) => {
	if (trace.relation !== 'actual' || trace.aboutKind !== 'interval') return null;
	if (!trace.aboutStart || !trace.aboutEnd) return null;
	const milliseconds = Date.parse(trace.aboutEnd) - Date.parse(trace.aboutStart);
	if (!Number.isFinite(milliseconds) || milliseconds <= 0) return null;
	return `PT${milliseconds / 1000}S`;
};

const scopeActivitiesFor = (fixture, traceId) => {
	const scopeIds = fixture.intersections
		.filter(
			(item) => !item.isDeleted && item.kind === 'belongs_to' && item.fromId === traceId
		)
		.map((item) => item.toId);
	return fixture.scopes
		.filter((item) => !item.isDeleted && scopeIds.includes(item.id))
		.map((item) => ({
			objectType: 'Activity',
			id: scopeId(item.id),
			definition: {
				type: `${BASE}/activity-types/scope`,
				name: { 'en-US': item.name }
			}
		}));
};

const evidenceTargetFor = (fixture, traceId) =>
	fixture.intersections.find(
		(item) => !item.isDeleted && item.kind === 'evidence_for' && item.fromId === traceId
	)?.toId ?? null;

const xapiContext = (fixture, trace, statementId, extraExtensions = {}) => {
	const scopes = scopeActivitiesFor(fixture, trace.id);
	const evidenceTarget = evidenceTargetFor(fixture, trace.id);
	const semantic = semanticOf(trace);
	const extensions = {
		[vocabulary.xapi.extensions.sourceTraceId]: trace.id,
		[vocabulary.xapi.extensions.sourceTraceContent]: trace.content,
		[vocabulary.xapi.extensions.capturedAt]: trace.capturedAt,
		[vocabulary.xapi.extensions.projectionVersion]: 1,
		...(semantic.usedTraceIds?.length
			? { [vocabulary.xapi.extensions.usedTraceIds]: semantic.usedTraceIds }
			: {}),
		...extraExtensions
	};

	return {
		...(scopes.length > 0 ? { contextActivities: { grouping: scopes } } : {}),
		...(evidenceTarget
			? { statement: { objectType: 'StatementRef', id: evidenceTarget } }
			: {}),
		extensions: {
			...extensions,
			...(statementId !== trace.id
				? { [vocabulary.xapi.extensions.correctionOf]: trace.id }
				: {})
		}
	};
};

const xapiActivity = (trace) => ({
	objectType: 'Activity',
	id: activityId(trace.id),
	definition: {
		type: `${BASE}/activity-types/iteration`,
		name: { 'en-US': trace.content }
	}
});

const xapiStatement = (fixture, trace, statementId = trace.id) => {
	const semantic = semanticOf(trace);
	const resultExtensions = {
		...(semantic.result
			? { [vocabulary.xapi.extensions.resultState]: semantic.result }
			: {}),
		...(semantic.observations?.length
			? { [vocabulary.xapi.extensions.stateObservations]: semantic.observations }
			: {})
	};
	const projectedDuration = duration(trace);
	const contextExtensions =
		trace.data?.ledger?.kind === 'weekly_budget'
			? {
					[vocabulary.xapi.extensions.weeklyTargetMinutes]:
						trace.data.ledger.targetMinutes
				}
			: {};

	if (trace.relation === 'intend') {
		return {
			id: statementId,
			actor,
			verb: {
				id: vocabulary.xapi.verbs.planned,
				display: { 'en-US': 'planned' }
			},
			object: {
				objectType: 'SubStatement',
				actor,
				verb: {
					id: vocabulary.xapi.verbs.intended,
					display: { 'en-US': 'intended' }
				},
				object: xapiActivity(trace)
			},
			context: xapiContext(fixture, trace, statementId, contextExtensions),
			timestamp: trace.capturedAt
		};
	}

	return {
		id: statementId,
		actor,
		verb: {
			id: vocabulary.xapi.verbs.iterated,
			display: { 'en-US': 'iterated' }
		},
		object: xapiActivity(trace),
		...((projectedDuration || Object.keys(resultExtensions).length > 0)
			? {
					result: {
						...(projectedDuration ? { duration: projectedDuration } : {}),
						...(Object.keys(resultExtensions).length > 0
							? { extensions: resultExtensions }
							: {})
					}
				}
			: {}),
		context: xapiContext(fixture, trace, statementId),
		timestamp: trace.aboutEnd ?? trace.aboutAt ?? trace.capturedAt
	};
};

const correctionFor = (fixture, traceId) =>
	fixture.logs.find(
		(log) =>
			log.entityType === 'trace' &&
			log.entityId === traceId &&
			log.action === 'updated' &&
			Object.keys(log.patch).length > 0
	) ?? null;

const beforeCorrection = (trace, log) => ({
	...trace,
	...Object.fromEntries(Object.entries(log.patch).map(([field, patch]) => [field, patch.before])),
	updatedAt: trace.createdAt
});

export const projectToXapi = (fixture) => {
	const statements = [];
	const features = new Set();
	const issues = new Set();
	const projected = fixture.traces.filter(isProjectedTrace);

	for (const trace of projected) {
		const correction = correctionFor(fixture, trace.id);
		if (correction) {
			statements.push(xapiStatement(fixture, beforeCorrection(trace, correction)));
			statements.push({
				id: correction.id,
				actor,
				verb: {
					id: 'http://adlnet.gov/expapi/verbs/voided',
					display: { 'en-US': 'voided' }
				},
				object: { objectType: 'StatementRef', id: trace.id },
				timestamp: correction.occurredAt
			});
			statements.push(xapiStatement(fixture, trace, correction.operationId));
			features.add('correction-void-reissue');
			issues.add('correction-strategy-is-experimental');
			issues.add('projection-statement-id-allocation-is-not-generalized');
			continue;
		}

		statements.push(xapiStatement(fixture, trace));
	}

	const actuals = projected.filter((trace) => trace.relation === 'actual');
	const intents = projected.filter((trace) => trace.relation === 'intend');
	const memberships = projected.filter(
		(trace) => scopeActivitiesFor(fixture, trace.id).length > 0
	);

	if (!projected.some((trace) => correctionFor(fixture, trace.id))) {
		const iteratedCount = statements.filter(
			(statement) => statement.verb.id === vocabulary.xapi.verbs.iterated
		).length;
		if (iteratedCount === actuals.length) features.add('iteration-cardinality');
	}
	if (actuals.some((trace) => duration(trace))) features.add('duration');
	if (memberships.length === projected.length && projected.length > 0) features.add('scope-context');
	if (intents.length > 0) features.add('intent');
	if (projected.some((trace) => semanticOf(trace).result)) features.add('structured-result');
	if (projected.some((trace) => semanticOf(trace).usedTraceIds?.length)) features.add('input-reference');
	if (projected.some((trace) => semanticOf(trace).observations?.length)) {
		features.add('state-observations');
		issues.add('state-vocabulary-and-privacy-are-open');
	}
	if (projected.some((trace) => trace.data?.ledger?.kind === 'weekly_budget')) {
		features.add('weekly-budget');
		issues.add('weekly-budget-is-a-custom-extension');
	}
	if (fixture.intersections.some((item) => !item.isDeleted && item.kind === 'evidence_for')) {
		features.add('evidence-reference');
		issues.add('evidence-for-is-not-equivalent-to-xapi-context');
	}
	if (actuals.some((trace) => !semanticOf(trace).result)) {
		issues.add('actual-has-no-recorded-result');
	}
	if (memberships.length > 0) issues.add('scope-context-needs-profile-semantics');
	if (projected.some((trace) => trace.data?.semantic)) {
		issues.add('semantic-data-vocabulary-is-provisional');
	}

	return { statements, features: [...features].sort(), issues: [...issues].sort() };
};

const provRef = (id) => ({ '@id': id });
const provRefs = (ids) => ids.map(provRef);

const scopeRefsFor = (fixture, traceId) =>
	scopeActivitiesFor(fixture, traceId).map((item) => provRef(item.id));

export const projectToProv = (fixture) => {
	const graph = [
		{
			'@id': `${BASE}/agents/self`,
			'@type': 'prov:Person',
			'prov:label': 'Tempience self'
		}
	];
	const features = new Set();
	const issues = new Set();
	const projected = fixture.traces.filter(isProjectedTrace);

	for (const trace of fixture.traces.filter((item) => !item.isDeleted)) {
		const correction = correctionFor(fixture, trace.id);
		const currentRecord = {
			'@id': recordId(trace.id),
			'@type': 'prov:Entity',
			'prov:value': trace.content,
			'prov:generatedAtTime': correction?.occurredAt ?? trace.capturedAt,
			'prov:wasAttributedTo': provRef(`${BASE}/agents/self`),
			...(scopeRefsFor(fixture, trace.id).length > 0
				? { 'tempience:scope': scopeRefsFor(fixture, trace.id) }
				: {})
		};

		if (correction) {
			const previousId = `${recordId(trace.id)}/revisions/${correction.id}/before`;
			graph.push({
				'@id': previousId,
				'@type': 'prov:Entity',
				'prov:value': beforeCorrection(trace, correction).content,
				'prov:generatedAtTime': trace.capturedAt
			});
			currentRecord['prov:wasRevisionOf'] = provRef(previousId);
			features.add('correction-lineage');
			issues.add('log-patches-do-not-guarantee-complete-historical-snapshots');
		}
		graph.push(currentRecord);

		if (trace.relation === 'intend') {
			const plan = {
				'@id': planId(trace.id),
				'@type': ['prov:Entity', 'prov:Plan'],
				'prov:value': trace.content
			};
			if (trace.data?.ledger?.kind === 'weekly_budget') {
				plan['tempience:weeklyTargetMinutes'] = trace.data.ledger.targetMinutes;
				features.add('weekly-budget');
				issues.add('weekly-budget-is-not-a-prov-concept');
			}
			currentRecord['tempience:describesPlan'] = provRef(planId(trace.id));
			graph.push(plan);
			features.add('intent');
		}

		if (trace.relation !== 'actual') continue;

		const semantic = semanticOf(trace);
		const activity = {
			'@id': activityNodeId(trace.id),
			'@type': 'prov:Activity',
			'prov:wasAssociatedWith': provRef(`${BASE}/agents/self`),
			...(trace.aboutStart ? { 'prov:startedAtTime': trace.aboutStart } : {}),
			...(trace.aboutEnd ? { 'prov:endedAtTime': trace.aboutEnd } : {}),
			...(scopeRefsFor(fixture, trace.id).length > 0
				? { 'tempience:scope': scopeRefsFor(fixture, trace.id) }
				: {}),
			...(semantic.usedTraceIds?.length
				? { 'prov:used': provRefs(semantic.usedTraceIds.map(recordId)) }
				: {})
		};
		currentRecord['tempience:records'] = provRef(activityNodeId(trace.id));
		features.add('activity-record-separation');

		if (semantic.usedTraceIds?.length) features.add('input-use');
		if (semantic.result) {
			activity['prov:generated'] = provRef(resultId(trace.id));
			graph.push({
				'@id': resultId(trace.id),
				'@type': 'prov:Entity',
				'prov:value': semantic.result,
				'prov:wasGeneratedBy': provRef(activityNodeId(trace.id)),
				...(semantic.result.affordances?.length
					? { 'tempience:affordance': semantic.result.affordances }
					: {})
			});
			features.add('result-generation');
			issues.add('semantic-data-vocabulary-is-provisional');
		}

		if (semantic.observations?.length) {
			for (const [index, observation] of semantic.observations.entries()) {
				const id = `${BASE}/prov/entities/${trace.id}/observations/${index}`;
				const observationNode = {
					'@id': id,
					'@type': ['prov:Entity', 'tempience:StateObservation'],
					'prov:value': observation.dimensions,
					'prov:generatedAtTime': observation.capturedAt,
					'tempience:observationPhase': observation.phase,
					'tempience:confidence': observation.confidence,
					'tempience:provenance': observation.provenance
				};
				if (observation.phase === 'before') {
					activity['prov:used'] = [...(activity['prov:used'] ?? []), provRef(id)];
				} else {
					observationNode['prov:wasGeneratedBy'] = provRef(activityNodeId(trace.id));
				}
				graph.push(observationNode);
			}
			features.add('state-observations');
			issues.add('state-vocabulary-and-privacy-are-open');
		}

		const evidenceTarget = evidenceTargetFor(fixture, trace.id);
		if (evidenceTarget) {
			activity['tempience:evidenceFor'] = provRef(planId(evidenceTarget));
			features.add('evidence-reference');
			issues.add('evidence-for-needs-a-tempience-relation');
		}
		graph.push(activity);
	}

	const actualCount = projected.filter((trace) => trace.relation === 'actual').length;
	const activityCount = graph.filter((node) => node['@type'] === 'prov:Activity').length;
	if (actualCount === activityCount) features.add('iteration-cardinality');
	if (projected.some((trace) => scopeRefsFor(fixture, trace.id).length > 0)) {
		issues.add('scope-needs-a-tempience-relation');
	}
	if (projected.some((trace) => trace.relation === 'actual' && !semanticOf(trace).result)) {
		issues.add('actual-has-no-recorded-result');
	}

	return {
		document: {
			'@context': {
				prov: PROV,
				tempience: `${BASE}/vocab/`
			},
			'@graph': graph
		},
		features: [...features].sort(),
		issues: [...issues].sort()
	};
};

export const projectFixture = (fixture) => ({
	fixtureId: fixture.id,
	title: fixture.title,
	xapi: projectToXapi(fixture),
	prov: projectToProv(fixture)
});
