"""Independent source-mask / decoded-GLB and browser-slice oracle checks.

Run with scripts/subject-mesh-requirements.txt after test:subject-browser.
"""
import hashlib
import json
from pathlib import Path
import struct

import nibabel as nib
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
TRAINER = ROOT / 'trainer'


def sha(path):
    with path.open('rb') as f:
        return hashlib.file_digest(f, 'sha256').hexdigest()


def main():
    cases = json.loads((TRAINER / 'assets/cases/manifest.json').read_text())['cases']
    index = json.loads((TRAINER / 'assets/packs/subject-core/current.json').read_text())
    results = []
    for c in cases:
        entry = next(e for e in index['cases'] if e['caseId'] == c['id'])
        assert sha(TRAINER / entry['url']) == entry['sha256']
        pack = json.loads((TRAINER / entry['url']).read_text())
        source = nib.load(TRAINER / c['segmentation']['url'])
        mask = np.asarray(source.dataobj)
        inverse = np.linalg.inv(source.affine)
        assert sha(TRAINER / c['segmentation']['url']) == c['segmentation']['sha256']
        for seq, spec in c['sequences'].items():
            assert sha(TRAINER / spec['url']) == spec['sha256']
        assert sha(TRAINER / f'assets/cases/{c["id"]}/T2w-native.nii.gz') == c['sequences']['T2w']['native']['sha256']
        for rep in pack['representations']:
            path = TRAINER / rep['mesh']['url']
            assert sha(path) == rep['mesh']['sha256']
            content = path.read_bytes()
            json_size = struct.unpack_from('<I', content, 12)[0]
            doc = json.loads(content[20:20 + json_size])
            start = 28 + json_size
            verts = np.frombuffer(content, '<f4', count=doc['accessors'][0]['count'] * 3, offset=start).reshape(-1, 3).astype(float) * 1000
            faces = np.frombuffer(content, '<u4', count=doc['accessors'][1]['count'], offset=start + doc['bufferViews'][1]['byteOffset']).reshape(-1, 3)
            assert np.isfinite(verts).all() and faces.max() < len(verts)
            v = nib.affines.apply_affine(inverse, verts)
            # Lewiner marching cubes includes ambiguity-resolution vertices at
            # cell centers as well as edge midpoints. Every decoded vertex must
            # still occupy a mixed source cell containing both label and nonlabel.
            rounded = np.round(v * 2) / 2
            assert np.max(np.abs(v - rounded)) < .001
            low, high = np.floor(rounded).astype(int), np.ceil(rounded).astype(int)
            membership = []
            for x in [0, 1]:
                for y in [0, 1]:
                    for z in [0, 1]:
                        corner = np.where(np.array([x, y, z]), high, low)
                        membership.append(mask[tuple(corner.T)] == rep['labelId'])
            assert np.all(np.any(membership, axis=0) & ~np.all(membership, axis=0))
            anchor = np.rint(nib.affines.apply_affine(inverse, rep['interiorAnchor'])).astype(int)
            assert mask[tuple(anchor)] == rep['labelId']
            volume = np.einsum('ij,ij->i', verts[faces[:, 0]], np.cross(verts[faces[:, 1]], verts[faces[:, 2]])).sum() / 6
            assert volume > 0
            error = np.linalg.norm(nib.affines.apply_affine(source.affine, v) - verts, axis=1).max()
            assert error < .001
            results.append({'caseId': c['id'], 'labelId': rep['labelId'], 'verticesOnSourceBoundary': len(verts), 'volumeMm3': float(volume), 'roundTripMaxMm': float(error)})
        for topic in ['hippocampus', 'amygdala', 'caudate', 'putamen', 'thalamus']:
            pair = [next(r for r in pack['representations'] if r['structureId'] == f'anatomy:{topic}:{side}') for side in ['left', 'right']]
            assert pair[0]['interiorAnchor'][0] < pair[1]['interiorAnchor'][0]
    report = {'sourceHashesUnchanged': True, 'representations': results, 'browserSamples': 0, 'maxIntensityError': 0}
    browser_path = TRAINER / 'qa/subject-report.json'
    if browser_path.exists():
        browser = json.loads(browser_path.read_text())
        cached = {}
        for batch in browser['samples']:
            c = next(c for c in cases if c['id'] == batch['caseId'])
            key = (c['id'], batch['sequence'])
            if key not in cached:
                # Keep at most the current source array in the independent oracle.
                cached.clear()
                img = nib.load(TRAINER / c['sequences'][batch['sequence']]['url'])
                cached[key] = (img, np.asarray(img.dataobj))
            img, values = cached[key]
            for slab in batch['data']:
                for sample in slab['samples']:
                    voxel = np.rint(nib.affines.apply_affine(np.linalg.inv(img.affine), sample['world'])).astype(int)
                    expected = float(values[tuple(voxel)])
                    error = abs(expected - sample['intensity'])
                    assert error < .001, (key, voxel, expected, sample)
                    report['browserSamples'] += 1
                    report['maxIntensityError'] = max(report['maxIntensityError'], error)
    out = TRAINER / 'qa/subject-data-report.json'
    out.write_text(json.dumps(report, indent=2) + '\n')
    print(f"PASS {len(results)} decoded GLBs: original mask edges, anchors, winding, source hashes; {report['browserSamples']} independent MRI samples")


if __name__ == '__main__':
    main()
