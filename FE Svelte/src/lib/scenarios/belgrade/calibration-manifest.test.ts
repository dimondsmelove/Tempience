import { describe, expect, it } from 'vitest';
import {
	CALIBRATION_CHECKPOINT_VERSION,
	CALIBRATION_MANIFEST_VERSION,
	CALIBRATION_REVIEW_VERSION,
	applyReviewCheckpoint,
	candidateSortValue,
	candidateTimeLabel,
	candidateValidationError,
	cloneManifest,
	createReviewArtifact,
	createReviewCheckpoint,
	derivedScopeIntervalRange,
	derivedScopeIntervalRangeLabel,
	initialCandidateReviews,
	inventoryCounts,
	parseCalibrationManifest,
	parseCalibrationManifestText,
	parseReviewCheckpoint,
	parseReviewCheckpointText,
	reviewProgress,
	serializeReviewCheckpoint,
	tracesForScope,
	tracesOverlappingPeriod,
	unscopedTraces,
	updateCandidate,
	type CalibrationManifest,
	type TraceCandidate
} from './calibration-manifest';

const syntheticManifest = (): CalibrationManifest =>
	parseCalibrationManifest({
		schemaVersion: CALIBRATION_MANIFEST_VERSION,
		manifestId: 'synthetic-calibration',
		title: 'Synthetic calibration fixture',
		sourceIds: ['source:synthetic'],
		claimRefs: ['claim:scope', 'claim:start', 'claim:outside', 'claim:phase'],
		claimEvidence: [
			{
				claimRef: 'claim:scope',
				statement: 'Проект является самостоятельной рамкой.',
				sourceWording: 'Отдельный проект',
				sourceRefs: [
					{ sourceId: 'source:synthetic', title: 'Synthetic source', locator: 'scope fragment' }
				]
			},
			{
				claimRef: 'claim:start',
				statement: 'Проект начался 6 сентября 2025 года.',
				sourceWording: '6 сентября начал проект',
				sourceRefs: [
					{ sourceId: 'source:synthetic', title: 'Synthetic source', locator: 'start fragment' }
				]
			},
			{
				claimRef: 'claim:outside',
				statement: 'В октябре произошло отдельное событие.',
				sourceWording: '2 октября событие',
				sourceRefs: [
					{ sourceId: 'source:synthetic', title: 'Synthetic source', locator: 'outside fragment' }
				]
			},
			{
				claimRef: 'claim:phase',
				statement: 'Первая фаза проекта длилась в сентябре.',
				sourceWording: 'первая фаза',
				sourceRefs: [
					{ sourceId: 'source:synthetic', title: 'Synthetic source', locator: 'phase fragment' }
				]
			}
		],
		candidates: [
			{
				candidateId: 'cal:scope:project',
				role: 'scope',
				proposed: { name: 'Проект', note: null, startedAt: null, endedAt: null },
				claimRefs: ['claim:scope'],
				gate: 'mapped',
				reason: null
			},
			{
				candidateId: 'cal:trace:start',
				role: 'trace',
				proposed: {
					content: 'Начал проект',
					relation: 'actual',
					aboutKind: 'instant',
					aboutTime: {
						basis: 'absolute',
						precision: 'day',
						certainty: 'exact',
						start: '2025-09-06',
						end: null
					},
					timezone: 'Europe/Belgrade'
				},
				claimRefs: ['claim:start'],
				gate: 'mapped',
				reason: null
			},
			{
				candidateId: 'cal:trace:stage',
				role: 'trace',
				proposed: {
					content: 'Работал над первой фазой',
					relation: 'actual',
					aboutKind: 'interval',
					aboutTime: {
						basis: 'absolute',
						precision: 'day',
						certainty: 'exact',
						start: '2025-09-06',
						end: '2025-09-30'
					},
					timezone: 'Europe/Belgrade'
				},
				claimRefs: ['claim:phase'],
				gate: 'mapped',
				reason: null
			},
			{
				candidateId: 'cal:trace:outside',
				role: 'trace',
				proposed: {
					content: 'Событие вне периода',
					relation: 'actual',
					aboutKind: 'instant',
					aboutTime: {
						basis: 'absolute',
						precision: 'day',
						certainty: 'exact',
						start: '2025-10-02',
						end: null
					},
					timezone: 'Europe/Belgrade'
				},
				claimRefs: ['claim:outside'],
				gate: 'review-required',
				reason: null
			},
			{
				candidateId: 'cal:period:september',
				role: 'period',
				proposed: {
					name: 'Сентябрь 2025',
					time: { precision: 'month', start: '2025-09', end: '2025-09' },
					timezone: 'Europe/Belgrade'
				},
				claimRefs: [],
				gate: 'mapped',
				reason: null
			},
			{
				candidateId: 'cal:intersection:start-scope',
				role: 'intersection',
				proposed: {
					fromId: 'cal:trace:start',
					toId: 'cal:scope:project',
					kind: 'belongs_to',
					context: null
				},
				claimRefs: ['claim:start'],
				gate: 'mapped',
				reason: null
			},
			{
				candidateId: 'cal:intersection:stage-scope',
				role: 'intersection',
				proposed: {
					fromId: 'cal:trace:stage',
					toId: 'cal:scope:project',
					kind: 'belongs_to',
					context: null
				},
				claimRefs: ['claim:phase'],
				gate: 'mapped',
				reason: null
			},
			{
				candidateId: 'cal:intersection:outside-scope',
				role: 'intersection',
				proposed: {
					fromId: 'cal:trace:outside',
					toId: 'cal:scope:project',
					kind: 'belongs_to',
					context: null
				},
				claimRefs: ['claim:outside'],
				gate: 'mapped',
				reason: null
			},
			{
				candidateId: 'cal:segment:phase',
				role: 'scopeSegment',
				proposed: {
					scopeId: 'cal:scope:project',
					startAt: null,
					endAt: null,
					label: 'Первая фаза',
					position: 0,
					boundaryLabel: 'month precision, canonical minute bounds unavailable'
				},
				claimRefs: ['claim:phase'],
				gate: 'deferred',
				reason: 'Synthetic precision mismatch'
			}
		]
	});

describe('calibration review manifest', () => {
	it('parses the isolated manifest and excludes deferred records from inventory counts', () => {
		const manifest = syntheticManifest();

		expect(inventoryCounts(manifest.candidates)).toEqual({
			scope: 1,
			trace: 3,
			period: 1,
			intersection: 3,
			scopeSegment: 0
		});
		expect(reviewProgress(manifest.candidates, initialCandidateReviews(manifest))).toEqual({
			reviewed: 0,
			total: 8
		});
	});

	it('rejects malformed JSON and dangling relation endpoints', () => {
		expect(() => parseCalibrationManifestText('{broken')).toThrow(
			'Файл не является корректным JSON.'
		);

		const manifest = cloneManifest(syntheticManifest());
		const relation = manifest.candidates.find(
			(candidate) => candidate.candidateId === 'cal:intersection:start-scope'
		);
		if (relation?.role === 'intersection') relation.proposed.toId = 'cal:scope:missing';
		expect(() => parseCalibrationManifest(manifest)).toThrow(
			'оба endpoint должны существовать в manifest'
		);

		const missingEvidence = cloneManifest(syntheticManifest());
		missingEvidence.claimEvidence = missingEvidence.claimEvidence.filter(
			(evidence) => evidence.claimRef !== 'claim:start'
		);
		expect(() => parseCalibrationManifest(missingEvidence)).toThrow(
			'claim:start: отсутствует раскрываемое claimEvidence'
		);
	});

	it('groups Trace by belongs_to without persisting a Scope membership on Trace', () => {
		const manifest = syntheticManifest();

		expect(
			tracesForScope('cal:scope:project', manifest.candidates).map((trace) => trace.candidateId)
		).toEqual(['cal:trace:start', 'cal:trace:stage', 'cal:trace:outside']);
		expect(unscopedTraces(manifest.candidates)).toEqual([]);
	});

	it('derives a display-only Scope range from absolute interval member Trace', () => {
		const manifest = syntheticManifest();
		const range = derivedScopeIntervalRange('cal:scope:project', manifest.candidates);

		expect(range).toEqual({
			start: { value: '2025-09-06', precision: 'day', certainty: 'exact' },
			end: { value: '2025-09-30', precision: 'day', certainty: 'exact' },
			traceIds: ['cal:trace:stage']
		});
		if (!range) throw new Error('Derived Scope range missing');
		expect(derivedScopeIntervalRangeLabel(range)).toBe('6 сент. 2025 г. — 30 сент. 2025 г.');
	});

	it('keeps review projections stable while a temporal edit is temporarily invalid', () => {
		const manifest = syntheticManifest();
		const trace = manifest.candidates.find(
			(candidate): candidate is TraceCandidate => candidate.candidateId === 'cal:trace:stage'
		);
		if (!trace || trace.proposed.aboutTime?.basis !== 'absolute') {
			throw new Error('Synthetic interval Trace missing');
		}

		trace.proposed.aboutTime.precision = 'year';

		expect(candidateValidationError(trace)).not.toBeNull();
		expect(candidateTimeLabel(trace)).toBe('время требует исправления');
		expect(candidateSortValue(trace)).toBe(Infinity);
		expect(derivedScopeIntervalRange('cal:scope:project', manifest.candidates)).toBeNull();
	});

	it('derives Period membership from temporal overlap', () => {
		const manifest = syntheticManifest();
		const period = manifest.candidates.find(
			(candidate) => candidate.candidateId === 'cal:period:september'
		);
		if (!period || period.role !== 'period') throw new Error('Synthetic Period missing');

		expect(
			tracesOverlappingPeriod(period, manifest.candidates).map((trace) => trace.candidateId)
		).toEqual(['cal:trace:start', 'cal:trace:stage']);
	});

	it('exports only review decisions, notes, and changed proposal values', () => {
		const manifest = syntheticManifest();
		let working = cloneManifest(manifest).candidates;
		const trace = working.find(
			(candidate): candidate is TraceCandidate => candidate.candidateId === 'cal:trace:start'
		);
		if (!trace) throw new Error('Synthetic Trace missing');
		working = updateCandidate(working, {
			...trace,
			proposed: { ...trace.proposed, content: 'Исправленное начало проекта' }
		});
		const reviews = initialCandidateReviews(manifest);
		reviews['cal:trace:start'] = { decision: 'accepted', note: 'Проверено' };

		const artifact = createReviewArtifact(manifest, working, reviews, '2026-08-25T12:00:00.000Z');

		expect(artifact.schemaVersion).toBe(CALIBRATION_REVIEW_VERSION);
		expect(artifact.entries).toEqual([
			{
				candidateId: 'cal:trace:start',
				decision: 'accepted',
				note: 'Проверено',
				proposed: { ...trace.proposed, content: 'Исправленное начало проекта' }
			}
		]);
	});

	it('round-trips a resumable checkpoint without mutating the base manifest', () => {
		const manifest = syntheticManifest();
		const baseSnapshot = JSON.stringify(manifest);
		let working = cloneManifest(manifest).candidates;
		const trace = working.find(
			(candidate): candidate is TraceCandidate => candidate.candidateId === 'cal:trace:start'
		);
		if (!trace) throw new Error('Synthetic Trace missing');
		working = updateCandidate(working, {
			...trace,
			proposed: { ...trace.proposed, content: 'Продолжил важный проект' }
		});
		const reviews = initialCandidateReviews(manifest);
		reviews['cal:trace:start'] = { decision: 'accepted', note: '  Сохранить отступы  ' };

		const checkpoint = createReviewCheckpoint(
			manifest,
			working,
			reviews,
			{
				selectedId: 'cal:trace:start',
				search: 'важный проект',
				decisionFilter: 'accepted'
			},
			'2026-08-27T12:00:00.000Z'
		);
		const parsed = parseReviewCheckpointText(serializeReviewCheckpoint(checkpoint), manifest);
		const restored = applyReviewCheckpoint(manifest, parsed);
		const restoredTrace = restored.candidates.find(
			(candidate): candidate is TraceCandidate => candidate.candidateId === 'cal:trace:start'
		);

		expect(checkpoint.schemaVersion).toBe(CALIBRATION_CHECKPOINT_VERSION);
		expect(checkpoint.entries).toEqual([
			{
				candidateId: 'cal:trace:start',
				decision: 'accepted',
				note: '  Сохранить отступы  ',
				proposed: { ...trace.proposed, content: 'Продолжил важный проект' }
			}
		]);
		expect(restoredTrace?.proposed.content).toBe('Продолжил важный проект');
		expect(restored.reviews['cal:trace:start']).toEqual({
			decision: 'accepted',
			note: '  Сохранить отступы  '
		});
		expect(restored).toMatchObject({
			selectedId: 'cal:trace:start',
			search: 'важный проект',
			decisionFilter: 'accepted'
		});
		expect(JSON.stringify(manifest)).toBe(baseSnapshot);
	});

	it('rejects mismatched, duplicate, unknown, and invalid checkpoint state', () => {
		const manifest = syntheticManifest();
		const checkpoint = createReviewCheckpoint(
			manifest,
			manifest.candidates,
			initialCandidateReviews(manifest),
			{ selectedId: null, search: '', decisionFilter: 'all' },
			'2026-08-27T12:00:00.000Z'
		);
		const entry = {
			candidateId: 'cal:trace:start',
			decision: 'pending'
		};

		expect(() =>
			parseReviewCheckpoint({ ...checkpoint, manifestId: 'another-manifest' }, manifest)
		).toThrow('Checkpoint относится к manifest another-manifest');
		expect(() =>
			parseReviewCheckpoint({ ...checkpoint, entries: [entry, entry] }, manifest)
		).toThrow('candidateId должны быть уникальны');
		expect(() =>
			parseReviewCheckpoint(
				{
					...checkpoint,
					entries: [{ candidateId: 'cal:trace:missing', decision: 'pending' }]
				},
				manifest
			)
		).toThrow('отсутствует в manifest');
		expect(() =>
			parseReviewCheckpoint(
				{
					...checkpoint,
					entries: [
						{
							candidateId: 'cal:intersection:start-scope',
							decision: 'pending',
							proposed: {
								fromId: 'cal:trace:start',
								toId: 'cal:scope:missing',
								kind: 'belongs_to',
								context: null
							}
						}
					]
				},
				manifest
			)
		).toThrow('оба endpoint должны существовать в manifest');
		expect(() => parseReviewCheckpointText('{broken', manifest)).toThrow(
			'Checkpoint не является корректным JSON.'
		);
	});

	it('normalizes legacy and blank Period notes while preserving meaningful text', () => {
		const legacy = syntheticManifest();
		const legacyPeriod = legacy.candidates.find(
			(candidate) => candidate.candidateId === 'cal:period:september'
		);
		if (!legacyPeriod || legacyPeriod.role !== 'period')
			throw new Error('Synthetic Period missing');
		expect(legacyPeriod.proposed.note).toBe(null);

		const withNotes = cloneManifest(legacy);
		const period = withNotes.candidates.find(
			(candidate) => candidate.candidateId === 'cal:period:september'
		);
		if (!period || period.role !== 'period') throw new Error('Synthetic Period missing');
		const note = '  first line\n\nsecond line  ';
		period.proposed.note = note;
		expect(
			parseCalibrationManifest(withNotes).candidates.find(
				(candidate) => candidate.candidateId === period.candidateId
			)?.proposed
		).toMatchObject({ note });

		period.proposed.note = ' \n\t ';
		expect(
			parseCalibrationManifest(withNotes).candidates.find(
				(candidate) => candidate.candidateId === period.candidateId
			)?.proposed
		).toMatchObject({ note: null });
	});
});
