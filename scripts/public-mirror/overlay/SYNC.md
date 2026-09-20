# Syncing Tempience between your own devices

Tempience keeps your records in the browser of each device. To have the same
records on your phone and your laptop, one of your computers runs a small
**sync server**; the other devices talk to it over your own private
[Tailscale](https://tailscale.com) network. Nothing passes through the author,
the site or anyone else: the server is yours, the data is yours, the network is
yours.

This guide assumes you have never run a server. It takes about fifteen
minutes; each step tells you what to type, what you will see and what to do
with it. Русская версия: [SYNC.ru.md](./SYNC.ru.md).

## Before you start

- **A computer that stays on** — a laptop or desktop at home. The other devices
  sync through it. When it is off or asleep, every device keeps working on its
  own and catches up the next time the server is reachable.
- **Node.js 22 or newer** on that computer. Download the LTS installer from
  [nodejs.org](https://nodejs.org) and run it. Check in a terminal
  (macOS: Terminal; Windows: PowerShell; Linux: any shell):

  ```sh
  node -v
  ```

  You should see `v22.…` or higher. If the command is not found, Node is not
  installed yet, or the terminal was opened before the installation finished:
  open a new one.
- **A Tailscale account** — free for personal use; step 2 sets it up.

## Step 1 — Start the sync server

In the terminal on that computer:

```sh
npx tempience-sync
```

The first run downloads the server (a minute or so). Then it prints:

```text
Tempience Triplit server listening on http://127.0.0.1:6544
Triplit database: /home/you/.local/share/tempience/triplit.sqlite
Config: /home/you/.local/share/tempience/config.json
Pairing code: kT9x2…
Pairing code expires: 2026-09-20T10:15:00.000Z
Status page: http://127.0.0.1:6544/
```

Open **http://127.0.0.1:6544/** in a browser *on that same computer*. The page
shows the **pairing code** in large type, how many minutes it is still valid,
a **Copy** button and a **New code** button. That page is the only place the
code is shown — it never appears on the network. Keep the terminal open for
now; closing it stops the server.

**Keep it running after you close the terminal (and after a reboot).** Install
the server permanently, then register it as a background service:

```sh
npm install -g tempience-sync
tempience-sync --install-service
```

On Linux this creates a systemd user service, on macOS a LaunchAgent; on
Windows it prints the one `schtasks` command to run. From then on the server
starts with your login. `tempience-sync --status` shows where the database and
the config are and whether the service is running; `tempience-sync
--uninstall-service` removes the service again.

## Step 2 — Give the computer an https address with Tailscale

The app at tempience.app is served over HTTPS, and browsers refuse to let it
talk to a plain `http://` address such as `http://192.168.1.10:6544`. Tailscale
gives your computer an `https://` address with a real certificate — one that
exists only inside your own network of devices.

1. Install Tailscale on **this computer and on every device** you want to sync
   (phone, tablet, other laptop): [tailscale.com/download](https://tailscale.com/download).
   Sign in with the **same account** everywhere.
2. In the Tailscale admin console open
   [DNS](https://login.tailscale.com/admin/dns) and enable **MagicDNS** and
   **HTTPS Certificates**.
3. On the computer that runs the server:

   ```sh
   tailscale serve --bg 6544
   ```

   It prints something like:

   ```text
   Available within your tailnet:

   https://laptop.tail1234.ts.net/
   |-- / proxy http://127.0.0.1:6544
   ```

   **Copy the `https://….ts.net` address** — that is the server address the
   app will ask for in step 3. The setting survives reboots; you run this
   once.

   *Linux note:* if `tailscale serve` says permission denied or asks for the
   operator, run `sudo tailscale set --operator=$USER` once and repeat the
   command.

This address is reachable only from devices signed in to your Tailscale
account. From the internet the server does not exist at all. Do not use
`tailscale funnel` — that would open the server to the whole internet.

## Step 3 — Connect each device

On each device open **https://tempience.app/pair** (in the app: tap the sync
indicator in the header, then **Pair**). Fill in:

- **Sync server address** — the `https://….ts.net` address from step 2.
- **Pairing code** — from the page on the computer (http://127.0.0.1:6544/).
  The code lives 10 minutes; if it ran out, click **New code** there and use
  the new one. The same code may be used for several devices while it lasts.
- **Device name** — anything you like, for example «Phone».

Press **Pair the device**. The app reloads, and the sync indicator in the header
changes from **Local only** to **Connecting…** and then **Synced**. Records
already on the device are sent to the server; records already on the server
arrive on the device. Repeat on every device.

## What to expect

- **Offline, or the computer is off** — the app works as usual; changes wait
  in a queue and are delivered on the next connection. The indicator shows
  **Offline** or **Connecting…** meanwhile, with the number of pending changes.
- **A device stays connected for 90 days.** After that the app shows
  **Local only** again; open `/pair`, get a fresh code, connect — nothing is
  lost. Restarting the server prints a new pairing code but does not touch
  already connected devices.
- **The server is not a backup.** It holds the same live data as your
  devices; deleting a record deletes it everywhere. Export JSON regularly
  (sync indicator → **Export data**) and keep the file somewhere safe.
- **Where things live.** `config.json` (the generated secret, the port, the
  code and token lifetimes) and `triplit.sqlite` (your data) are in
  `~/.local/share/tempience` on Linux, `~/Library/Application Support/Tempience`
  on macOS, `%APPDATA%\Tempience` on Windows. `tempience-sync --status` prints
  the exact paths. Changing the secret in `config.json` and restarting the
  server disconnects every device at once — that is how you revoke access.

## Something went wrong

**On the computer's page the countdown shows `Expired — click “New code”`.**
Click **New code**; enter the new code on the device.

**The app says `Pairing failed: invalid_pairing_code`.**
The code was mistyped, or it comes from an earlier start of the server (every
start makes a new one). Copy the code from http://127.0.0.1:6544/ again.

**The app says `Pairing failed: pairing_code_expired`.**
The code's 10 minutes passed. Click **New code** on the page and try again.

**The app says `The server address must start with https:// (http:// is allowed only for localhost).`**
You entered `http://…` or an IP address. Use the `https://….ts.net` address
printed by `tailscale serve` (step 2).

**The app says `The server address must be a full URL, for example https://laptop.your-tailnet.ts.net.`**
Include `https://` at the start and nothing after the host — no spaces, no
`?`.

**The app says `Unexpected error: Failed to fetch`, or the button spins and nothing happens.**
The device cannot reach the computer. On the device, open the Tailscale app:
it must say **Connected**, with the same account as on the computer. Then open
the `https://….ts.net` address in the device's browser: it should show
«Tempience sync server is running». If the page does not open, MagicDNS or
HTTPS Certificates are still off in the admin console (step 2.2), Tailscale is
off on one of the two devices, or the server is not running on the computer
(`tempience-sync --status`).

**After connecting, the indicator still says `Local only`.**
Tap the indicator and read the details. «Sync error: …» with an authorization
message means the device's token belongs to another server (the secret
changed, or the server was set up anew): press **Unpair this device** on
`/pair` and connect again with a fresh code.

**The server prints `Port 6544 is already in use.`**
A server is already running — probably the service you installed in step 1;
`tempience-sync --status` tells. To run a second one, start it with
`npx tempience-sync --port 6545` and use that port in `tailscale serve`.

**`npm install -g` fails with `EACCES` / permission denied (Linux).**
Node was installed by the system package manager. Install into your home
folder instead: `npm install -g --prefix ~/.local tempience-sync`, then run
`~/.local/bin/tempience-sync --install-service`.

**`tailscale serve` says HTTPS certificates or MagicDNS are not enabled.**
Step 2.2: [DNS settings](https://login.tailscale.com/admin/dns) in the admin
console.

**Something else.** `tempience-sync --status` on the computer, and on Linux
`journalctl --user -u tempience-sync -n 50` (macOS:
`~/Library/Logs/tempience-sync.log`) show what the server says.
