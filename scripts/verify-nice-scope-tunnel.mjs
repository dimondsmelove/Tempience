#!/usr/bin/env node
/** Smoke verification for NICE+Scope tunnel — requires running API. */
const base = (process.argv[2] ?? 'http://127.0.0.1:3100/api/v1').replace(/\/$/, '');

const get = async (path) => {
	const res = await fetch(`${base}${path}`);
	if (!res.ok) throw new Error(`${path} → ${res.status}`);
	return res.json();
};

const assert = (cond, msg) => {
	if (!cond) throw new Error(msg);
	console.log('  ✓', msg);
};

const main = async () => {
	console.log('verify-nice-scope-tunnel @', base);

	await get('/health');
	assert(true, 'health ok');

	const inbox = await get('/inbox/hooks?state=all&limit=20');
	assert(inbox.hooks.length > 0, `inbox has ${inbox.hooks.length} hooks`);

	const today = new Date().toISOString().slice(0, 10);
	const day = await get(`/days/${today}/context?timezone=Europe/Moscow`);
	assert(day.traces.length > 0, `day ${today} has ${day.traces.length} traces`);
	assert(day.scope_touches.length > 0, `day has ${day.scope_touches.length} scope touches`);

	const continuities = await get('/continuities');
	assert(continuities.continuities.length >= 2, 'continuities seeded');

	const tech = continuities.continuities.find((c) => c.name === 'техника');
	assert(tech, 'continuity «техника» exists');

	let scope = await get(`/scopes/continuity/${tech.uid}/context?lens=scope-card`);
	if (scope.traces.length === 0) {
		for (const c of continuities.continuities.filter((x) => x.name === 'техника')) {
			const candidate = await get(`/scopes/continuity/${c.uid}/context?lens=scope-card`);
			if (candidate.traces.length > 0) {
				scope = candidate;
				break;
			}
		}
	}
	assert(scope.traces.length > 0, `scope-card «техника» has ${scope.traces.length} traces`);
	assert(scope.projection_meta.dedupe_applied === true, 'dedupe_applied');

	const atlas = await get(
		`/scopes/continuity/${tech.uid}/context?lens=atlas-week&view_time=${encodeURIComponent(new Date().toISOString())}`
	);
	assert(Array.isArray(atlas.traces), 'atlas-week lens returns traces');

	const kazanList = continuities.continuities.filter((c) => c.name === 'Жизнь в Казани');
	const kazan = kazanList.find((c) => c.status === 'completed') ?? kazanList.at(-1);
	if (kazan) {
		const kCtx = await get(`/scopes/continuity/${kazan.uid}/context`);
		assert(kCtx.scope.status === 'completed', 'kazan scope completed (M8)');
	} else {
		console.log('  ~ skip M8 (kazan not seeded)');
	}

	console.log('\nAll tunnel smoke checks passed.');
};

main().catch((err) => {
	console.error('\nFAIL:', err.message);
	process.exit(1);
});
