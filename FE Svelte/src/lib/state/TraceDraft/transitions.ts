import { SvelteMap } from 'svelte/reactivity';
import { traceRecordText } from '$lib/state/triplit/Traces/fields';
import type {
	JsonObject,
	Trace,
	TraceKind,
	TraceKindV,
	TraceRelation
} from '$lib/state/triplit/types';
import type { DraftLoad } from './load';
import {
	initialTime,
	markerPlacement,
	nowPlacement,
	savedPlacement,
	undatedPlacement
} from './placement';
import { EMPTY_SCOPES, replaceKindScopes } from './scopes';
import { EMPTY_INPUT, targetsOfRoles } from './targets';
import type { TraceDraftState } from './TraceDraft.svelte';
import type { DraftPreset, EvidenceRole, TimeDraft } from './types';

/** The one head of a Kind's version tree, or '' when the user has to pick a branch. */
export const singleHead = (versions: readonly TraceKindV[], kindId: string): string => {
	const own = versions.filter((entry) => entry.kindId === kindId);
	const heads = own.filter(
		(entry) => !own.some((other) => other.parentKindVIds.includes(entry.id))
	);
	return heads.length === 1 ? heads[0].id : '';
};

/**
 * The time a relation switch assigns: «Факт → Намерение» removes the date, «Намерение → Факт»
 * takes «now». Any other change of relation leaves the chosen time alone.
 */
export const switchedTime = (
	from: TraceRelation | null,
	to: TraceRelation,
	now?: Date
): TimeDraft | null => {
	if (from === 'actual' && to === 'intend') return { mode: 'chosen', chosen: undatedPlacement() };
	if (from === 'intend' && to === 'actual') return { mode: 'chosen', chosen: nowPlacement(now) };
	return null;
};

/**
 * «Факт → Намерение» clears the date, the reverse assigns «now»; opening changes nothing, and a
 * saved supplement keeps its marker because it has no date of its own to take.
 * Kind input has no relation switch; a relation an active evidence link forbids is not
 * switched, the form shows the link instead. Either switch drops the chosen results and
 * their statements: they belong to the other role, and nothing hidden comes back.
 */
export const switchRelation = (draft: TraceDraftState, next: TraceRelation, now?: Date): void => {
	if (draft.typed && draft.entry.mode === 'create') return;
	if (next === draft.relation || draft.blockedRelation?.relation === next) return;
	// A supplement is placed by its original, not by a date of its own: the marker stays as it is.
	if (draft.supplement === null) draft.time = switchedTime(draft.relation, next, now) ?? draft.time;
	draft.relation = next;
	draft.results.reset();
	draft.touch('time');
};

/**
 * A new input's Kind: the previous variant's content goes, the Kind's own version and
 * default data come, its direct Scopes replace the previous Kind's contribution. Back and
 * forth restores nothing; a saved record never changes Kind.
 */
export const chooseKind = (draft: TraceDraftState, kindId: string, versionId?: string): void => {
	if (draft.entry.mode === 'edit') return;
	const wasTyped = draft.typed;
	// Kind input is a fact: a plain intention entering it takes the «now» of any switch to a fact.
	if (!wasTyped && kindId !== '' && draft.relation === 'intend') draft.setRelation('actual');
	draft.kindId = kindId;
	if (wasTyped !== (kindId !== '')) {
		draft.title = '';
		draft.description = '';
		draft.touched.delete('title');
		draft.touched.delete('description');
	}
	draft.chooseVersion(versionId ?? singleHead(draft.versions, kindId));
	draft.scopes = replaceKindScopes(draft.scopes, draft.kindScopes.get(kindId) ?? []);
};

/** The pinned version of a new input, with its schema defaults as fresh data. */
export const chooseVersion = (
	draft: TraceDraftState,
	versionId: string,
	defaults: (version: TraceKindV) => JsonObject
): void => {
	if (draft.entry.mode === 'edit') return;
	draft.versionId = versionId;
	draft.data = draft.version ? defaults(draft.version) : {};
	draft.nativeInvalid = 0;
	draft.touched.delete('data');
};

/** The relation an active evidence link forbids: a fact with results stays a fact, and so on. */
export const blockedRelationOf = (
	roles: readonly EvidenceRole[]
): { relation: TraceRelation; role: EvidenceRole } | null => {
	const outgoing = roles.find((role) => role.direction === 'outgoing');
	if (outgoing) return { relation: 'intend', role: outgoing };
	const incoming = roles.find((role) => role.direction === 'incoming');
	return incoming ? { relation: 'actual', role: incoming } : null;
};

/**
 * A Kind saved from inside the form joins the catalogs the subscriptions may not have
 * delivered yet and brings its memberships, so an explicit choice of it applies the
 * ordinary Kind rules at once. Nothing else of the form changes.
 */
export const noteKind = (
	draft: TraceDraftState,
	kind: TraceKind,
	version: TraceKindV,
	scopeIds: readonly string[]
): void => {
	draft.kindScopes.set(kind.id, [...scopeIds]);
	if (!draft.kinds.some((entry) => entry.id === kind.id)) draft.kinds = [...draft.kinds, kind];
	if (!draft.versions.some((entry) => entry.id === version.id)) {
		draft.versions = [...draft.versions, version];
	}
	draft.createdKind = kind;
};

/** The saved record's editable values, exactly as stored: nothing is split, moved or invented. */
export const loadedFields = (trace: Trace) => {
	const text = traceRecordText(trace);
	return {
		title: text.title ?? '',
		description: text.description ?? '',
		relation: trace.relation,
		time: initialTime(savedPlacement(trace)),
		kindId: trace.kindId ?? '',
		versionId: trace.kindVId ?? '',
		data: { ...(trace.data ?? {}) }
	};
};

/**
 * A Context action's start (TRACE_FORMS «входы»): «Добавить результат» chooses the intention;
 * «Дополнить» fixes the supplement marker as the placement; «Добавить часть» of an intention
 * starts as a plain intention without a date, of a fact as the ordinary fact. Nothing of the
 * parent's Kind, evidence or assessments is taken over.
 */
const applyPreset = (draft: TraceDraftState, preset: DraftPreset, loaded: DraftLoad): void => {
	if (preset.kind === 'result') {
		draft.results.start([], [{ otherId: preset.intentionId, linkId: null, input: EMPTY_INPUT }]);
		return;
	}
	if (preset.kind === 'supplement') {
		draft.time = { mode: 'chosen', chosen: markerPlacement() };
		return;
	}
	const whole = loaded.traces.find((trace) => trace.id === preset.wholeId);
	if (whole?.relation === 'intend' && !draft.typed) {
		draft.relation = 'intend';
		draft.time = { mode: 'chosen', chosen: undatedPlacement() };
	}
};

/**
 * What a loaded entry becomes in the draft: the Kinds' Scopes, the records the result picker
 * reads and the evidence roles for both modes; for an edit the saved record's own values,
 * memberships, saved results and diagnostics; for a new input «now», the entry's Scopes (a
 * preset's parent's direct ones by default), the entry's Kind through the ordinary Kind
 * choice, then the preset.
 */
export const hydrate = (draft: TraceDraftState, loaded: DraftLoad, now?: Date): void => {
	draft.kindScopes = new SvelteMap(loaded.kindScopes);
	draft.evidenceRoles = loaded.evidenceRoles;
	draft.supplement = loaded.supplement;
	draft.results.traces = loaded.traces;
	draft.results.intersections = loaded.intersections;
	draft.results.assessments = loaded.assessments;
	const { entry } = draft;
	if (entry.mode === 'edit') {
		if (!loaded.trace) {
			draft.diagnostic = 'draft.missingRecord';
			return;
		}
		draft.saved = loaded.trace;
		Object.assign(draft, loadedFields(loaded.trace));
		draft.scopes = { ...EMPTY_SCOPES, initial: loaded.memberships };
		const direction = loaded.trace.relation === 'intend' ? 'incoming' : 'outgoing';
		draft.results.start(
			targetsOfRoles(loaded.evidenceRoles.filter((role) => role.direction === direction))
		);
		if (draft.kindId && !draft.version) draft.diagnostic = 'draft.missingVersion';
		return;
	}
	draft.time = initialTime(null, now);
	const initial = entry.scopeIds ?? (entry.preset ? loaded.memberships : []);
	draft.scopes = { ...EMPTY_SCOPES, initial: [...initial] };
	if (entry.kindId) draft.chooseKind(entry.kindId, entry.versionId);
	if (entry.preset) applyPreset(draft, entry.preset, loaded);
};
