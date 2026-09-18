import { schemaDefaults } from '$lib/forms/TraceForms/runtime';
import { openRecordFixture, type RecordFixture } from '$lib/state/triplit/Traces/record.fixture';
import type { Scope, TraceKind, TraceKindV, TraceKindVDraft } from '$lib/state/triplit/types';
import { TraceDraftState, type TraceDraftOptions } from './TraceDraft.svelte';
import type { DraftEntry } from './types';

/** The clock of every draft in these tests: the 13th, so the 12th is a past date. */
export const NOW = new Date('2026-09-13T10:00:00.000Z');

export const numberKind = (title: string, field: string): TraceKindVDraft => ({
	dataSchema: {
		type: 'object',
		additionalProperties: false,
		required: [field],
		properties: { [field]: { type: 'number', title, default: 80 } }
	}
});

export type DraftFixture = RecordFixture & {
	open: (entry: DraftEntry, options?: Partial<TraceDraftOptions>) => Promise<TraceDraftState>;
	/** A Kind with its head version and, optionally, its own Scopes. */
	kind: (
		name: string,
		definition: TraceKindVDraft,
		scopeIds?: readonly string[]
	) => Promise<{ kind: TraceKind; version: TraceKindV }>;
	scope: (name: string) => Promise<Scope>;
};

/** A fresh in-memory repository with drafts that are disposed with it. */
export const openDraftFixture = (): DraftFixture => {
	const fixture = openRecordFixture();
	const drafts: TraceDraftState[] = [];
	return {
		...fixture,
		open: async (entry, options = {}) => {
			const draft = new TraceDraftState(entry, {
				repository: fixture.repository,
				defaults: schemaDefaults,
				now: () => NOW,
				timezone: () => 'UTC',
				...options
			});
			await draft.load();
			drafts.push(draft);
			return draft;
		},
		kind: async (name, definition, scopeIds = []) => {
			const created = await fixture.repository.createTraceKind({ name, initialKindV: definition });
			if (scopeIds.length > 0) {
				await fixture.repository.setTraceKindScopes(created.kind.id, [...scopeIds]);
			}
			return { kind: created.kind, version: created.kindV };
		},
		scope: (name) => fixture.repository.createScope({ name }),
		dispose: async () => {
			for (const draft of drafts) draft.dispose();
			await fixture.dispose();
		}
	};
};

/** Active Scope memberships of a Trace. */
export const membershipsOf = async (fixture: RecordFixture, traceId: string): Promise<string[]> =>
	(await fixture.repository.listIntersections())
		.filter((link) => link.kind === 'belongs_to' && link.fromId === traceId)
		.map((link) => link.toId)
		.toSorted();

/** Journal rows of one operation, as `entityType:action`. */
export const operationLogs = async (
	fixture: RecordFixture,
	operationId: string
): Promise<string[]> =>
	(await fixture.repository.listLogs())
		.filter((log) => log.operationId === operationId)
		.map((log) => `${log.entityType}:${log.action}`)
		.toSorted();

export const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
