import {chromium,expect} from '@playwright/test';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1366,height:768},deviceScaleFactor:2});page.setDefaultTimeout(20000);
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const atlas=()=>page.evaluate(()=>window.mriAtlasQA.snapshot()),subject=()=>page.evaluate(()=>window.mriCaseQA.snapshot());
const atlasReady=()=>page.waitForFunction(()=>window.mriAtlasQA&&!window.mriAtlasQA.snapshot().busy,undefined,{timeout:90000});
const caseReady=()=>page.waitForFunction(()=>window.mriCaseQA&&!window.mriCaseQA.snapshot().loading,undefined,{timeout:120000});
const log=s=>console.log('PASS',s);
async function ringAlignment(canvasId,qa){
 await expect.poll(()=>page.evaluate(({canvasId,qa})=>{
  const s=window[qa].snapshot(),marker=s.marker,canvas=document.getElementById(canvasId),ring=canvas.parentElement.querySelector('.anatomy-marker');
  if(!marker||!ring)return Infinity;const p=window[qa].projectPoint(marker.point,(s.viewer??s).plane==='multi'?'axial':(s.viewer??s).plane);if(!p)return Infinity;
  const a=canvas.getBoundingClientRect(),b=ring.getBoundingClientRect();return Math.max(Math.abs(b.x+b.width/2-a.x-p[0]),Math.abs(b.y+b.height/2-a.y-p[1]));
 },{canvasId,qa})).toBeLessThan(.75);
}
try{
 await page.goto('http://127.0.0.1:8091/');await atlasReady();await page.locator('[data-workspace=mri]').click();
 await page.locator('[data-group="21"]').click();await atlasReady();
 await expect(page.locator('#detail .relation')).toContainText('뇌섬엽 피질(insular cortex) → 최외포(extreme capsule) → 담장(claustrum) → 외포(external capsule) → 조가비핵(putamen)');
 const before=await atlas();await page.locator('#detail .relation [data-anatomy-term="조가비핵"]').click();
 await expect(page.locator('#mri').locator('..').locator('.anatomy-marker')).toBeVisible();let marked=await atlas();
 expect(marked.selected).toBe(before.selected);expect(marked.point).toEqual(before.point);expect(marked.marker.name).toBe('조가비핵');
 expect(await page.evaluate(p=>window.mriAtlasQA.referenceAt(p),marked.marker.point)).toBe(1);
 await ringAlignment('mri','mriAtlasQA');await page.screenshot({path:'/tmp/mri-anatomy-linked.png',fullPage:true});
 log('Insula chain has bilingual links; putamen ring is on its real current-slice mask without replacing the teaching topic or moving the crosshair');
 await page.locator('#zoom').fill('1.4');await page.locator('#zoom').dispatchEvent('input');await ringAlignment('mri','mriAtlasQA');await page.setViewportSize({width:1440,height:900});await ringAlignment('mri','mriAtlasQA');
 for(const term of ['최외포','외포','담장']){
  const word=page.locator(`#detail [data-anatomy-term="${term}"]`);await expect(word).toBeVisible();expect(await word.evaluate(el=>el.tagName)).toBe('SPAN');await expect(word).not.toHaveClass('anatomy-link');
 }
 await expect(page.locator('#detail .anatomy-status')).not.toContainText('등록되어 있지');
 log('Only current-template registered structures are linked; unavailable structures retain bilingual plain text');
 await page.locator('#zoom').fill('1');await page.locator('#zoom').dispatchEvent('input');await page.locator('[data-group="36"]').click();await atlasReady();
 const box=await page.locator('#mri').boundingBox();
 const emptyPixel=await page.evaluate(()=>{const qa=window.mriAtlasQA,s=qa.snapshot();for(let x=-80;x<=80;x+=10)for(let y=-90;y<=80;y+=10){const p=[x,y,s.point[2]],pixel=qa.projectPoint(p,'axial');if(pixel&&qa.referenceAt(p)===0&&pixel[0]>25&&pixel[1]>25)return pixel;}return null;});
 expect(emptyPixel).not.toBeNull();await page.mouse.click(box.x+emptyPixel[0],box.y+emptyPixel[1]);
 await expect.poll(async()=>(await atlas()).unregisteredSelection).toBe(true);await expect(page.locator('#detail h2')).toHaveText('미등록 위치');await expect(page.locator('#detail')).not.toContainText('소뇌 충부');expect((await atlas()).selected).toBeNull();await expect(page.locator('#structures [aria-pressed=true]')).toHaveCount(0);await expect(page.locator('#mri-reset')).toBeDisabled();await page.screenshot({path:'/tmp/mri-unregistered.png',fullPage:true});
 await page.locator('[data-group="36"]').click();await atlasReady();await expect(page.locator('#detail h2')).toHaveText('소뇌 충부(cerebellar vermis)');expect((await atlas()).unregisteredSelection).toBe(false);
 log('Direct unregistered click clears old vermis title, action, mask and list selection; selecting a known structure restores all');
 // Off-slice requests use a verified anchor; a moved slice hides the old marker.
 await page.locator('[data-group="21"]').click();await atlasReady();await page.locator('#slice-z').fill('70');await page.locator('#slice-z').dispatchEvent('input');await page.locator('#detail .relation [data-anatomy-term="조가비핵"]').click();await expect(page.locator('#detail .anatomy-status')).toContainText('단면으로 이동');await ringAlignment('mri','mriAtlasQA');
 await page.locator('#mri').focus();await page.keyboard.press('ArrowUp');await expect(page.locator('.anatomy-marker')).toHaveCount(0);await expect(page.locator('#detail h2')).toContainText('뇌섬엽');
 log('Off-slice link moves to a verified mask anchor; slice scrolling hides a circle that no longer belongs to the displayed plane');
 // A late mask request must not mark a newly selected teaching topic.
 await page.locator('[data-group="28"]').click();await atlasReady();
 let release;const gate=new Promise(resolve=>release=resolve);
 await page.route('**/assets/rois/27.nii.gz',async route=>{await gate;await route.continue();});
 const request=page.waitForRequest('**/assets/rois/27.nii.gz');
 await page.locator('#detail .relation [data-anatomy-term="시상하부"]').click();await request;
 await page.locator('[data-group="21"]').click();await atlasReady();const response=page.waitForResponse('**/assets/rois/27.nii.gz');release();await response;
 await expect(page.locator('#detail h2')).toContainText('뇌섬엽');await expect(page.locator('.anatomy-marker')).toHaveCount(0);
 log('A late anatomy-mask response cannot add an old marker after a new topic selection');
 const fixture=await page.evaluate(async()=>{
  const {annotateAnatomy}=await import('./anatomy-terms.js'),root=document.createElement('div');
  root.innerHTML='<p>해마 머리와 해마(hippocampus)</p><p data-user-content>해마 안쪽에서 관찰</p><textarea>시상과 해마</textarea>';
  annotateAnatomy(root,{onLocate:()=>{}});const once=root.innerHTML;annotateAnatomy(root,{onLocate:()=>{}});
  return {stable:once===root.innerHTML,note:root.querySelector('[data-user-content]').textContent,input:root.querySelector('textarea').value,text:root.firstElementChild.textContent};
 });
 expect(fixture).toEqual({stable:true,note:'해마 안쪽에서 관찰',input:'시상과 해마',text:'해마 머리(head of the hippocampus)와 해마(hippocampus)'});
 log('Repeated formatting preserves existing English and leaves user notes and form inputs untouched');
 await page.locator('[data-group="1"]').click();await atlasReady();
 for(const term of ['측뇌실 전각','내포 앞다리'])expect(await page.locator(`#detail .relation [data-anatomy-term="${term}"]`).evaluate(el=>el.tagName)).toBe('SPAN');
 await expect(page.locator('#detail .relation button[data-anatomy-term="렌즈핵"]')).toBeVisible();
 log('Caudate explanation links lentiform nucleus, keeping anterior horn and anterior limb as plain bilingual text');
 await page.locator('#cases-mode').click();await caseReady();await page.locator('[data-case-mode=explore]').click();await page.locator('[data-topic=putamen]').click();await page.locator('#case-side').selectOption('left');await page.locator('[data-hint=landmarks]').click();
 expect(await page.locator('#case-detail .landmark-guide [data-anatomy-term="내포"]').first().evaluate(el=>el.tagName)).toBe('SPAN');
 await page.locator('#case-detail .landmark-guide button[data-anatomy-term="담창구"]').first().click();await expect(page.locator('#case-mri').locator('..').locator('.anatomy-marker')).toBeVisible();
 const cs=await subject();expect(cs.topic).toBe('putamen');const id=await page.evaluate(p=>window.mriCaseQA.referenceAt(p),cs.marker.point);const manifest=await page.evaluate(()=>window.mriCaseQA.manifest());const labels=manifest.cases.find(c=>c.id===cs.caseId).segmentation.labels;expect(labels.find(l=>l.id===id).structure).toBe('pallidum');expect(labels.find(l=>l.id===id).side).toBe('left');await ringAlignment('case-mri','mriCaseQA');
 log('Individual MRI links sample that person’s native segmentation and respect the selected hemisphere');
 const caseEmpty=await page.evaluate(()=>{const qa=window.mriCaseQA;for(const sample of qa.sliceEvidence()[0].samples){const plane=qa.snapshot().viewer.plane,point=qa.pointOnSection(sample.world,plane),pixel=qa.projectPoint(point,plane);if(pixel&&qa.referenceAt(point)===0)return pixel;}return null;});
 expect(caseEmpty).not.toBeNull();const caseBox=await page.locator('#case-mri').boundingBox();await page.mouse.click(caseBox.x+caseEmpty[0],caseBox.y+caseEmpty[1]);
 await expect.poll(async()=>(await subject()).unregisteredSelection).toBe(true);await expect(page.locator('#case-detail h2')).toHaveText('미등록 위치');await expect(page.locator('.anatomy-marker')).toHaveCount(0);expect((await subject()).viewer.overlay).toBe(false);
 await page.locator('[data-topic=putamen]').click();await expect(page.locator('#case-detail h2')).toHaveText('조가비핵(putamen)');
 log('Individual MRI also clears the old title and overlay on an unregistered direct click');

 await page.locator('[data-case-id="sub-02"]').click();await caseReady();await expect(page.locator('.anatomy-marker')).toHaveCount(0);
 await page.locator('[data-case-mode=guided]').click();await expect(page.locator('#case-detail .anatomy-link').first()).toBeDisabled();
 log('Subject changes clear markers and unanswered exercises cannot reveal positions through anatomy links');
 expect(errors).toEqual([]);
}catch(e){console.error('ERRORS',errors,'ATLAS',await atlas().catch(()=>null),'CASE',await subject().catch(()=>null));await page.screenshot({path:'/tmp/anatomy-failure.png',fullPage:true});throw e;}finally{await browser.close();}
