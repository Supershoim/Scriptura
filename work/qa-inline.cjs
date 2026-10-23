const assert=require('node:assert/strict');const path=require('node:path');const fs=require('node:fs');
const {chromium}=require('C:/Users/Ovidiu Pop/Documents/Codex/2026-10-17/new-chat/work/playwright/package');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8796/#43/3');await page.waitForFunction(()=>window.scriptura?.state.ready);
 assert.equal(await page.locator('details.references').count(),0);
 const john=page.locator('#v-42-3-16 .versecell').first();
 assert.equal(await john.locator('.inline-references').count(),1);
 assert.equal(await john.locator('.ref-link').count(),2);
 assert.match(await john.locator('.inline-references').innerText(),/^\[\*Rom\. 5\.8\. 1 Ioan 4\.9\.\]$/);
 assert.equal(await john.locator('.inline-references').evaluate(x=>x.previousSibling.textContent),'Fiindcă');
 assert.match(await john.locator('.inline-references').evaluate(x=>x.nextSibling.textContent),/^ atât de mult/);
 assert.equal(await page.locator('#v-42-3-16 .versecell').nth(1).locator('.inline-references').count(),0);
 await john.locator('.ref-link').first().hover();assert.equal(await page.locator('#referenceTitle').innerText(),'Romani 5:8');assert.match(await page.locator('#referenceText').innerText(),/Își arată dragostea/);
 await page.locator('#referencePopup').hover();assert(await page.locator('#referencePopup').isVisible());await page.keyboard.press('Escape');assert.equal(await page.locator('#referencePopup').isVisible(),false);
 await john.locator('.ref-link').nth(1).focus();assert.equal(await page.locator('#referenceTitle').innerText(),'1 Ioan 4:9');await page.keyboard.press('Escape');
 await page.evaluate(()=>window.scriptura.read(0,1));
 const genesis=page.locator('#v-0-1-1 .versecell').first();assert.equal(await genesis.locator('.inline-references').count(),2);assert.equal(await genesis.locator('.ref-link').count(),18);
 const anchors=await genesis.locator('.inline-references').evaluateAll(xs=>xs.map(x=>({before:x.previousSibling.textContent,after:x.nextSibling.textContent})));
 assert.equal(anchors[0].before,'La început');assert.equal(anchors[0].after,', Dumnezeu a făcut');assert.equal(anchors[1].after,' cerurile și pământul.');
 await genesis.locator('.ref-link').first().hover();assert.equal(await page.locator('#referenceTitle').innerText(),'Ioan 1:1, 2');assert.equal(await page.locator('#referenceText p').count(),2);
 await page.locator('#v-0-1-16 .versecell').first().locator('.ref-link').first().hover();assert.equal(await page.locator('#referenceTitle').innerText(),'Psalmi 136:7, 8, 9');assert.equal(await page.locator('#referenceText p').count(),3);
 // Rendering must preserve every character of the underlying verse when references are removed.
 for(const [b,c] of [[0,1],[18,23],[42,3],[46,13],[49,1],[63,1]]){
   await page.evaluate(([b,c])=>window.scriptura.read(b,c),[b,c]);
   const mismatches=await page.evaluate(()=>{const rows=window.scriptura.data.rows.filter(r=>r[0]===window.scriptura.state.b&&r[1]===window.scriptura.state.c),bad=[];for(const row of rows)for(let e=0;e<2;e++){const value=row[e?4:3];if(!value)continue;const el=document.querySelector('#v-'+row.slice(0,3).join('-')).querySelectorAll('.vtext')[e];const cell=document.querySelector('#v-'+row.slice(0,3).join('-')).children[e],text=cell.querySelector('.vtext').cloneNode(true);text.querySelectorAll('[data-no-copy]').forEach(n=>n.remove());if(text.textContent!==value)bad.push(row.slice(0,3).join(':')+':'+e);}return bad;});assert.deepEqual(mismatches,[]);
 }
 // Both individual-verse and chapter copy read plain data, never the rendered references.
 await page.evaluate(()=>{window.__copies=[];Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>window.__copies.push(text)}});window.scriptura.read(42,3,16);});
 await john.hover();await john.locator('.copy').click();
 let copied=await page.evaluate(()=>window.__copies.at(-1)),expected=await page.evaluate(()=>window.scriptura.data.rows.find(r=>r[0]===42&&r[1]===3&&r[2]===16)[3]);
 assert.equal(copied,'Ioan 3:16 (VDCC)\n'+expected);assert(!copied.includes('Rom. 5.8'));assert(!/[*†‡\[\]]/.test(copied));
 for(const edition of ['vdcc','ntr','both']){
   await page.locator('#copyEdition').selectOption(edition);await page.locator('#copyChapter').click();copied=await page.evaluate(()=>window.__copies.at(-1));
   expected=await page.evaluate(edition=>{const rows=window.scriptura.data.rows.filter(r=>r[0]===42&&r[1]===3),part=e=>(e?'NTR':'VDCC')+'\n'+rows.filter(r=>r[e?4:3]).map(r=>(e?(r[7]||r[2]):r[2])+'. '+r[e?4:3]).join('\n');return 'Ioan 3\n\n'+(edition==='both'?part(0)+'\n\n'+part(1):part(edition==='ntr'));},edition);
   assert.equal(copied,expected);assert(copied.includes('\n36.'));assert(!copied.includes('Rom. 5.8'));assert(!/[*†‡\[\]]/.test(copied));
 }
 for(const e of ['vdcc','ntr']){await page.locator('[data-copy-edition="'+e+'"]').click();copied=await page.evaluate(()=>window.__copies.at(-1));assert.match(copied,new RegExp('^Ioan 3\\n\\n'+e.toUpperCase()+'\\n'));assert(!copied.includes('Rom. 5.8'));}
 await page.evaluate(()=>{navigator.clipboard.writeText=async()=>{throw Error('denied')};window.__fallback='';document.execCommand=cmd=>{window.__fallback=document.activeElement.value;return cmd==='copy'};});
 await john.hover();await john.locator('.copy').click();copied=await page.evaluate(()=>window.__fallback);assert(!copied.includes('Rom. 5.8'));assert(!/[*†‡\[\]]/.test(copied));assert.equal(await page.locator('textarea').count(),0);
 // Phrase highlighting spans the reference insertion point without searching the reference labels.
 await page.locator('#query').fill('Fiindcă atât');await page.locator('#mode').selectOption('phrase');await page.locator('#searchForm .primary').click();
 assert.equal(await john.locator('mark').allTextContents().then(xs=>xs.join('')),'Fiindcă atât');assert.equal(await page.locator('.inline-references mark').count(),0);
 await page.evaluate(()=>window.scriptura.read(42,3,16));await john.locator('.ref-link').first().hover();await page.screenshot({path:path.join(__dirname,'inline-desktop.png'),fullPage:false});
 const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#download').click()]);await download.saveAs(path.join(__dirname,'inline-downloaded.html'));
 const offline=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,offline:true}),mobile=await offline.newPage();mobile.on('pageerror',e=>errors.push(e.message));
 await mobile.goto('file:///'+path.join(__dirname,'inline-downloaded.html').replace(/\\/g,'/'));await mobile.waitForFunction(()=>window.scriptura?.state.ready);await mobile.evaluate(()=>window.scriptura.read(42,3,16));
 const mobileJohn=mobile.locator('#v-42-3-16 .versecell').first();await mobileJohn.locator('.ref-link').first().tap();assert(await mobile.locator('#referencePopup').isVisible());assert(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 const rect=await mobile.locator('#referencePopup').boundingBox();assert(rect.x>=0&&rect.x+rect.width<=390);await mobile.screenshot({path:path.join(__dirname,'inline-mobile.png'),fullPage:false});
 await mobile.locator('#openReference').tap();assert.equal(await mobile.locator('#readingTitle').innerText(),'Romani 5');await mobile.locator('#theme').tap();assert(await mobile.locator('body').evaluate(x=>x.classList.contains('dark')));
 assert.deepEqual(errors,[]);const stats=await page.evaluate(()=>window.scriptura.data.metadata.crossReferences);
 const report={passed:true,stats,checks:['reference groups at original PDF word markers','multiple groups and range popups','hover, keyboard and mobile touch','rendered Bible text unchanged','verse copy excludes all references and markers','VDCC, NTR and both chapter copy exclude references','column copy and clipboard fallback','search phrases across inline references','mobile viewport','offline downloaded HTML','navigation and dark theme'],pageErrors:errors};fs.writeFileSync(path.join(__dirname,'qa-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
