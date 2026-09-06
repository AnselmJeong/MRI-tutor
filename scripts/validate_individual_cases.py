"""Validate installed bytes, geometry, label identity and non-scoring contracts."""
from pathlib import Path
import hashlib,json
import nibabel as nib
import numpy as np
ROOT=Path(__file__).resolve().parents[1]/'trainer'
m=json.loads((ROOT/'assets/cases/manifest.json').read_text());results=[]
for c in m['cases']:
    label=nib.load(ROOT/c['segmentation']['url']);a=np.asanyarray(label.dataobj)
    assert hashlib.sha256((ROOT/c['segmentation']['url']).read_bytes()).hexdigest()==c['segmentation']['sha256']
    for seq in c['sequences'].values():
        p=ROOT/seq['url'];im=nib.load(p)
        assert hashlib.sha256(p.read_bytes()).hexdigest()==seq['sha256']
        assert np.allclose(im.affine,seq['affine'])
        assert str(im.get_data_dtype())==seq['dtype']
        assert list(im.shape)==seq['shape']
        assert np.isfinite(np.asanyarray(im.dataobj)).all()
        assert im.get_data_dtype()!=np.dtype('uint8')
    assert np.allclose(c['sequences']['T1w']['affine'],c['sequences']['T2w']['affine'],atol=1e-4)
    assert c['sequences']['T1w']['sha256']==c['sequences']['T1w']['native']['sha256']
    assert hashlib.sha256((ROOT/'assets/cases'/c['id']/'T2w-native.nii.gz').read_bytes()).hexdigest()==c['sequences']['T2w']['native']['sha256']
    for l in c['segmentation']['labels']:
        ijk=np.round(nib.affines.apply_affine(np.linalg.inv(label.affine),l['anchor'])).astype(int)
        assert a[tuple(ijk)]==l['id']
        assert int((a==l['id']).sum())==l['voxel_count']
        assert not l['scoreable'] and l['review_status']=='reference-only'
        assert l['case_id']==c['id'] and l['reference_space']==c['reference_space']
        assert 'T1w' in l['observability'] and 'T2w' in l['observability']
    for structure in set(l['structure'] for l in c['segmentation']['labels']):
        pair={l['side']:l for l in c['segmentation']['labels'] if l['structure']==structure}
        if 'left' in pair and 'right' in pair:assert pair['left']['anchor'][0]<pair['right']['anchor'][0]
    assert len(c['tasks'])==11
    assert all(t['status']=='enabled-observation' and not t['scoreable'] and t['allowed_region'] is None for t in c['tasks'])
    results.append({'case':c['id'],'labels_checked':len(c['segmentation']['labels']),'tasks':len(c['tasks']),'hashes':'passed','affines':'passed','native_intensity':'passed','hemispheres':'left relative to right in scanner RAS, not sign-of-x assumption'})
(ROOT/'qa/data-validation.json').write_text(json.dumps({'results':results,'clinical_scoreable_tasks':0},indent=2));print(json.dumps(results,indent=2))
