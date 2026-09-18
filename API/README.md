Hono + Drizzle + SQLite. Контракт: `../docs/architecture.md`.

## Dev

```bash
cp .env.example .env
npm run db:push    # первый раз / после изменения schema
npm run dev        # :3100 (3000 занят SilverBullet на ноуте)
```

## Scripts

| Команда | Назначение |
|---|---|
| `npm run dev` | watch mode |
| `npm run db:push` | применить schema к SQLite |
| `npm run test` | vitest |
| `npm run typecheck` | tsc |

## Smoke

```bash
curl http://localhost:3100/api/v1/health
```
