import { describe, expect, it, vi } from 'vitest';
import {
	CALIBRATION_MANIFEST_VERSION,
	parseCalibrationManifest,
	type CalibrationCandidate,
	type CalibrationManifest
} from './calibration-manifest';
import {
	createScenarioImport,
	prepareScenarioImport,
	previewScenarioImport,
	type ScenarioImportInput
} from './scenario-import';
import type { ScenarioImportRepository } from '$lib/state/triplit/scenario-import-repository';

const target = {
	id: 'belgrade-what-if-v1' as const,
	kind: 'scenario' as const,
	label: 'Belgrade what-if',
	descriptionKey: 'dataSpace.description_scenario' as const,
	storageName: 'synthetic',
	syncEnabled: false
};

const manifest = (): CalibrationManifest =>
	parseCalibrationManifest({
		schemaVersion: CALIBRATION_MANIFEST_VERSION,
		manifestId: 'fixture/manifest',
		title: 'Scenario fixture',
		sourceIds: ['source:fixture'],
		claimRefs: ['claim:all'],
		claimEvidence: [
			{
				claimRef: 'claim:all',
				statement: 'fixture',
				sourceWording: 'fixture',
				sourceRefs: [{ sourceId: 'source:fixture', title: 'fixture', locator: '1' }]
			}
		],
		candidates: [
			{
				candidateId: 'scope:root',
				role: 'scope',
				proposed: { name: 'Root', note: null, startedAt: null, endedAt: null },
				claimRefs: ['claim:all'],
				gate: 'mapped',
				reason: null
			},
			{
				candidateId: 'trace:one',
				role: 'trace',
				proposed: {
					content: 'One',
					relation: 'actual',
					aboutKind: 'instant',
					aboutTime: {
						basis: 'absolute',
						precision: 'day',
						certainty: 'exact',
						start: '2025-01-01',
						end: null
					},
					timezone: 'Europe/Belgrade'
				},
				claimRefs: ['claim:all'],
				gate: 'mapped',
				reason: null
			},
			{
				candidateId: 'trace:two',
				role: 'trace',
				proposed: {
					content: 'Two',
					relation: 'intend',
					aboutKind: 'instant',
					aboutTime: {
						basis: 'absolute',
						precision: 'day',
						certainty: 'exact',
						start: '2025-01-02',
						end: null
					},
					timezone: 'Europe/Belgrade'
				},
				claimRefs: ['claim:all'],
				gate: 'mapped',
				reason: null
			},
			{
				candidateId: 'period:one',
				role: 'period',
				proposed: {
					name: 'January',
					time: { precision: 'month', start: '2025-01', end: '2025-01' },
					timezone: 'Europe/Belgrade'
				},
				claimRefs: ['claim:all'],
				gate: 'mapped',
				reason: null
			},
			{
				candidateId: 'intersection:one',
				role: 'intersection',
				proposed: { fromId: 'trace:one', toId: 'scope:root', kind: 'belongs_to', context: null },
				claimRefs: ['claim:all'],
				gate: 'mapped',
				reason: null
			},
			{
				candidateId: 'segment:one',
				role: 'scopeSegment',
				proposed: {
					scopeId: 'scope:root',
					startAt: null,
					endAt: null,
					label: 'Segment',
					position: 0,
					boundaryLabel: 'unknown'
				},
				claimRefs: ['claim:all'],
				gate: 'mapped',
				reason: null
			}
		]
	});

const input = (overrides: Partial<ScenarioImportInput> = {}): ScenarioImportInput => ({
	manifest: manifest(),
	review: null,
	target,
	capturedAt: '2026-08-29T00:00:00.000Z',
	...overrides
});

describe('scenario import planner', () => {
	it('applies edits and exclusions, and cascades dangling records', () => {
		const base = manifest();
		const editedCandidates: CalibrationCandidate[] = base.candidates.map((candidate) => {
			if (candidate.role !== 'scope') return candidate;
			return { ...candidate, proposed: { ...candidate.proposed, name: 'Edited root' } };
		});
		const batch = prepareScenarioImport(
			input({
				review: {
					candidates: editedCandidates,
					reviews: { 'scope:root': { decision: 'excluded', note: '' } }
				}
			})
		);

		expect(batch.entries).toHaveLength(3);
		expect(batch.skipped).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ candidateId: 'scope:root' }),
				expect.objectContaining({ candidateId: 'intersection:one' }),
				expect.objectContaining({ candidateId: 'segment:one' })
			])
		);
		expect(JSON.stringify(base)).toBe(JSON.stringify(manifest()));
	});

	it('skips deferred gate and deferred review candidates', () => {
		const base = manifest();
		const batch = prepareScenarioImport(
			input({
				manifest: {
					...base,
					candidates: base.candidates.map((candidate) =>
						candidate.candidateId === 'period:one' ? { ...candidate, gate: 'deferred' } : candidate
					)
				},
				review: {
					candidates: base.candidates.map((candidate) =>
						candidate.candidateId === 'period:one' ? { ...candidate, gate: 'deferred' } : candidate
					),
					reviews: { 'trace:one': { decision: 'deferred', note: '' } }
				}
			})
		);
		expect(batch.entries).toHaveLength(3);
		expect(batch.skipped).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ candidateId: 'period:one' }),
				expect.objectContaining({ candidateId: 'trace:one' }),
				expect.objectContaining({ candidateId: 'intersection:one' })
			])
		);
	});

	it('uses stable IDs and remaps relation endpoints and relative anchors', () => {
		const batch = prepareScenarioImport(input());
		const expectedTraceId = 'scenario:fixture%2Fmanifest:trace%3Aone';
		expect(batch.mapping['trace:one']).toBe(expectedTraceId);
		const intersection = batch.entries.find((entry) => entry.candidateId === 'intersection:one');
		expect(intersection).toEqual(
			expect.objectContaining({ draft: expect.objectContaining({ fromId: expectedTraceId }) })
		);
	});

	it('preserves a multiline Period note in the prepared scenario draft', () => {
		const base = manifest();
		const period = base.candidates.find((candidate) => candidate.candidateId === 'period:one');
		if (!period || period.role !== 'period') throw new Error('Fixture Period missing');
		const note = '  first line\n\nsecond line  ';
		period.proposed.note = note;

		const batch = prepareScenarioImport(input({ manifest: base }));
		expect(batch.entries.find((entry) => entry.candidateId === period.candidateId)).toMatchObject({
			type: 'period',
			draft: { note }
		});
	});

	it('reports invalid trace_ref with candidate-scoped reason', () => {
		const broken = manifest();
		const candidate = broken.candidates.find((item) => item.candidateId === 'trace:two')!;
		expect(() =>
			prepareScenarioImport(
				input({
					manifest: {
						...broken,
						candidates: [
							{
								...candidate,
								proposed: {
									...candidate.proposed,
									aboutKind: 'trace_ref',
									aboutTime: null,
									aboutTraceId: null
								}
							}
						] as never
					}
				})
			)
		).toThrow(/trace:two/);
	});

	it('plans the full 390-record shape with two deferred records', () => {
		const base = manifest();
		const candidates: CalibrationCandidate[] = Array.from({ length: 390 }, (_, index) => ({
			candidateId: `scope:${index}`,
			role: 'scope',
			proposed: { name: `Scope ${index}`, note: null, startedAt: null, endedAt: null },
			claimRefs: ['claim:all'],
			gate: index >= 388 ? 'deferred' : 'mapped',
			reason: index >= 388 ? 'not in MVP inventory' : null
		}));
		const batch = prepareScenarioImport(input({ manifest: { ...base, candidates } }));
		expect(batch.entries).toHaveLength(388);
		expect(batch.skipped).toHaveLength(2);
	});

	it('Create inspects and never applies', async () => {
		let inspectedBatch: unknown;
		const inspect = vi.fn(async (batch: unknown) => {
			inspectedBatch = batch;
			return { ok: true };
		});
		const apply = vi.fn(async () => undefined);
		const repository = { inspect, apply } as unknown as ScenarioImportRepository;
		const created = await createScenarioImport({ ...input(), repository });
		expect(inspect).toHaveBeenCalledOnce();
		expect(apply).not.toHaveBeenCalled();
		expect(created.batch).toBe(inspectedBatch);
		await previewScenarioImport({ ...input(), repository });
		expect(inspect).toHaveBeenCalledTimes(2);
	});
});
