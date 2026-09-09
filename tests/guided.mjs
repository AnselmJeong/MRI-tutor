import {chromium,expect} from '@playwright/test';
import fs from 'node:fs';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1050}}),errors=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(30000);
const state=()=>page.evaluate(()=>window.mriCaseQA.snapshot());
const ready=()=>page.waitForFunction(()=>window.mriCaseQA&&!window.mriCaseQA.snapshot().loading&&!window.mriCaseQA.snapshot().loadError,undefined,{timeout:120000});
const log=x=>{checks.push(x);console.log('PASS',x);};
const axis={axial:2,coronal:1,sagittal:0};
// Calibrate world/screen correspondence through real pointer clicks, without mutating app state.
async function clickWorld(target){
 const box=await page.locator('#case-mri').boundingBox(),cx=box.x+box.width/2,cy=box.y+box.height/2;
 const click=async(x,y)=>{await page.mouse.click(x,y);await page.waitForTimeout(80);return (await state()).viewer.point;};
 const p0=await click(cx,cy),px=await click(cx+40,cy),py=await click(cx,cy+40);
 const s=await state(),uv=[0,1,2].filter(i=>i!==axis[s.viewer.plane]);
 const [u,v]=uv,ax=(px[u]-p0[u])/40,bx=(py[u]-p0[u])/40,ay=(px[v]-p0[v])/40,by=(py[v]-p0[v])/40;
 const det=ax*by-bx*ay,du=target[u]-p0[u],dv=target[v]-p0[v];
 expect(Math.abs(det)).toBeGreaterThan(.01);
 await click(cx+(du*by-bx*dv)/det,cy+(ax*dv-du*ay)/det);
}
try{
 await page.goto('http://127.0.0.1:8091/');await page.locator('#cases-mode').click();await ready();
 let s=await state();expect(s.task.guided.sections).toHaveLength(3);expect(s.viewer.overlay).toBe(false);
 await expect(page.locator('#reading-note')).toHaveCount(0);await expect(page.locator('#case-topics')).toBeHidden();await expect(page.locator('#guided-submit')).toBeDisabled();await expect(page.locator('.guided-route')).toHaveCount(0);
 log('Random question opens a real target-containing plane with click-only response; route hidden until first answer');
 for(let i=0;i<3;i++){
  s=await state();const section=s.task.guided.sections[i];expect(s.task.guided.index).toBe(i);
  expect(s.viewer.plane).toBe(section.plane);expect(s.viewer.sliceDepth).toBeCloseTo(section.depth,1);
  await clickWorld(section.answer);s=await state();expect(s.viewer.referenceLabel).toBe(s.task.guided.labelId);await expect(page.locator('#guided-submit')).toBeEnabled();
  if(i===0){
   await page.keyboard.press('ArrowUp'); // Focus the canvas explicitly below for invalidation.
   await page.locator('#case-mri').focus();await page.keyboard.press('ArrowUp');await expect(page.locator('#guided-submit')).toBeDisabled();await expect(page.locator('#guided-selection')).toContainText('문제 단면');
   await page.locator('#guided-return').click();await clickWorld(section.answer);
  }
  await page.locator('#guided-submit').click();await expect(page.locator('.guided-feedback')).toHaveAttribute('data-result','match');await expect(page.locator('.guided-route')).toBeVisible();expect((await state()).viewer.overlay).toBe(true);
  if(i===0){await page.screenshot({path:'trainer/qa/guided-match.png',fullPage:true});await page.reload();await page.locator('#cases-mode').click();await ready();expect((await state()).attemptCount).toBe(1);await expect(page.locator('.guided-feedback')).toHaveAttribute('data-result','match');}
  await page.locator('#guided-next').click();
 }
 expect((await state()).topic).not.toBe(s.topic);expect((await state()).task.guided.index).toBe(0);expect((await state()).viewer.overlay).toBe(false);log('Real clicks match all three planes; slice movement invalidates response; feedback restores after reload; new structure follows');
 s=await state();const first=s.task.guided.sections[0];const wrong=[...first.answer],uv=[0,1,2].filter(i=>i!==axis[first.plane]);wrong[uv[0]]=0;wrong[uv[1]]=-60;
 await clickWorld(wrong);expect((await state()).viewer.referenceLabel).not.toBe(s.task.guided.labelId);await page.locator('#guided-submit').click();await expect(page.locator('.guided-feedback')).toHaveAttribute('data-result','miss');expect((await state()).viewer.referenceLabel).toBe(s.task.guided.labelId);
 await page.locator('#guided-mine').click();expect((await state()).viewer.referenceLabel).not.toBe(s.task.guided.labelId);await page.locator('#guided-answer').click();expect((await state()).viewer.referenceLabel).toBe(s.task.guided.labelId);
 await page.screenshot({path:'trainer/qa/guided-miss.png',fullPage:true});log('Wrong real click reveals target mask and actual interior answer on same plane; own point can be compared');
 await page.locator('#guided-retry').click();expect((await state()).viewer.overlay).toBe(false);await expect(page.locator('#guided-submit')).toBeDisabled();await page.locator('#guided-reveal').click();await expect(page.locator('.guided-feedback')).toHaveAttribute('data-result','revealed');
 await page.locator('#guided-next').click();await page.reload();await page.locator('#cases-mode').click();await ready();expect((await state()).task.guided.index).toBe(1);expect((await state()).viewer.overlay).toBe(false);await expect(page.locator('#guided-submit')).toBeDisabled();
 await page.locator('[data-sequence=T2w]').click();await ready();expect((await state()).task.guided.index).toBe(1);await page.locator('#case-reset').click();s=await state();expect(s.viewer.sliceDepth).toBeCloseTo(s.task.guided.sections[1].depth,1);
 log('Reveal, retry, unfinished progress restore, T2 and reset preserve the assigned section');
 await page.locator('[data-case-id="sub-02"]').click();await page.locator('[data-case-id="sub-03"]').click();await ready();s=await state();expect(s.caseId).toBe('sub-03');expect(s.viewer.caseId).toBe('sub-03');expect(s.task.guided.index).toBe(0);
 await page.locator('#guided-reveal').click();s=await state();expect(s.viewer.referenceLabel).toBe(s.task.guided.labelId);log('Rapid subject changes build questions from the loaded subject’s own mask');
 await page.locator('[data-case-mode=transfer]').click();await ready();await expect(page.locator('#case-anchor')).toBeDisabled();await expect(page.locator('#reading-note')).toBeVisible();expect((await state()).viewer.overlay).toBe(false);
 await page.locator('[data-case-mode=explore]').click();await ready();await page.locator('[data-topic=pallidum]').click();await expect(page.locator('#case-anchor')).toBeEnabled();await expect(page.locator('#case-cursor-status')).toContainText('선택 영역 안');
 await page.locator('[data-case-mode=guided]').click();await ready();await expect(page.locator('#guided-submit')).toBeVisible();log('Transfer remains locked and exploration retains structure selection and native target navigation');
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'trainer/qa/guided-mobile.png',fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);await expect(page.locator('#guided-reveal')).toBeVisible();log('390px layout retains question, answer controls and route without horizontal overflow');
 expect(errors).toEqual([]);log('No uncaught browser errors');
 fs.writeFileSync('trainer/qa/guided-report.json',JSON.stringify({date:new Date().toISOString(),checks,errors},null,2));
}catch(error){console.error('ORIGINAL',error);console.error('BROWSER ERRORS',errors);console.error('GUIDED STATE',JSON.stringify(await state().catch(()=>null),null,2));await page.screenshot({path:'/tmp/guided-failure.png',fullPage:true});throw error;}finally{await browser.close();}
