#!/usr/bin/env node
/**
 * Seed manual-test scopes via running Tempience API.
 * Usage: node scripts/seed-nice-scope-manual-test.mjs [baseUrl]
 * Default: http://127.0.0.1:3100/api/v1
 */
const base = (process.argv[2] ?? 'http://127.0.0.1:3100/api/v1').replace(/\/$/, '');

const post = async (path, body) => {
	const res = await fetch(`${base}${path}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});
	if (!res.ok) throw new Error(`${path} ${res.status}: ${await res.text()}`);
	return res.json();
};

const patch = async (path, body) => {
	const res = await fetch(`${base}${path}`, {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});
	if (!res.ok) throw new Error(`${path} ${res.status}: ${await res.text()}`);
	return res.json();
};

const main = async () => {
	console.log('Seeding NICE+Scope manual test at', base);
	const now = new Date().toISOString();
	const today = now.slice(0, 10);

	const tech = await post('/continuities', { name: 'техника', kind: 'thread' });
	const substances = await post('/continuities', {
		name: 'отношения с веществами',
		kind: 'condition'
	});
	const family = await post('/continuities', { name: 'Семья', kind: 'relationship' });
	const kazan = await post('/continuities', {
		name: 'Жизнь в Казани',
		kind: 'thread',
		started_at: '2020-01-01T00:00:00.000Z'
	});

	const move = await post('/tasks', { name: 'Переезд', status: 'in_progress' });
	const pack = await post('/tasks', {
		name: 'Упаковать вещи',
		parent_uid: move.uid,
		status: 'not_started'
	});
	const relations = await post('/tasks', { name: 'Восстановление отношений', status: 'in_progress' });
	const julyTask = await post('/tasks', { name: 'Отпуск июль 2026', status: 'planned' });

	await post('/links', {
		from_kind: 'task',
		from_uid: move.uid,
		to_kind: 'continuity',
		to_uid: tech.continuity.uid,
		link_kind: 'membership',
		provenance: 'asserted',
		creator: 'user'
	});

	const bare = await post('/capture/moment', {
		idempotency_key: `seed-bare-${Date.now()}`,
		trace: {
			timezone: 'Europe/Moscow',
			about_kind: 'instant',
			about_at: now,
			hook_text: 'Приехал USB-хаб. Вторая попытка доставки.',
			hook_kind: 'pulse'
		},
		threads: []
	});

	await post(`/traces/${bare.trace.uid}/memberships`, {
		refs: [{ mode: 'existing', continuity_uid: tech.continuity.uid }],
		primary_continuity_uid: tech.continuity.uid
	});

	const contextTrace = await post('/capture/moment', {
		idempotency_key: `seed-context-${Date.now()}`,
		trace: {
			timezone: 'Europe/Moscow',
			about_kind: 'instant',
			about_at: now,
			hook_text: 'Нужен хаб для SSD → Steam Deck → сервер',
			hook_kind: 'pulse'
		},
		threads: [{ mode: 'existing', continuity_uid: tech.continuity.uid }]
	});

	await post(`/traces/${bare.trace.uid}/relates`, {
		to_kind: 'trace',
		to_uid: contextTrace.trace.uid,
		label: 'цепочка SSD-Deck'
	});

	await post('/capture/moment', {
		idempotency_key: `seed-revisit-${Date.now()}`,
		trace: {
			timezone: 'Europe/Moscow',
			about_kind: 'instant',
			about_at: now,
			hook_text: 'Вторая попытка — курьер позвонил, забрал на месте',
			hook_kind: 'revisit',
			relation: 'revisit',
			about_trace_uid: bare.trace.uid,
			word: 'поворот'
		},
		threads: [{ mode: 'existing', continuity_uid: tech.continuity.uid }]
	});

	const dinner = await post('/capture/moment', {
		idempotency_key: `seed-dinner-${Date.now()}`,
		trace: {
			timezone: 'Europe/Moscow',
			about_kind: 'instant',
			about_at: now,
			hook_text: 'photo family dinner',
			hook_kind: 'pulse'
		},
		threads: []
	});

	for (const [toKind, toUid, label] of [
		['continuity', family.continuity.uid, 'primary'],
		['task', relations.uid, 'context'],
		['task', julyTask.uid, 'context']
	]) {
		await post('/links', {
			from_kind: 'trace',
			from_uid: dinner.trace.uid,
			to_kind: toKind,
			to_uid: toUid,
			link_kind: 'membership',
			provenance: 'asserted',
			creator: 'user',
			label
		});
	}

	await post('/capture/moment', {
		idempotency_key: `seed-substances-${Date.now()}`,
		trace: {
			timezone: 'Europe/Moscow',
			about_kind: 'instant',
			about_at: now,
			hook_text: 'Снова курю — хочу научиться жить с дуткой в соседней комнате',
			hook_kind: 'pulse'
		},
		threads: [{ mode: 'existing', continuity_uid: substances.continuity.uid }]
	});

	await patch(`/continuities/${kazan.continuity.uid}`, {
		status: 'completed',
		ended_at: '2021-12-31T00:00:00.000Z'
	});

	const revisitKazan = await post('/capture/moment', {
		idempotency_key: `seed-kazan-${Date.now()}`,
		trace: {
			timezone: 'Europe/Moscow',
			about_kind: 'instant',
			about_at: now,
			hook_text: 'набережная, странное чувство',
			hook_kind: 'revisit',
			relation: 'revisit'
		},
		threads: [{ mode: 'existing', continuity_uid: kazan.continuity.uid }]
	});

	const out = {
		today,
		ids: {
			tech: tech.continuity.uid,
			substances: substances.continuity.uid,
			family: family.continuity.uid,
			kazan: kazan.continuity.uid,
			move: move.uid,
			usbHub: bare.trace.uid,
			dinner: dinner.trace.uid
		},
		urls: {
			feBase: 'http://127.0.0.1:5173',
			inbox: '/inbox',
			today: `/days/${today}`
		}
	};

	console.log(JSON.stringify(out, null, 2));
};

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
