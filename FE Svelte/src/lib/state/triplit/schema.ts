import { Schema as S } from '@triplit/client';

export const schema = S.Collections({
	scopeCaptureSettings: {
		schema: S.Schema({ id: S.Id(), suggestedKindIds: S.Json() })
	},
	uiThemes: { schema: S.Schema({ id: S.Id(), data: S.Json() }) },
	uiAppearance: { schema: S.Schema({ id: S.Id(), themeId: S.String(), mode: S.String() }) },
	traceKinds: {
		schema: S.Schema({
			id: S.Id(),
			name: S.String(),
			currentKindVId: S.String(),
			createdAt: S.String(),
			updatedAt: S.String()
		})
	},
	traceKindVersions: {
		schema: S.Schema({
			id: S.Id(),
			kindId: S.String(),
			generation: S.Number(),
			parentKindVIds: S.Json(),
			dataSchema: S.Json(),
			uiSchema: S.Optional(S.Json()),
			fieldMeta: S.Optional(S.Json()),
			createdAt: S.String(),
			createdByDeviceId: S.String()
		})
	},
	traces: {
		schema: S.Schema({
			id: S.Id(),
			capturedAt: S.String(),
			timezone: S.String(),
			aboutKind: S.String(),
			aboutTime: S.Optional(S.Json()),
			statedDuration: S.Optional(S.Json()),
			aboutAt: S.Optional(S.String()),
			aboutStart: S.Optional(S.String()),
			aboutEnd: S.Optional(S.String()),
			aboutTraceId: S.Optional(S.String()),
			content: S.String(),
			/** Plain records: optional description beside the title in `content`; typed records keep null. */
			description: S.Optional(S.String()),
			relation: S.Optional(S.String()),
			kindId: S.Optional(S.String()),
			kindVId: S.Optional(S.String()),
			data: S.Optional(S.Json()),
			// Retain pre-Kind payloads: removing populated fields aborts Triplit schema upgrades.
			dataJson: S.Optional(S.String()),
			/** Per-field marker: 1 = the field is stored as a singleton array [value]. */
			encoding: S.Optional(S.Json()),
			/** Per-field revision: the operation that last wrote the field (Traces/revisions.ts). */
			revisions: S.Optional(S.Json()),
			isDeleted: S.Boolean(),
			createdAt: S.String(),
			updatedAt: S.String()
		}),
		relationships: {
			activeScopeMemberships: S.RelationMany('intersections', {
				where: [
					['fromId', '=', '$1.id'],
					['kind', '=', 'belongs_to'],
					['isDeleted', '=', false]
				]
			})
		}
	},
	periods: {
		schema: S.Schema({
			id: S.Id(),
			name: S.String(),
			time: S.Json(),
			timezone: S.String(),
			note: S.Optional(S.String()),
			isDeleted: S.Boolean(),
			createdAt: S.String(),
			updatedAt: S.String()
		})
	},
	scopes: {
		schema: S.Schema({
			id: S.Id(),
			name: S.String(),
			note: S.Optional(S.String()),
			parentScopeId: S.Optional(S.String()),
			// Stored by pre-Kind clients; preserved without restoring the old Scope binding.
			definitionId: S.Optional(S.String()),
			startedAt: S.Optional(S.String()),
			endedAt: S.Optional(S.String()),
			isDeleted: S.Boolean(),
			deletionOperationId: S.Optional(S.String()),
			createdAt: S.String(),
			updatedAt: S.String()
		})
	},
	scopeSegments: {
		schema: S.Schema({
			id: S.Id(),
			scopeId: S.String(),
			// Legacy segment metadata remains readable in storage and backups.
			phase: S.Optional(S.String()),
			startAt: S.Optional(S.String()),
			endAt: S.Optional(S.String()),
			label: S.Optional(S.String()),
			position: S.Number(),
			createdAt: S.String(),
			updatedAt: S.String()
		})
	},
	intersections: {
		schema: S.Schema({
			id: S.Id(),
			fromId: S.String(),
			toId: S.String(),
			kind: S.String(),
			context: S.Optional(S.String()),
			fromEntityType: S.Optional(S.String()),
			activationId: S.Optional(S.String()),
			lifecycleId: S.Optional(S.String()),
			scopeDeletionOperationId: S.Optional(S.String()),
			/** Transfer binding: the assessment a retarget moved onto this evidence link. */
			assessmentId: S.Optional(S.String()),
			isDeleted: S.Boolean(),
			createdAt: S.String(),
			updatedAt: S.String()
		})
	},
	intentionAssessments: {
		schema: S.Schema({
			id: S.Id(),
			source: S.String(),
			origin: S.Json(),
			initial: S.Json(),
			values: S.Optional(S.Json()),
			placement: S.Optional(S.Json()),
			isDeleted: S.Optional(S.Boolean()),
			lifecycleId: S.Optional(S.String()),
			updatedAt: S.String()
		})
	},
	sources: {
		schema: S.Schema({
			id: S.Id(),
			title: S.String(),
			kind: S.String(),
			content: S.String(),
			capturedAt: S.Optional(S.String()),
			isDeleted: S.Boolean(),
			createdAt: S.String(),
			updatedAt: S.String()
		})
	},
	assertions: {
		schema: S.Schema({
			id: S.Id(),
			statement: S.String(),
			epistemicLayer: S.String(),
			confidence: S.String(),
			reviewStatus: S.String(),
			reviewedAt: S.Optional(S.String()),
			note: S.Optional(S.String()),
			isDeleted: S.Boolean(),
			createdAt: S.String(),
			updatedAt: S.String()
		})
	},
	citations: {
		schema: S.Schema({
			id: S.Id(),
			assertionId: S.String(),
			sourceId: S.String(),
			startOffset: S.Number(),
			endOffset: S.Number(),
			label: S.Optional(S.String()),
			isDeleted: S.Boolean(),
			createdAt: S.String(),
			updatedAt: S.String()
		})
	},
	assertionRelations: {
		schema: S.Schema({
			id: S.Id(),
			fromAssertionId: S.String(),
			toAssertionId: S.String(),
			kind: S.String(),
			isDeleted: S.Boolean(),
			createdAt: S.String(),
			updatedAt: S.String()
		})
	},
	provenanceLinks: {
		schema: S.Schema({
			id: S.Id(),
			assertionId: S.String(),
			targetType: S.String(),
			targetId: S.String(),
			targetPath: S.Optional(S.String()),
			isDeleted: S.Boolean(),
			createdAt: S.String(),
			updatedAt: S.String()
		})
	},
	logs: {
		schema: S.Schema({
			id: S.Id(),
			operationId: S.String(),
			entityType: S.String(),
			entityId: S.String(),
			action: S.String(),
			patchJson: S.String(),
			occurredAt: S.String(),
			deviceId: S.String(),
			actor: S.String(),
			cause: S.String()
		})
	}
});
