import {chromium, expect} from '@playwright/test';
import fs from 'node:fs';

const manifest = JSON.parse(fs.readFileSync('trainer/assets/illustrations/telencephalon/manifest.json'));
const browser = await chromium.launch({channel:'chrome', headless:true});
const page = await browser.newPage({viewport:{width:1200,height:950}});
const errors = [], checks = [];
page.on('pageerror', e => errors.push(e.message));
const log = text => { checks.push(text); console.log('PASS', text); };
try {
  await page.route('**/__illustration-variants__', route => route.fulfill({contentType:'text/html',body:`
    <link rel="stylesheet" href="styles.css"><link rel="stylesheet" href="illustrations.css">
    <aside class="inspector" style="width:280px"></aside><script type="module">
    import {createIllustrations} from './illustrations.js';
    window.referenceState={context:'test',plane:'axial',point:[0,80,-80],revealed:true};
    window.referencePanel=createIllustrations({getState:()=>window.referenceState,onHint:()=>{}});
    </script>`}));
  await page.goto('http://127.0.0.1:8091/__illustration-variants__');
  const panel = page.locator('#reference-illustrations');
  const dialog = page.locator('#illustration-dialog');
  const img = dialog.locator('img');
  const select = page.locator('#illustration-view');
  async function verify(asset) {
    await expect(img).toBeVisible();
    await expect.poll(() => img.evaluate(i => i.complete && i.naturalWidth > 0)).toBe(true);
    await expect(img).toHaveAttribute('src', `${asset.image}?v=${asset.sha256}`);
    const actual = await img.evaluate(i => ({width:i.naturalWidth,height:i.naturalHeight,box:i.getBoundingClientRect().toJSON()}));
    expect([actual.width,actual.height]).toEqual([asset.width,asset.height]);
    expect(Math.abs(actual.box.width / actual.box.height - asset.width / asset.height)).toBeLessThan(.005);
    expect(await page.locator('.illustration-viewport').evaluate(v => v.scrollWidth <= v.clientWidth+1 && v.scrollHeight <= v.clientHeight+1)).toBe(true);
  }
  for (const plane of ['axial','coronal']) {
    await page.evaluate(plane => { referenceState.plane=plane;referencePanel.refresh(); }, plane);
    await expect(panel.locator('img')).toHaveAttribute('src',new RegExp(`${plane}-01-thumb`));
    const first = manifest.figures.find(f => f.plane === plane);
    await expect(panel.locator('img')).toHaveAttribute('src', `${first.thumbnail}?v=${first.thumbnailSHA256}`);
    await panel.locator('[data-action=open]').click();
    const figures = manifest.figures.filter(f => f.plane === plane);
    for (const [i,f] of figures.entries()) {
      for (const view of ['labeled','unlabeled','fullPlate']) {
        await select.selectOption(view);
        await verify(view === 'labeled' ? f : f[view]);
        await expect(img).toHaveAttribute('alt',new RegExp(view === 'unlabeled' ? '삽화만' : view === 'fullPlate' ? '원본 전체' : '라벨 포함'));
      }
      if (i < 9) {
        await dialog.locator('[data-action=next]').click();
        await expect(select).toHaveValue('fullPlate');
      }
    }
    await page.keyboard.press('Escape');
  }
  log('All 20 figures load all three variants with correct dimensions, aspect ratio, fit and alt text; navigation preserves the selected view');

  await panel.locator('[data-action=open]').click();
  await expect(select).toHaveValue('labeled');
  await select.selectOption('unlabeled');
  await dialog.locator('[data-action=zoom-in]').click();
  await expect(page.locator('#illustration-zoom')).toHaveText('150%');
  await select.selectOption('labeled');
  await expect(page.locator('#illustration-zoom')).toHaveText('100%');
  await verify(manifest.figures[10]);
  log('Reopening defaults to labeled artwork and view changes reset zoom and scroll');

  let fail = true;
  await page.route('**/coronal-01-unlabeled.webp*', r => fail ? r.fulfill({status:503,body:'unavailable'}) : r.continue());
  // Start a new document so Chrome cannot reuse an already decoded image.
  await page.reload();
  await page.evaluate(() => { referenceState.plane='coronal';referencePanel.refresh(); });
  await expect(panel.locator('img')).toHaveAttribute('src',/coronal-01-thumb/);
  await panel.locator('[data-action=open]').click();
  await select.selectOption('unlabeled');
  await expect(page.locator('#illustration-image-error')).toBeVisible();
  fail = false;
  await dialog.locator('[data-action=retry-image]').click();
  await verify(manifest.figures[10].unlabeled);
  log('A failed alternate image retries the selected view successfully');

  await page.setViewportSize({width:390,height:844});
  for (const view of ['labeled','unlabeled','fullPlate']) {
    await select.selectOption(view);
    await verify(view === 'labeled' ? manifest.figures[10] : manifest.figures[10][view]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    const box = await select.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
  }
  await select.selectOption('labeled');
  await page.screenshot({path:'trainer/qa/illustration-variants-mobile.png'});
  log('All view options fit a 390px screen without overflow');
  expect(errors).toEqual([]);
  fs.writeFileSync('trainer/qa/illustration-variants-report.json',JSON.stringify({checks,errors},null,2)+'\n');
} finally {
  await browser.close();
}
