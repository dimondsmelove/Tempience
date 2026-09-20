import { Temporal } from 'temporal-polyfill';
import { periodAt, periodTitle } from '$lib/model/Axis/Axis';
import { periodDraftTime } from '$lib/model/PeriodContext/PeriodContext';
import { translate } from '$lib/state/Locale/messages';
import type { Locale, MessageKey } from '$lib/state/Locale/types';
import { DEMO_DATA_SPACE_ID } from '$lib/state/triplit/data-space';
import {
	SCENARIO_IMPORT_BATCH_VERSION,
	type ScenarioImportBatch,
	type ScenarioImportEntry
} from '$lib/state/triplit/scenario-import-repository';
import type {
	IntersectionKind,
	JsonObject,
	TraceAboutKind,
	TraceAboutTime,
	TraceFieldMetadata,
	TraceKindSeed
} from '$lib/state/triplit/types';
import {
	CAPTURE_TIME,
	DEMO_MANIFEST_PREFIX,
	DEMO_MANIFEST_VERSION,
	DEMO_RECORD_PREFIX,
	DEMO_TIMEZONE,
	SEASON_MONTHS
} from './constants';
import { DEMO_STORY } from './story';
import type {
	DemoSeed,
	DemoSeedAssessment,
	DemoSeedInput,
	DemoStory,
	StoryKind,
	StoryTime,
	StoryValue
} from './types';

/** The record id of a story id: fixed, so a reload or another locale never produces a second copy. */
export const demoRecordId = (storyId: string): string =>
	`${DEMO_RECORD_PREFIX}${storyId.replaceAll('.', '-')}`;

export const demoManifestId = (locale: Locale): string => `${DEMO_MANIFEST_PREFIX}:${locale}`;

const pad = (value: number): string => String(value).padStart(2, '0');

/** A local wall-clock `YYYY-MM-DDTHH:MM` of the notebook's zone as an ISO instant. */
const localInstant = (value: string): string =>
	new Date(
		Temporal.PlainDateTime.from(value).toZonedDateTime(DEMO_TIMEZONE).epochMilliseconds
	).toISOString();

const intersectionId = (fromId: string, toId: string, kind: IntersectionKind): string =>
	`${fromId}:${toId}:${kind}`;

const kindSeed = (kind: StoryKind, text: (key: MessageKey) => string): TraceKindSeed => {
	const properties: JsonObject = {};
	const fieldMeta: TraceFieldMetadata = {};
	for (const field of kind.fields) {
		properties[field.key] = { type: field.type, title: text(field.titleKey) };
		if (field.unit)
			fieldMeta[`/properties/${field.key}`] = {
				unit: { id: field.unit.id, label: text(field.unit.labelKey) }
			};
	}
	return {
		id: kind.id,
		name: text(kind.nameKey),
		initialKindV: {
			id: kind.kindVId,
			dataSchema: { type: 'object', properties },
			fieldMeta
		}
	};
};

const placement = (time: StoryTime): { aboutKind: TraceAboutKind; aboutTime: TraceAboutTime } => {
	const instant = (aboutTime: TraceAboutTime) => ({ aboutKind: 'instant' as const, aboutTime });
	switch (time.type) {
		case 'day':
			return instant({
				basis: 'absolute',
				precision: 'day',
				certainty: time.certainty ?? 'exact',
				start: time.value,
				end: null
			});
		case 'month':
			return instant({
				basis: 'absolute',
				precision: 'month',
				certainty: time.certainty ?? 'approximate',
				start: time.value,
				end: null
			});
		case 'year':
			return instant({
				basis: 'absolute',
				precision: 'year',
				certainty: 'approximate',
				start: String(time.value),
				end: null
			});
		case 'season': {
			const [from, to] = SEASON_MONTHS[time.season];
			return instant({
				basis: 'absolute',
				precision: 'season',
				certainty: 'approximate',
				start: `${time.year}-${pad(from)}`,
				end: `${time.year}-${pad(to)}`
			});
		}
		case 'relative':
			return instant({
				basis: 'relative',
				precision: time.precision,
				anchorTraceId: demoRecordId(time.anchor),
				relation: time.relation
			});
		case 'unknown':
			return instant({ basis: 'unknown' });
		case 'interval': {
			const value = (at: string) => (time.precision === 'minute' ? localInstant(at) : at);
			return {
				aboutKind: 'interval',
				aboutTime: {
					basis: 'absolute',
					precision: time.precision,
					certainty: time.certainty ?? 'exact',
					start: value(time.start),
					end: value(time.end)
				}
			};
		}
		case 'minute':
			return instant({
				basis: 'absolute',
				precision: 'minute',
				certainty: time.certainty ?? 'exact',
				start: localInstant(time.value),
				end: null
			});
	}
};

/**
 * The seed of the demo space: the Kinds to ensure first, their memberships to set after the
 * Scopes exist, and one scenario-import batch with every Scope, Period, Trace and link. Every
 * date is the notebook's own, in London time; every text is written in `locale` once.
 */
export const buildDemoSeed = (
	{ locale, capturedAt }: DemoSeedInput,
	story: DemoStory = DEMO_STORY
): DemoSeed => {
	const text = (key: MessageKey): string => translate(locale, key);
	const value = (item: StoryValue): string | number =>
		typeof item === 'number' ? item : text(item.key);

	const kindsById = new Map(story.kinds.map((kind) => [kind.id, kind]));
	const entries: ScenarioImportEntry[] = [];
	const mapping: Record<string, string> = {};
	const push = (entry: ScenarioImportEntry): void => {
		entries.push(entry);
		mapping[entry.candidateId] = entry.id;
	};
	const linkCandidateId = (kind: IntersectionKind, fromStoryId: string, toStoryId: string) =>
		`link:${intersectionId(demoRecordId(fromStoryId), demoRecordId(toStoryId), kind)}`;
	const link = (kind: IntersectionKind, fromStoryId: string, toStoryId: string): void => {
		let fromId = demoRecordId(fromStoryId);
		let toId = demoRecordId(toStoryId);
		// The repository canonicalizes an undirected link's endpoint order; the id follows it.
		if (kind === 'related_to' && fromId.localeCompare(toId) > 0) [fromId, toId] = [toId, fromId];
		const id = intersectionId(fromId, toId, kind);
		push({
			type: 'intersection',
			id,
			candidateId: `link:${id}`,
			draft: { fromId, toId, kind, context: null }
		});
	};

	for (const scope of story.scopes)
		push({
			type: 'scope',
			id: demoRecordId(scope.id),
			candidateId: scope.id,
			draft: {
				name: text(scope.nameKey),
				note: scope.noteKey ? text(scope.noteKey) : null,
				parentScopeId: null,
				startedAt: null,
				endedAt: null
			}
		});

	for (const period of story.periods) {
		const ref = periodAt(Date.UTC(period.year, (period.month ?? 1) - 1, 1), period.unit);
		push({
			type: 'period',
			id: demoRecordId(period.id),
			candidateId: period.id,
			draft: {
				name: periodTitle(ref, locale),
				time: periodDraftTime(ref),
				timezone: DEMO_TIMEZONE,
				note: text(period.noteKey)
			}
		});
	}

	for (const trace of story.traces) {
		const kind = trace.kind ? kindsById.get(trace.kind.id) : undefined;
		if (trace.kind && !kind) throw new Error(`Demo story: unknown Kind ${trace.kind.id}`);
		if (!trace.kind && !trace.contentKey)
			throw new Error(`Demo story: plain record ${trace.id} has no content`);
		if (trace.kind && trace.descriptionKey)
			throw new Error(`Demo story: typed record ${trace.id} keeps its description in content`);
		push({
			type: 'trace',
			id: demoRecordId(trace.id),
			candidateId: trace.id,
			draft: {
				// A typed record keeps its optional description in `content`, blank when there is none.
				content: trace.contentKey ? text(trace.contentKey) : '',
				description: trace.descriptionKey ? text(trace.descriptionKey) : null,
				capturedAt: localInstant(
					trace.captured.includes('T') ? trace.captured : `${trace.captured}T${CAPTURE_TIME}`
				),
				timezone: DEMO_TIMEZONE,
				...placement(trace.time),
				aboutTraceId: null,
				relation: trace.relation,
				kindId: kind?.id ?? null,
				kindVId: kind?.kindVId ?? null,
				data: trace.kind
					? Object.fromEntries(
							Object.entries(trace.kind.data).map(([key, item]) => [key, value(item)])
						)
					: null
			}
		});
	}

	for (const scope of story.scopes) if (scope.parentId) link('child_of', scope.id, scope.parentId);
	for (const item of story.scopeLinks) link(item.kind, item.fromId, item.toId);
	for (const trace of story.traces)
		for (const scopeId of trace.scopeIds) link('belongs_to', trace.id, scopeId);
	for (const item of story.traceLinks) link(item.kind, item.fromId, item.toId);

	// A verdict names the evidence link it goes through; the link must be in the batch.
	const assessments: DemoSeedAssessment[] = story.assessments.map((item) => {
		const candidateId = linkCandidateId('evidence_for', item.factId, item.intentionId);
		if (!(candidateId in mapping))
			throw new Error(`Demo story: no evidence_for link ${item.factId} → ${item.intentionId}`);
		return { candidateId, values: { outcome: item.outcome, open: item.open } };
	});

	const manifestId = demoManifestId(locale);
	const batch: ScenarioImportBatch = {
		schemaVersion: SCENARIO_IMPORT_BATCH_VERSION,
		manifestId,
		manifestVersion: DEMO_MANIFEST_VERSION,
		targetDataSpaceId: DEMO_DATA_SPACE_ID,
		capturedAt,
		mapping,
		entries,
		skipped: []
	};
	return {
		manifestId,
		kinds: story.kinds.map((kind) => kindSeed(kind, text)),
		kindScopes: Object.fromEntries(
			story.kinds.map((kind) => [kind.id, kind.scopeIds.map(demoRecordId)])
		),
		batch,
		assessments
	};
};
