"""Native-space ROI derivatives; never overlay 2009b symmetric masks on 2009c asymmetric MRI.
uv run --with numpy --with scipy --with nibabel --with scikit-image python scripts/build_extended_atlas.py
"""
from pathlib import Path
import json, hashlib
import nibabel as nib
import numpy as np
from nibabel.processing import resample_from_to
from scipy.ndimage import binary_fill_holes, gaussian_filter, distance_transform_edt
from skimage.measure import marching_cubes
R=Path(__file__).resolve().parents[1]/'trainer/assets'
E=R/'extended'; O=R/'rois'; O.mkdir(exist_ok=True)
base=nib.load(R/'CIT168toMNI152-2009c_T1w_brain.nii.gz')
old=json.loads((R/'atlas-meshes.json').read_text())
old['regions']=[x for x in old['regions'] if x['id']<=32]
specs=[]
def add(key,src,left,right=None,space='mni',midline=False):
 specs.append(dict(key=key,src=src,left=left,right=right,space=space,midline=midline))
for i in range(16):add('cit'+str(i),'../training-labels.nii.gz',[i*2+1],[i*2+2])
add('amygdala','aal3.nii.gz',[45],[46])
add('hippocampus','aal3.nii.gz',[41],[42])
add('acc','aal3.nii.gz',[151,153,155],[152,154,156])
add('pcc','aal3.nii.gz',[39],[40])
add('dacc','aal3.nii.gz',[155],[156])
add('insula','aal3.nii.gz',[33],[34])
add('dlpfc','aal3.nii.gz',[3,5],[4,6])
add('ofc','aal3.nii.gz',[25,27,29,31],[26,28,30,32])
add('vmpfc','aal3.nii.gz',[21,23],[22,24])
add('sma','aal3.nii.gz',[15],[16])
add('precuneus','aal3.nii.gz',[71],[72])
add('ipl','aal3.nii.gz',[65,67,69],[66,68,70])
add('thalamus','aal3.nii.gz',list(range(121,151,2)),list(range(122,151,2)))
add('mammillary','cobra.nii.gz',[38],[138])
add('nbm','julichbrain3.nii.gz',[225],[226])
add('lc','aan/AAN_LC_L_MNI152_1mm_v2p0_MNI152NLin2009cAsym.nii.gz',[1],'aan/AAN_LC_R_MNI152_1mm_v2p0_MNI152NLin2009cAsym.nii.gz')
add('pptn','aan/AAN_PTg_L_MNI152_1mm_v2p0_MNI152NLin2009cAsym.nii.gz',[1],'aan/AAN_PTg_R_MNI152_1mm_v2p0_MNI152NLin2009cAsym.nii.gz')
add('pag','aan/AAN_PAG_MNI152_1mm_v2p0_MNI152NLin2009cAsym.nii.gz',[1],midline=True)
add('dr','aan/AAN_DR_MNI152_1mm_v2p0_MNI152NLin2009cAsym.nii.gz',[1],midline=True)
add('mnr','aan/AAN_MnR_MNI152_1mm_v2p0_MNI152NLin2009cAsym.nii.gz',[1],midline=True)
add('vermis','aal3.nii.gz',list(range(113,121)),midline=True)
add('fornix','cobra.nii.gz',[33,37],[133,137])
add('anterior_thalamus','thalamic_nuclei.nii.gz',[2],[16])
add('parahippocampal','aal3.nii.gz',[43],[44])
add('claustrum','allen/AllenAtlas.nii.gz',[13],[13],space='allen')
add('septal','allen/AllenAtlas.nii.gz',[15],[15],space='allen')
cache={};manifest=[]; meshes=[]; pick=np.zeros(base.shape,np.uint16);pick_size=np.full(base.shape,np.inf)
def load(src):
 if src not in cache:cache[src]=nib.load(E/src)
 return cache[src]
def surf(d,a,step=1):
 v,f,_,_=marching_cubes(d.astype(np.float32),.5,step_size=step)
 v=nib.affines.apply_affine(a,v)
 if np.linalg.det(a[:3,:3])<0:f=f[:,::-1]
 return dict(positions=np.round(v,3).ravel().tolist(),indices=f.ravel().tolist())
for group,s in enumerate(specs):
 entries=[]; labels=[]; images=[]
 for hemi,values in enumerate([s['left']] if s['midline'] else [s['left'],s['right']]):
  src=s['src'] if not isinstance(values,str) else values
  im=load(src);d=np.asanyarray(im.dataobj)
  mask=(d>=.5) if src.startswith('aan/') else np.isin(d,values)
  if s['space']=='allen' or (src.startswith('aan/') and not s['midline']):
   x=nib.affines.apply_affine(im.affine,np.column_stack([np.arange(im.shape[0]),np.zeros(im.shape[0]),np.zeros(im.shape[0])]))[:,0]
   mask &= (x<0 if hemi==0 else x>=0)[:,None,None]
  coords=np.argwhere(mask);assert len(coords),s
  lo=np.maximum(coords.min(0)-1,0);hi=np.minimum(coords.max(0)+2,mask.shape)
  sl=tuple(slice(int(a),int(b)) for a,b in zip(lo,hi));cropped=mask[sl]
  aff=im.affine.copy();aff[:3,3]=nib.affines.apply_affine(im.affine,lo)
  id=group*2+hemi+1
  # Thickest interior voxel is a robust anchor, including curved ROIs.
  dist=distance_transform_edt(cropped,sampling=im.header.get_zooms()[:3]);anchor=np.array(np.unravel_index(dist.argmax(),dist.shape))
  world=nib.affines.apply_affine(aff,anchor)
  assert cropped[tuple(anchor)]
  if not s['midline']:assert (world[0]<0)==(hemi==0),(s,world)
  native=(cropped*id).astype(np.uint16);out=nib.Nifti1Image(native,aff);out.header.set_xyzt_units('mm');out.header.set_intent('label')
  name=f'{id}.nii.gz';nib.save(out,O/name)
  points=nib.affines.apply_affine(im.affine,coords)
  rng=np.random.default_rng(id);samples=points[rng.choice(len(points),min(150,len(points)),replace=False)]
  entry=dict(id=id,anchor=np.round(world,3).tolist(),voxels=int(mask.sum()),samples=np.round(samples,2).tolist(),url='assets/rois/'+name,space=s['space'],midline=s['midline'])
  if id<=32:mesh=next(x for x in old['regions'] if x['id']==id);mesh.update(entry)
  else:mesh={**entry,**surf(cropped,aff)}
  meshes.append(mesh);entries.append({k:v for k,v in entry.items() if k!='samples'})
  if s['space']=='mni':
   rem=np.asanyarray(resample_from_to(out,(base.shape,base.affine),order=0).dataobj)>0
   size=mask.sum()*abs(np.linalg.det(im.affine[:3,:3]));take=rem & (size<pick_size);pick[take]=id;pick_size[take]=size
 manifest.append({**s,'group':group,'entries':entries})
 print(group,s['key'],[e['voxels'] for e in entries],flush=True)
nib.save(nib.Nifti1Image(pick,base.affine),R/'all-labels.nii.gz')
allen=load('allen/AllenAtlas.nii.gz');ad=np.asanyarray(allen.dataobj)
# Separate global picker for the matched Allen MRI.
allen_pick=np.zeros(ad.shape,np.uint16)
x=nib.affines.apply_affine(allen.affine,np.column_stack([np.arange(ad.shape[0]),np.zeros(ad.shape[0]),np.zeros(ad.shape[0])]))[:,0]
for source,left,right in [(13,81,82),(15,83,84)]:
 codes=np.broadcast_to(np.where(x<0,left,right)[:,None,None],ad.shape)
 allen_pick[ad==source]=codes[ad==source]
nib.save(nib.Nifti1Image(allen_pick,allen.affine),R/'all-labels-allen.nii.gz')
# Matched Allen template contextual surface only. Keep in its own space.
mask=binary_fill_holes(ad>0);old['allenBrain']=surf(gaussian_filter(mask.astype(np.float32),1),allen.affine,step=4)
old['regions']=meshes
(R/'atlas-meshes.json').write_text(json.dumps(old,separators=(',',':')))
(R/'roi-manifest.json').write_text(json.dumps(manifest,indent=2))
(R/'extended-build-report.json').write_text(json.dumps({'groups':len(specs),'meshes':len(meshes),'anchors_inside':len(meshes),'spaces':{'mni':'MNI152NLin2009cAsym; CAT12 registered atlas derivatives and CANLab AAN conversion','allen':'ICBM2009b nonlinear symmetric; own matched MRI, never mixed with 2009c'},'overlay':'Each ROI retains a separate native-resolution mask; overlap is preserved. Global picking uses smallest physical ROI at overlapping voxels, active ROI takes precedence.','mesh':'Unsmooth marching cubes, exact same native mask as MRI overlay.','AAN_limit':'Boundaries approximate: CANLab conversion assumes original template identity. Paired masks split at world x=0; supplied PTg_L contained bilateral voxels (222), retaining 109 left voxels. PTg_R contains 113 right voxels.','sources':{str(E/k):hashlib.sha256((E/k).read_bytes()).hexdigest() for k in cache}},indent=2))
print('COMPLETE',len(meshes),(R/'atlas-meshes.json').stat().st_size)
