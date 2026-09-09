import {chromium,expect} from '@playwright/test';
import fs from 'node:fs';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const logs=[];const errors=[];
const make=async()=>{const context=await browser.newContext({viewport:{width:1440,height:1050}});const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));return {page,context};};
const ready=page=>page.waitForFunction(()=>window.mriCaseQA&&!window.mriCaseQA.snapshot().loading&&!window.mriCaseQA.snapshot().loadError,undefined,{timeout:120000});
try{
 const {page,context}=await make();await page.goto('http://127.0.0.1:8091/');await page.locator('#cases-mode').click();await ready(page);
 await page.route('**/sub-01/T2w-in-T1.nii.gz',r=>r.fulfill({status:503,body:'test simulated unavailable image'}));
 await page.locator('[data-sequence=T2w]').click();await page.waitForFunction(()=>window.mriCaseQA.snapshot().loadError);
 await expect(page.locator('#guided-submit')).toBeDisabled();await expect(page.locator('#case-mri')).toHaveCSS('visibility','hidden');await expect(page.locator('#case-loading')).toContainText('다시 불러오기');
 await page.unroute('**/sub-01/T2w-in-T1.nii.gz');await page.getByRole('button',{name:'다시 불러오기',exact:true}).click();await ready(page);expect((await page.evaluate(()=>window.mriCaseQA.snapshot())).viewer.sequence).toBe('T2w');logs.push('503 hides stale MRI, blocks submission, and retry recovers');
 await page.locator('[data-case-mode=transfer]').click();await ready(page);await page.locator('[data-case-mode=guided]').click();await ready(page);await page.locator('[data-case-mode=transfer]').click();await ready(page);expect((await page.evaluate(()=>window.mriCaseQA.snapshot())).task.novel).toBe(false);logs.push('Repeated held-out exposure is not mislabeled as unseen');
 await page.locator('#explore-mode').click();await page.waitForFunction(()=>document.querySelector('#mri-loading').hidden,undefined,{timeout:45000});await page.locator('#mri-train').click();await expect(page.locator('#detail')).toContainText('MRI LOCALIZATION');await page.waitForFunction(()=>Boolean(document.querySelector('#mri-reveal')));await page.locator('#mri-reveal').click();await expect(page.locator('#detail')).toContainText('정답 확인을 선택했습니다');
 await page.locator('#find-mode').click();await page.locator('#find-reveal').click();await expect(page.locator('#detail')).toContainText('정답은');
 await expect(page.locator('#mri-train')).toHaveAttribute('aria-pressed','true');
 await page.locator('#cases-mode').click();await expect(page.locator('#isolate')).toBeEnabled();logs.push('Atlas localization, supplementary 3D quiz and return restore controls');
 await context.close();
 const second=await make();await second.page.addInitScript(()=>{Storage.prototype.getItem=function(){throw new DOMException('blocked','SecurityError')};Storage.prototype.setItem=function(){throw new DOMException('blocked','QuotaExceededError')};});await second.page.goto('http://127.0.0.1:8091/');await second.page.locator('#cases-mode').click();await ready(second.page);await second.page.locator('#guided-reveal').click();await expect(second.page.locator('.guided-feedback')).toBeVisible();await second.page.locator('#case-history').click();await expect(second.page.locator('#case-dialog')).toContainText('1개 첫 응답');logs.push('Blocked localStorage still permits learning, live history and export');await second.context.close();
 expect(errors).toEqual([]);fs.writeFileSync('trainer/qa/resilience-report.json',JSON.stringify({date:new Date().toISOString(),logs,uncaughtErrors:errors},null,2));console.log(logs.join('\n'));
}finally{await browser.close();}
