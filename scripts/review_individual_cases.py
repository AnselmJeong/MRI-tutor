"""Render world-coordinate QA contacts from real MRI and subject labels, never synthetic images."""
from pathlib import Path
import json,sys
import nibabel as nib
from nibabel.processing import resample_from_to
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
ROOT=Path(__file__).resolve().parents[1]/'trainer';OUT=ROOT/'qa';OUT.mkdir(exist_ok=True)
manifest=json.loads((ROOT/'assets/cases/manifest.json').read_text())
for c in manifest['cases']:
    folder=ROOT/'assets/cases'/c['id'];raw=nib.load(folder/'T1w.nii.gz');lab=nib.load(folder/'labels-reference.nii.gz')
    # Axis-aligned scanner RAS grid solely for static visual QA (not the app MRI derivative).
    affine=np.diag([1.,1.,1.,1.]);affine[:3,3]=np.floor(c['sequences']['T1w']['bounds'][0]);shape=np.ceil(np.array(c['sequences']['T1w']['bounds'][1])-affine[:3,3]+1).astype(int)
    grid=(tuple(shape),affine)
    t1=resample_from_to(raw,grid,order=1).get_fdata(dtype=np.float32);t2=resample_from_to(nib.load(folder/'T2w-in-T1.nii.gz'),grid,order=1).get_fdata(dtype=np.float32);l=resample_from_to(lab,grid,order=0).get_fdata(dtype=np.float32)
    fig,axes=plt.subplots(3,4,figsize=(12,9),facecolor='#f1f3eb')
    point=np.round(np.array(c['initial_point'])-affine[:3,3]).astype(int)
    for axis in range(3):
        for j,arr in enumerate([t1,t2,t1,t2]):
            ax=axes[axis,j];img=np.take(arr,point[axis],axis=axis).T;ax.imshow(img,origin='lower',cmap='gray',vmin=0,vmax=c['sequences']['T1w' if j%2==0 else 'T2w']['display_range'][1]);ax.axis('off')
            if j>1:
                lm=np.take(l,point[axis],axis=axis).T;ax.contour(lm>0,levels=[.5],colors=['#d5aa69'],linewidths=.35)
            ax.set_title(f'{c["id"]} {"T1" if j%2==0 else "T2 aligned"} {"XYZ"[axis]}={c["initial_point"][axis]:.1f}',fontsize=9)
    fig.tight_layout();fig.savefig(OUT/f'{c["id"]}-registration.png',dpi=115);plt.close(fig)
    side='right' if '--right' in sys.argv else 'left'
    targets=[x for x in c['segmentation']['labels'] if (x['side']=='right' if side=='right' else x['side']!='right')];fig,axes=plt.subplots(len(targets),3,figsize=(10,3*len(targets)),facecolor='#f1f3eb')
    for row,target in enumerate(targets):
        point=np.round(np.array(target['anchor'])-affine[:3,3]).astype(int)
        for axis in range(3):
            ax=axes[row,axis];img=np.take(t1,point[axis],axis=axis).T;mask=np.take(l,point[axis],axis=axis).T==target['id'];ax.imshow(img,origin='lower',cmap='gray',vmin=0,vmax=c['sequences']['T1w']['display_range'][1]);ax.contour(mask,levels=[.5],colors=['#e6b666'],linewidths=.8);ax.set_title(f'{target["structure"]} {"XYZ"[axis]}={target["anchor"][axis]:.1f}',fontsize=9);ax.axis('off')
            non=np.argwhere(mask)
            if len(non):
                center=non.mean(0);ax.set_xlim(max(0,center[1]-55),min(img.shape[1],center[1]+55));ax.set_ylim(max(0,center[0]-55),min(img.shape[0],center[0]+55))
    fig.tight_layout();fig.savefig(OUT/f'{c["id"]}-labels{"-right" if side=="right" else ""}.png',dpi=110);plt.close(fig)
    print('Rendered',c['id'],flush=True)
