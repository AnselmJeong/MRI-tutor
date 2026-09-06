import {chromium,expect} from '@playwright/test';
import fs from 'node:fs';
import {expandedTopics} from '../trainer/case-content-expanded.js';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1050}}),errors=[];
page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
page.on('requestfailed',r=>console.error(r.url(),r.failure()));
page.setDefaultTimeout(20000);
const state=()=>page.evaluate(()=>window.mriCaseQA.snapshot());
const ready=()=>page.waitForFunction(()=>window.mriCaseQA&&!window.mriCaseQA.snapshot().loading&&!window.mriCaseQA.snapshot().loadError,undefined,{timeout:120000});
try{
 await page.goto('http://127.0.0.1:8091/');await ready();
 await expect(page.locator('#case-topics button')).toHaveCount(26);
 const manifest=await page.evaluate(()=>window.mriCaseQA.manifest());const c=manifest.cases[0];
 await page.locator('#case-category').selectOption('뇌간 · 소뇌');await expect(page.locator('#case-topics button')).toHaveCount(2);
 await page.locator('#case-search').fill('교뇌');await expect(page.locator('#case-topics button')).toHaveCount(1);
 await page.locator('#case-search').fill('없는구조');await expect(page.locator('#case-topics')).toContainText('일치하는 주제가 없습니다');
 await page.locator('#case-search').fill('');await page.locator('#case-category').selectOption('');
 const checked=[];
 for(const t of expandedTopics){
  await page.locator(`[data-topic="${t.id}"]`).click();expect((await state()).viewer.overlay).toBe(false);
  for(const side of t.midline?['midline']:['left','right']){
   if(!t.midline)await page.locator('#case-side').selectOption(side);
   else {await expect(page.locator('#case-side')).toHaveValue('midline');await expect(page.locator('#case-side')).toBeDisabled();}
   await page.locator('[data-hint=boundary]').click();await page.locator('#case-anchor').click();
   const s=await state(),ref=c.segmentation.labels.find(l=>l.structure===t.id&&l.side===side);
   expect(s.viewer.ids).toEqual([ref.id]);expect(s.viewer.overlay).toBe(true);s.viewer.point.forEach((v,i)=>expect(v).toBeCloseTo(ref.anchor[i],1));
   if(t.group==null){await expect(page.locator('[data-hint=three]')).toHaveCount(0);await expect(page.locator('body')).toHaveClass(/reference-concealed/);}
   checked.push(`${t.id}:${side}`);console.log('Checked',t.id,side);
  }
 }
 await page.locator('[data-topic=orbitofrontal]').click();await page.locator('[data-hint=boundary]').click();await page.locator('#case-anchor').click();await page.locator('[data-workspace=mri]').click();
 await page.screenshot({path:'trainer/qa/individual-expanded.png',fullPage:true});
 await page.locator('[data-topic=brainstem]').click();await page.locator('[data-hint=boundary]').click();await page.locator('#case-anchor').click();
 await page.locator('input[value=indeterminate]').check();await page.locator('#reading-note').fill('교뇌와 제4뇌실의 관계는 확인했지만 내부 미세 핵의 경계는 이 대비에서 확정할 수 없다.');await page.locator('#reading-submit').click();await expect(page.locator('body')).toHaveClass(/reference-concealed/);
 expect((await state()).task.submitted.contractId).toContain('brainstem');await page.reload();await ready();await expect(page.locator('#case-side')).toHaveValue('midline');await expect(page.locator('.reading-feedback')).toBeVisible();
 await expect(page.locator('body')).toHaveClass(/reference-concealed/);await page.locator('[data-case-mode=explore]').click();await expect(page.locator('body')).toHaveClass(/reference-concealed/);
 expect(errors).toEqual([]);fs.writeFileSync('trainer/qa/expanded-report.json',JSON.stringify({date:new Date().toISOString(),checked,checks:['26 topics; category and landmark search','Every new topic maps to correct native label and anchor on both sides','Midline selection, first-response contract and reload','Unavailable 3D never displays previous structure as current'],errors},null,2));
 console.log('Expanded curriculum passed:',checked.length,'label/side paths');
}finally{await browser.close();}
