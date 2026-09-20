import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pickLanguage, statusPage } from "../src/page.mjs";

describe("pickLanguage", () => {
  it("defaults to English", () => {
    assert.equal(pickLanguage(undefined), "en");
    assert.equal(pickLanguage(""), "en");
    assert.equal(pickLanguage("de-DE,de;q=0.9"), "en");
  });
  it("picks Russian when the browser prefers it", () => {
    assert.equal(pickLanguage("ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7"), "ru");
    assert.equal(pickLanguage("en-US,en;q=0.9,ru;q=0.8"), "en");
    assert.equal(pickLanguage("sr,ru;q=0.5"), "ru");
    assert.equal(pickLanguage("en;q=0.3, ru;q=0.8"), "ru");
  });
});

describe("statusPage", () => {
  const input = {
    local: true,
    code: "abc<def>",
    expiresAt: "2026-09-20T10:00:00.000Z",
    port: 6561,
    databasePath: "/tmp/sync-npm/home/triplit.sqlite",
    version: "0.1.0",
  };

  it("shows the code, the countdown, the buttons and the next step locally", () => {
    const html = statusPage({ ...input, language: "en" });
    assert.match(html, /<html lang="en">/);
    assert.match(html, /id="code" data-expires-at="2026-09-20T10:00:00.000Z">abc&lt;def&gt;</);
    assert.match(html, /id="countdown"/);
    assert.match(html, /id="rotate"/);
    assert.match(html, /id="copy"/);
    assert.match(html, /tailscale serve --bg 6561/);
    assert.match(html, /tempience\.app\/pair/);
    assert.match(html, /\/tmp\/sync-npm\/home\/triplit\.sqlite/);
    assert.match(html, /SYNC\.md/);
    assert.match(html, /tempience-sync 0\.1\.0/);
  });

  it("speaks Russian on request", () => {
    const html = statusPage({ ...input, language: "ru" });
    assert.match(html, /<html lang="ru">/);
    assert.match(html, /Код подключения/);
    assert.match(html, /Новый код/);
    assert.match(html, /SYNC\.ru\.md/);
  });

  it("keeps the code off the page for a request that is not local", () => {
    for (const language of ["en", "ru"]) {
      const html = statusPage({ ...input, language, local: false });
      assert.doesNotMatch(html, /abc&lt;def&gt;/);
      assert.doesNotMatch(html, /id="rotate"/);
      assert.match(html, /127\.0\.0\.1:6561/);
    }
  });
});
