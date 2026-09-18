import { afterEach, expect, it } from 'vitest';
import { createAssessmentFixture, type AssessmentFixture } from './fixture';

const fixtures: AssessmentFixture[] = [];
const setup = async (): Promise<AssessmentFixture> => {
	const fixture = await createAssessmentFixture();
	fixtures.push(fixture);
	return fixture;
};
afterEach(async () => {
	for (const fixture of fixtures.splice(0)) await fixture.dispose();
});

it('applies the explicit values of a revival as corrections over earlier corrections', async () => {
	const { repository, client, link } = await setup();
	const created = await repository.createEvidenceAssessment(link.id, { outcome: 'completed' });
	await repository.editIntentionAssessment(created.id, { outcome: 'partial' });
	await repository.setIntentionAssessmentDeleted(created.id, true);
	const revived = await repository.createEvidenceAssessment(link.id, { outcome: 'completed' });
	expect(revived).toMatchObject({
		id: created.id,
		isDeleted: false,
		outcome: 'completed',
		open: null,
		firstAssessedAt: created.firstAssessedAt
	});
	const [log] = await repository.listLogs(created.id);
	expect(log).toMatchObject({
		action: 'restored',
		cause: 'normal',
		patch: {
			isDeleted: { before: true, after: false },
			outcome: { before: 'partial', after: 'completed' }
		}
	});
	expect(revived.outcomeRevision).toBe(log.operationId);
	// The persisted row reads the same as the returned value.
	const [reread] = await repository.listIntentionAssessments();
	expect(reread).toEqual(revived);
	const stored = await client.fetchById('intentionAssessments', created.id, {
		policy: 'local-only'
	});
	// A revival is not a concurrent first creation: the first creations stay as they were.
	expect(Object.keys(stored?.initial as object)).toHaveLength(1);
	expect((stored?.values as { outcome: { value: string } }).outcome.value).toBe('completed');
});

it('persists a newly supplied feature on revival so a delayed first creation cannot displace it', async () => {
	const { repository, client, link } = await setup();
	const created = await repository.createEvidenceAssessment(link.id, { outcome: 'completed' });
	await repository.setIntentionAssessmentDeleted(created.id, true);
	const revived = await repository.createEvidenceAssessment(link.id, { open: false });
	expect(revived).toMatchObject({ open: false, outcome: 'completed' });
	const stored = await client.fetchById('intentionAssessments', created.id, {
		policy: 'local-only'
	});
	expect((stored?.values as { open: { value: boolean; operationId: string } }).open).toEqual({
		value: false,
		operationId: revived.openRevision,
		statement: revived.openRevision
	});
	// Storage-level merge of a late concurrent first creation from a client that never saw the row.
	const lateAt = new Date(Date.parse(revived.updatedAt) + 1000).toISOString();
	await client.update('intentionAssessments', created.id, {
		initial: { 'late-offline-first': { at: lateAt, open: true } }
	});
	const [merged] = await repository.listIntentionAssessments();
	expect(merged).toMatchObject({
		id: created.id,
		open: false,
		openRevision: revived.openRevision,
		outcome: 'completed',
		outcomeRevision: created.outcomeRevision,
		firstAssessedAt: created.firstAssessedAt
	});
});

it('treats a restated value on revival as a correction too', async () => {
	const { repository, client, link } = await setup();
	const created = await repository.createEvidenceAssessment(link.id, { outcome: 'completed' });
	await repository.setIntentionAssessmentDeleted(created.id, true);
	const revived = await repository.createEvidenceAssessment(link.id, { outcome: 'completed' });
	expect(revived.outcomeRevision).toBe(revived.lifecycleId);
	const lateAt = new Date(Date.parse(revived.updatedAt) + 1000).toISOString();
	await client.update('intentionAssessments', created.id, {
		initial: { 'late-offline-first': { at: lateAt, outcome: 'partial' } }
	});
	expect((await repository.listIntentionAssessments())[0]).toMatchObject({
		outcome: 'completed',
		outcomeRevision: revived.lifecycleId,
		firstAssessedAt: created.firstAssessedAt
	});
	// An ordinary edit that changes nothing leaves revisions and the journal alone, and names
	// no operation of its own.
	expect(await repository.editIntentionAssessment(created.id, { outcome: 'completed' })).toEqual({
		assessment: (await repository.listIntentionAssessments())[0],
		operation: null
	});
	expect(await repository.listLogs(created.id)).toHaveLength(3);
});

it('keeps untouched features on revival and honours null clearing and explicit false', async () => {
	const { repository, link } = await setup();
	const created = await repository.createEvidenceAssessment(link.id, {
		outcome: 'completed',
		open: true
	});
	await repository.editIntentionAssessment(created.id, { outcome: 'partial' });
	await repository.setIntentionAssessmentDeleted(created.id, true);
	// Only openness is supplied: the corrected outcome stays as it was.
	const kept = await repository.createEvidenceAssessment(link.id, { open: false });
	expect(kept).toMatchObject({ outcome: 'partial', open: false });
	expect((await repository.listLogs(created.id))[0].patch).toEqual({
		isDeleted: { before: true, after: false },
		lifecycleId: { before: expect.any(String), after: kept.lifecycleId },
		open: { before: true, after: false },
		openRevision: { before: expect.any(String), after: kept.openRevision }
	});
	await repository.setIntentionAssessmentDeleted(created.id, true);
	const cleared = await repository.createEvidenceAssessment(link.id, {
		outcome: null,
		open: true
	});
	expect(cleared).toMatchObject({
		outcome: null,
		open: true,
		outcomeRevision: cleared.lifecycleId,
		firstAssessedAt: created.firstAssessedAt
	});
	expect((await repository.listLogs(created.id))[0].patch).toMatchObject({
		outcome: { before: 'partial', after: null },
		open: { before: false, after: true }
	});
	expect((await repository.listIntentionAssessments())[0]).toEqual(cleared);
});

it('orders the list by instant, not by timestamp spelling, with a stable identity tie-break', async () => {
	const { repository, client, intention } = await setup();
	const row = (id: string, at: string) => ({
		id,
		source: 'direct',
		origin: { intentionId: intention.id },
		initial: { [`op-${id}`]: { at, open: false } },
		updatedAt: '2026-09-13T12:00:00.000Z'
	});
	// Offset spellings sort lexically after UTC ones; instants must decide. Equal instants
	// fall back to code-unit identity order ('Z' before 'a'), unlike locale collation.
	await client.insert('intentionAssessments', row('offset-0930', '2026-09-13T11:30:00+02:00'));
	await client.insert('intentionAssessments', row('utc-0900', '2026-09-13T09:00:00Z'));
	await client.insert('intentionAssessments', row('a-1000', '2026-09-13T10:00:00.000Z'));
	await client.insert('intentionAssessments', row('Z-1000', '2026-09-13T12:00:00+02:00'));
	const listed = await repository.listIntentionAssessments();
	expect(listed.map((assessment) => assessment.id)).toEqual([
		'Z-1000',
		'a-1000',
		'offset-0930',
		'utc-0900'
	]);
	expect(listed.map((assessment) => assessment.firstAssessedAt)).toEqual([
		'2026-09-13T10:00:00.000Z',
		'2026-09-13T10:00:00.000Z',
		'2026-09-13T09:30:00.000Z',
		'2026-09-13T09:00:00.000Z'
	]);
});
