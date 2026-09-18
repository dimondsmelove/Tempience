import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Wipe ephemeral screenshots before each run (not committed snapshot baselines). */
export default async function globalSetup(): Promise<void> {
	const artifactsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'artifacts');
	fs.rmSync(artifactsDir, { recursive: true, force: true });
	fs.mkdirSync(artifactsDir, { recursive: true });
}
