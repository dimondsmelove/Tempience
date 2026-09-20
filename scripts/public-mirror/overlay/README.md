# Tempience

**[tempience.app](https://tempience.app)** — records and plans on a timeline.
A local-first PWA: everything you write lives in your browser's IndexedDB.
No accounts, no shared backend, no telemetry. Optional sync between *your own*
devices through a tiny server you run yourself, inside your own Tailscale network.

## Using it

- Open the app in a browser. Install it as an app if you like — it works offline.
- Your data belongs to the origin (domain). A different domain or port is a
  different, empty database. Clearing site data in the browser deletes the
  database — keep a JSON export.
- To move data between devices without sync: export JSON, import it on the other
  device. Import creates a separate local database; it never merges into an
  existing one.
- The site sends nothing anywhere. Its only network requests fetch the app's own
  files. The one exception is a sync server that you run yourself (below).

## Installing as an app

- **Android** — Chrome: menu → *Install app* (or the banner at the bottom).
- **iPhone / iPad** — Safari only: *Share* → *Add to Home Screen*.
- **Windows / macOS / Linux** — Chrome, Edge, Brave, Chromium: the *Install*
  icon at the right end of the address bar. Firefox does not install PWAs
  without an extension.
- **Vivaldi on Linux (Flatpak / Snap) under GNOME** — Vivaldi creates the
  launcher, but GNOME cannot match the app window to it and shows it as a
  Vivaldi window without its own icon. Not the app's fault: the window carries
  the app-id `vivaldi-<id>-Default` while the launcher file is named
  differently. One edit fixes it — in
  `~/.local/share/applications/*vivaldi-<id>-Default.desktop` set
  `StartupWMClass=vivaldi-<id>-Default` (the same value as in the file name),
  then relaunch the app.

An installed app opens in its own window without an address bar, works
offline and updates itself: a new version shows a banner, and applying it
reloads only the current tab.

## Syncing between your own devices

In short: **one device needs no setup at all.** Several devices sharing one
database need your own sync server on a computer that stays on, plus
Tailscale. Neither the author nor the site takes part: the server is yours,
the data is yours, the network is yours.

1. **Start the server** on that computer (Node.js 22): `npx tempience-sync`.
   It prints a pairing code and the local page `http://127.0.0.1:6544/` that
   shows it. `npm install -g tempience-sync && tempience-sync --install-service`
   keeps it running across reboots.
2. **Give the computer an https address**: Tailscale on every device with one
   account, MagicDNS + HTTPS Certificates in the admin console, then on the
   computer `tailscale serve --bg 6544` — copy the `https://….ts.net` address
   it prints.
3. **Pair each device**: open `https://tempience.app/pair`, enter that address,
   the code and a device name.

The step-by-step guide for someone who has never run a server — what each
command prints, what to expect afterwards, what the error messages mean — is
**[SYNC.md](./SYNC.md)** (по-русски: **[SYNC.ru.md](./SYNC.ru.md)**).

The server listens on `127.0.0.1` only; the Tailscale address exists only
inside your tailnet, so from the internet the server is unreachable — not the
pairing endpoint, not the data. `serve`, not `funnel` (see below).

### Who sees what

| Where | What | Who has access |
|---|---|---|
| Each device's browser | IndexedDB with your database | you, on that device |
| The laptop | `triplit.sqlite` — the source of truth for all your devices; not encrypted by itself | whoever can read the laptop's disk |
| Between devices | WireGuard (Tailscale) + TLS | nobody in between |
| Tailscale | metadata: devices, keys, IPs — not the traffic | Tailscale |
| The app's site | nothing — it serves static files | — |

### How paranoid to be

**Doing nothing beyond the setup:** the server is loopback-only; its address
exists only in your tailnet; the pairing code is 24 random characters valid
for 10 minutes and shown only on the computer's own page; the device token is
signed with your secret and lives 90 days; traffic is encrypted twice. For
personal notes this is enough.

**Stricter** (Tailscale admin console):
- **ACLs**: allow access to the laptop's port 443 only from your own devices —
  and from nothing else, if the tailnet has other people's or shared nodes.
  Example:
  ```jsonc
  { "acls": [
      { "action": "accept", "src": ["autogroup:member"], "dst": ["laptop:443"] }
  ] }
  ```
- **Device approval** — a new device joins the network only after you approve
  it. Keep **key expiry** on: a lost device drops off by itself.
- `pairingTtlMs` and `deviceTokenTtlMs` in `config.json` (or the
  `TRIPLIT_PAIRING_TTL_MS` / `TRIPLIT_DEVICE_TOKEN_TTL_MS` environment
  variables, which win over the file) can be shortened; `TRIPLIT_PAIRING_CODE`
  can be set by hand if you do not want to read a code off the screen.
- `config.json` holds the secret: the server creates it with mode `600`; keep
  it out of Git and out of shared folders.

**Paranoid:**
- **Tailnet Lock** — new nodes must be signed by your existing ones; this also
  removes the theoretical trust in Tailscale's coordination server.
- Full-disk encryption on the laptop (LUKS / FileVault / BitLocker) — the only
  way to protect the SQLite file at rest.
- Backups of the SQLite file via `sqlite3 triplit.sqlite ".backup …"` into
  encrypted storage, never by copying the live file.

**Revoking access.** Lost a phone — remove it from the tailnet in the admin
console: its path to the server disappears immediately. To revoke *all*
tokens at once, change `jwtSecret` in `config.json` (or `TRIPLIT_JWT_SECRET`),
restart the server and pair the devices again.

**What this does not protect against:** someone who has unlocked your device,
and someone who is signed in to your Tailscale account. Those are the edges
of the "own devices" model.

### Never

- `tailscale funnel` on this port — that is "open to the internet".
- `TRIPLIT_HOST=0.0.0.0` — the server becomes visible to the whole LAN, without TLS.
- Forwarding the pairing code through third-party services; it is one-shot in
  spirit, even if it only lives 10 minutes.

## Building from source

Requires Node.js 22.

```sh
npm ci --ignore-scripts          # root: packages/shared
cd "FE Svelte"
npm ci
npm run check:public             # types for the public route set
npm test                         # vitest
npm run build:public             # → FE Svelte/build-public/
```

A local dev server of the public version: `PUBLIC_BUILD=1 npm run dev` in `FE Svelte`.

The sync server from this checkout instead of npm: `npm ci` at the root
(without `--ignore-scripts`, so SQLite gets its native build) and then
`node scripts/triplit-server.mjs` — the same program as `npx tempience-sync`,
published from `packages/sync-server` by `.github/workflows/publish-sync.yml`
on a `sync-v*` tag.

`build-public/` is plain static output (SvelteKit `adapter-static`, fallback to
`index.html`). Any static host with HTTPS can serve it. This repository deploys
it to GitHub Pages through `.github/workflows/pages.yml`.

## What is inside

| Directory | What it is |
|---|---|
| `FE Svelte/` | The app: SvelteKit 2 + Svelte 5, Tailwind 4, Triplit client on top of IndexedDB, service worker |
| `packages/shared/` | Shared types and utilities |
| `packages/sync-server/` | The sync server, published to npm as `tempience-sync`: pairing by code, the local status page, SQLite |
| `scripts/triplit-server.mjs` | A thin wrapper that runs the same server from this checkout |
| `scripts/public-mirror/` | The scripts that produce this public repository |
| `SYNC.md`, `SYNC.ru.md` | The sync guide for a first-time self-hoster |

## About this repository

This is a public mirror. Development happens in a private repository; a
cleaned copy without working notes and personal data is exported here
(`scripts/public-mirror/export.sh`). The commit history here is a history of
publications, not of development.

License: [AGPL-3.0](./LICENSE).
