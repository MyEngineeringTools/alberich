/*
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/* Public disposable fixtures only. No production browser profile or credentials. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.ALBERICH_BASE_URL || 'http://127.0.0.1:8876';
const fixtures = process.env.FAMILY_FIXTURES || path.resolve(__dirname, '../../js/tests/fixtures/family-test');
const executablePath = process.env.BROWSER_EXECUTABLE;
const results = [];
let browser;
const watchdog = setTimeout(async () => {
  console.error('SUITE_TIMEOUT: aborting after 10 minutes');
  await browser?.close().catch(() => {});
  process.exit(124);
}, 600_000);
async function test(name, body, contextOptions = {}) {
  const start = Date.now();
  const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'], ...contextOptions });
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  page.setDefaultNavigationTimeout(15_000);
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  try {
    await body(page, context);
    assert.deepEqual(pageErrors, [], 'No uncaught browser errors');
    const result = { test: name, status: 'PASS', ms: Date.now() - start };
    results.push(result); console.log(JSON.stringify(result));
  } catch (error) {
    const result = { test: name, status: 'FAIL', ms: Date.now() - start, error: error.message };
    results.push(result); console.error(JSON.stringify(result));
    throw error;
  } finally { await context.close(); }
}
async function openBook(page, kind = 'daily') {
  await page.goto(base);
  await page.locator('#rotorSection').click();
  await page.locator('#btnSourceCodebook').click();
  await page.locator('#codebookFileInput').setInputFiles(path.join(fixtures, `web-${kind}.${kind === 'daily' ? 'json' : 'alb3cb2'}`));
  await page.waitForFunction(() => document.querySelector('#codebookStatus').classList.contains('loaded'));
}
async function output(page) {
  await page.waitForFunction(() => document.querySelector('#outputText').value.startsWith('ALBV'));
  return page.locator('#outputText').inputValue();
}
(async () => {
  browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  try {
    for (const kind of ['daily', '24h', '4h', '1h']) {
      await test(`fixture-receive-${kind}-reload-tamper`, async page => {
        await openBook(page, kind);
        if (kind !== 'daily') assert.match(await page.locator('#codebookStatus').innerText(), /[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}/i);
        const message = JSON.parse(fs.readFileSync(path.join(fixtures, `web-${kind}-message.json`)));
        await page.locator('#btnCloseSetup').click();
        await page.locator('#btnRoleCipher').click();
        await page.locator('#inputText').fill(message.cipher);
        await page.waitForFunction(expected => document.querySelector('#outputText').value === expected, message.plain);
        assert(await page.locator('#btnShowCourierQr').isHidden(), 'No courier QR of decrypted plaintext');
        await page.reload();
        await page.locator('#inputText').fill(message.cipher);
        await page.waitForFunction(expected => document.querySelector('#outputText').value === expected, message.plain);
        const letters = message.cipher.replace(/[^A-Z]/g, '');
        await page.locator('#inputText').fill(letters.slice(0, -1) + (letters.endsWith('A') ? 'B' : 'A'));
        await page.waitForFunction(() => !document.querySelector('#modernCryptoError').hidden);
        assert.equal(await page.locator('#outputText').inputValue(), '');
      });
    }
    await test('empty-network-and-import-boundaries', async page => {
      await openBook(page);
      const status = await page.locator('#codebookStatus').innerText();
      await page.locator('#codebookFileInput').setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{broken') });
      await page.waitForFunction(() => document.querySelector('#toast').classList.contains('show'));
      assert.equal(await page.locator('#codebookStatus').innerText(), status);
      await page.locator('#codebookFileInput').setInputFiles({ name: 'oversized.json', mimeType: 'application/json', buffer: Buffer.alloc(2_000_001, 65) });
      assert.equal(await page.locator('#codebookStatus').innerText(), status);
      const cancelled = page.waitForEvent('dialog').then(dialog => dialog.dismiss());
      await page.locator('#codebookFileInput').setInputFiles(path.join(fixtures, 'web-24h.alb3cb2'));
      await cancelled;
      assert.equal(await page.locator('#codebookStatus').innerText(), status);
      page.once('dialog', dialog => dialog.accept('Empty family test'));
      await page.locator('#btnNetworkAdd').click();
      await page.locator('#btnCloseSetup').click();
      await page.locator('#inputText').fill('Must not use previous family key');
      await page.waitForFunction(() => !document.querySelector('#modernCryptoError').hidden);
      assert.equal(await page.locator('#outputText').inputValue(), '');
    });
    await test('copy-edit-race-and-private-preview', async page => {
      await openBook(page, '24h'); await page.locator('#btnCloseSetup').click();
      for (let i = 0; i < 5; i++) {
        await page.locator('#btnClearAll').click(); await page.locator('#inputText').fill(`Original ${i}`);
        const first = await output(page);
        await page.evaluate(i => {
          document.querySelector('#btnCopyOutput').click();
          const input = document.querySelector('#inputText'); input.value = `Changed ${i}`;
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }, i);
        await page.waitForFunction(old => document.querySelector('#outputText').value.startsWith('ALBV') && document.querySelector('#outputText').value !== old, first);
        const second = await output(page);
        assert.notEqual(first.replace(/[^A-Z]/g, '').slice(8, 16), second.replace(/[^A-Z]/g, '').slice(8, 16));
      }
    });
    for (const tz of ['Europe/Berlin', 'America/New_York']) {
      await test(`utc-plus-one-day-${tz}`, async page => {
        await page.clock.install({ time: new Date('2026-09-26T22:30:00Z') });
        await openBook(page); assert.equal(await page.locator('#codebookDaySelect').inputValue(), '26');
        await page.locator('#btnCodebookToday').click(); assert.equal(await page.locator('#codebookDaySelect').inputValue(), '26');
      }, { timezoneId: tz });
    }
    for (const kind of ['daily', '24h']) {
      await test(`unavailable-idb-${kind}`, async page => {
        await page.addInitScript(() => Object.defineProperty(window, 'indexedDB', { get() { throw new Error('Intentional unavailable test DB'); } }));
        await openBook(page, kind); await page.locator('#btnCloseSetup').click();
        await page.locator('#inputText').fill('Must not encrypt without a durable reservation');
        await page.waitForFunction(() => !document.querySelector('#modernCryptoError').hidden);
        assert.equal(await page.locator('#outputText').inputValue(), '');
      });
    }
    await test('unicode-long-offline-hidden-small-screen', async (page, context) => {
      const hosts = new Set(); page.on('request', request => hosts.add(new URL(request.url()).host));
      await openBook(page); await page.locator('#btnCloseSetup').click();
      for (const plain of [' ', 'ÄÖÜ ß € 🔐\n中文 नमस्ते مرحبا', 'Grüße an Familie 🔐 '.repeat(200)]) {
        await page.locator('#btnClearAll').click(); await page.locator('#btnRolePlain').click();
        await page.locator('#inputText').fill(plain); await output(page);
        await page.locator('#btnRoleCipher').click();
        await page.waitForFunction(expected => document.querySelector('#outputText').value === expected, plain);
      }
      await page.locator('#btnClearAll').click(); await page.locator('#btnRolePlain').click();
      await context.setOffline(true); await page.locator('#inputText').fill('Offline family message'); await output(page);
      assert.deepEqual([...hosts], [new URL(base).host]);
      assert.equal(await page.locator('[hidden]').evaluateAll(elements => elements.filter(element => getComputedStyle(element).display !== 'none').length), 0);
    }, { viewport: { width: 390, height: 844 } });
  } finally { await browser.close(); clearTimeout(watchdog); }
  console.log(JSON.stringify({ summary: { passed: results.filter(x => x.status === 'PASS').length, total: results.length } }));
})().catch(error => { clearTimeout(watchdog); console.error(error.message); process.exitCode = 1; });
