import {chromium,expect} from '@playwright/test';
import fs from 'node:fs';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1050},deviceScaleFactor:2,hasTouch:true}),errors=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(30000);
const state=()=>page.evaluate(()=>window.mriCaseQA.snapshot());
const ready=()=>page.waitForFunction(()=>window.mriCaseQA&&!window.mriCaseQA.snapshot().loading&&!window.mriCaseQA.snapshot().loadError,undefined,{timeout:120000});
const log=s=>{checks.push(s);console.log('PASS',s);};
async function clickPoint(point,plane){
 await page.locator('#case-mri').scrollIntoViewIfNeeded();
 const pixel=await page.evaluate(({point,plane})=>window.mriCaseQA.projectPoint(point,plane),{point,plane});expect(pixel).not.toBeNull();
 const box=await page.locator('#case-mri').boundingBox();await page.mouse.click(box.x+pixel[0],box.y+pixel[1]);
 await page.waitForTimeout(100);
}
async function searchAnchor(){await page.locator('#case-anchor').click();const s=await state();await clickPoint(s.viewer.point,s.viewer.plane==='multi'?'axial':s.viewer.plane);await expect(page.locator('.nearby-dot').first()).toBeVisible();return state();}
async function checkMarkers(){
 const s=await state();expect(s.nearby.items.length).toBeGreaterThan(0);expect(new Set(s.nearby.items.map(i=>i.id)).size).toBe(s.nearby.items.length);
 for(const item of s.nearby.items){
  expect(item.distance).toBeLessThanOrEqual(Number(await page.locator('#nearby-radius').inputValue())+.001);
  expect(await page.evaluate(p=>window.mriCaseQA.referenceAt(p),item.point)).toBe(item.id);
  await expect.poll(()=>page.evaluate(i=>{
   const dot=document.querySelector(`.nearby-dot[data-label-id="${i.id}"]`),canvas=document.querySelector('#case-mri').getBoundingClientRect(),pixel=window.mriCaseQA.projectPoint(i.point,i.plane);
   if(!dot||dot.hidden||!pixel)return Infinity;const box=dot.getBoundingClientRect();
   return Math.max(Math.abs(box.x+box.width/2-canvas.x-pixel[0]),Math.abs(box.y+box.height/2-canvas.y-pixel[1]));
  },item)).toBeLessThan(.5);
 }
}
try{
 await page.goto('http://127.0.0.1:8091/');await page.locator('#cases-mode').click();await ready();await expect(page.locator('#nearby-controls')).toBeHidden();
 await page.locator('[data-case-mode=explore]').click();await page.locator('[data-topic=thalamus]').click();await page.locator('#case-side').selectOption('left');await page.locator('[data-workspace=mri]').click();
 await expect(page.locator('#nearby-radius')).toHaveValue('15');await expect(page.locator('.nearby-dot')).toHaveCount(0);
 await searchAnchor();await checkMarkers();let s=await state();expect(s.nearby.items.length).toBeGreaterThan(1);expect(s.viewer.overlay).toBe(false);
 for(const dot of await page.locator('.nearby-dot').all()){await dot.hover();await expect(page.locator('#nearby-tooltip')).toContainText(await dot.getAttribute('aria-label'));}
 const first=page.locator('.nearby-dot').first(),name=await first.getAttribute('aria-label');await first.hover();await expect(page.locator('#nearby-tooltip')).toHaveText(name);
 const point=s.viewer.point;await first.focus();await expect(page.locator('#nearby-tooltip')).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator('#nearby-tooltip')).toBeHidden();expect((await state()).viewer.point).toEqual(point);
 await first.tap();await expect(page.locator('#nearby-tooltip')).toBeVisible();await page.screenshot({path:'trainer/qa/nearby-hover.png',fullPage:true});log('Actual MRI click finds multiple in-plane masks; yellow points have hover, focus and touch labels without moving the MRI');
 await page.locator('#nearby-radius').selectOption('25');await checkMarkers();expect((await state()).nearby.items.length).toBeGreaterThanOrEqual(s.nearby.items.length);
 await page.locator('#case-zoom').fill('2');await page.locator('#case-zoom').dispatchEvent('input');await page.waitForTimeout(100);await checkMarkers();
 await page.setViewportSize({width:1600,height:1100});await page.waitForTimeout(250);await checkMarkers();await page.locator('[data-workspace=linked]').click();await page.waitForTimeout(250);await checkMarkers();await page.locator('[data-workspace=mri]').click();await page.waitForTimeout(250);await checkMarkers();log('Radius updates replace results; 2x zoom, DPR 2, viewport and split resizing keep every dot on its registered point');
 await page.locator('#case-zoom').fill('1');await page.locator('#case-zoom').dispatchEvent('input');await page.locator('#nearby-radius').selectOption('15');
 const previous=await page.locator('.nearby-dot').first().elementHandle();const canvas=await page.locator('#case-mri').boundingBox();await page.mouse.click(canvas.x+canvas.width*.63,canvas.y+canvas.height*.62);await page.waitForTimeout(100);expect(await previous.evaluate(el=>el.isConnected)).toBe(false);log('Clicking elsewhere removes old marker elements before showing the new local result');
 // Find a valid image location without any registered mask in the chosen radius.
 let empty=false;for(const [x,y] of [[.5,.82],[.25,.5],[.7,.8],[.5,.2],[.3,.75]]){await page.mouse.click(canvas.x+canvas.width*x,canvas.y+canvas.height*y);await page.waitForTimeout(80);s=await state();if(s.nearby.center&&s.nearby.items.length===0){empty=true;break;}}
 expect(empty).toBe(true);await expect(page.locator('#nearby-status')).toContainText('등록된 구조가 없어요');await expect(page.locator('.nearby-dot')).toHaveCount(0);log('Empty neighbourhood clears the old dots and explains how to search again');
 await expect(page.locator('#case-detail h2')).toHaveText('미등록 위치');await page.locator('[data-topic=thalamus]').click();await page.locator('#case-anchor').click();await page.locator('[data-case-plane=multi]').click();s=await state();await clickPoint(s.viewer.point,'coronal');await checkMarkers();expect((await state()).nearby.plane).toBe('coronal');log('Three-plane view searches and marks only the clicked tile');
 await page.locator('[data-case-plane=axial]').click();await expect(page.locator('.nearby-dot')).toHaveCount(0);await searchAnchor();await page.locator('#case-mri').focus();await page.keyboard.press('ArrowUp');await expect(page.locator('.nearby-dot')).toHaveCount(0);
 await searchAnchor();await page.locator('[data-sequence=T2w]').click();await ready();await expect(page.locator('.nearby-dot')).toHaveCount(0);await searchAnchor();await checkMarkers();
 await page.locator('[data-case-id="sub-02"]').click();await ready();await expect(page.locator('.nearby-dot')).toHaveCount(0);await searchAnchor();await checkMarkers();log('Slice, sequence and subject changes clear old markers; new subject and T2 use their own coordinates');
 await page.locator('[data-case-mode=guided]').click();await expect(page.locator('#nearby-controls')).toBeHidden();await expect(page.locator('.nearby-dot')).toHaveCount(0);await page.locator('#guided-reveal').click();await expect(page.locator('.guided-feedback')).toBeVisible();log('Guided practice stays separate and still accepts a reveal response');
 await page.locator('[data-case-mode=explore]').click();await searchAnchor();await page.locator('#nearby-clear').click();await expect(page.locator('.nearby-dot')).toHaveCount(0);await expect(page.locator('#nearby-clear')).toBeDisabled();
 await page.setViewportSize({width:390,height:844});await page.locator('[data-case-plane=axial]').click();await searchAnchor();await checkMarkers();await page.locator('.nearby-dot').first().tap();await expect(page.locator('#nearby-tooltip')).toBeVisible();await page.screenshot({path:'trainer/qa/nearby-mobile.png',fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);log('Narrow screen supports touch labels and clear action without horizontal overflow');
 expect(errors).toEqual([]);log('No uncaught browser errors');fs.writeFileSync('trainer/qa/nearby-report.json',JSON.stringify({date:new Date().toISOString(),checks,errors},null,2));
}catch(error){console.error(error);console.error('STATE',await state().catch(()=>null));console.error('ERRORS',errors);await page.screenshot({path:'/tmp/nearby-failure.png',fullPage:true});throw error;}finally{await browser.close();}
