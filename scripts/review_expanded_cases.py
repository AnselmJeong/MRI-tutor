"""Three-plane bilateral contact sheets for the additional native subject labels."""
from pathlib import Path
import json
import nibabel as nib
from nibabel.processing import resample_from_to
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
ROOT=Path(__file__).resolve().parents[1]/'trainer'
manifest=json.loads((ROOT/'assets/cases/manifest.json').read_text())
for c in manifest['cases']:
    affine=np.diag([1.,1.,1.,1.]);affine[:3,3]=np.floor(c['sequences']['T1w']['bounds'][0])
    shape=np.ceil(np.array(c['sequences']['T1w']['bounds'][1])-affine[:3,3]+1).astype(int)
    grid=(tuple(shape),affine)
    t1=resample_from_to(nib.load(ROOT/c['sequences']['T1w']['url']),grid,order=1).get_fdata(dtype=np.float32)
    lab=resample_from_to(nib.load(ROOT/c['segmentation']['url']),grid,order=0).get_fdata(dtype=np.float32)
    labels=[l for l in c['segmentation']['labels'] if l['id']>20]
    names=list(dict.fromkeys(l['structure'] for l in labels))
    for start in range(0,len(names),7):
        batch=names[start:start+7];fig,axes=plt.subplots(len(batch),6,figsize=(18,3*len(batch)),squeeze=False,facecolor='#f1f3eb')
        for row,name in enumerate(batch):
            for ax in axes[row]:ax.axis('off')
            for target in [l for l in labels if l['structure']==name]:
                offset=3 if target['side']=='right' else 0
                point=np.round(np.array(target['anchor'])-affine[:3,3]).astype(int)
                for axis in range(3):
                    ax=axes[row,offset+axis];img=np.take(t1,point[axis],axis=axis).T
                    mask=np.take(lab,point[axis],axis=axis).T==target['id']
                    ax.imshow(img,origin='lower',cmap='gray',vmin=0,vmax=c['sequences']['T1w']['display_range'][1])
                    ax.contour(mask,levels=[.5],colors=['#e6b666'],linewidths=.7)
                    ax.set_title(f'{name} {target["side"]}\n{"XYZ"[axis]}={target["anchor"][axis]:.1f}',fontsize=8)
                    non=np.argwhere(mask)
                    if len(non):
                        center=non.mean(0);ax.set_xlim(max(0,center[1]-55),min(img.shape[1],center[1]+55));ax.set_ylim(max(0,center[0]-55),min(img.shape[0],center[0]+55))
        fig.suptitle(f'{c["id"]} expanded native labels / developer localization QC only',fontsize=14)
        fig.tight_layout(rect=(0,0,1,.975));path=ROOT/f'qa/{c["id"]}-expanded-{start//7+1}.png';fig.savefig(path,dpi=100);plt.close(fig)
        print(path.name,flush=True)
