import {chromium, expect} from '@playwright/test';
import fs from 'node:fs';
const browser = await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page = await browser.newPage({viewport:{width:1440,height:1050}});
page.setDefaultTimeout(30000);
const errors=[], checks=[];
page.on('pageerror', e=>errors.push(e.message));
const log=x=>{checks.push(x);console.log('PASS',x);};
const panel=page.locator('#reference-illustrations'), modal=page.locator('#illustration-dialog');
const range=(id,value)=>page.locator(id).evaluate((el,v)=>{el.value=String(v);el.dispatchEvent(new Event('input',{bubbles:true}));},value);
const ready=()=>page.waitForFunction(()=>window.mriCaseQA&&!window.mriCaseQA.snapshot().loading&&!window.mriCaseQA.snapshot().loadError,undefined,{timeout:120000});
const imageReady=()=>expect.poll(()=>panel.locator('img').evaluate(i=>i.complete&&i.naturalWidth>0)).toBe(true);
try {
  await page.goto('http://127.0.0.1:8091/'); await ready();
  await page.waitForFunction(()=>document.querySelector('#mri-loading').hidden,undefined,{timeout:120000});
  await imageReady(); await expect(panel).toContainText('Axial');
  await range('#slice-z',-26); await expect(panel.locator('img')).toHaveAttribute('src',/axial-02-thumb/);
  await range('#slice-z',36); await expect(panel.locator('img')).toHaveAttribute('src',/axial-09-thumb/);
  await panel.locator('[data-action=previous]').click();await expect(panel.locator('img')).toHaveAttribute('src',/axial-08-thumb/);
  await range('#slice-z',50); await expect(panel.locator('img')).toHaveAttribute('src',/axial-08-thumb/);
  await panel.locator('[data-action=follow]').click();await expect(panel.locator('img')).toHaveAttribute('src',/axial-10-thumb/);
  await page.locator('[data-plane=coronal]').click();await range('#slice-y',-20);await expect(panel.locator('img')).toHaveAttribute('src',/coronal-07-thumb/);
  await page.locator('[data-plane=sagittal]').click();await expect(panel.locator('img')).toHaveCount(0);await expect(panel).toContainText('Axial 또는 Coronal');
  await page.locator('[data-plane=multi]').click();await panel.locator('[data-illustration-plane=coronal]').click();await expect(panel.locator('img')).toHaveAttribute('src',/coronal-07-thumb/);
  expect(await page.evaluate(()=>window.mriAtlasQA.snapshot().plane)).toBe('multi');
  log('Atlas axial/coronal follow actual sliders; manual browsing stays put; sagittal and multiplanar coverage are explicit');
  await panel.locator('[data-action=open]').click();await expect(modal).toBeVisible();
  await expect.poll(()=>modal.locator('img').evaluate(i=>i.complete&&i.naturalWidth>0)).toBe(true);
  await modal.locator('[data-action=zoom-in]').click();await expect(page.locator('#illustration-zoom')).toHaveText('150%');
  await page.keyboard.press('ArrowRight');await expect(page.locator('#illustration-dialog-level')).toContainText('8 / 10');
  await expect(modal.locator('img')).toBeVisible();await expect.poll(()=>modal.locator('img').evaluate(i=>i.complete&&i.naturalWidth>0&&i.currentSrc.split('?')[0].endsWith('coronal-08.webp'))).toBe(true);
  await page.screenshot({path:'trainer/qa/illustration-dialog.png'});
  await page.keyboard.press('Escape');await expect(modal).not.toBeVisible();await expect(panel.locator('[data-action=open]')).toBeFocused();
  await page.locator('#mri-train').click();await expect(panel.locator('img')).toHaveCount(0);
  log('Large image loads, zoom and keyboard plate navigation work, Escape restores focus, Atlas exercise keeps labels hidden');

  await page.locator('#cases-mode').click();await ready();await page.locator('[data-case-mode=explore]').click();
  await page.locator('[data-topic=thalamus]').click();await page.locator('[data-case-plane=axial]').click();await imageReady();
  for (const id of ['sub-01','sub-02','sub-03']) {
    await page.locator(`[data-case-id=${id}]`).click();await ready();
    const target=await page.evaluate(()=>{const s=window.mriCaseQA.snapshot(),c=window.mriCaseQA.manifest().cases.find(c=>c.id===s.caseId),t=c.segmentation.labels.filter(l=>l.structure==='thalamus');return (t[0].anchor[2]+t[1].anchor[2])/2+28;});
    await range('#case-slice-z',target);await expect(panel.locator('img')).toHaveAttribute('src',/axial-09-thumb/);
  }
  await page.locator('[data-case-plane=coronal]').click();
  const y=await page.evaluate(()=>{const s=window.mriCaseQA.snapshot(),c=window.mriCaseQA.manifest().cases.find(c=>c.id===s.caseId),t=c.segmentation.labels.filter(l=>l.structure==='thalamus');return (t[0].anchor[1]+t[1].anchor[1])/2-2;});
  await range('#case-slice-y',y);await expect(panel.locator('img')).toHaveAttribute('src',/coronal-07-thumb/);
  await page.locator('[data-sequence=T2w]').click();await ready();await expect(panel.locator('img')).toHaveAttribute('src',/coronal-07-thumb/);
  await page.screenshot({path:'trainer/qa/illustration-individual.png',fullPage:true});
  log('Individual matching accounts for three different native origins, supports coronal, and survives T1/T2 switching');

  await page.locator('[data-case-mode=guided]').click();await ready();await page.locator('[data-case-plane=axial]').click();
  await expect(panel.locator('img')).toHaveCount(0);await panel.locator('[data-action=hint]').click();await imageReady();
  expect(await page.evaluate(()=>window.mriCaseQA.snapshot().task.helpUsed)).toContain('illustrations');
  await page.locator('#guided-new').click();await page.locator('[data-case-plane=axial]').click();await expect(panel.locator('img')).toHaveCount(0);
  await page.locator('[data-case-mode=transfer]').click();await ready();await page.locator('[data-case-plane=axial]').click();await expect(panel.locator('img')).toHaveCount(0);await expect(panel.locator('[data-action=hint]')).toHaveCount(0);
  log('Optional guided illustration is recorded as help; new question and held-out transfer reset/lock labeled plates');

  await page.locator('[data-case-mode=explore]').click();await ready();await page.locator('[data-case-plane=coronal]').click();await imageReady();
  await page.setViewportSize({width:390,height:844});await panel.locator('[data-action=open]').click();await expect(modal).toBeVisible();
  await expect(modal.locator('img')).toBeVisible();await expect.poll(()=>modal.locator('img').evaluate(i=>i.complete&&i.naturalWidth>0)).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  const box=await modal.boundingBox();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(390);
  await page.screenshot({path:'trainer/qa/illustration-mobile.png'});await page.keyboard.press('Escape');
  log('390px mobile dialog fits viewport with controls and no document overflow');
  expect(errors).toEqual([]);
  fs.writeFileSync('trainer/qa/illustrations-report.json',JSON.stringify({date:new Date().toISOString(),checks,errors},null,2));
} catch(e) { console.error('BROWSER ERRORS',errors);await page.screenshot({path:'trainer/qa/illustrations-failure.png',fullPage:true});throw e; }
finally { await browser.close(); }
