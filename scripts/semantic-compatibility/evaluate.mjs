import { pathToFileURL } from 'node:url';
import { fixtures } from './fixtures.mjs';
import { projectFixture } from './projectors.mjs';

const missingFeatures = (expected = [], actual = []) =>
	expected.filter((feature) => !actual.includes(feature));

export const evaluateFixture = (fixture) => {
	const projection = projectFixture(fixture);
	const missingXapi = missingFeatures(fixture.expect.xapiFeatures, projection.xapi.features);
	const missingProv = missingFeatures(fixture.expect.provFeatures, projection.prov.features);
	const missingIssues = missingFeatures(fixture.expect.issues, [
		...projection.xapi.issues,
		...projection.prov.issues
	]);

	return {
		fixtureId: fixture.id,
		title: fixture.title,
		xapi: {
			statementCount: projection.xapi.statements.length,
			expectedStatementCount: fixture.expect.xapiStatements,
			features: projection.xapi.features,
			missingFeatures: missingXapi,
			issues: projection.xapi.issues
		},
		prov: {
			nodeCount: projection.prov.document['@graph'].length,
			features: projection.prov.features,
			missingFeatures: missingProv,
			issues: projection.prov.issues
		},
		missingExpectedIssues: missingIssues,
		shapeCompatible:
			projection.xapi.statements.length === fixture.expect.xapiStatements &&
			missingXapi.length === 0 &&
			missingProv.length === 0 &&
			missingIssues.length === 0
	};
};

export const evaluateExperiment = () => {
	const cases = fixtures.map(evaluateFixture);
	return {
		fixtureCount: cases.length,
		shapeCompatibleCount: cases.filter((item) => item.shapeCompatible).length,
		cases
	};
};

export const formatMarkdown = (evaluation) => {
	const rows = evaluation.cases.map((item) => {
		const issues = [...new Set([...item.xapi.issues, ...item.prov.issues])];
		return `| ${item.fixtureId} | ${item.xapi.statementCount} | ${item.prov.nodeCount} | ${item.shapeCompatible ? 'shape-compatible' : 'missing expected mapping'} | ${issues.join(', ')} |`;
	});

	return [
		'| Fixture | xAPI statements | PROV nodes | Mechanical result | Caveats |',
		'| --- | ---: | ---: | --- | --- |',
		...rows
	].join('\n');
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
	const evaluation = evaluateExperiment();
	if (process.argv.includes('--json')) {
		console.log(JSON.stringify(evaluation, null, 2));
	} else {
		console.log(formatMarkdown(evaluation));
	}
}
