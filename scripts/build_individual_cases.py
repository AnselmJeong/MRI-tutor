"""Reproducible native MRI case pipeline. No atlas-to-person overlays or 8-bit MRI."""
from pathlib import Path
import hashlib,json,itertools,shutil
import numpy as np
import nibabel as nib
from nibabel.orientations import aff2axcodes
from scipy.ndimage import distance_transform_edt
import SimpleITK as sitk
ROOT=Path(__file__).resolve().parents[1]/'trainer/assets/cases'
SRC=ROOT/'source'
sitk.ProcessObject.SetGlobalDefaultNumberOfThreads(4)
# FreeSurfer aparc+aseg: subjects' own segmentation, never certified ground truth.
GROUPS=[('hippocampus',[17],[53]),('amygdala',[18],[54]),('caudate',[11],[50]),('putamen',[12],[51]),('pallidum',[13],[52]),('thalamus',[10],[49]),('insula',[1035],[2035]),('cingulate',[1002,1010,1023,1026],[2002,2010,2023,2026]),('ventricle',[4],[43]),('callosum',[251,252,253,254,255],[]),('third-ventricle',[14],[])]

def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def info(p):
    im=nib.load(p);a=np.asanyarray(im.dataobj);nonzero=a[a>0]
    corners=nib.affines.apply_affine(im.affine,list(itertools.product(*[(0,n-1) for n in im.shape[:3]])))
    return {'shape':list(map(int,im.shape)),'voxel_size':list(map(float,im.header.get_zooms()[:3])),'dtype':str(im.get_data_dtype()),'affine':im.affine.tolist(),'orientation':''.join(aff2axcodes(im.affine)),'range':[float(a.min()),float(a.max())],'display_range':[0,float(np.percentile(nonzero,99.5))],'bounds':[corners.min(0).tolist(),corners.max(0).tolist()],'sha256':sha(p),'bytes':p.stat().st_size}

def register(t1,t2,out,brainmask):
    txfile=out/'T2-to-T1.tfm';t2file=out/'T2w-in-T1.nii.gz';logfile=out/'registration.json'
    if t2file.exists() and logfile.exists():return json.loads(logfile.read_text())
    fixed=sitk.ReadImage(str(t1),sitk.sitkFloat32);moving=sitk.ReadImage(str(t2),sitk.sitkFloat32)
    reg=sitk.ImageRegistrationMethod();reg.SetMetricAsMattesMutualInformation(50)
    reg.SetMetricSamplingStrategy(reg.RANDOM);reg.SetMetricSamplingPercentage(.12,seed=20260906)
    reg.SetMetricFixedMask(brainmask)
    reg.SetInterpolator(sitk.sitkLinear)
    tx=sitk.CenteredTransformInitializer(fixed,moving,sitk.Euler3DTransform(),sitk.CenteredTransformInitializerFilter.GEOMETRY)
    reg.SetInitialTransform(tx,inPlace=False)
    reg.SetOptimizerAsRegularStepGradientDescent(1.0,.001,180,gradientMagnitudeTolerance=1e-6)
    reg.SetOptimizerScalesFromPhysicalShift();reg.SetShrinkFactorsPerLevel([4,2,1]);reg.SetSmoothingSigmasPerLevel([2,1,0]);reg.SmoothingSigmasAreSpecifiedInPhysicalUnitsOn()
    initial=float(reg.MetricEvaluate(fixed,moving))
    transform=reg.Execute(fixed,moving)
    sitk.WriteTransform(transform,str(txfile))
    aligned=sitk.Resample(moving,fixed,transform,sitk.sitkLinear,0,sitk.sitkFloat32)
    sitk.WriteImage(aligned,str(t2file),True)
    log={'method':'SimpleITK 2.5.6 Euler3D rigid / Mattes MI 50 bins / fixed subject brain mask / seeded 12% sampling / levels 4,2,1','transform_file':txfile.name,'transform_direction':'fixed T1 LPS physical point to moving T2 LPS sampling point','parameters':list(transform.GetParameters()),'fixed_parameters':list(transform.GetFixedParameters()),'initial_full_metric':initial,'final_sampled_metric':float(reg.GetMetricValue()),'stop':reg.GetOptimizerStopConditionDescription(),'resampling':'one linear interpolation from intact native T2 to native T1 grid; float32','review_status':'pending-visual-review','clinical_boundary_review':'not-performed'}
    logfile.write_text(json.dumps(log,indent=2));return log

cases=[]
for index,sid in enumerate(['sub-01','sub-02','sub-03','sub-04']):
    print('Building',sid,flush=True);out=ROOT/sid;out.mkdir(exist_ok=True,parents=True)
    t1=SRC/f'structural/{sid}/anat/{sid}_T1w.nii.gz';t2=SRC/f'structural/{sid}/anat/{sid}_T2w.nii.gz'
    raw=SRC/f'freesurfer/{sid}/mri/rawavg.mgz';seg=SRC/f'freesurfer/{sid}/mri/aparc+aseg.mgz'
    for source,name in [(t1,'T1w.nii.gz'),(t2,'T2w-native.nii.gz')]:
        if not (out/name).exists():shutil.copyfile(source,out/name)
    a=nib.as_closest_canonical(nib.load(t1));b=nib.as_closest_canonical(nib.load(raw))
    ax=np.asanyarray(a.dataobj);bx=np.asanyarray(b.dataobj)
    assert ax.shape==bx.shape
    # Same acquisition, different conversion headers. Match voxel ordering, retain mapping.
    foreground=(ax>10)&(bx>10)
    agreement=float(np.mean(ax[foreground]==bx[foreground]));correlation=float(np.corrcoef(ax[foreground],bx[foreground])[0,1])
    if correlation<.98:raise ValueError(f'{sid} FreeSurfer input is not demonstrably the same acquisition: {correlation}')
    mapping=a.affine@np.linalg.inv(b.affine)
    si=nib.load(seg);segdata=np.asanyarray(si.dataobj);aff=mapping@si.affine
    labels=np.zeros(si.shape,dtype=np.uint8);items=[];label_id=0
    for key,left,right in GROUPS:
        for side,ids in [('left',left),('right',right)]:
            if not ids:continue
            label_id+=1;mask=np.isin(segdata,ids);labels[mask]=label_id
            ijk=np.argwhere(mask);world=nib.affines.apply_affine(aff,ijk)
            center=ijk[np.argmax(distance_transform_edt(mask)[mask])];anchor=nib.affines.apply_affine(aff,center)
            items.append({'id':label_id,'structure':key,'side':'midline' if key in ['callosum','third-ventricle'] else side,'source_ids':ids,'anchor':anchor.tolist(),'bounds':[world.min(0).tolist(),world.max(0).tolist()],'voxel_count':int(mask.sum()),'space':f'{sid}:T1-native-world','source':'StudyForrest FreeSurfer 5.3 aparc+aseg','generation':'automatic-subject-segmentation','transform_history':['FreeSurfer conformed voxel to scanner RAS','voxel-order-matched rawavg RAS to distributed T1 RAS header correction'],'review_status':'reference-only','boundary_uncertainty':'automatic-segmentation; local boundaries require expert review','scoreable':False,'review_log':[]})
    nib.save(nib.Nifti1Image(labels,aff),out/'labels-reference.nii.gz')
    # Registration metric uses the individual's brain region; geometry only, not a scored label.
    maskpath=out/'registration-mask.nii.gz';nib.save(nib.Nifti1Image((segdata>0).astype('uint8'),aff),maskpath)
    bm=sitk.ReadImage(str(maskpath),sitk.sitkUInt8);maskpath.unlink()
    reg=register(t1,t2,out,bm)
    sequence_info={}
    for seq,name,source in [('T1w','T1w.nii.gz',t1),('T2w','T2w-in-T1.nii.gz',t2)]:
        meta=json.loads((SRC/f'structural/{sid}/anat/{sid}_{seq}.json').read_text())['global']['const']
        sequence_info[seq]={**info(out/name),'url':f'assets/cases/{sid}/{name}','sequence':seq,'field_strength_t':meta.get('MagneticFieldStrength'),'acquisition_voxel_size':[.7,.7,.7],'acquisition_source':'https://studyforrest.org/data.html','native':info(source),'source':json.loads(source.with_name(source.name+'.provenance.json').read_text()),'preprocessing':['public source defacing; original intensity retained']+([] if seq=='T1w' else [reg['resampling']])}
    case={'id':sid,'title':f'사례 {index+1:02}','cohort':'learning' if index<3 else 'transfer','kind':'individual','source_project':'StudyForrest','source_url':'https://doi.gin.g-node.org/10.12751/g-node.zdwr8e/','license':'PDDL','diagnosis':None,'diagnosis_note':'연구 참여자의 구조영상. 진단·병변·정상 판정은 이 앱에서 부여하지 않음.','reference_space':f'{sid}:T1-native-world','sequences':sequence_info,'registration':reg,'segmentation':{'url':f'assets/cases/{sid}/labels-reference.nii.gz','sha256':sha(out/'labels-reference.nii.gz'),'source_sha256':sha(seg),'rawavg_sha256':sha(raw),'rawavg_to_T1_RAS':mapping.tolist(),'foreground_exact_agreement':agreement,'foreground_correlation':correlation,'review_status':'reference-only','expert_review':False,'labels':items},'initial_point':np.mean([x['anchor'] for x in items if x['structure']=='thalamus'],axis=0).tolist(),'qc':{'status':'pending-visual-review','orientation':'header-derived RAS; radiological screen convention; no independent physical left-right fiducial','intensity_integrity':sha(t1)==sha(out/'T1w.nii.gz'),'notes':[]}}
    (out/'case.json').write_text(json.dumps(case,ensure_ascii=False,indent=2));cases.append(case)
    print(sid,'done',sequence_info['T1w']['voxel_size'],'rawavg correlation',correlation,flush=True)
for repo in ['structural','freesurfer']:shutil.copyfile(SRC/repo/'LICENSE',ROOT/f'{repo}-LICENSE.txt')
(ROOT/'manifest.json').write_text(json.dumps({'schema_version':1,'dataset':'StudyForrest individual structural MRI pilot','cases':cases,'clinical_scoring_enabled':False},ensure_ascii=False,indent=2))
print('Published manifest',flush=True)
