import { afterEach, describe, expect, it } from 'vitest';
import { compileTraceForm, decodeTraceForm } from '$lib/model/TraceForm/TraceForm';
import { openRecordFixture, type RecordFixture } from '$lib/state/triplit/Traces/record.fixture';
import type { TraceKindVDraft } from '$lib/state/triplit/types';
import { sameDefinition, saveKind } from './kind-save';

const NUMBER: TraceKindVDraft = {
	dataSchema: {
		type: 'object',
		title: 'Замер',
		additionalProperties: false,
		properties: { value: { type: 'number', title: 'Значение' } }
	},
	uiSchema: {},
	fieldMeta: {}
};

let fixture: RecordFixture;
afterEach(async () => {
	await fixture?.dispose();
});
const open = () => {
	fixture = openRecordFixture();
	return fixture.repository;
};
const membershipsOf = async (kindId: string) =>
	(await fixture.repository.listIntersections())
		.filter((link) => link.fromId === kindId && link.kind === 'belongs_to')
		.map((link) => link.toId)
		.toSorted();

describe('saveKind — one authoring save of a Kind', () => {
	it('tells a rename from a changed form: the root title is the name, the fields are the version', () => {
		const published = { ...NUMBER, dataSchema: { ...NUMBER.dataSchema, title: 'Замер' } };
		const renamed = compileTraceForm(decodeTraceForm('Вес', published));
		expect(sameDefinition(renamed, published)).toBe(true);
		expect(renamed.dataSchema.title).toBe('Вес');
		const changed = compileTraceForm({
			...decodeTraceForm('Замер', published),
			fields: [
				...decodeTraceForm('Замер', published).fields,
				{ id: 'n', label: 'Заметка', required: false, kind: 'text', unit: '', options: [] }
			]
		});
		expect(sameDefinition(changed, published)).toBe(false);
	});

	it('creates a Kind with the memberships shown, in one operation', async () => {
		const repo = open();
		const a = await repo.createScope({ name: 'A' });
		const result = await saveKind(repo, {
			name: 'Замер',
			definition: NUMBER,
			memberships: { scopeIds: [a.id], explicit: false }
		});
		expect(result.outcome).toBe('created');
		expect(await membershipsOf(result.kindId)).toEqual([a.id]);
		const logs = (await repo.listLogs()).filter((log) => log.entityId !== a.id);
		expect(new Set(logs.map((log) => log.operationId)).size).toBe(1);
	});

	it('a rename with an untouched selection keeps a deleted Scope’s membership restorable', async () => {
		const repo = open();
		const a = await repo.createScope({ name: 'A' });
		const created = await repo.createTraceKind({
			name: 'Замер',
			initialKindV: NUMBER,
			scopeIds: [a.id]
		});
		await repo.setScopeDeleted(a.id, true);
		const [kind] = await repo.listTraceKinds();
		const [published] = await repo.listTraceKindVersions(kind.id);
		const result = await saveKind(repo, {
			kind,
			published,
			name: 'Вес',
			definition: compileTraceForm(decodeTraceForm('Вес', published)),
			memberships: { scopeIds: [], explicit: false }
		});
		expect([result.outcome, result.scopeIds]).toEqual(['edited', null]);
		expect((await repo.listTraceKinds())[0].name).toBe('Вес');
		expect(await repo.listTraceKindVersions(kind.id)).toHaveLength(1);
		await repo.setScopeDeleted(a.id, false);
		expect(await membershipsOf(created.kind.id)).toEqual([a.id]);
	});

	it('an explicit «Без Scope» on an already empty selection withdraws the pending restore', async () => {
		const repo = open();
		const a = await repo.createScope({ name: 'A' });
		await repo.createTraceKind({ name: 'Замер', initialKindV: NUMBER, scopeIds: [a.id] });
		await repo.setScopeDeleted(a.id, true);
		const [kind] = await repo.listTraceKinds();
		const [published] = await repo.listTraceKindVersions(kind.id);
		const result = await saveKind(repo, {
			kind,
			published,
			name: kind.name,
			definition: compileTraceForm(decodeTraceForm(kind.name, published)),
			memberships: { scopeIds: [], explicit: true }
		});
		expect([result.outcome, result.scopeIds]).toEqual(['edited', []]);
		await repo.setScopeDeleted(a.id, false);
		expect(await membershipsOf(kind.id)).toEqual([]);
	});

	it('changed fields publish a new version with the chosen memberships; nothing changed writes nothing', async () => {
		const repo = open();
		const a = await repo.createScope({ name: 'A' });
		const b = await repo.createScope({ name: 'B' });
		await repo.createTraceKind({ name: 'Замер', initialKindV: NUMBER, scopeIds: [a.id] });
		const [kind] = await repo.listTraceKinds();
		const [published] = await repo.listTraceKindVersions(kind.id);
		const untouched = await saveKind(repo, {
			kind,
			published,
			name: kind.name,
			definition: compileTraceForm(decodeTraceForm(kind.name, published)),
			memberships: { scopeIds: [a.id], explicit: false }
		});
		const logs = await repo.listLogs();
		expect(untouched.outcome).toBe('unchanged');
		const draft = decodeTraceForm(kind.name, published);
		const versioned = await saveKind(repo, {
			kind,
			published,
			name: kind.name,
			definition: compileTraceForm({
				...draft,
				fields: [
					...draft.fields,
					{ id: 'n', label: 'Заметка', required: false, kind: 'text', unit: '', options: [] }
				]
			}),
			memberships: { scopeIds: [a.id, b.id], explicit: true }
		});
		expect(versioned.outcome).toBe('versioned');
		expect(await repo.listTraceKindVersions(kind.id)).toHaveLength(2);
		expect(await membershipsOf(kind.id)).toEqual([a.id, b.id].toSorted());
		const newLogs = (await repo.listLogs()).filter((log) => !logs.some((old) => old.id === log.id));
		expect(new Set(newLogs.map((log) => log.operationId)).size).toBe(1);
	});
});
