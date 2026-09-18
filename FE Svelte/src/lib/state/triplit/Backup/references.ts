import { CodedError } from '$lib/model/Errors/CodedError';
import { assessmentIdFor, parseStoredAssessment } from '../IntentionAssessments/read';
import { readStoredTraceData, readStoredTraceTime } from '../Traces/stored-time';
import { activeRevisitsFrom, isSupplementMarker, supplementState } from '../Traces/supplement';
import { parseStatedDuration } from '../trace-duration';
import { assertTraceData, isJsonObject } from '../trace-kind-v-validation';
import { assertTraceTemporalPlacement } from '../trace-time';
import type { TraceAboutKind } from '../types';
import type { BackupCollection, BackupEntity } from './types';

type BackupCollections = Record<BackupCollection, BackupEntity[]>;

const assertIntersectionReferences = (collections: BackupCollections): void => {
	const kindIds = new Set(collections.traceKinds.map((row) => row.id));
	const assessmentsById = new Map(collections.intentionAssessments.map((row) => [row.id, row]));
	const scopesById = new Map(collections.scopes.map((row) => [row.id, row]));
	for (const row of collections.intersections) {
		if (row.fromEntityType != null && row.fromEntityType !== 'traceKind')
			throw new CodedError(
				'backup_link_source',
				`Неизвестный тип источника Intersection ${row.id}.`,
				{ id: row.id }
			);
		if (row.fromEntityType === 'traceKind') {
			const scope = scopesById.get(row.toId as string);
			if (row.kind !== 'belongs_to' || !kindIds.has(row.fromId as string) || !scope)
				throw new CodedError(
					'backup_kind_membership',
					`Некорректная принадлежность Kind ${row.id}.`,
					{ id: row.id }
				);
			if (
				row.scopeDeletionOperationId != null &&
				(!row.isDeleted ||
					!scope.isDeleted ||
					row.scopeDeletionOperationId !== scope.deletionOperationId)
			)
				throw new CodedError(
					'backup_membership_reason',
					`Некорректная причина снятия принадлежности ${row.id}.`,
					{ id: row.id }
				);
		} else if (row.scopeDeletionOperationId != null) {
			throw new CodedError(
				'backup_scope_reason',
				`Причина снятия Scope допустима только у принадлежности Kind ${row.id}.`,
				{ id: row.id }
			);
		}
		// A transfer binding must name an evidence source of the same fact: a retarget never
		// changes the fact or binds a direct source. Whether the source still sits at this link
		// is history after later moves, not corruption.
		if (row.assessmentId != null) {
			const bound = assessmentsById.get(row.assessmentId as string);
			if (row.kind !== 'evidence_for' || !bound)
				throw new CodedError(
					'backup_link_assessment_missing',
					`Связь ${row.id} ссылается на отсутствующую перенесённую оценку.`,
					{ id: row.id }
				);
			const stored = parseStoredAssessment(bound);
			if (!('factId' in stored.origin) || stored.origin.factId !== row.fromId)
				throw new CodedError(
					'backup_link_assessment_source',
					`Связь ${row.id} ссылается на перенесённую оценку другого источника.`,
					{ id: row.id }
				);
		}
	}
};

const assertTraceReferences = (collections: BackupCollections): void => {
	const traceIds = new Set(collections.traces.map((row) => row.id));
	const kindIds = new Set(collections.traceKinds.map((row) => row.id));
	const kindVersions = new Map(collections.traceKindVersions.map((row) => [row.id, row]));
	const intersections = collections.intersections;
	for (const row of collections.traces) {
		const aboutKind = row.aboutKind as TraceAboutKind;
		// Encoded and legacy shapes both decode here; corrupt markers or payloads fail the file.
		const aboutTime = readStoredTraceTime(row, aboutKind, {
			aboutAt: (row.aboutAt as string | null | undefined) ?? null,
			aboutStart: (row.aboutStart as string | null | undefined) ?? null,
			aboutEnd: (row.aboutEnd as string | null | undefined) ?? null
		});
		readStoredTraceData(row);
		const aboutTraceId = (row.aboutTraceId as string | null | undefined) ?? null;
		assertTraceTemporalPlacement(
			aboutKind,
			aboutTime,
			aboutTraceId,
			row.statedDuration == null ? null : parseStatedDuration(row.statedDuration)
		);
		const referenceId =
			aboutKind === 'trace_ref'
				? aboutTraceId
				: aboutTime?.basis === 'relative'
					? aboutTime.anchorTraceId
					: null;
		if (
			referenceId !== null &&
			(referenceId.trim() !== referenceId || referenceId === row.id || !traceIds.has(referenceId))
		)
			throw new CodedError(
				'backup_trace_reference',
				`Некорректная временная ссылка Trace ${row.id}: ${referenceId}.`,
				{ id: row.id, reference: referenceId }
			);
		// A typed record is pinned to an existing KindV of an existing Kind and its data must fit.
		const kindId = (row.kindId as string | null | undefined) ?? null;
		const kindVId = (row.kindVId as string | null | undefined) ?? null;
		if ((kindId === null) !== (kindVId === null))
			throw new CodedError(
				'backup_trace_typing',
				`Некорректная типизация Trace ${row.id}: Kind и версия задаются вместе.`,
				{ id: row.id }
			);
		if (kindId !== null && kindVId !== null) {
			const kindV = kindVersions.get(kindVId);
			if (!kindIds.has(kindId) || !kindV || kindV.kindId !== kindId)
				throw new CodedError(
					'backup_trace_version',
					`Trace ${row.id} ссылается на отсутствующую версию Kind.`,
					{ id: row.id }
				);
			if (!isJsonObject(kindV.dataSchema))
				throw new CodedError(
					'backup_version_schema',
					`Версия Kind ${kindVId} не содержит схемы данных.`,
					{ id: kindVId }
				);
			try {
				assertTraceData(readStoredTraceData(row), kindV.dataSchema);
			} catch (cause) {
				throw new CodedError(
					'backup_trace_data',
					`Данные Trace ${row.id} не соответствуют своей версии Kind: ${cause instanceof Error ? cause.message : String(cause)}`,
					{ id: row.id, detail: cause instanceof Error ? cause.message : String(cause) }
				);
			}
		}
		// An active supplement marker is a completed record with exactly one active revisits
		// link to an existing original.
		if (row.isDeleted !== true && isSupplementMarker({ aboutKind, aboutTime, aboutTraceId })) {
			const state = supplementState(
				row.id,
				row.relation,
				activeRevisitsFrom(intersections as never, row.id),
				(id) => traceIds.has(id)
			);
			if (state.status === 'intention')
				throw new CodedError(
					'backup_supplement_intention',
					`Дополнение ${row.id} не может быть намерением.`,
					{ id: row.id }
				);
			if (state.status === 'self')
				throw new CodedError(
					'backup_supplement_self',
					`Дополнение ${row.id} не может относиться к самому себе.`,
					{ id: row.id }
				);
			if (state.status !== 'valid')
				throw new CodedError(
					'backup_supplement_original',
					`Дополнение ${row.id} должно относиться ровно к одной существующей записи.`,
					{ id: row.id }
				);
		}
	}
};

/**
 * Every address of an assessment must point at existing rows of the right shape. Whether the
 * addressed link is still the active activation is an eligibility question, not corruption:
 * a retargeted or unlinked source keeps its historical address for history and undo.
 */
const assertAssessmentReferences = (collections: BackupCollections): void => {
	const traceIds = new Set(collections.traces.map((row) => row.id));
	const linksById = new Map(collections.intersections.map((row) => [row.id, row]));
	const isEvidenceLink = (linkId: string, factId: string, intentionId: string): boolean => {
		const link = linksById.get(linkId);
		return (
			link !== undefined &&
			link.kind === 'evidence_for' &&
			link.fromId === factId &&
			link.toId === intentionId
		);
	};
	for (const row of collections.intentionAssessments) {
		const stored = parseStoredAssessment(row);
		if (!traceIds.has(stored.origin.intentionId))
			throw new CodedError(
				'backup_assessment_intention',
				`Оценка ${row.id} ссылается на отсутствующее намерение.`,
				{ id: row.id }
			);
		if (!('factId' in stored.origin)) continue;
		const { factId, evidenceId, intentionId, activationId } = stored.origin;
		if (!traceIds.has(factId))
			throw new CodedError(
				'backup_assessment_fact',
				`Оценка ${row.id} ссылается на отсутствующий факт.`,
				{ id: row.id }
			);
		if (
			!isEvidenceLink(evidenceId, factId, intentionId) ||
			row.id !== assessmentIdFor(activationId)
		)
			throw new CodedError(
				'backup_assessment_link',
				`Оценка ${row.id} ссылается на несуществующую связь «результат для».`,
				{ id: row.id }
			);
		if (stored.placement) {
			if (
				!traceIds.has(stored.placement.intentionId) ||
				!isEvidenceLink(stored.placement.evidenceId, factId, stored.placement.intentionId)
			)
				throw new CodedError(
					'backup_assessment_source_link',
					`Перенесённая оценка ${row.id} ссылается на несуществующую связь.`,
					{ id: row.id }
				);
		}
	}
};

export const assertBackupReferences = (collections: BackupCollections): void => {
	assertIntersectionReferences(collections);
	assertTraceReferences(collections);
	assertAssessmentReferences(collections);
};
