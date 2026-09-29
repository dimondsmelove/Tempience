import { Temporal } from 'temporal-polyfill';
import { periodAt, periodTitle } from '$lib/model/Axis/Axis';
import { periodDraftTime } from '$lib/model/PeriodContext/PeriodContext';
import { translate } from '$lib/state/Locale/messages';
import type { Locale, MessageKey } from '$lib/state/Locale/types';
import type { ScenarioDataSpaceId } from '$lib/state/triplit/data-space';
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
import { DEMO_MANIFEST_VERSION, SEASON_MONTHS } from './constants';
import type { DemoStoryEntry } from './registry';
import type {
	DemoSeed,
	DemoSeedAssessment,
	DemoSeedChapter,
	DemoSeedInput,
	DemoStory,
	StoryKind,
	StoryStart,
	StoryTime,
	StoryValue
} from './types';

/** The record id of a story id: fixed, so a reload or another locale never produces a second copy. */
export const demoRecordId = (entry: DemoStoryEntry, storyId: string): string =>
	`${entry.recordPrefix}${storyId.replaceAll('.', '-')}`;

export const demoManifestId = (entry: DemoStoryEntry, locale: Locale): string =>
	`${entry.manifestPrefix}:${locale}`;

const pad = (value: number): string => String(value).padStart(2, '0');

/** A local wall-clock `YYYY-MM-DDTHH:MM` of the notebook's zone as an ISO instant. */
const localInstant = (value: string, timezone: string): string =>
	new Date(
		Temporal.PlainDateTime.from(value).toZonedDateTime(timezone).epochMilliseconds
	).toISOString();

/** The calendar day an instant falls on in the notebook's zone. */
const localDay = (instant: string, timezone: string): string =>
	Temporal.Instant.from(instant).toZonedDateTimeISO(timezone).toPlainDate().toString();

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

type Placement = { aboutKind: TraceAboutKind; aboutTime: TraceAboutTime };

const placement = (time: StoryTime, entry: DemoStoryEntry): Placement => {
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
				anchorTraceId: demoRecordId(entry, time.anchor),
				relation: time.relation
			});
		case 'unknown':
			return instant({ basis: 'unknown' });
		case 'interval': {
			const value = (at: string) =>
				time.precision === 'minute' ? localInstant(at, entry.timezone) : at;
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
				start: localInstant(time.value, entry.timezone),
				end: null
			});
	}
};

/**
 * The seed of a demo space: the Kinds to ensure first, their memberships to set after the
 * Scopes exist, one scenario-import batch with every Scope, Period, Trace and link, and the
 * chapters with their stages, to create once the Scopes they name exist. Every
 * date is the notebook's own, in the story's zone; every text is written in `locale` once.
 * A story whose entry asks for it (`startAtInstall`) has its first page dated by the install
 * instant instead — the only date that cannot be written into the story file.
 */
export const buildDemoSeed = (
	{ locale, capturedAt, entry }: DemoSeedInput,
	story: DemoStory
): DemoSeed => {
	const text = (key: MessageKey): string => translate(locale, key);
	const value = (item: StoryValue): string | number =>
		typeof item === 'number' ? item : text(item.key);
	const recordId = (storyId: string): string => demoRecordId(entry, storyId);
	const installDay = entry.startAtInstall ? localDay(capturedAt, entry.timezone) : null;

	const kindsById = new Map(story.kinds.map((kind) => [kind.id, kind]));
	const entries: ScenarioImportEntry[] = [];
	const mapping: Record<string, string> = {};
	const push = (item: ScenarioImportEntry): void => {
		entries.push(item);
		mapping[item.candidateId] = item.id;
	};
	const linkCandidateId = (kind: IntersectionKind, fromStoryId: string, toStoryId: string) =>
		`link:${intersectionId(recordId(fromStoryId), recordId(toStoryId), kind)}`;
	const link = (kind: IntersectionKind, fromStoryId: string, toStoryId: string): void => {
		let fromId = recordId(fromStoryId);
		let toId = recordId(toStoryId);
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
			id: recordId(scope.id),
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
			id: recordId(period.id),
			candidateId: period.id,
			draft: {
				name: periodTitle(ref, locale),
				time: periodDraftTime(ref),
				timezone: entry.timezone,
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
		// The first page of an `startAtInstall` story is written the day the demo is installed.
		const atInstall = installDay !== null && trace.id === entry.startId;
		const place: Placement = atInstall
			? {
					aboutKind: 'instant',
					aboutTime: {
						basis: 'absolute',
						precision: 'day',
						certainty: 'exact',
						start: installDay,
						end: null
					}
				}
			: placement(trace.time, entry);
		push({
			type: 'trace',
			id: recordId(trace.id),
			candidateId: trace.id,
			draft: {
				// A typed record keeps its optional description in `content`, blank when there is none.
				content: trace.contentKey ? text(trace.contentKey) : '',
				description: trace.descriptionKey ? text(trace.descriptionKey) : null,
				capturedAt: atInstall
					? capturedAt
					: localInstant(
							trace.captured.includes('T')
								? trace.captured
								: `${trace.captured}T${entry.captureTime}`,
							entry.timezone
						),
				timezone: entry.timezone,
				...place,
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

	const scopeIds = new Set(story.scopes.map((scope) => scope.id));
	const lineup = (ids: readonly string[]) =>
		ids.map((id) => {
			if (!scopeIds.has(id)) throw new Error(`Demo story: chapter lineup names no Scope ${id}`);
			return { scopeId: recordId(id), level: 'focus' as const };
		});
	const at = (start: StoryStart): string =>
		localInstant(start.includes('T') ? start : `${start}T00:00`, entry.timezone);
	const chapters: DemoSeedChapter[] = story.chapters.map((chapter) => ({
		draft: {
			name: text(chapter.nameKey),
			note: chapter.noteKey ? text(chapter.noteKey) : null,
			colorHue: chapter.colour?.hue ?? null,
			colorChroma: chapter.colour?.chroma ?? null,
			colorDepth: chapter.colour?.depth ?? null,
			start: at(chapter.start),
			closedAt: chapter.closedAt ? at(chapter.closedAt) : null,
			lineup: lineup(chapter.lineup)
		},
		stages: chapter.stages.map((stage) => ({
			name: text(stage.nameKey),
			note: stage.noteKey ? text(stage.noteKey) : null,
			start: at(stage.start),
			lineup: stage.lineup ? lineup(stage.lineup) : null
		}))
	}));

	const manifestId = demoManifestId(entry, locale);
	const batch: ScenarioImportBatch = {
		schemaVersion: SCENARIO_IMPORT_BATCH_VERSION,
		manifestId,
		manifestVersion: DEMO_MANIFEST_VERSION,
		// Every registry entry names a built-in scenario space; the registry owns that union.
		targetDataSpaceId: entry.dataSpaceId as ScenarioDataSpaceId,
		capturedAt,
		mapping,
		entries,
		skipped: []
	};
	return {
		manifestId,
		kinds: story.kinds.map((kind) => kindSeed(kind, text)),
		kindScopes: Object.fromEntries(
			story.kinds.map((kind) => [kind.id, kind.scopeIds.map(recordId)])
		),
		batch,
		assessments,
		chapters
	};
};
