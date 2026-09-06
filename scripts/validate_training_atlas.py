"""Validate delivered data independently of mesh construction.
uv run --with numpy --with nibabel python scripts/validate_training_atlas.py
"""
from pathlib import Path
import nibabel as nib
import numpy as np
import json
R=Path(__file__).resolve().parents[1]/'trainer/assets'
d=json.loads((R/'atlas-meshes.json').read_text());manifest=json.loads((R/'roi-manifest.json').read_text())
assert len(manifest)==42 and len(d['regions'])==80
ids=set()
for r in d['regions']:
 assert r['id'] not in ids;ids.add(r['id'])
 im=nib.load(R.parent/r['url']);values=np.asanyarray(im.dataobj)
 assert set(np.unique(values))=={0,r['id']}
 inv=np.linalg.inv(im.affine)
 for world in [r['anchor'],*r['samples']]:
  v=np.rint(nib.affines.apply_affine(inv,world)).astype(int)
  assert values[tuple(v)]==r['id'],(r['id'],world)
 if not r['midline']:assert (r['anchor'][0]<0)==(r['id']%2==1)
 mesh=np.array(r['positions']).reshape(-1,3);faces=np.array(r['indices'])
 assert np.isfinite(mesh).all() and faces.min()>=0 and faces.max()<len(mesh)
 voxel_mesh=nib.affines.apply_affine(inv,mesh)
 nonzero=np.argwhere(values>0)
 assert np.allclose(voxel_mesh.min(0),nonzero.min(0)-.5,atol=.006)
 assert np.allclose(voxel_mesh.max(0),nonzero.max(0)+.5,atol=.006)
for id in [65,66]:
 im=nib.load(R/f'rois/{id}.nii.gz');points=nib.affines.apply_affine(im.affine,np.argwhere(np.asanyarray(im.dataobj)>0))
 assert np.all(points[:,0]<0) if id==65 else np.all(points[:,0]>0)
for name in ['all-labels.nii.gz','all-labels-allen.nii.gz']:
 labels=set(np.unique(nib.load(R/name).get_fdata()).astype(int))-{0};assert labels<=ids
print(json.dumps({'groups':42,'regions':80,'anchors_and_sample_points_inside':True,'mesh_bounds_match_native_voxels':True,'pptn_hemispheres_disjoint':True}))
