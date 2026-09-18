import { expect, type Page } from '@playwright/test';

export const SKIP = 'The app’s modules are reachable on a dev server only.';
export const REPOSITORY = '/src/lib/state/triplit/index.ts';

/** A Kind through the app's own repository, with a schema the builder would not make itself. */
export const seedKind = (
	page: Page,
	name: string,
	dataSchema: Record<string, unknown>,
	fieldMeta?: Record<string, unknown>
): Promise<string> =>
	page.evaluate(
		async ([kindName, schema, meta, path]) => {
			const { tempienceRepository } = await import(
				/* @vite-ignore */ window.__appModule!(path as string)
			);
			const { kind } = await tempienceRepository.createTraceKind({
				name: kindName as string,
				initialKindV: { dataSchema: schema as never, ...(meta ? { fieldMeta: meta as never } : {}) }
			});
			return kind.id;
		},
		[name, dataSchema, fieldMeta, REPOSITORY] as const
	);

/** The timeline again, ready, after something was seeded behind the workbench's back. */
export const timeline = async (page: Page): Promise<void> => {
	await page.goto('/time');
	await expect(page.getByTestId('time-workbench')).toHaveAttribute('data-status', 'ready', {
		timeout: 20_000
	});
};
