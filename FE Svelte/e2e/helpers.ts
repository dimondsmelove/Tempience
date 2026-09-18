import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';

export const artifactDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'artifacts');

export function trackConsoleErrors(page: Page): string[] {
	const errors: string[] = [];
	page.on('console', (msg) => {
		if (msg.type() === 'error') errors.push(msg.text());
	});
	return errors;
}

export async function captureArtifact(page: Page, name: string): Promise<string> {
	const filePath = path.join(artifactDir, name);
	await fs.promises.mkdir(artifactDir, { recursive: true });
	await page.screenshot({ path: filePath, fullPage: true });
	return filePath;
}
