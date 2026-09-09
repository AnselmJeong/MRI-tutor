import {chromium,expect} from '@playwright/test';
import fs from 'node:fs';

const browser=await chromium.launch({channel:'chrome',headless:true,args:process.env.MRI_QA_GPU==='metal'?['--enable-webgl','--use-gl=angle','--use-angle=metal']:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1600,height:1050}}),errors=[],checks=[],samples=[],resources=[],latencies=[];
page.setDefaultTimeout(30000);page.on('pageerror',e=>errors.push(e.message));
const state=()=>page.evaluate(()=>window.mriCaseQA.snapshot());
const scene=()=>page.evaluate(()=>window.mriSubjectQA.snapshot());
const ready=()=>page.waitForFunction(()=>window.mriCaseQA&&!window.mriCaseQA.snapshot().loading&&!window.mriCaseQA.snapshot().loadError,undefined,{timeout:120000});
const meshReady=()=>page.waitForFunction(()=>window.mriSubjectQA?.snapshot().visible&&window.mriSubjectQA.snapshot().spaceId===`subject:${window.mriCaseQA.snapshot().caseId}:T1-native-RAS-mm`&&window.mriSubjectQA.snapshot().sliceCount>0,undefined,{timeout:60000});
const log=text=>{checks.push(text);console.log('PASS',text);};
const distance=(frame,p)=>frame.normal.reduce((d,n,i)=>d+n*(p[i]-frame.originMm[i]),0);
async function waitFrame(){
  await page.waitForFunction(()=>{
    const s=window.mriSubjectQA.snapshot(),c=window.mriCaseQA.snapshot();
    return s.frames.length===(c.viewer.plane==='multi'?3:1)&&s.frames.every(f=>(c.viewer.plane==='multi'||c.viewer.plane===f.plane)&&Math.abs(f.normal.reduce((d,n,i)=>d+n*(c.viewer.point[i]-f.originMm[i]),0))<.001);
  });
}
async function captureEvidence(){
  const c=await state(),s=await scene(),data=await page.evaluate(()=>window.mriCaseQA.sliceEvidence());
  for(const f of s.frames)expect(Math.abs(distance(f,c.viewer.point))).toBeLessThan(.001);
  for(const slab of data)for(const sample of slab.samples)expect(Math.abs(sample.intensity-sample.niivue)).toBeLessThan(.0001);
  samples.push({caseId:c.caseId,sequence:c.viewer.sequence,data});
}
try{
  await page.goto('http://127.0.0.1:8091/');await page.locator('#cases-mode').click();await ready();
  await page.locator('[data-workspace=linked]').click();
  expect((await scene()).visible).toBe(false);expect((await scene()).meshCount).toBe(0);
  await expect(page.locator('.guided-route')).toHaveCount(0);
  log('Unanswered practice loads no subject mesh or slice and exposes no route, even in 3D layout');
  await page.locator('#guided-reveal').click();const first=structuredClone((await state()).task.submitted);
  await page.locator('#guided-three').click();await meshReady();await waitFrame();
  expect((await state()).task.submitted).toEqual(first);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('mri-tutor-individual-v1')).helpEvents.at(-1).hint)).toBe('subject-three');
  await page.locator('#guided-next').click();expect((await scene()).visible).toBe(false);expect((await scene()).sliceCount).toBe(0);
  log('Post-answer 3D exposure is separate from immutable first response; next section conceals it again');
  await page.locator('[data-case-mode=explore]').click();await page.locator('[data-topic=hippocampus]').click();await page.locator('#case-side').selectOption('left');
  await page.locator('[data-workspace=linked]').click();await meshReady();
  for(const orientation of ['axial','coronal','sagittal','multi']){
    await page.locator(`[data-case-plane=${orientation}]`).click();await waitFrame();await captureEvidence();
  }
  log('Oblique native axial/coronal/sagittal and all three planes share the MRI frame within 0.001 mm');
  await page.locator('[data-case-plane=axial]').click();await waitFrame();
  const original=(await state()).viewer.point;
  await page.locator('[data-sequence=T2w]').click();await ready();await meshReady();await waitFrame();
  (await state()).viewer.point.forEach((v,i)=>expect(v).toBeCloseTo(original[i],3));await captureEvidence();
  const updates=(await scene()).statistics.sliceUpdates;
  await page.locator('#case-window').fill('80');await page.locator('#case-window').dispatchEvent('input');
  await page.waitForFunction(n=>window.mriSubjectQA.snapshot().statistics.sliceUpdates>n,updates);
  await captureEvidence();log('T2 and W/L use original scalar data and the preserved T1 position');
  await page.locator('[data-sequence=T1w]').click();await ready();await meshReady();
  // Picking is tested through the same visible raycast as pointer interaction.
  await page.locator('#show-planes').uncheck();await page.locator('#isolate').check();
  await page.locator('[data-view=front]').click();
  const candidates=await page.evaluate(()=>{
    const r=document.getElementById('brain').getBoundingClientRect(),hits=[];
    for(let y=r.y+30;y<r.bottom-20;y+=8)for(let x=r.x+20;x<r.right-20;x+=8){const hit=window.mriSubjectQA.pickAt(x,y);if(hit)hits.push({x,y,...hit});}
    return hits;
  });
  expect(candidates.length).toBeGreaterThan(0);const clicked=candidates[Math.floor(candidates.length/2)];
  await page.mouse.click(clicked.x,clicked.y);
  expect((await state()).viewer.referenceLabel).toBe(clicked.labelId);
  expect((await scene()).selection.source).toBe('mesh');
  log('Real mesh click moves MRI to a nearby voxel inside that subject’s reference mask');
  await page.locator('#show-planes').check();await page.locator('#isolate').uncheck();await waitFrame();
  for(const value of ['forward','reverse']){
    const updates=(await scene()).statistics.sliceUpdates;
    await page.locator('#subject-peel').selectOption(value);
    await page.waitForFunction(n=>window.mriSubjectQA.snapshot().statistics.sliceUpdates>n,updates);
    const result=await page.evaluate(()=>{
      const s=window.mriSubjectQA.snapshot(),r=document.getElementById('brain').getBoundingClientRect(),hits=[];
      for(let y=r.y+20;y<r.bottom-20;y+=12)for(let x=r.x+20;x<r.right-20;x+=12){const hit=window.mriSubjectQA.pickAt(x,y);if(hit)hits.push(hit.point);}
      return {s,hits};
    });
    expect(result.hits.length).toBeGreaterThan(0);
    for(const p of result.hits)for(const f of result.s.frames)expect(distance(f,p)*(value==='reverse'?-1:1)).toBeGreaterThanOrEqual(-.001);
  }
  log('Both clipping directions reject every sampled hidden intersection');
  await page.locator('[data-view=oblique]').click();
  await page.screenshot({path:'trainer/qa/subject-linked.png',fullPage:true});
  await page.locator('#subject-peel').selectOption('none');
  const beforeHidden=(await scene()).statistics.sliceUpdates;
  await page.locator('[data-workspace=mri]').click();await page.locator('#case-mri').focus();await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(200);expect((await scene()).statistics.sliceUpdates).toBeLessThanOrEqual(beforeHidden+1);
  await page.locator('[data-workspace=linked]').click();await waitFrame();
  log('Collapsed 3D stops slice work and restores the latest MRI frame');
  // Fast changes plus 20 completed loads bound renderer resources.
  for(let i=0;i<20;i++){
    const id=`sub-0${i%3+1}`;
    await page.locator(`[data-case-id="${id}"]`).click();await ready();await meshReady();await waitFrame();
    const s=await scene();expect(s.caseId).toBe(id);expect(s.meshCount).toBe(18);expect(s.atlasVisible).toBe(false);
    resources.push({iteration:i,...s.resources,renderer:s.renderer});
    if(i<3)await captureEvidence();
  }
  expect(new Set(resources.slice(3).map(r=>r.renderer.textures)).size).toBe(1);
  expect(Math.max(...resources.map(r=>r.textures))).toBeLessThanOrEqual(3);
  expect(Math.max(...resources.map(r=>r.workers))).toBe(1);
  log('20 case switches retain only the current 18 meshes, bounded textures and one worker');
  for(let i=0;i<12;i++){
    const n=(await scene()).statistics.sliceUpdates,start=performance.now();
    await page.locator('#case-mri').focus();await page.keyboard.press('ArrowUp');
    await page.waitForFunction(n=>window.mriSubjectQA.snapshot().statistics.sliceUpdates>n,n,{polling:'raf'});
    latencies.push(performance.now()-start);
  }
  // Loading failure must not silently use a template or the last person.
  await page.route('**/subject-core/**/sub-03/*.glb',route=>route.fulfill({status:200,body:'corrupt GLB'}));
  await page.locator('[data-case-id="sub-03"]').click();await ready();
  await page.waitForFunction(()=>window.mriSubjectQA.snapshot().failed);
  expect((await scene()).visible).toBe(false);expect((await scene()).atlasVisible).toBe(false);await expect(page.locator('#case-anchor')).toBeEnabled();
  await page.unroute('**/subject-core/**/sub-03/*.glb');await page.locator('#subject-retry').click();await meshReady();
  log('Corrupt GLB is rejected; MRI continues; explicit retry restores the same subject');
  await page.route('**/subject-core/**/sub-01/*.glb',async route=>{await new Promise(r=>setTimeout(r,1500));await route.continue().catch(()=>{});});
  await page.locator('[data-case-id="sub-01"]').click();await ready();
  await page.locator('[data-case-id="sub-02"]').click();await ready();await meshReady();
  await page.waitForTimeout(1700);expect((await scene()).caseId).toBe('sub-02');expect((await scene()).spaceId).toContain('sub-02');
  await page.unroute('**/subject-core/**/sub-01/*.glb');log('Late meshes from a previous subject cannot replace the current subject');
  await page.locator('[data-case-mode=transfer]').click();await ready();expect((await scene()).visible).toBe(false);
  await page.locator('input[value=indeterminate]').check();await page.locator('#reading-note').fill('연속 단면에서 경계를 추가 확인합니다.');await page.locator('#reading-submit').click();
  await page.locator('[data-workspace=linked]').click();await meshReady();await captureEvidence();
  expect((await scene()).caseId).toBe('sub-04');log('Held-out fourth subject reveals only its own 3D after the first response');
  await page.locator('#explore-mode').click();expect((await scene()).visible).toBe(false);expect((await scene()).atlasVisible).toBe(true);
  await page.locator('#cases-mode').click();await meshReady();expect((await scene()).atlasVisible).toBe(false);
  await page.setViewportSize({width:390,height:844});await page.locator('[data-workspace=linked]').click();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({path:'trainer/qa/subject-mobile.png',fullPage:true});log('Atlas spaces remain separate; mobile layout remains within the viewport');
  expect(errors).toEqual([]);
  fs.writeFileSync('trainer/qa/subject-report.json',JSON.stringify({date:new Date().toISOString(),browser:await browser.version(),renderer:`Chrome ${process.env.MRI_QA_GPU??'software'} WebGL; timings include Playwright input and polling`,checks,errors,resources,latenciesMs:latencies,p95Ms:latencies.slice().sort((a,b)=>a-b)[Math.ceil(latencies.length*.95)-1],samples},null,2));
}catch(error){console.error('SUBJECT',await scene().catch(()=>null));console.error('CASE',await state().catch(()=>null));console.error('ERRORS',errors);await page.screenshot({path:'/tmp/subject-failure.png',fullPage:true});throw error;}
finally{await browser.close();}
