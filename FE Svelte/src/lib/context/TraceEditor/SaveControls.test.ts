import { render } from 'svelte/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CodedError } from '$lib/model/Errors/CodedError';
import { openDraftFixture, type DraftFixture } from '$lib/state/TraceDraft/TraceDraft.fixture';
import SaveControls from './SaveControls.svelte';

let fx: DraftFixture;
beforeEach(() => {
	fx = openDraftFixture();
});
afterEach(async () => {
	await fx.dispose();
});

const props = (draft: Awaited<ReturnType<DraftFixture['open']>>) => ({
	draft,
	onsave: () => {},
	oncancel: () => {}
});

describe('SaveControls', () => {
	it('tells the truth about a saved record whose opening failed and offers the same opening', async () => {
		const draft = await fx.open({ mode: 'create' });
		draft.title = 'Сохранено, не открыто';
		await draft.save(async () => {
			throw new CodedError('repository_unreadable', 'the repository could not be read');
		});
		expect(draft.phase).toBe('openFailed');
		const { body } = render(SaveControls, { props: props(draft) });
		expect(body).toContain('data-phase="openFailed"');
		expect(body).toContain(
			'Запись сохранена, но не удалось её открыть: Не удалось прочитать данные.'
		);
		expect(body).toContain('data-testid="retry-open"');
		expect(body).not.toContain('data-testid="capture-save"');
	});

	it('shows the saving and refused states around one save button', async () => {
		const draft = await fx.open({ mode: 'create' });
		draft.title = 'Черновик';
		expect(render(SaveControls, { props: props(draft) }).body).toContain(
			'data-testid="capture-save"'
		);
		await draft.save(async () => {});
		const refused = await fx.open(
			{ mode: 'create' },
			{
				repository: {
					...fx.repository,
					saveTraceRecord: async () => {
						throw new Error('Хранилище недоступно.');
					}
				}
			}
		);
		refused.title = 'Отклонено';
		await refused.save(async () => {});
		const { body } = render(SaveControls, { props: props(refused) });
		// A plain failure is named as unexpected; a coded one would read as the interface's copy.
		expect(body).toContain('Не удалось сохранить: Непредвиденная ошибка: Хранилище недоступно.');
		expect(body).toContain('data-testid="capture-save"');
	});
});
