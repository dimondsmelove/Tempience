import { CodedError } from '$lib/model/Errors/CodedError';
import { compileTraceForm, decodeTraceForm } from '$lib/model/TraceForm/TraceForm';
import type { TempienceRepository } from '$lib/state/triplit/repository';
import type { TraceKind, TraceKindV, TraceKindVDraft } from '$lib/state/triplit/types';
import type { MembershipIntent } from './types';

export type KindSaveRepository = Pick<
	TempienceRepository,
	'createTraceKind' | 'createTraceKindV' | 'editTraceKind'
>;

export type KindSaveInput = {
	/** The Kind being edited, or none for a new one. */
	kind?: TraceKind;
	/** The published version the edit started from; a changed definition becomes its child. */
	published?: TraceKindV;
	name: string;
	definition: TraceKindVDraft;
	memberships: MembershipIntent;
};

/** What the repository returned: the committed rows themselves, no read after the commit. */
export type KindSaveResult = {
	kindId: string;
	versionId: string;
	kind: TraceKind;
	version: TraceKindV;
	outcome: 'created' | 'versioned' | 'edited' | 'unchanged';
	/** The memberships this save wrote, if it wrote any. */
	scopeIds: readonly string[] | null;
};

const canonical = (value: unknown): string => JSON.stringify(value ?? null);

/** A definition as the Builder would compile it, without the root title the Kind's name fills. */
const fieldsOf = (definition: TraceKindVDraft): string => {
	const { title, ...schema } = definition.dataSchema;
	void title;
	return canonical({
		schema,
		ui: definition.uiSchema ?? {},
		meta: definition.fieldMeta ?? {}
	});
};

/**
 * Whether a compiled definition keeps the published fields: the published version is read
 * back through the same Builder decoding and compiled again, so only the user's edits count,
 * never the Kind's name (the compiler copies it into the root title). A rename is then the
 * Kind's own metadata, not a new version; a definition the Builder cannot decode counts as changed.
 */
export const sameDefinition = (compiled: TraceKindVDraft, published: TraceKindVDraft): boolean => {
	try {
		const name = String(published.dataSchema.title ?? 'Вид записи');
		const reopened = compileTraceForm(decodeTraceForm(name, published));
		return fieldsOf(compiled) === fieldsOf(reopened);
	} catch {
		return false;
	}
};

/**
 * One authoring save of a Kind. A new Kind takes the memberships shown with it. An existing
 * Kind gets a new version only when its fields changed (with the accepted evolution checks
 * done by the Builder), otherwise a rename through its own metadata; memberships go along in
 * the same commit only when the user chose them — an untouched selection is never resent.
 */
export const saveKind = async (
	repository: KindSaveRepository,
	input: KindSaveInput
): Promise<KindSaveResult> => {
	const chosen = input.memberships.explicit ? [...input.memberships.scopeIds] : undefined;
	if (!input.kind) {
		const scopeIds = [...input.memberships.scopeIds];
		const created = await repository.createTraceKind({
			name: input.name,
			initialKindV: input.definition,
			scopeIds
		});
		return {
			kindId: created.kind.id,
			versionId: created.kindV.id,
			kind: created.kind,
			version: created.kindV,
			outcome: 'created',
			scopeIds
		};
	}
	if (!input.published) throw new CodedError('form_version_required', 'Выберите версию формы.');
	if (!sameDefinition(input.definition, input.published)) {
		const version = await repository.createTraceKindV(input.kind.id, {
			...input.definition,
			kindName: input.name,
			parentKindVIds: [input.published.id],
			...(chosen ? { scopeIds: chosen } : {})
		});
		return {
			kindId: input.kind.id,
			versionId: version.id,
			kind: { ...input.kind, name: input.name.trim(), currentKindVId: version.id },
			version,
			outcome: 'versioned',
			scopeIds: chosen ?? null
		};
	}
	const renamed = input.name.trim() !== input.kind.name;
	if (!renamed && !chosen) {
		return {
			kindId: input.kind.id,
			versionId: input.published.id,
			kind: input.kind,
			version: input.published,
			outcome: 'unchanged',
			scopeIds: null
		};
	}
	const kind = await repository.editTraceKind(input.kind.id, {
		...(renamed ? { name: input.name } : {}),
		...(chosen ? { scopeIds: chosen } : {})
	});
	return {
		kindId: input.kind.id,
		versionId: input.published.id,
		kind,
		version: input.published,
		outcome: 'edited',
		scopeIds: chosen ?? null
	};
};
