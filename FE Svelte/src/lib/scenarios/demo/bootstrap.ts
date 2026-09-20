import { demoSeedLocale } from '$lib/state/triplit/demo-actions';
import { WORKBENCH_OPEN_AT_KEY } from '$lib/state/Workbench/constants';
import { buildDemoSeed, demoManifestId, demoRecordId } from './batch';
import { DEMO_DATA_SPACE_ID, DEMO_SEED_MARKER_KEY, DEMO_START_STORY_ID } from './constants';
import { DEMO_STORY } from './story';
import type { DemoSeedBootstrapInput, DemoSeedBootstrapResult, DemoSeedSkipReason } from './types';

const skipped = (reason: DemoSeedSkipReason, manifestId: string): DemoSeedBootstrapResult => ({
	status: 'skipped',
	reason,
	manifestId
});

/**
 * Seeds the demo replica once. The marker names the manifest the replica was seeded with; a
 * replica that already holds anything is left as it is, the same way a DataPack is: a seed in
 * another language keeps that language's marker (the header offers to rebuild it), the user's
 * own additions after the marker was lost are marked with the language of the moment. Watson's
 * verdicts are created through their evidence links once the records exist, so each is ordered
 * by its fact's date (a direct assessment would carry the install day). A seed that was applied
 * asks the workbench, once, to open on the notebook's first page.
 */
export const bootstrapDemoSeed = async ({
	dataSpace,
	repository,
	importRepository,
	clock,
	storage,
	locale
}: DemoSeedBootstrapInput): Promise<DemoSeedBootstrapResult> => {
	const manifestId = demoManifestId(locale);
	if (
		dataSpace.id !== DEMO_DATA_SPACE_ID ||
		dataSpace.kind !== 'scenario' ||
		dataSpace.syncEnabled
	) {
		return skipped('not-target', manifestId);
	}
	if (storage.getItem(DEMO_SEED_MARKER_KEY) === manifestId) return skipped('marker', manifestId);

	const [kinds, traces, scopes, periods, intersections] = await Promise.all([
		repository.listTraceKinds(),
		repository.listTraces(true),
		repository.listScopes(true),
		repository.listPeriods(true),
		repository.listIntersections(true)
	]);
	if (kinds.length + traces.length + scopes.length + periods.length + intersections.length > 0) {
		if (demoSeedLocale(storage) === null) storage.setItem(DEMO_SEED_MARKER_KEY, manifestId);
		return skipped('existing-data', manifestId);
	}

	const seed = buildDemoSeed({ locale, capturedAt: clock() });
	for (const kind of seed.kinds) await repository.ensureTraceKind(kind, 'system');
	const receipt = await importRepository.apply(seed.batch);
	if (receipt.failures.length)
		throw new Error(receipt.failures.map((failure) => failure.reason).join('; '));
	let memberships = 0;
	for (const [kindId, scopeIds] of Object.entries(seed.kindScopes)) {
		memberships += (await repository.setTraceKindScopes(kindId, scopeIds, 'system')).length;
	}
	let assessments = 0;
	for (const item of seed.assessments) {
		const evidenceId = receipt.mapping[item.candidateId];
		if (!evidenceId) throw new Error(`Demo seed: ${item.candidateId} was not imported`);
		await repository.createEvidenceAssessment(evidenceId, item.values, 'system');
		assessments += 1;
	}
	// The Scopes' colours are the story's own; the import carries none, so they are set here.
	for (const scope of DEMO_STORY.scopes) {
		if (!scope.colour) continue;
		await repository.editScope(
			demoRecordId(scope.id),
			{
				colorHue: scope.colour.hue,
				colorChroma: scope.colour.chroma ?? null,
				colorDepth: scope.colour.depth ?? null
			},
			'system'
		);
	}
	storage.setItem(DEMO_SEED_MARKER_KEY, manifestId);
	storage.setItem(WORKBENCH_OPEN_AT_KEY, demoRecordId(DEMO_START_STORY_ID));
	const count = (type: string): number =>
		seed.batch.entries.filter((entry) => entry.type === type).length;
	return {
		status: 'applied',
		manifestId,
		counts: {
			kinds: seed.kinds.length,
			scopes: count('scope'),
			traces: count('trace'),
			periods: count('period'),
			intersections: count('intersection') + memberships,
			assessments
		}
	};
};
