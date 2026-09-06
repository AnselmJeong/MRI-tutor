"""Build educational display derivatives of the CC BY 4.0 CIT168 atlas.

Run: uv run --with numpy --with scipy --with nibabel --with scikit-image python scripts/build_training_atlas.py
Source files remain unchanged. Coordinates are world RAS millimeters.
"""
from pathlib import Path
import hashlib
import json
import numpy as np
import nibabel as nib
from scipy.ndimage import gaussian_filter, binary_fill_holes
from skimage.measure import marching_cubes

ROOT = Path(__file__).resolve().parents[1] / 'trainer' / 'assets'
source = nib.load(ROOT / 'CIT168.nii.gz')
rgba = np.asanyarray(source.dataobj)
# NIfTI RGBA channels encode top label, runner-up, top probability, runner-up probability.
assert rgba.dtype.names == ('R', 'G', 'B', 'A'), rgba.dtype
labels = np.where(rgba['B'] >= 64, rgba['R'], 0).astype(np.uint8)
out = nib.Nifti1Image(labels, source.affine)
out.header.set_xyzt_units('mm')
out.header.set_intent('label')
nib.save(out, ROOT / 'training-labels.nii.gz')

def surface(data, affine, level=0.5, step=1):
    vertices, faces, _, _ = marching_cubes(data, level=level, step_size=step)
    vertices = nib.affines.apply_affine(affine, vertices)
    if np.linalg.det(affine[:3,:3]) < 0:
        faces = faces[:, ::-1]
    return {'positions':np.round(vertices, 3).ravel().tolist(), 'indices':faces.ravel().tolist()}

colors = json.loads((ROOT / 'CIT168.json').read_text())
regions = []
for label in range(1, 33):
    mask = labels == label
    assert mask.any(), label
    coords = np.argwhere(mask)
    center = coords.mean(axis=0)
    # Pick an actual labelled voxel nearest the centroid; a centroid can lie outside a curved nucleus.
    anchor = coords[np.argmin(np.sum((coords-center)**2, axis=1))]
    world = nib.affines.apply_affine(source.affine, anchor)
    assert (world[0] < 0) == (label % 2 == 1), (label, world)
    assert labels[tuple(anchor)] == label
    regions.append({'id':label, 'name':colors['labels'][label].strip(),
                    'anchor':np.round(world,3).tolist(), 'voxels':int(mask.sum()),
                    **surface(mask.astype(np.float32), source.affine)})

brain = nib.load(ROOT / 'CIT168toMNI152-2009c_T1w_brain.nii.gz')
data = brain.get_fdata(dtype=np.float32)
level = float(np.percentile(data[data > 0], 12))
mask = binary_fill_holes(data > level)
brain_mesh = surface(gaussian_filter(mask.astype(np.float32),0.7), brain.affine, step=2)
(ROOT / 'atlas-meshes.json').write_text(json.dumps({'regions':regions,'brain':brain_mesh},separators=(',',':')))
report = {'source':'Pauli, Nili & Tyszka (2018); NiiVue CIT168 derivatives',
          'license':'CC BY 4.0','coordinates':'RAS millimeters; x<0 is patient left',
          'label_derivative':'Most probable label with quantized probability >=64/255; educational display threshold, not a biological boundary',
          'brain_surface':'Filled binary mask at positive-intensity percentile 12, Gaussian sigma 0.7 voxels, marching cubes step 2; contextual outer surface, not a cortical parcellation',
          'region_surface':'Marching cubes of same binary labels as the MRI overlay; no smoothing',
          'regions':len(regions),'verified_inside_anchors':len(regions),
          'source_hashes':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in [ROOT/'CIT168.nii.gz',ROOT/'CIT168toMNI152-2009c_T1w_brain.nii.gz']}}
(ROOT / 'build-report.json').write_text(json.dumps(report,indent=2))
print(json.dumps({'regions':len(regions),'brain_vertices':len(brain_mesh['positions'])//3,'size':(ROOT/'atlas-meshes.json').stat().st_size}))
