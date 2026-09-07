import {chromium,expect} from '@playwright/test';
import fs from 'node:fs';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1050}}),errors=[],checks=[],points=[];
page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(25000);
const state=()=>page.evaluate(()=>window.mriCaseQA.snapshot());
const ready=()=>page.waitForFunction(()=>window.mriCaseQA&&!window.mriCaseQA.snapshot().loading&&!window.mriCaseQA.snapshot().loadError,undefined,{timeout:120000});
const log=x=>{checks.push(x);console.log('PASS',x);};
try{
 await page.goto('http://127.0.0.1:8091/');await ready();
 const manifest=await page.evaluate(()=>window.mriCaseQA.manifest());
 await expect(page.locator('#case-cursor-status')).toContainText('목표 구조의 위치를 뜻하지 않습니다');
 await expect(page.locator('#case-anchor')).toBeVisible();expect((await state()).viewer.overlay).toBe(false);
 const check=async()=>{
  const s=await state(),c=manifest.cases.find(c=>c.id===s.caseId),ref=c.segmentation.labels.find(l=>l.structure===s.topic&&l.side===s.side);
  expect(s.viewer.referenceLabel).toBe(ref.id);s.viewer.point.forEach((v,i)=>expect(v).toBeCloseTo(ref.anchor[i],1));
  await expect(page.locator('#case-cursor-status')).toContainText('선택 영역 안');
  expect(s.task.hints).toContain('anchor');expect(s.viewer.overlay).toBe(false);
  console.log('CHECK',s.caseId,s.topic,s.side);
  points.push({caseId:s.caseId,topic:s.topic,side:s.side,point:s.viewer.point,label:s.viewer.referenceLabel,sourceIds:ref.source_ids});
 };
 await page.locator('[data-case-mode=explore]').click();await check();
 // All 46 native labels via ordinary structure/hemisphere selection, no anchor button.
 for(const t of [...new Set(manifest.cases[0].segmentation.labels.map(l=>l.structure))]){
  await page.locator(`[data-topic="${t}"]`).click();
  const sides=manifest.cases[0].segmentation.labels.filter(l=>l.structure===t).map(l=>l.side);
  for(const side of sides){if(side!=='midline')await page.locator('#case-side').selectOption(side);await check();}
 }
 log('All 46 native labels: normal exploration topic/side selection reaches actual label voxel');
 await page.locator('[data-topic=hippocampus]').click();await page.locator('#case-side').selectOption('left');await check();
 await page.locator('#case-location-source summary').click();await expect(page.locator('#case-location-source')).toContainText('원천 라벨 ID: 17');await expect(page.locator('#case-open-aal')).toBeVisible();
 const keep=(await state()).viewer.point;
 await page.locator('#case-slice-x').focus();await page.keyboard.press('End');await expect(page.locator('#case-cursor-status')).toContainText('선택 영역 밖');
 await page.locator('#case-anchor').click();await check();
 await page.locator('[data-sequence=T2w]').click();await ready();await check();(await state()).viewer.point.forEach((v,i)=>expect(v).toBeCloseTo(keep[i],2));
 log('Manual movement reports actual membership; visible anchor restores location; T2 preserves native point');
 await page.locator('#case-select').selectOption('sub-02');await ready();await check();
 await page.locator('#case-select').selectOption('sub-03');await ready();await check();
 log('Changing subjects locates the new subject’s own label');
 await page.locator('[data-case-mode=guided]').click();let previous=(await state()).viewer.point;
 await page.locator('[data-topic=thalamus]').click();expect((await state()).viewer.point).toEqual(previous);expect((await state()).task.hints).toEqual([]);await expect(page.locator('#case-cursor-status')).toContainText('목표 구조의 위치를 뜻하지 않습니다');
 await page.locator('#case-anchor').click();await check();
 await page.locator('[data-case-mode=transfer]').click();await ready();await expect(page.locator('#case-anchor')).toBeDisabled();await expect(page.locator('[data-hint=boundary]')).toBeDisabled();await expect(page.locator('#case-cursor-status')).not.toContainText('현재 십자선의 자동 라벨:');
 await page.locator('#case-location-source summary').click();await expect(page.locator('#case-open-aal')).toBeDisabled();
 log('Unaided training does not auto-locate or expose labels; held-out location and AAL hints locked');
 await page.locator('[data-case-mode=explore]').click();await ready();await check();
 await page.locator('[data-topic=hippocampus]').click();await page.locator('[data-workspace=mri]').click();
 await page.locator('#case-location-source summary').click();await page.locator('#case-open-aal').click();await expect(page.locator('#atlas-mri-content')).toBeVisible();
 await page.waitForFunction(()=>document.querySelector('#mri-loading').hidden,undefined,{timeout:120000});await expect(page.locator('#detail h2')).toContainText('해마');
 log('AAL link opens corresponding hippocampus in separate reference atlas');
 await page.locator('#cases-mode').click();await ready();await page.locator('[data-hint=boundary]').click();
 for(const t of ['hippocampus','thalamus','callosum']){
  await page.locator(`[data-topic="${t}"]`).click();await page.locator('[data-case-plane=multi]').click();
  await page.locator('[data-hint=boundary]').click();await page.screenshot({path:`trainer/qa/navigation-${t}.png`,fullPage:true});
 }
 expect(errors).toEqual([]);log('No uncaught browser errors');
 fs.writeFileSync('trainer/qa/navigation-report.json',JSON.stringify({date:new Date().toISOString(),checks,points,errors},null,2));
}finally{await browser.close();}
