import {chromium,expect} from '@playwright/test';
import fs from 'node:fs';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:1440,height:1050}});const page=await context.newPage();
page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',e=>errors.push(e.message));const results=[];
const state=()=>page.evaluate(()=>window.mriCaseQA.snapshot());
const ready=()=>page.waitForFunction(()=>window.mriCaseQA&&!window.mriCaseQA.snapshot().loading&&!window.mriCaseQA.snapshot().loadError,undefined,{timeout:120000});
const log=s=>{results.push(s);console.log('PASS',s);};
const range=async(id,value)=>{await page.locator(id).fill(String(value));await page.locator(id).dispatchEvent('input');};
try{
 await page.goto('http://127.0.0.1:8091/');await ready();
 await page.waitForFunction(()=>document.querySelector('#mri-loading').hidden,undefined,{timeout:45000});
 await expect(page.locator('.top-nav button')).toHaveText(['해부학 Atlas','Atlas 위치 연습','실제 MRI']);
 await expect(page.locator('#explore-mode')).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('#cases-mode')).toHaveAttribute('aria-pressed','false');
 await expect(page.locator('#atlas-mri-content')).toBeVisible();await expect(page.locator('#case-mri-content')).toBeHidden();
 expect((await state()).active).toBe(false);expect(await page.evaluate(()=>window.mriSubjectQA.snapshot().atlasVisible)).toBe(true);
 await page.screenshot({path:'trainer/qa/atlas-first.png',fullPage:true});
 log('Anatomical Atlas opens first; menu follows Atlas to actual MRI with distinct template wording');
 await page.locator('#cases-mode').click();await expect(page.locator('#cases-mode')).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('#explore-mode')).toHaveAttribute('aria-pressed','false');

 await expect(page.locator('#guided-submit')).toBeVisible();await page.locator('[data-case-mode=explore]').click();await page.locator('[data-topic=hippocampus]').click();await page.locator('#case-side').selectOption('left');
 expect((await state()).viewer.overlay).toBe(false);await expect(page.locator('#case-detail h2')).toHaveText('해마(hippocampus)');log('Individual T1 defaults to guided practice; exploration retains hidden label and topic selection');
 await page.locator('[data-workspace=mri]').click();const original=(await state()).viewer.point;
 await page.locator('[data-workspace=three]').click();await page.locator('[data-workspace=linked]').click();expect((await state()).viewer.point).toEqual(original);log('Split endpoints preserve MRI coordinates');
 await page.locator('[data-workspace=mri]').click();await page.locator('[data-hint=boundary]').click();expect((await state()).viewer.overlay).toBe(true);await page.locator('#case-anchor').click();
 await page.locator('[data-hint=landmarks]').click();await expect(page.locator('.landmark-guide')).toContainText('측뇌실');
 const anchor=(await state()).viewer.point;const canvas=page.locator('#case-mri');await canvas.focus();await page.keyboard.press('ArrowUp');expect((await state()).viewer.point[2]).toBeGreaterThan(anchor[2]+.8);log('Native label reveal, anatomical anchor and continuous slice keyboard navigation');
 await range('#case-window',60);expect((await state()).viewer.range[1]-(await state()).viewer.range[0]).toBe(60);
 await page.locator('[data-sequence=T2w]').click();await ready();const t2state=await state();expect(t2state.sequence??t2state.viewer.sequence).toBe('T2w');expect(t2state.viewer.point[2]).toBeCloseTo(anchor[2]+1,2);log('T2 load retains T1 world point and W/L updates display');
 await page.screenshot({path:'trainer/qa/individual-t2-reference.png',fullPage:true});
 for(const id of ['sub-02','sub-03','sub-01']){
  const beforeSwitch=await state();await page.locator(`[data-case-id="${id}"]`).click();await ready();
  let s=await state();expect(s.viewer.caseId).toBe(id);expect(s.viewer.sequence).toBe('T2w');expect(s.topic).toBe(beforeSwitch.topic);expect(s.side).toBe(beforeSwitch.side);
  await expect(page.locator(`[data-case-id="${id}"]`)).toHaveAttribute('aria-pressed','true');
  const point=s.viewer.point;await page.locator('[data-sequence=T1w]').click();await ready();s=await state();expect(s.viewer.sequence).toBe('T1w');s.viewer.point.forEach((v,i)=>expect(v).toBeCloseTo(point[i],3));
  await page.locator('[data-sequence=T2w]').click();await ready();s=await state();expect(s.viewer.sequence).toBe('T2w');s.viewer.point.forEach((v,i)=>expect(v).toBeCloseTo(point[i],3));
 }
 log('Cases 1, 2 and 3 expose both T1/T2; switching people retains target, side and sequence while each sequence retains its subject point');
 await page.screenshot({path:'trainer/qa/case-image-switching.png',fullPage:true});

 await expect(page.locator('#reading-form')).toHaveCount(0);await expect(page.locator('#case-detail > .reference-note')).toHaveCount(0);
 await page.locator('[data-case-mode=compare]').click();
 await page.locator('input[value=present]').check();await page.locator('#reading-note').fill('좌측 내측 측두엽에서 측두각 아래 회색질을 확인했고 앞뒤 단면의 연속성을 관찰했다.');
 const box=await canvas.boundingBox();await page.mouse.click(box.x+box.width*.58,box.y+box.height*.46);
 await expect(page.locator('#reading-submit')).toBeEnabled();await canvas.focus();await page.keyboard.press('ArrowUp');await expect(page.locator('#reading-submit')).toBeDisabled();
 await page.mouse.click(box.x+box.width*.55,box.y+box.height*.5);await expect(page.locator('#reading-submit')).toBeEnabled();await page.locator('#reading-submit').click();await expect(page.locator('.reading-feedback')).toContainText('점수 없음');expect((await state()).attemptCount).toBe(1);log('Real click required; moving slice invalidates old candidate; first response has reference-only feedback');
 await page.reload();await page.locator('#cases-mode').click();await ready();expect((await state()).attemptCount).toBe(1);await expect(page.locator('.reading-feedback')).toBeVisible();log('First response and review survive reload');
 await page.locator('[data-case-mode=trace]').click();await page.locator('[data-case-plane=coronal]').click();
 await page.locator('[data-trace-mark=appearance]').click();await page.locator('#trace-forward').click();await page.locator('[data-trace-mark=body]').click();await page.locator('#trace-forward').click();await page.locator('[data-trace-mark=disappearance]').click();
 await page.locator('input[value=indeterminate]').check();await page.locator('#reading-note').fill('세 개의 연속 깊이를 따라 형태 변화를 확인했으나 경계의 일부는 신호만으로 구분하기 어렵다.');await expect(page.locator('#reading-submit')).toBeEnabled();await page.locator('#reading-submit').click();expect((await state()).attemptCount).toBe(2);log('Ordered appearance, change and disappearance trace records');
 await page.locator('[data-case-mode=compare]').click();await page.waitForFunction(()=>window.mriCaseQA.snapshot().comparison?.caseId==='sub-01'&&!window.mriCaseQA.snapshot().comparison.busy,undefined,{timeout:120000});
 expect((await state()).comparison.point[0]).toBeCloseTo((await state()).viewer.point[0],2);log('Same-person T1/T2 comparison shares world coordinates');
 await page.locator('#compare-select').selectOption('sub-02');await page.waitForFunction(()=>window.mriCaseQA.snapshot().comparison?.caseId==='sub-02'&&!window.mriCaseQA.snapshot().comparison.busy,undefined,{timeout:120000});const compareBefore=(await state()).comparison.point;
 await canvas.focus();await page.keyboard.press('ArrowUp');expect((await state()).comparison.point).toEqual(compareBefore);log('Different subjects navigate independently, without false spatial matching');
 await page.screenshot({path:'trainer/qa/individual-comparison.png',fullPage:true});
 await page.locator('[data-case-mode=transfer]').click();await ready();expect((await state()).caseId).toBe('sub-04');expect((await state()).viewer.overlay).toBe(false);await expect(page.locator('[data-hint=boundary]')).toBeDisabled();await expect(page.locator('body')).toHaveClass(/reference-concealed/);log('Held-out case, reference masking and pre-answer hint lock');
 await page.locator('input[value=absent]').check();await page.locator('#reading-note').fill('이 깊이에서는 목표 구조의 연속성을 확신하기 어렵고 다른 방향에서 확인이 필요하다.');await page.locator('#reading-submit').click();await expect(page.locator('[data-hint=boundary]')).toBeEnabled();await page.locator('#reading-next').click();await expect(page.locator('[data-hint=boundary]')).toBeDisabled();await expect(page.locator('body')).toHaveClass(/reference-concealed/);log('Next transfer question re-locks every hint after feedback');
 await page.locator('[data-case-mode=guided]').click();await ready();await page.locator('[data-case-id="sub-02"]').click();await page.locator('[data-case-id="sub-03"]').click();await ready();expect((await state()).viewer.caseId).toBe('sub-03');log('Rapid subject selection rejects stale volume completion');
 await page.locator('#case-history').click();await expect(page.locator('#case-dialog')).toContainText('3개 첫 응답');await page.locator('#case-dialog-close').click();
 await page.locator('#case-provenance').click();await expect(page.locator('#case-dialog')).toContainText('0.667');await expect(page.locator('#case-dialog')).toContainText('int16');await page.locator('#case-dialog-close').click();log('History and acquisition/native geometry provenance');
 await page.locator('#explore-mode').click();await expect(page.locator('#atlas-mri-content')).toBeVisible();await page.waitForFunction(()=>document.querySelector('#mri-loading').hidden,undefined,{timeout:45000});await page.locator('[data-plane=axial]').click();await page.locator('[data-workspace=linked]').click();await expect(page.locator('#brain')).toBeVisible();log('Original atlas, MRI planes and 3D split still work');
 await page.locator('#cases-mode').click();await expect(page.locator('#case-mri-content')).toBeVisible();
 await page.setViewportSize({width:390,height:844});await page.locator('[data-workspace=mri]').click();await page.screenshot({path:'trainer/qa/individual-mobile.png',fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);log('390px mobile retains reading controls without horizontal overflow');
 expect(errors).toEqual([]);log('No uncaught browser errors');
 fs.writeFileSync('trainer/qa/browser-report.json',JSON.stringify({date:new Date().toISOString(),browser:'Chrome headless, software WebGL',results,errors},null,2));
}catch(e){await page.screenshot({path:'trainer/qa/browser-failure.png',fullPage:true});console.error('STATE',await state().catch(()=>null));console.error('ERRORS',errors);throw e;}finally{await browser.close();}
