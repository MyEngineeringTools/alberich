/*
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/* Local HTTP cache simulation. Never uses a personal browser profile. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs');const path=require('node:path');const http=require('node:http');const assert=require('node:assert/strict');
const before=process.env.BEFORE_WEB_ROOT;assert(before,'BEFORE_WEB_ROOT is required');
const after=path.resolve(__dirname,'../..');let active=path.resolve(before);const served=[];
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');let name=decodeURIComponent(url.pathname);if(name==='/')name='/index.html';
 const file=path.resolve(active,'.'+name);if(!file.startsWith(active+path.sep)){res.writeHead(403);res.end();return;}
 try{const bytes=fs.readFileSync(file);const ext=path.extname(file);res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.json':'application/json'})[ext]||'application/octet-stream');res.setHeader('Cache-Control',ext==='.html'?'no-cache':'public, max-age=31536000');served.push({phase:active===path.resolve(before)?'before':'after',url:req.url});res.end(bytes);}catch{res.writeHead(404);res.end();}
});
const timer=setTimeout(()=>{console.error('Cache test timeout');process.exit(124);},120000);
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE});
 try{
  const context=await browser.newContext();const page=await context.newPage();page.setDefaultTimeout(15000);
  await page.goto(base);assert.match(await page.locator('#versionLabel').textContent(),/Revision 66/);
  await page.locator('#rotorSection').click();await page.locator('#btnSourceCodebook').click();
  await page.locator('#codebookFileInput').setInputFiles(path.join(after,'js/tests/fixtures/family-test/web-daily.json'));
  await page.waitForFunction(()=>document.querySelector('#codebookStatus').classList.contains('loaded'));
  await page.locator('#btnCloseSetup').click();await page.locator('#inputText').fill('Cache upgrade family test');
  await page.waitForFunction(()=>document.querySelector('#outputText').value.startsWith('ALBV'));
  const cipher=await page.locator('#outputText').inputValue();
  active=after;await page.reload();assert.match(await page.locator('#versionLabel').textContent(),/Revision 67/);
  await page.locator('#btnRoleCipher').click();await page.locator('#inputText').fill(cipher);
  await page.waitForFunction(()=>document.querySelector('#outputText').value==='Cache upgrade family test');
  for(const asset of ['/js/app.js?v=67','/styles.css?v=67','/js/i18n/index.js?v=19','/js/i18n/de.js?v=19','/js/i18n/en.js?v=19'])assert(served.some(x=>x.phase==='after'&&x.url===asset),`fresh request ${asset}`);
  console.log(JSON.stringify({test:'warm-cache-66-to-67',status:'PASS',bookPreserved:true,messageDecrypted:true,requests:served.filter(x=>x.phase==='after').map(x=>x.url),scope:'Local simulated cache headers; public host not checked'}));
  await context.close();
 }finally{await browser.close();server.close();clearTimeout(timer);}
})().catch(e=>{console.error(e);server.close();clearTimeout(timer);process.exitCode=1;});
