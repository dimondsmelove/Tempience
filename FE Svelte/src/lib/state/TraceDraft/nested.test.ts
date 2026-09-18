import { afterEach, describe, expect, it } from 'vitest';
import { openRecordFixture, type RecordFixture } from '$lib/state/triplit/Traces/record.fixture';
import { NestedSave } from './nested.svelte';

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

let fixture: RecordFixture | undefined;
afterEach(async () => {
	await fixture?.dispose();
	fixture = undefined;
});

describe('NestedSave — one write, a latched result, a repeatable return', () => {
	it('writes once, latches the result, repeats only the return after it failed, then is done', async () => {
		const saving = new NestedSave<string>();
		let writes = 0;
		let returns = 0;
		const write = async () => {
			writes += 1;
			return `scope-${writes}`;
		};
		await saving.run(write, () => {
			returns += 1;
			if (returns === 1) throw new Error('Не удалось обновить представление.');
		});
		expect([writes, returns, saving.committed]).toEqual([1, 1, 'scope-1']);
		expect(saving.failure).toMatchObject({
			stage: 'return',
			message: 'Не удалось обновить представление.'
		});
		// A second click on the same save never writes again: the result is already there.
		await saving.retry();
		expect([writes, returns, saving.failure, saving.committed]).toEqual([1, 2, null, null]);
		// The step is complete: a further retry does nothing, a further run is a new write.
		await saving.retry();
		expect([writes, returns]).toEqual([1, 2]);
		await saving.run(write, () => {
			returns += 1;
		});
		expect([writes, returns, saving.committed]).toEqual([2, 3, null]);
	});

	it('a refused write leaves nothing latched; a double click during the write is one write', async () => {
		const saving = new NestedSave<string>();
		let writes = 0;
		await saving.run(
			async () => {
				writes += 1;
				throw new Error('Хранилище недоступно.');
			},
			() => {}
		);
		expect([writes, saving.committed, saving.failure?.stage]).toEqual([1, null, 'write']);
		let release!: () => void;
		const pending = new Promise<void>((resolve) => (release = resolve));
		const first = saving.run(
			async () => {
				writes += 1;
				await pending;
				return 'kind';
			},
			() => {}
		);
		expect(saving.busy).toBe(true);
		const second = saving.run(
			async () => {
				writes += 1;
				return 'duplicate';
			},
			() => {}
		);
		release();
		await Promise.all([first, second]);
		await flush();
		expect([writes, saving.failure, saving.busy]).toEqual([2, null, false]);
	});

	it('hands every run to its holder, so the form’s exit rule can wait for it', async () => {
		const held: Promise<void>[] = [];
		const saving = new NestedSave<string>((run) => held.push(run));
		await saving.run(
			async () => 'scope',
			() => {
				throw new Error('later');
			}
		);
		await saving.retry();
		expect(held).toHaveLength(2);
	});

	it('a Scope committed in the repository stays single when the return fails and is repeated', async () => {
		fixture = openRecordFixture();
		const { repository } = fixture;
		const scope = new NestedSave<string>();
		let returned = 0;
		await scope.run(
			async () => (await repository.createScope({ name: 'Созданный внутри' })).id,
			() => {
				returned += 1;
				if (returned === 1) throw new Error('Не удалось вернуться к форме.');
			}
		);
		expect(scope.failure?.stage).toBe('return');
		await scope.retry();
		expect(scope.failure).toBeNull();
		expect((await repository.listScopes()).map((row) => row.name)).toEqual(['Созданный внутри']);
	});
});
