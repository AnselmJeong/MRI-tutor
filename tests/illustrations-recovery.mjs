import {chromium,expect} from '@playwright/test';
import fs from 'node:fs';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1000,height:800}}), errors=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));
const log=s=>{checks.push(s);console.log('PASS',s);};
try {
  // Exercise the production module without loading unrelated WebGL volumes.
  await page.route('**/__illustration-qa__',route=>route.fulfill({contentType:'text/html',body:`<html><head><link rel="stylesheet" href="styles.css"><link rel="stylesheet" href="illustrations.css"></head><body><aside class="inspector" style="width:280px"></aside><script type="module">
    import {createIllustrations} from './illustrations.js';
    window.referenceState={context:'test',plane:'axial',point:[0,0,14],revealed:true};
    window.referencePanel=createIllustrations({getState:()=>window.referenceState,onHint:()=>{}});
    </script></body></html>`}));
  let failManifest=true,failImage=true,release;
  await page.route('**/illustrations/telencephalon/manifest.json',route=>failManifest?route.fulfill({status:503,body:'unavailable'}):route.continue());
  await page.route('**/axial-07.webp*',route=>failImage?route.fulfill({status:503,body:'unavailable'}):route.continue());
  await page.goto('http://127.0.0.1:8091/__illustration-qa__');
  const panel=page.locator('#reference-illustrations'),dialog=page.locator('#illustration-dialog');
  await expect(panel).toContainText('도식 자료를 불러오지 못했습니다');failManifest=false;await panel.locator('[data-action=retry]').click();
  await expect(panel.locator('img')).toBeVisible();await panel.locator('[data-action=open]').click();
  await expect(page.locator('#illustration-image-error')).toBeVisible();failImage=false;await dialog.locator('[data-action=retry-image]').click();
  await expect(dialog.locator('img')).toBeVisible();await expect.poll(()=>dialog.locator('img').evaluate(i=>i.complete&&i.naturalWidth>0)).toBe(true);
  log('Manifest and large-image failures show actionable retry and recover without a page reload');
  await page.route('**/axial-08.webp*',async route=>{await new Promise(resolve=>{release=resolve;});await route.continue();});
  await dialog.locator('[data-action=next]').click();await expect(page.locator('#illustration-dialog-level')).toContainText('8 / 10');
  await expect(dialog.locator('img')).toBeHidden();await expect(page.locator('#illustration-image-loading')).toBeVisible();
  await expect.poll(()=>Boolean(release)).toBe(true);release();await expect(dialog.locator('img')).toBeVisible();
  await expect.poll(()=>dialog.locator('img').evaluate(i=>i.complete&&i.currentSrc.split('?')[0].endsWith('axial-08.webp'))).toBe(true);
  log('Delayed next plate never leaves the previous image beneath its new title');
  await dialog.locator('[data-action=zoom-in]').click();await dialog.locator('[data-action=zoom-in]').click();
  const viewport=dialog.locator('.illustration-viewport'),box=await viewport.boundingBox();
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2-80,box.y+box.height/2-80,{steps:5});await page.mouse.up();
  expect(await viewport.evaluate(el=>el.scrollTop)).toBeGreaterThan(50);
  await dialog.locator('[data-action=fit]').click();await expect(page.locator('#illustration-zoom')).toHaveText('100%');expect(await viewport.evaluate(el=>el.scrollTop)).toBe(0);
  log('Mouse dragging pans the zoomed plate and fit resets its scale and scroll');
  await page.evaluate(()=>{referenceState.busy=true;referencePanel.refresh();});await expect(dialog).not.toBeVisible();await expect(panel.locator('img')).toHaveCount(0);
  await page.evaluate(()=>{referenceState={context:'another-subject',plane:'coronal',point:[0,0,0],labels:[],revealed:true};referencePanel.refresh();});
  await expect(panel).toContainText('위치 기준이 없어');await expect(panel.locator('img')).toHaveAttribute('src',/coronal-01-thumb/);
  await panel.locator('[data-action=next]').click();await expect(panel.locator('img')).toHaveAttribute('src',/coronal-02-thumb/);
  await page.evaluate(()=>{referenceState.revealed=false;referenceState.locked=true;referencePanel.refresh();});await expect(panel.locator('img')).toHaveCount(0);await expect(panel.locator('[data-action=hint]')).toHaveCount(0);
  log('Loading hides stale figures; missing subject landmarks use explicit manual fallback; locked state removes labeled content');
  expect(errors).toEqual([]);
  fs.writeFileSync('trainer/qa/illustrations-recovery-report.json',JSON.stringify({date:new Date().toISOString(),checks,errors},null,2));
} finally {await browser.close();}
