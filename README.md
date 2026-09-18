# Tempience

Записи и планы на ленте времени. Local-first PWA: все данные живут в IndexedDB
вашего браузера, без аккаунтов и без сервера.

*Tempience is a local-first timeline PWA: your records and plans stay in your
browser's IndexedDB. No accounts, no backend. Russian UI.*

## Как пользоваться

- Откройте приложение в браузере и, если хотите, установите его как PWA
  («Добавить на главный экран» / «Установить»). Оно работает offline.
- Данные принадлежат origin (домену). Другой домен или порт — другая, пустая база.
- Перенос между устройствами: экспорт в JSON → импорт на другом устройстве.
  Импорт создаёт отдельную локальную базу и не смешивается с существующей.
- Публичная сборка не отправляет данные никуда: сетевые запросы — только за
  файлами самого приложения. Резервные копии — ваш JSON-экспорт.

## Запуск из исходников

Нужен Node.js 22.

```sh
npm ci --ignore-scripts          # корень: workspaces API и packages/shared
cd "FE Svelte"
npm ci
npm run check:public             # типы для публичного набора маршрутов
npm test                         # vitest
npm run build:public             # → FE Svelte/build-public/
```

Локальный dev-сервер публичной версии: `PUBLIC_BUILD=1 npm run dev` в `FE Svelte`.

`build-public/` — обычная статика (SvelteKit `adapter-static`, fallback на
`index.html`). Её можно отдать любым статическим хостингом с HTTPS; для
self-hosting есть `deploy/Caddyfile.public` и `deploy/systemd/tempience-public.service`.
Этот репозиторий деплоит её на GitHub Pages через
`.github/workflows/pages.yml`.

## Что внутри

| Каталог | Что это |
|---|---|
| `FE Svelte/` | Приложение: SvelteKit 2 + Svelte 5, Tailwind 4, Triplit client поверх IndexedDB, service worker |
| `packages/shared/` | Общие типы и утилиты |
| `API/` | Hono + Drizzle + SQLite — owner-режим (не нужен публичной сборке) |
| `scripts/triplit-server.mjs` | Опциональный сервер синхронизации для одного владельца (pairing по коду, device JWT) |
| `scripts/public-mirror/` | Скрипты, которыми собирается этот публичный репозиторий |

Полная (owner) сборка `npm run build` включает маршруты, которые ходят в API и
Triplit-сервер; синхронизация настраивается через `PUBLIC_TRIPLIT_SERVER_URL`
(см. `FE Svelte/.env.example`). В публичной сборке синхронизации нет — по замыслу.

## О репозитории

Это публичное зеркало: разработка ведётся в приватном репозитории, сюда
выкладывается очищенная копия без внутренних заметок и личных данных
(`scripts/public-mirror/export.sh`). История коммитов здесь — история
публикаций, а не разработки.

Лицензия: [AGPL-3.0](./LICENSE).
