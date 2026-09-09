import {chromium} from '@playwright/test';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1050}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:8091/');await page.locator('#cases-mode').click();
await page.waitForFunction(()=>window.mriCaseQA&&!window.mriCaseQA.snapshot().loading,undefined,{timeout:120000});
console.log('Default case',await page.evaluate(()=>window.mriCaseQA.snapshot().caseId),'errors',errors);
await page.screenshot({path:'trainer/qa/individual-default.png',fullPage:true});
await browser.close();
