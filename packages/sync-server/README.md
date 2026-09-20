# tempience-sync

The sync server for [Tempience](https://tempience.app): one command on a laptop
that stays on, a pairing code, one SQLite file. Your phone and other computers
reach it through your own [Tailscale](https://tailscale.com) network; nothing
goes through anyone else's server.

```sh
npx tempience-sync
```

prints a pairing code and opens `http://127.0.0.1:6544/` — the page with the
code, its countdown and a «New code» button. Then `tailscale serve --bg 6544`
on the laptop and `https://tempience.app/pair` on each device.

The complete, first-timer guide — prerequisites, the three steps, what to
expect and what to do when something goes wrong — is
[SYNC.md](https://github.com/dimondsmelove/Tempience/blob/main/SYNC.md)
(in Russian: [SYNC.ru.md](https://github.com/dimondsmelove/Tempience/blob/main/SYNC.ru.md)).

- `tempience-sync --install-service` keeps it running across reboots
  (Linux: systemd `--user`; macOS: a LaunchAgent; Windows: prints the recipe).
  Install permanently first: `npm install -g tempience-sync`.
- `tempience-sync --uninstall-service`, `--status`, `--port <n>`, `--help`.
- Configuration: `config.json` in `~/.local/share/tempience` (Linux),
  `~/Library/Application Support/Tempience` (macOS) or `%APPDATA%\Tempience`
  (Windows), created on the first run with a generated secret. `TRIPLIT_*`
  environment variables override it; `TEMPIENCE_SYNC_HOME` moves the folder.

Requires Node.js 22 or newer. License: AGPL-3.0.
