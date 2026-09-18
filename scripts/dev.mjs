import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const feDir = path.join(root, 'FE Svelte');
const restartDelayMs = 1_000;
const healthIntervalMs = 5_000;
const failuresBeforeRestart = 3;

const services = [
	{
		name: 'API',
		cwd: root,
		args: ['run', 'dev', '-w', '@chronograph/api'],
		healthUrl: 'http://127.0.0.1:3100/api/v1/health'
	},
	{
		name: 'FE',
		cwd: feDir,
		args: ['run', 'dev'],
		healthUrl: 'http://127.0.0.1:5173/'
	}
];

let shuttingDown = false;

const stopService = (service) => {
	const child = service.child;
	if (!child || child.killed) return;

	if (process.platform === 'win32') {
		child.kill('SIGTERM');
		return;
	}

	try {
		process.kill(-child.pid, 'SIGTERM');
	} catch {
		child.kill('SIGTERM');
	}
};

const startService = (service) => {
	const child = spawn('npm', service.args, {
		cwd: service.cwd,
		stdio: 'inherit',
		detached: process.platform !== 'win32'
	});

	service.child = child;
	service.healthFailures = 0;

	child.on('exit', (code, signal) => {
		service.child = undefined;
		if (shuttingDown) return;

		console.error(`[dev] ${service.name} завершился (${signal ?? code}); перезапуск через 1 с.`);
		setTimeout(() => startService(service), restartDelayMs).unref();
	});
};

const healthCheck = async (service) => {
	if (!service.child || service.child.killed) return;

	try {
		const response = await fetch(service.healthUrl, { signal: AbortSignal.timeout(2_000) });
		if (!response.ok) throw new Error(`HTTP ${response.status}`);
		service.healthFailures = 0;
	} catch {
		service.healthFailures += 1;
		if (service.healthFailures < failuresBeforeRestart) return;

		console.error(`[dev] ${service.name} не отвечает; перезапуск.`);
		stopService(service);
	}
};

for (const service of services) startService(service);

const healthTimer = setInterval(() => {
	for (const service of services) void healthCheck(service);
}, healthIntervalMs);

const shutdown = () => {
	shuttingDown = true;
	clearInterval(healthTimer);
	for (const service of services) stopService(service);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
