# Tempience

**[tempience.app](https://tempience.app)** — records and plans on a timeline.
A local-first PWA: everything you write lives in your browser's IndexedDB.
No accounts, no shared backend, no telemetry. Optional sync between *your own*
devices through a tiny server you run yourself, inside your own Tailscale network.

The UI is in Russian.

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
database need your own sync server on your own laptop, plus Tailscale.
Neither the author nor the site takes part: the server is yours, the data is
yours, the network is yours.

### Why Tailscale

The app is served over HTTPS, and browsers forbid it from talking to `http://`
or `ws://` — including your laptop on the home LAN (`http://192.168.…`). You
need an HTTPS address for your laptop with a real certificate. Tailscale Serve
provides one with a single command, and that address exists **only inside your
tailnet**: from the internet the server is unreachable altogether — not the
pairing endpoint, not the data. The server itself listens on `127.0.0.1` only,
so nobody on the LAN can connect to it directly either.

### Setup

1. **Tailscale on every device**, one account: [tailscale.com/download](https://tailscale.com/download).
   In the tailnet admin console: DNS → enable MagicDNS and HTTPS Certificates.

2. **The sync server on the laptop.** Requires Node.js 22.

   ```sh
   git clone https://github.com/dimondsmelove/tempience.git
   cd tempience
   npm ci                                   # root: the server and SQLite
   mkdir -p ~/.config/tempience
   cat > ~/.config/tempience/triplit.env <<ENV
   TRIPLIT_JWT_SECRET=$(openssl rand -hex 32)
   TRIPLIT_DATABASE_PATH=$HOME/.local/share/tempience/triplit.sqlite
   ENV
   chmod 600 ~/.config/tempience/triplit.env
   set -a; . ~/.config/tempience/triplit.env; set +a
   node scripts/triplit-server.mjs
   ```

   The server prints its address (`http://127.0.0.1:6544`), the database path
   and a **pairing code**. The code lives 10 minutes; restarting the server
   prints a new one.

3. **An HTTPS address inside the tailnet** (on the laptop):

   ```sh
   tailscale serve --bg 6544
   ```

   This prints an address like `https://laptop.<tailnet>.ts.net`. That is the
   server address for the app. `serve`, not `funnel` (see below).

4. **Pair each device.** In the app open `/pair`, enter the server address and
   the pairing code, give the device a name. From then on the database on the
   device and the SQLite file on the laptop sync both ways. A device stays
   paired for 30 days, then `/pair` again.

5. **What to expect.** The sync indicator in the app shows the state. Without
   a network, or with the laptop off, devices keep working as usual; changes
   wait in a queue and arrive on the next connection. The sync server is not a
   backup — keep exporting JSON.

To keep the server running on the laptop, a user systemd unit
(`~/.config/systemd/user/tempience-sync.service`):

```ini
[Unit]
Description=Tempience sync server
After=network-online.target
Wants=network-online.target

[Service]
WorkingDirectory=%h/tempience
EnvironmentFile=%h/.config/tempience/triplit.env
ExecStart=/usr/bin/node scripts/triplit-server.mjs
Restart=always
RestartSec=3

[Install]
WantedBy=default.target
```

```sh
systemctl --user daemon-reload
systemctl --user enable --now tempience-sync.service
```

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
for 10 minutes; the device token is signed with your secret and lives 30
days; traffic is encrypted twice. For personal notes this is enough.

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
- `TRIPLIT_PAIRING_TTL_MS` and `TRIPLIT_DEVICE_TOKEN_TTL_MS` can be shortened;
  `TRIPLIT_PAIRING_CODE` can be set by hand if you do not want to read a code
  off the screen.
- The env file holding the secret: mode `600`, never in Git.

**Paranoid:**
- **Tailnet Lock** — new nodes must be signed by your existing ones; this also
  removes the theoretical trust in Tailscale's coordination server.
- Full-disk encryption on the laptop (LUKS / FileVault / BitLocker) — the only
  way to protect the SQLite file at rest.
- Backups of the SQLite file via `sqlite3 triplit.sqlite ".backup …"` into
  encrypted storage, never by copying the live file.

**Revoking access.** Lost a phone — remove it from the tailnet in the admin
console: its path to the server disappears immediately. To revoke *all*
tokens at once, change `TRIPLIT_JWT_SECRET`, restart the server and pair the
devices again.

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
npm ci --ignore-scripts          # root: workspaces
cd "FE Svelte"
npm ci
npm run check:public             # types for the public route set
npm test                         # vitest
npm run build:public             # → FE Svelte/build-public/
```

A local dev server of the public version: `PUBLIC_BUILD=1 npm run dev` in `FE Svelte`.

`build-public/` is plain static output (SvelteKit `adapter-static`, fallback to
`index.html`). Any static host with HTTPS can serve it. This repository deploys
it to GitHub Pages through `.github/workflows/pages.yml`.

## What is inside

| Directory | What it is |
|---|---|
| `FE Svelte/` | The app: SvelteKit 2 + Svelte 5, Tailwind 4, Triplit client on top of IndexedDB, service worker |
| `packages/shared/` | Shared types and utilities |
| `scripts/triplit-server.mjs` | The single-owner sync server: pairing by code, SQLite |
| `API/` | Hono + Drizzle + SQLite — the owner-mode backend (needed by neither the public build nor sync) |
| `scripts/public-mirror/` | The scripts that produce this public repository |

## About this repository

This is a public mirror. Development happens in a private repository; a
cleaned copy without working notes and personal data is exported here
(`scripts/public-mirror/export.sh`). The commit history here is a history of
publications, not of development.

License: [AGPL-3.0](./LICENSE).
