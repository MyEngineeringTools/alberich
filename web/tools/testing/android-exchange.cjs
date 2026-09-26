/*
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs'); const path = require('node:path'); const assert = require('node:assert/strict');
const exchange = process.env.ANDROID_EXCHANGE_DIR;
assert(exchange, 'ANDROID_EXCHANGE_DIR must contain public disposable Android test exports');
const fixtures = path.resolve(__dirname, '../../js/tests/fixtures/family-test');
const base = process.env.ALBERICH_BASE_URL || 'http://127.0.0.1:8876';
const watchdog = setTimeout(() => { console.error('Exchange watchdog: 5 minutes');process.exit(124); },300000);
(async () => {
 const browser = await chromium.launch({headless:true, executablePath:process.env.BROWSER_EXECUTABLE});
 try {
  const cases = JSON.parse(fs.readFileSync(path.join(exchange,'pixel-replies.json'))).map(reply => {
   const kind=reply.plain.match(/\((daily|24h|4h|1h)\)/)[1];
   return { name:'android-reply-'+kind, book:path.join(fixtures,`web-${kind}.${kind==='daily'?'json':'alb3cb2'}`),reply };
  });
  for (const kind of ['daily','24h']) cases.push({name:'android-generated-'+kind,book:path.join(exchange,`android-${kind}.${kind==='daily'?'json':'alb3cb2'}`),reply:JSON.parse(fs.readFileSync(path.join(exchange,`android-${kind}_message.json`)))});
  for (const entry of cases) {
   const context=await browser.newContext();const page=await context.newPage();page.setDefaultTimeout(15000);
   try {
    await page.goto(base);await page.locator('#rotorSection').click();await page.locator('#btnSourceCodebook').click();
    await page.locator('#codebookFileInput').setInputFiles(entry.book);
    await page.waitForFunction(()=>document.querySelector('#codebookStatus').classList.contains('loaded'));
    await page.locator('#btnCloseSetup').click();await page.locator('#btnRoleCipher').click();
    await page.locator('#inputText').fill(entry.reply.cipher);
    await page.waitForFunction(x=>document.querySelector('#outputText').value===x,entry.reply.plain);
    assert(await page.locator('#btnShowCourierQr').isHidden());
    console.log(JSON.stringify({test:entry.name,status:'PASS'}));
   } finally { await context.close(); }
  }
 } finally {await browser.close();clearTimeout(watchdog);}
})().catch(e=>{console.error(e);clearTimeout(watchdog);process.exitCode=1;});
