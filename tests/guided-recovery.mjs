import {chromium,expect} from '@playwright/test';
import fs from 'node:fs';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1050}}),errors=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));
const state=()=>page.evaluate(()=>window.mriCaseQA.snapshot());
const ready=()=>page.waitForFunction(()=>window.mriCaseQA&&!window.mriCaseQA.snapshot().loading&&!window.mriCaseQA.snapshot().loadError,undefined,{timeout:120000});
try{
 await page.addInitScript(()=>{
  if(localStorage.getItem('guided-test-seeded'))return;
  const a={id:'legacy',caseId:'sub-01',topic:'pallidum',side:'left',sequence:'T1w',plane:'axial',point:[-9,25,5],status:'present',note:'보존할 이전 관찰 기록',hints:[],marks:{},visited:{},mode:'guided'};
  localStorage.setItem('mri-tutor-individual-v1',JSON.stringify({exposures:['sub-01'],attempts:[a]}));
  localStorage.setItem('mri-tutor-individual-draft-v1',JSON.stringify({caseId:'sub-01',topic:'pallidum',mode:'guided',side:'left',sequence:'T1w',point:a.point,task:{...a,submitted:a}}));
  localStorage.setItem('guided-test-seeded','yes');
 });
 await page.goto('http://127.0.0.1:8091/');await page.locator('#cases-mode').click();await ready();
 expect((await state()).attemptCount).toBe(1);await expect(page.locator('#guided-submit')).toBeVisible();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('mri-tutor-individual-draft-v1-legacy')).task.note)).toBe('보존할 이전 관찰 기록');checks.push('Legacy guided draft migrates to click exercise with prior history and draft backup preserved');
 const box=await page.locator('#case-mri').boundingBox();await page.mouse.click(box.x+box.width/2,box.y+box.height/2);await expect(page.locator('#guided-submit')).toBeEnabled();let s=await state();const point=s.viewer.point;
 await page.locator(`[data-case-plane=${s.viewer.plane}]`).click();await expect(page.locator('#guided-submit')).toBeDisabled();await page.mouse.click(box.x+box.width/2,box.y+box.height/2);await expect(page.locator('#guided-submit')).toBeEnabled();expect((await state()).viewer.point).toEqual(point);checks.push('A deliberate repeat click at the unchanged crosshair is accepted');
 await page.locator('#guided-reveal').click();s=await state();const answerId=s.task.id;await page.locator('#case-history').click();await page.locator(`[data-review="${answerId}"]`).evaluate(el=>el.closest('details').open=true);await page.locator(`[data-review="${answerId}"]`).click();await ready();expect((await state()).task.id).toBe(answerId);expect((await state()).viewer.referenceLabel).toBe((await state()).task.guided.labelId);
 await page.reload();await page.locator('#cases-mode').click();await ready();await expect(page.locator('.guided-feedback')).toHaveAttribute('data-result','revealed');expect((await state()).attemptCount).toBe(2);checks.push('History review opens the actual answer and remains submitted across reload');
 await page.locator('#guided-next').click();await page.reload();await page.locator('#cases-mode').click();await ready();expect((await state()).task.guided.index).toBe(1);await expect(page.locator('#guided-submit')).toBeDisabled();checks.push('Unanswered next section restores without accessing an unloaded volume');
 await page.setViewportSize({width:390,height:844});await expect(page.locator('#guided-image-prompt')).toBeVisible();await expect(page.locator('#guided-image-prompt')).toContainText('단면 2/3');await page.screenshot({path:'trainer/qa/guided-mobile.png',fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);checks.push('Narrow layout shows the assigned structure above the image');
 expect(errors).toEqual([]);fs.writeFileSync('trainer/qa/guided-recovery-report.json',JSON.stringify({date:new Date().toISOString(),checks,errors},null,2));console.log(checks.join('\n'));
}finally{await browser.close();}
