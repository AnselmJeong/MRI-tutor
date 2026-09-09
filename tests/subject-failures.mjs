import {chromium,expect} from '@playwright/test';
import fs from 'node:fs';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=metal']});
const checks=[],errors=[];
async function open(url=''){
  const page=await browser.newPage({viewport:{width:1600,height:1050}});page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8091/'+url);await page.locator('#cases-mode').click();await page.waitForFunction(()=>window.mriCaseQA&&!window.mriCaseQA.snapshot().loading,undefined,{timeout:120000});
  // Keep 3D inactive until the caller installs its failure route.
  await page.locator('[data-workspace=mri]').click();
  await page.locator('[data-case-mode=explore]').click();await page.locator('[data-topic=hippocampus]').click();return page;
}
try{
  const page=await open();
  await page.route('**/slice-worker.js',route=>route.fulfill({contentType:'text/javascript',body:'throw new Error("injected worker failure");'}));
  await page.locator('[data-workspace=linked]').click();
  await page.waitForFunction(()=>window.mriSubjectQA.snapshot().sliceFailed);
  await expect(page.locator('#subject-retry')).toBeVisible();
  expect(await page.evaluate(()=>window.mriSubjectQA.snapshot().sliceCount)).toBe(0);
  await expect(page.locator('#case-anchor')).toBeEnabled();
  await page.unroute('**/slice-worker.js');await page.locator('#subject-retry').click();
  await page.waitForFunction(()=>window.mriSubjectQA.snapshot().sliceCount===1&&!window.mriSubjectQA.snapshot().sliceFailed);
  checks.push('Worker failure keeps MRI and same-subject meshes usable, clears stale planes and supports retry');
  await page.locator('[data-topic=precentral]').click();
  expect(await page.evaluate(()=>window.mriSubjectQA.snapshot().visibleStructureIds)).toEqual([]);
  await expect(page.locator('#subject-status')).toContainText('선택 구조의 개인 3D 없음');
  checks.push('Unsupported subject ROI displays no borrowed or previous mesh');
  await page.locator('#case-search').fill('꼬리핵');await expect(page.locator('[data-topic=caudate]')).toHaveCount(1);
  await page.close();
  const disabled=await open('?subject3D=0');await disabled.locator('[data-workspace=linked]').click();
  expect(await disabled.evaluate(()=>window.mriSubjectQA.snapshot().meshCount)).toBe(0);expect(await disabled.evaluate(()=>window.mriSubjectQA.snapshot().atlasVisible)).toBe(false);
  await expect(disabled.locator('#case-anchor')).toBeEnabled();await disabled.close();
  const sliceDisabled=await open('?mriSliceIn3D=0');await sliceDisabled.locator('[data-workspace=linked]').click();
  await sliceDisabled.waitForFunction(()=>window.mriSubjectQA.snapshot().meshCount===18);
  expect(await sliceDisabled.evaluate(()=>window.mriSubjectQA.snapshot().sliceCount)).toBe(0);await sliceDisabled.close();
  checks.push('Both rollback flags preserve MRI and never substitute a template');
  expect(errors).toEqual([]);checks.forEach(c=>console.log('PASS',c));
  fs.writeFileSync('trainer/qa/subject-failures-report.json',JSON.stringify({checks,errors},null,2));
}finally{await browser.close();}
