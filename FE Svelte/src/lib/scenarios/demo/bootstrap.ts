import { demoSeedLocale } from '$lib/state/triplit/demo-actions';
import { WORKBENCH_OPEN_AT_KEY } from '$lib/state/Workbench/constants';
import { buildDemoSeed, demoManifestId, demoRecordId } from './batch';
import type { DemoSeedBootstrapInput, DemoSeedBootstrapResult, DemoSeedSkipReason } from './types';

const skipped = (reason: DemoSeedSkipReason, manifestId: string): DemoSeedBootstrapResult => ({
	status: 'skipped',
	reason,
	manifestId
});

/**
 * Seeds one story's replica once. The marker names the manifest the replica was seeded with; a
 * replica that already holds anything is left as it is, the same way a DataPack is: a seed in
 * another language keeps that language's marker (the header offers to rebuild it), the user's
 * own additions after the marker was lost are marked with the language of the moment. The
 * story module is imported only once the replica is really about to be seeded. Verdicts are
 * created through their evidence links once the records exist, so each is ordered by its fact's
 * date (a direct assessment would carry the install day). A seed that was applied asks the
 * workbench, once, to open on the notebook's first page.
 */
export const bootstrapDemoSeed = async ({
	dataSpace,
	entry,
	repository,
	importRepository,
	clock,
	storage,
	locale
}: DemoSeedBootstrapInput): Promise<DemoSeedBootstrapResult> => {
	const manifestId = demoManifestId(entry, locale);
	if (
		dataSpace.id !== entry.dataSpaceId ||
		dataSpace.kind !== 'scenario' ||
		dataSpace.syncEnabled
	) {
		return skipped('not-target', manifestId);
	}
	if (storage.getItem(entry.seedMarkerKey) === manifestId) return skipped('marker', manifestId);

	const [kinds, traces, scopes, periods, intersections] = await Promise.all([
		repository.listTraceKinds(),
		repository.listTraces(true),
		repository.listScopes(true),
		repository.listPeriods(true),
		repository.listIntersections(true)
	]);
	if (kinds.length + traces.length + scopes.length + periods.length + intersections.length > 0) {
		if (demoSeedLocale(entry, storage) === null) storage.setItem(entry.seedMarkerKey, manifestId);
		return skipped('existing-data', manifestId);
	}

	const story = await entry.load();
	const seed = buildDemoSeed({ locale, capturedAt: clock(), entry }, story);
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
	for (const scope of story.scopes) {
		if (!scope.colour) continue;
		await repository.editScope(
			demoRecordId(entry, scope.id),
			{
				colorHue: scope.colour.hue,
				colorChroma: scope.colour.chroma ?? null,
				colorDepth: scope.colour.depth ?? null
			},
			'system'
		);
	}
	storage.setItem(entry.seedMarkerKey, manifestId);
	storage.setItem(WORKBENCH_OPEN_AT_KEY, demoRecordId(entry, entry.startId));
	const count = (type: string): number =>
		seed.batch.entries.filter((item) => item.type === type).length;
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
