import { describe, expect, it, vi } from 'vitest';
import { DATA_SPACES } from '$lib/state/triplit/data-space';
import type {
	ScenarioImportBatch,
	ScenarioImportReceipt
} from '$lib/state/triplit/scenario-import-repository';
import {
	E2E_SYNTHETIC_LEGACY_SLOTS_KEY,
	E2E_SYNTHETIC_MANIFEST_KEY,
	E2E_SYNTHETIC_SEED_MARKER_KEY,
	bootstrapE2eSyntheticSeed,
	type E2eSyntheticSeedStorage
} from './bootstrap';

const clockValue = '2026-09-04T12:00:00.000Z';

const manifestText = JSON.stringify({
	schemaVersion: 'tempience.calibration-review.v2',
	manifestId: 'synthetic-unit-manifest',
	title: 'Synthetic unit manifest',
	sourceIds: ['source:unit'],
	claimRefs: [],
	claimEvidence: [],
	candidates: [
		{
			candidateId: 'scope-alpha',
			role: 'scope',
			proposed: { name: 'Alpha', note: null, startedAt: null, endedAt: null },
			claimRefs: [],
			gate: 'mapped',
			reason: null
		}
	]
});

const storage = (values: Record<string, string> = {}): E2eSyntheticSeedStorage => {
	const map = new Map(Object.entries(values));
	return {
		getItem: vi.fn((key: string) => map.get(key) ?? null),
		setItem: vi.fn((key: string, value: string) => void map.set(key, value))
	};
};

const receipt = (batch: ScenarioImportBatch, failures: string[] = []): ScenarioImportReceipt => ({
	created: batch.entries.length,
	reused: 0,
	skipped: 0,
	failures: failures.map((reason) => ({ reason })),
	mapping: batch.mapping,
	manifestId: batch.manifestId,
	manifestVersion: batch.manifestVersion,
	targetDataSpaceId: batch.targetDataSpaceId,
	capturedAt: batch.capturedAt,
	appliedAt: clockValue
});

describe('e2e synthetic scenario seed bootstrap', () => {
	it('is a strict no-op outside the e2e-synthetic data space', async () => {
		const apply = vi.fn();

		for (const dataSpace of [DATA_SPACES.canonical, DATA_SPACES['belgrade-what-if-v1']]) {
			const target = storage({ [E2E_SYNTHETIC_MANIFEST_KEY]: manifestText });
			await expect(
				bootstrapE2eSyntheticSeed({
					dataSpace,
					importRepository: { apply },
					clock: () => clockValue,
					storage: target
				})
			).resolves.toEqual({ status: 'skipped', reason: 'not-target' });
			expect(target.getItem).not.toHaveBeenCalled();
		}
		expect(apply).not.toHaveBeenCalled();
	});

	it('does nothing when the harness left no manifest behind', async () => {
		const apply = vi.fn();

		await expect(
			bootstrapE2eSyntheticSeed({
				dataSpace: DATA_SPACES['e2e-synthetic'],
				importRepository: { apply },
				clock: () => clockValue,
				storage: storage()
			})
		).resolves.toEqual({ status: 'skipped', reason: 'no-manifest' });
		expect(apply).not.toHaveBeenCalled();
	});

	it('imports the harness manifest into the e2e space and records its marker', async () => {
		const target = storage({ [E2E_SYNTHETIC_MANIFEST_KEY]: manifestText });
		const apply = vi.fn(async (batch: ScenarioImportBatch) => receipt(batch));

		const result = await bootstrapE2eSyntheticSeed({
			dataSpace: DATA_SPACES['e2e-synthetic'],
			importRepository: { apply },
			clock: () => clockValue,
			storage: target
		});

		expect(result.status).toBe('applied');
		expect(apply).toHaveBeenCalledOnce();
		const batch = apply.mock.calls[0][0];
		expect(batch.targetDataSpaceId).toBe('e2e-synthetic');
		expect(batch.manifestId).toBe('synthetic-unit-manifest');
		expect(batch.capturedAt).toBe(clockValue);
		expect(target.setItem).toHaveBeenCalledExactlyOnceWith(
			E2E_SYNTHETIC_SEED_MARKER_KEY,
			'synthetic-unit-manifest'
		);
	});

	it('stamps a loop-005 colour slot onto a seeded Scope when the harness asks, before the marker', async () => {
		const target = storage({
			[E2E_SYNTHETIC_MANIFEST_KEY]: manifestText,
			[E2E_SYNTHETIC_LEGACY_SLOTS_KEY]: JSON.stringify({ 'scope-alpha': 3, 'scope-missing': 5 })
		});
		const stamp = vi.fn(async () => {});
		const apply = vi.fn(async (batch: ScenarioImportBatch) => receipt(batch));

		const result = await bootstrapE2eSyntheticSeed({
			dataSpace: DATA_SPACES['e2e-synthetic'],
			importRepository: { apply },
			clock: () => clockValue,
			storage: target,
			stampLegacySlot: stamp
		});

		expect(result.status).toBe('applied');
		const batch = apply.mock.calls[0][0];
		// Only a seeded candidate is stamped, with the id the import gave it.
		expect(stamp).toHaveBeenCalledExactlyOnceWith(batch.mapping['scope-alpha'], 3);
		expect(target.setItem).toHaveBeenCalledExactlyOnceWith(
			E2E_SYNTHETIC_SEED_MARKER_KEY,
			'synthetic-unit-manifest'
		);
		// Without a stamp writer the key is inert.
		const plain = storage({
			[E2E_SYNTHETIC_MANIFEST_KEY]: manifestText,
			[E2E_SYNTHETIC_LEGACY_SLOTS_KEY]: JSON.stringify({ 'scope-alpha': 3 })
		});
		await bootstrapE2eSyntheticSeed({
			dataSpace: DATA_SPACES['e2e-synthetic'],
			importRepository: { apply },
			clock: () => clockValue,
			storage: plain
		});
		expect(plain.setItem).toHaveBeenCalledOnce();
	});

	it('re-imports nothing after a reload and keeps the marker on failed applies', async () => {
		const seeded = storage({
			[E2E_SYNTHETIC_MANIFEST_KEY]: manifestText,
			[E2E_SYNTHETIC_SEED_MARKER_KEY]: 'synthetic-unit-manifest'
		});
		const apply = vi.fn();

		await expect(
			bootstrapE2eSyntheticSeed({
				dataSpace: DATA_SPACES['e2e-synthetic'],
				importRepository: { apply },
				clock: () => clockValue,
				storage: seeded
			})
		).resolves.toEqual({ status: 'skipped', reason: 'marker' });
		expect(apply).not.toHaveBeenCalled();

		const failing = storage({ [E2E_SYNTHETIC_MANIFEST_KEY]: manifestText });
		const result = await bootstrapE2eSyntheticSeed({
			dataSpace: DATA_SPACES['e2e-synthetic'],
			importRepository: {
				apply: async (batch: ScenarioImportBatch) => receipt(batch, ['scope-alpha rejected'])
			},
			clock: () => clockValue,
			storage: failing
		});

		expect(result.status).toBe('applied');
		expect(failing.setItem).not.toHaveBeenCalled();
	});
});
