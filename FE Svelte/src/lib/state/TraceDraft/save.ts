import { CodedError } from '$lib/model/Errors/CodedError';
import { samePlacement } from '$lib/state/triplit/Traces/intention-time';
import type {
	TraceRecordFields,
	TraceRecordLinkInput,
	TraceRecordResult,
	TraceRecordSave
} from '$lib/state/triplit/Traces/record';
import type { JsonObject } from '$lib/state/triplit/types';
import { normalizeText } from './compare';
import { jsonData, sameData } from './json';
import { createLinks, editLinks, resultRole } from './targets';
import type { DraftEntry, DraftPreset, DraftValues, TraceDraftOptions } from './types';

const placementFields = (
	values: DraftValues
): Pick<TraceRecordFields, 'aboutKind' | 'aboutTime' | 'aboutTraceId' | 'statedDuration'> => ({
	aboutKind: values.placement.aboutKind,
	aboutTime: values.placement.aboutTime,
	aboutTraceId: values.placement.aboutTraceId,
	statedDuration: values.placement.statedDuration ?? null
});

/** The typed data as it is stored; a save only happens once the reading is complete. */
const storedData = (values: DraftValues): JsonObject => {
	const json = jsonData(values.data);
	if (!json.ok)
		throw new CodedError('draft_native_input', `Незавершённый ввод в поле формы: ${json.path}`, {
			path: json.path
		});
	return json.value;
};

/** The one relation a preset fixes: a part of its whole, a supplement of its original. */
const presetLinks = (preset: DraftPreset | undefined): TraceRecordLinkInput[] =>
	preset?.kind === 'part'
		? [{ kind: 'part_of', wholeId: preset.wholeId }]
		: preset?.kind === 'supplement'
			? [{ kind: 'revisits', originalId: preset.originalId }]
			: [];

/**
 * A new record: every field, the chosen memberships, the capture moment of this save, the
 * evidence links of the chosen results with the statements made for them, the preset's
 * relation — one command, one operation.
 */
export const createSave = (
	values: DraftValues,
	capturedAt: string,
	timezone: string,
	preset?: DraftPreset
): TraceRecordSave => {
	const typed = values.kindId !== null;
	const links = [...createLinks(values, resultRole(values.relation)), ...presetLinks(preset)];
	return {
		fields: {
			...(typed ? {} : { title: values.title.trim() }),
			description: normalizeText(values.description),
			relation: typed ? 'actual' : values.relation,
			capturedAt,
			timezone,
			...placementFields(values),
			...(typed
				? { kindId: values.kindId, kindVId: values.versionId, data: storedData(values) }
				: {})
		},
		memberships: { add: [...values.scopeIds] },
		...(links.length > 0 ? { links: { add: links } } : {})
	};
};

/**
 * An edit as explicit deltas against the baseline: only changed fields, only added and
 * removed memberships, only added and withdrawn evidence links and the statements entered
 * for saved ones. Kind and version are never sent; the record's own stay pinned. Typed
 * data counts as changed by the same JSON reading the dirty comparison uses, so reordered
 * keys never resend it.
 */
export const editSave = (
	id: string,
	values: DraftValues,
	baseline: DraftValues
): TraceRecordSave => {
	const typed = values.kindId !== null;
	const fields: TraceRecordFields = {};
	if (!typed && values.title.trim() !== baseline.title.trim()) fields.title = values.title.trim();
	if (normalizeText(values.description) !== normalizeText(baseline.description)) {
		fields.description = normalizeText(values.description);
	}
	if (!typed && values.relation !== baseline.relation) fields.relation = values.relation;
	if (!samePlacement(values.placement, baseline.placement))
		Object.assign(fields, placementFields(values));
	if (typed && !sameData(values.data, baseline.data)) fields.data = storedData(values);
	const add = values.scopeIds.filter((scopeId) => !baseline.scopeIds.includes(scopeId));
	const remove = baseline.scopeIds.filter((scopeId) => !values.scopeIds.includes(scopeId));
	return {
		id,
		fields,
		...(add.length > 0 || remove.length > 0 ? { memberships: { add, remove } } : {}),
		...editLinks(values, baseline, resultRole(values.relation))
	};
};

/** The one write of a save: the record command with the create or the edit of this entry. */
export const writeRecord = (
	options: TraceDraftOptions,
	entry: DraftEntry,
	values: DraftValues,
	baseline: DraftValues | null
): Promise<TraceRecordResult> =>
	options.repository.saveTraceRecord(
		entry.mode === 'edit' && baseline
			? editSave(entry.traceId, values, baseline)
			: createSave(
					values,
					(options.now?.() ?? new Date()).toISOString(),
					options.timezone?.() ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
					entry.mode === 'create' ? entry.preset : undefined
				)
	);
