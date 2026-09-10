import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {illustrationReferencePoint, nearestIllustration} from '../trainer/illustration-matching.js';
const manifest = JSON.parse(fs.readFileSync(new URL('../trainer/assets/illustrations/telencephalon/manifest.json', import.meta.url)));

test('all 20 labeled plates retain unique source pages and valid full/preview assets', () => {
  assert.equal(manifest.figures.length, 20);
  assert.equal(new Set(manifest.figures.map(f => f.pdfPage)).size, 20);
  for (const plane of ['axial', 'coronal']) assert.deepEqual(manifest.figures.filter(f => f.plane === plane).map(f => f.level), [1,2,3,4,5,6,7,8,9,10]);
  for (const f of manifest.figures) {
    const full = fs.readFileSync(new URL('../trainer/' + f.image, import.meta.url));
    assert.equal(createHash('sha256').update(full).digest('hex'), f.sha256);
    assert.equal(full.toString('ascii', 8, 12), 'WEBP');
    assert.ok(fs.statSync(new URL('../trainer/' + f.thumbnail, import.meta.url)).size > 1000);
    assert.equal(createHash('sha256').update(fs.readFileSync(new URL('../trainer/' + f.thumbnail, import.meta.url))).digest('hex'), f.thumbnailSHA256);
    assert.ok(f.width > 1000 && f.height > 1000);
    assert.equal(f.width, (f.cropPoints[2] - f.cropPoints[0]) * manifest.renderDpi / 72);
    assert.equal(f.height, (f.cropPoints[3] - f.cropPoints[1] + 24) * manifest.renderDpi / 72);
    for (const key of ['unlabeled', 'fullPlate']) {
      const variant = f[key];
      const bytes = fs.readFileSync(new URL('../trainer/' + variant.image, import.meta.url));
      assert.equal(createHash('sha256').update(bytes).digest('hex'), variant.sha256);
      assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
      assert.ok(variant.width > 800 && variant.height > 800);
      assert.notEqual(variant.image, f.image);
    }
  }
});

test('source and reviewed extraction geometry match the rendered set', () => {
  const source = fs.readFileSync(new URL('../Telencephalon.pdf', import.meta.url));
  const regions = JSON.parse(fs.readFileSync(new URL('../scripts/illustration-regions.json', import.meta.url)));
  const report = JSON.parse(fs.readFileSync(new URL('../trainer/qa/illustration-extraction-report.json', import.meta.url)));
  const hash = createHash('sha256').update(source).digest('hex');
  assert.equal(hash, manifest.sourceSHA256);
  assert.equal(hash, regions.sourceSHA256);
  assert.equal(hash, report.sourceSHA256);
  assert.equal(report.figures.length, 20);
  for (const f of report.figures) {
    assert.equal(f.labelLines, regions.figures[f.id].labelLines.length);
    assert.ok(f.leaderPaths > 0);
    assert.ok(f.maxArtworkChannelDifference <= 2);
  }
  // These three lines share a PDF block with the localizer caption.
  const last = regions.figures['coronal-10'].labelLines.map(l => l.text);
  for (const text of ['Inferior pole', 'of lateral', 'ventricle']) assert.ok(last.includes(text));
});

test('subject translation changes native coordinates without changing the selected plate', () => {
  const labels = [{structure:'thalamus', side:'left', anchor:[-10,10,20]}, {structure:'thalamus', side:'right', anchor:[10,14,22]}];
  const at = [4,20,31], offset = [55,-90,120];
  const movedLabels = labels.map(l => ({...l, anchor:l.anchor.map((v,i) => v+offset[i])}));
  const a = illustrationReferencePoint(at, labels), b = illustrationReferencePoint(at.map((v,i) => v+offset[i]), movedLabels);
  assert.deepEqual(a, b);
  for (const plane of ['axial','coronal']) assert.equal(nearestIllustration(manifest.figures, plane, a).figure.id, nearestIllustration(manifest.figures, plane, b).figure.id);
  assert.equal(illustrationReferencePoint(at, []), null);
  assert.equal(illustrationReferencePoint(at, labels.slice(0,1)), null);
});

test('coverage and invalid coordinates cannot falsely imply a matched sagittal or unsupported level', () => {
  assert.equal(nearestIllustration(manifest.figures, 'sagittal', [0,0,0]), null);
  assert.equal(nearestIllustration(manifest.figures, 'axial', [0,0,NaN]), null);
  assert.equal(nearestIllustration([], 'axial', [0,0,0]), null);
  const top = nearestIllustration(manifest.figures, 'axial', [0,0,100]);
  assert.equal(top.figure.level, 10); assert.equal(top.outside, true);
  const front = nearestIllustration(manifest.figures, 'coronal', [0,80,0]);
  assert.equal(front.figure.level, 1); assert.equal(front.outside, true);
  assert.equal(nearestIllustration(manifest.figures, 'coronal', [0,-20,0]).figure.level, 7);
});
