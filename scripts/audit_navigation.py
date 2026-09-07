"""Independently trace browser world points to original FreeSurfer voxels.

This checks coordinate/data consistency, not the clinical truth of segmentation.
Run after tests/navigation.mjs. Original source staging is required.
"""
from pathlib import Path
import hashlib
import json
import nibabel as nib
from nibabel.processing import resample_from_to
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

ROOT = Path(__file__).resolve().parents[1] / 'trainer'
manifest = json.loads((ROOT / 'assets/cases/manifest.json').read_text())
browser = json.loads((ROOT / 'qa/navigation-report.json').read_text())
checks = []
for case in manifest['cases']:
    sid = case['id']
    t1 = nib.load(ROOT / case['sequences']['T1w']['url'])
    raw = nib.load(ROOT / f'assets/cases/source/freesurfer/{sid}/mri/rawavg.mgz')
    original = nib.load(ROOT / f'assets/cases/source/freesurfer/{sid}/mri/aparc+aseg.mgz')
    canonical_t1, canonical_raw = map(nib.as_closest_canonical, (t1, raw))
    t1_data, raw_data = map(lambda x: np.asanyarray(x.dataobj), (canonical_t1, canonical_raw))
    foreground = (t1_data > 10) & (raw_data > 10)
    assert foreground.any() and np.array_equal(t1_data[foreground], raw_data[foreground]), sid
    # Reconstruct from the original image headers, not the case's recorded matrix.
    raw_to_t1 = canonical_t1.affine @ np.linalg.inv(canonical_raw.affine)
    original_data = np.asanyarray(original.dataobj)
    world_to_source = np.linalg.inv(original.affine) @ np.linalg.inv(raw_to_t1)
    targets = [dict(caseId=sid, topic=l['structure'], side=l['side'], point=l['anchor'],
                    label=l['id'], sourceIds=l['source_ids'], origin='stored-anchor')
               for l in case['segmentation']['labels']]
    targets += [dict(p, origin='browser') for p in browser['points'] if p['caseId'] == sid]
    for target in targets:
        voxel = np.rint(nib.affines.apply_affine(world_to_source, target['point'])).astype(int)
        assert ((voxel >= 0) & (voxel < original.shape)).all()
        source_id = int(original_data[tuple(voxel)])
        assert source_id in target['sourceIds'], (target, source_id)
        checks.append(dict(target, originalVoxel=voxel.tolist(), originalSourceId=source_id))
    print(sid, 'original segmentation anchor/point checks:', len(targets), flush=True)

# Independent world-axis render for the first subject, without browser rendering code.
case = manifest['cases'][0]
t1 = nib.load(ROOT / case['sequences']['T1w']['url'])
labels = nib.load(ROOT / case['segmentation']['url'])
fig, axes = plt.subplots(3, 3, figsize=(12, 12), facecolor='#f1f3eb')
for row, name in enumerate(['hippocampus', 'thalamus', 'callosum']):
    ref = next(l for l in case['segmentation']['labels'] if l['structure'] == name)
    anchor = np.array(ref['anchor'])
    # 120 mm cube centered on the anchor; nearest-neighbor only for categorical labels.
    grid_affine = np.eye(4)
    grid_affine[:3, 3] = anchor - 60
    grid = ((121, 121, 121), grid_affine)
    image = resample_from_to(t1, grid, order=1).get_fdata(dtype=np.float32)
    mask = resample_from_to(labels, grid, order=0).get_fdata(dtype=np.float32) == ref['id']
    for axis in range(3):
        ax = axes[row, axis]
        ax.imshow(np.take(image, 60, axis=axis).T, origin='lower', cmap='gray',
                  vmin=0, vmax=case['sequences']['T1w']['display_range'][1])
        ax.contour(np.take(mask, 60, axis=axis).T, levels=[.5], colors=['#e6b666'], linewidths=.8)
        ax.plot(60, 60, '+', color='#e6b666', markersize=10)
        ax.set_title(f"{name} {ref['side']} / {'sagittal coronal axial'.split()[axis]}\n"
                     f"source IDs {ref['source_ids']} / {'XYZ'[axis]}={anchor[axis]:.1f}", fontsize=9)
        if axis in (1, 2):
            ax.invert_xaxis()  # Same radiological R-left/L-right convention as the app.
        left, right, top = ('P', 'A', 'S') if axis == 0 else ('R', 'L', 'S' if axis == 1 else 'A')
        for x, y, text in [(0.03, .5, left), (.97, .5, right), (.5, .97, top)]:
            ax.text(x, y, text, transform=ax.transAxes, ha='center', va='center', color='white',
                    fontsize=9, bbox=dict(facecolor='black', alpha=.55, edgecolor='none', pad=2))
        ax.set_axis_off()
fig.suptitle('sub-01 / independent source-coordinate audit; not expert boundary approval', fontsize=12)
fig.tight_layout(rect=(0, 0, 1, .975))
fig.savefig(ROOT / 'qa/navigation-independent.png', dpi=120)
plt.close(fig)
report = dict(browser_report_sha256=hashlib.sha256((ROOT/'qa/navigation-report.json').read_bytes()).hexdigest(),
              scope='Original source ID and coordinate consistency; no expert anatomical adjudication',
              checked=len(checks), checks=checks)
(ROOT / 'qa/navigation-source-audit.json').write_text(json.dumps(report, indent=2))
