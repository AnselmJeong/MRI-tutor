import {chromium,expect} from '@playwright/test';

// Use a non-localhost HTTP origin so Chrome really disables randomUUID().
// MRI_TUTOR_TEST_URL can point to a LAN or public HTTP address for live QA.
const url=process.env.MRI_TUTOR_TEST_URL??'http://mri-tutor.test:8091/';
const browser=await chromium.launch({channel:'chrome',headless:true,args:[
  '--host-resolver-rules=MAP mri-tutor.test 127.0.0.1',
  '--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
]});
try{
  const page=await browser.newPage({viewport:{width:1440,height:1050}});
  const errors=[],failed=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  page.on('requestfailed',request=>failed.push(request.url()));
  const ready=()=>page.waitForFunction(()=>window.mriCaseQA&&!window.mriCaseQA.snapshot().loading&&!window.mriCaseQA.snapshot().loadError,undefined,{timeout:120000});
  const state=()=>page.evaluate(()=>window.mriCaseQA.snapshot());
  expect((await page.goto(url)).status()).toBe(200);await page.locator('#cases-mode').click();await page.locator('#cases-mode').click();
  expect(await page.evaluate(()=>({secure:isSecureContext,uuid:typeof crypto.randomUUID}))).toEqual({secure:false,uuid:'undefined'});
  await ready();
  await expect(page.locator('#case-loading')).toBeHidden();
  let s=await state();
  expect(s.viewer.busy).toBe(false);
  expect(s.viewer.error).toBe(false);
  expect(s.viewer.range).toHaveLength(2);
  expect(s.viewer.range[1]).toBeGreaterThan(s.viewer.range[0]);
  expect(s.task.id).toMatch(/^[0-9a-f-]{36}$/);
  const firstId=s.task.id;
  await page.reload();await page.locator('#cases-mode').click();await ready();
  expect((await state()).task.id).toBe(firstId);
  await page.locator('[data-case-mode=explore]').click();
  s=await state();expect(s.task.id).not.toBe(firstId);
  await page.locator('[data-sequence=T2w]').click();await ready();
  expect((await state()).viewer.sequence).toBe('T2w');
  if(process.env.MRI_TUTOR_TEST_SCREENSHOT)await page.screenshot({path:process.env.MRI_TUTOR_TEST_SCREENSHOT,fullPage:true});
  expect(errors).toEqual([]);expect(failed).toEqual([]);
  console.log(`PASS ${url}: insecure HTTP, T1/T2 MRI, saved task restored, new task created; no browser errors or failed requests`);
}finally{await browser.close();}
