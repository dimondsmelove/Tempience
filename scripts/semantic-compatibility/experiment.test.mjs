import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateExperiment } from './evaluate.mjs';
import { fixtures } from './fixtures.mjs';
import { projectFixture, vocabulary } from './projectors.mjs';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const findFixture = (id) => fixtures.find((fixture) => fixture.id === id);

const hasNull = (value) => {
	if (value === null) return true;
	if (Array.isArray(value)) return value.some(hasNull);
	if (typeof value !== 'object') return false;
	return Object.values(value).some(hasNull);
};

test('all seven proposed fixtures have their expected mechanical mappings', () => {
	const evaluation = evaluateExperiment();
	assert.equal(evaluation.fixtureCount, 7);
	assert.equal(evaluation.shapeCompatibleCount, 7);
});

test('xAPI output keeps required Statement shape and UUID identifiers', () => {
	for (const fixture of fixtures) {
		const { statements } = projectFixture(fixture).xapi;
		for (const statement of statements) {
			assert.match(statement.id, uuid);
			assert.ok(statement.actor);
			assert.ok(statement.verb?.id);
			assert.ok(statement.object);
			assert.equal(hasNull(statement), false);
			for (const group of Object.values(statement.context?.contextActivities ?? {})) {
				assert.ok(Array.isArray(group));
			}
		}
	}
});

test('one hour remains three iterations while duration remains one hour', () => {
	const projection = projectFixture(findFixture('several-iterations')).xapi;
	const statements = projection.statements.filter(
		(statement) => statement.verb.id === vocabulary.xapi.verbs.iterated
	);
	const seconds = statements.reduce(
		(total, statement) => total + Number(statement.result.duration.slice(2, -1)),
		0
	);
	assert.equal(statements.length, 3);
	assert.equal(seconds, 3600);
});

test('weekly budget stays a target extension and is not projected as performed duration', () => {
	const [statement] = projectFixture(findFixture('weekly-intent')).xapi.statements;
	assert.equal(statement.object.objectType, 'SubStatement');
	assert.equal(
		statement.context.extensions[vocabulary.xapi.extensions.weeklyTargetMinutes],
		600
	);
	assert.equal(statement.result, undefined);
});

test('actual evidence points to the exported intent Statement', () => {
	const projection = projectFixture(findFixture('actual-evidence')).xapi;
	const actual = projection.statements.find(
		(statement) => statement.verb.id === vocabulary.xapi.verbs.iterated
	);
	assert.deepEqual(actual.context.statement, {
		objectType: 'StatementRef',
		id: '51000000-0000-4000-8000-000000000001'
	});
});

test('correction can be shaped as original, void and replacement without mutating fixtures', () => {
	const fixture = findFixture('corrected-record');
	const before = JSON.stringify(fixture);
	const projection = projectFixture(fixture);
	assert.equal(projection.xapi.statements.length, 3);
	assert.equal(
		projection.xapi.statements[1].verb.id,
		'http://adlnet.gov/expapi/verbs/voided'
	);
	assert.equal(projection.xapi.statements[1].object.objectType, 'StatementRef');
	assert.equal(
		projection.xapi.statements[0].context.extensions[
			vocabulary.xapi.extensions.sourceTraceContent
		],
		'Selected direction B.'
	);
	assert.equal(
		projection.xapi.statements[2].context.extensions[
			vocabulary.xapi.extensions.sourceTraceContent
		],
		'Selected direction C.'
	);
	assert.ok(projection.xapi.features.includes('correction-void-reissue'));
	assert.ok(projection.prov.features.includes('correction-lineage'));
	assert.equal(JSON.stringify(fixture), before);
});

test('PROV projection keeps Trace records and described activities disjoint', () => {
	for (const fixture of fixtures) {
		const graph = projectFixture(fixture).prov.document['@graph'];
		const entities = new Set(
			graph
				.filter((node) => [node['@type']].flat().includes('prov:Entity'))
				.map((node) => node['@id'])
		);
		const activities = graph
			.filter((node) => node['@type'] === 'prov:Activity')
			.map((node) => node['@id']);
		for (const id of activities) assert.equal(entities.has(id), false);
	}
});

test('felt-state observations retain raw values, provenance and confidence', () => {
	const projection = projectFixture(findFixture('felt-state'));
	const observations =
		projection.xapi.statements[0].result.extensions[
			vocabulary.xapi.extensions.stateObservations
		];
	assert.equal(observations.length, 2);
	assert.deepEqual(observations.map((item) => item.provenance), ['self_report', 'self_report']);
	assert.deepEqual(observations.map((item) => item.confidence), [0.8, 0.8]);
	assert.ok(projection.prov.features.includes('state-observations'));
});
