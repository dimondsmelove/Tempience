export const GUIDE_URL = "https://github.com/dimondsmelove/Tempience/blob/main/SYNC.md";
export const GUIDE_URL_RU = "https://github.com/dimondsmelove/Tempience/blob/main/SYNC.ru.md";

const COPY = {
  en: {
    title: "Tempience sync server",
    running: "Running on this laptop at",
    database: "Database",
    code: "Pairing code",
    expiresIn: "Expires in",
    expired: "Expired — click “New code”",
    copy: "Copy",
    copied: "Copied",
    newCode: "New code",
    nextTitle: "Next",
    next1: "On this laptop run <code>tailscale serve --bg {port}</code> and copy the <code>https://…ts.net</code> address it prints.",
    next2: "On the other device open <a href=\"https://tempience.app/pair\">tempience.app/pair</a>, enter that address, this code and a name for the device, then press “Pair the device”.",
    guide: "Full guide",
    guideUrl: GUIDE_URL,
    remoteTitle: "Tempience sync server is running",
    remote: "The pairing code is shown only on the laptop itself: open <code>http://127.0.0.1:{port}/</code> there.",
    version: "tempience-sync",
  },
  ru: {
    title: "Сервер синхронизации Tempience",
    running: "Работает на этом ноутбуке по адресу",
    database: "База данных",
    code: "Код подключения",
    expiresIn: "Действует ещё",
    expired: "Истёк — нажмите «Новый код»",
    copy: "Скопировать",
    copied: "Скопировано",
    newCode: "Новый код",
    nextTitle: "Дальше",
    next1: "На этом ноутбуке выполните <code>tailscale serve --bg {port}</code> и скопируйте адрес <code>https://…ts.net</code>, который напечатает команда.",
    next2: "На другом устройстве откройте <a href=\"https://tempience.app/pair\">tempience.app/pair</a>, введите этот адрес, этот код и название устройства, затем «Подключить устройство».",
    guide: "Подробная инструкция",
    guideUrl: GUIDE_URL_RU,
    remoteTitle: "Сервер синхронизации Tempience работает",
    remote: "Код подключения показывается только на самом ноутбуке: откройте там <code>http://127.0.0.1:{port}/</code>.",
    version: "tempience-sync",
  },
};

/** ru when the browser prefers Russian ahead of English; en otherwise. */
export const pickLanguage = (acceptLanguage) => {
  const tags = (acceptLanguage ?? "")
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params
        .map((param) => param.trim())
        .find((param) => param.startsWith("q="));
      return { tag: tag.toLowerCase(), q: q ? Number(q.slice(2)) : 1 };
    })
    .filter(({ tag, q }) => tag && q > 0)
    .sort((a, b) => b.q - a.q);
  const first = tags.find(({ tag }) => tag.startsWith("ru") || tag.startsWith("en"));
  return first?.tag.startsWith("ru") ? "ru" : "en";
};

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const STYLE = `
  :root { color-scheme: light dark; }
  body { margin: 0; padding: 24px 16px 48px; font: 16px/1.5 system-ui, sans-serif;
    max-width: 40rem; margin-inline: auto; }
  h1 { font-size: 1.4rem; margin: 0 0 8px; }
  p { margin: 8px 0; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
  .muted { opacity: 0.7; font-size: 0.9rem; word-break: break-all; }
  .code-box { margin: 24px 0 8px; padding: 16px; border: 1px solid color-mix(in srgb, currentColor 25%, transparent);
    border-radius: 12px; }
  .code-box .label { font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.06em; opacity: 0.7; }
  #code { display: block; font: 700 1.9rem/1.2 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    word-break: break-all; user-select: all; margin: 6px 0 12px; }
  .row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  button { font: inherit; padding: 8px 14px; border-radius: 8px; cursor: pointer;
    border: 1px solid color-mix(in srgb, currentColor 35%, transparent); background: transparent; color: inherit; }
  button:hover { background: color-mix(in srgb, currentColor 8%, transparent); }
  #countdown { font-variant-numeric: tabular-nums; margin-left: auto; }
  #countdown.expired { color: #c0392b; font-weight: 600; }
  ol { padding-left: 1.4em; } li { margin: 6px 0; }
`;

const SCRIPT = `
  const expiresAt = Date.parse(document.getElementById("code").dataset.expiresAt);
  const countdown = document.getElementById("countdown");
  const tick = () => {
    const left = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
    if (left === 0) {
      countdown.textContent = countdown.dataset.expired;
      countdown.classList.add("expired");
      return;
    }
    const mm = String(Math.floor(left / 60)).padStart(2, "0");
    const ss = String(left % 60).padStart(2, "0");
    countdown.textContent = countdown.dataset.label + " " + mm + ":" + ss;
  };
  tick();
  setInterval(tick, 1000);
  document.getElementById("copy").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    try {
      await navigator.clipboard.writeText(document.getElementById("code").textContent.trim());
      button.textContent = button.dataset.done;
      setTimeout(() => { button.textContent = button.dataset.label; }, 1500);
    } catch {
      const range = document.createRange();
      range.selectNodeContents(document.getElementById("code"));
      getSelection().removeAllRanges();
      getSelection().addRange(range);
    }
  });
  document.getElementById("rotate").addEventListener("click", async () => {
    const response = await fetch("/pairing-code/rotate", { method: "POST" });
    if (response.ok) location.reload();
  });
`;

const layout = (text, body) => `<!doctype html>
<html lang="${text === COPY.ru ? "ru" : "en"}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${text.title}</title>
<style>${STYLE}</style>
</head>
<body>
${body}
</body>
</html>
`;

/**
 * The local status page: the pairing code, its countdown and «New code». Off the
 * laptop (`local` false) the page only says the server is up — the code stays
 * on the machine that runs it.
 */
export const statusPage = ({
  language = "en",
  local,
  code,
  expiresAt,
  port,
  databasePath,
  version,
}) => {
  const text = COPY[language] ?? COPY.en;
  const fill = (template) => template.replaceAll("{port}", escapeHtml(port));
  if (!local || !code) {
    return layout(
      text,
      `<h1>${text.remoteTitle}</h1>
<p>${fill(text.remote)}</p>`,
    );
  }
  const url = `http://127.0.0.1:${escapeHtml(port)}/`;
  return layout(
    text,
    `<h1>${text.title}</h1>
<p class="muted">${text.running} <code>${url}</code><br>${text.database}: <code>${escapeHtml(databasePath)}</code></p>
<section class="code-box">
  <div class="label">${text.code}</div>
  <code id="code" data-expires-at="${escapeHtml(expiresAt)}">${escapeHtml(code)}</code>
  <div class="row">
    <button id="copy" type="button" data-label="${text.copy}" data-done="${text.copied}">${text.copy}</button>
    <button id="rotate" type="button">${text.newCode}</button>
    <span id="countdown" data-label="${text.expiresIn}" data-expired="${text.expired}"></span>
  </div>
</section>
<h2>${text.nextTitle}</h2>
<ol>
  <li>${fill(text.next1)}</li>
  <li>${text.next2}</li>
</ol>
<p class="muted"><a href="${text.guideUrl}">${text.guide}</a>${version ? ` · ${text.version} ${escapeHtml(version)}` : ""}</p>
<script>${SCRIPT}</script>`,
  );
};
