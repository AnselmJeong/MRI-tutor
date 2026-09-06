import { Niivue, NVImage, MULTIPLANAR_TYPE, SHOW_RENDER } from './vendor/niivue.js';
const $=id=>document.getElementById(id);
export async function createMRI({data,onLocation,onRetry}){
 let nv,token=0,busy=false,failed=false,space=null,selected=3,plane='multi',concealed=false,lastPoint=[0,0,0];
 const cache=new Map();
 const get=async(url)=>{if(!cache.has(url))cache.set(url,NVImage.loadFromUrl({url,name:url.split('/').pop()}).catch(e=>{cache.delete(url);throw e;}));return cache.get(url);};
 const roi=id=>data.regions.find(r=>r.id===id);
 nv=new Niivue({backColor:[.045,.055,.055,1],crosshairColor:[.9,.71,.43,.8],isRadiologicalConvention:true,fontMinPx:12,fontSizeScaling:0,multiplanarLayout:MULTIPLANAR_TYPE.AUTO,multiplanarShowRender:SHOW_RENDER.NEVER,onLocationChange(event){
  if(busy||failed)return;
  lastPoint=Array.from(event.mm).slice(0,3);
  const hits=event.values.slice(2).map(x=>Number(x.value));
  const active=hits.includes(selected)?selected:hits.find(x=>x>0)||0;
  const global=Number(event.values[1]?.value)||0;
  $('coordinates').textContent=`x ${lastPoint[0].toFixed(1)} · y ${lastPoint[1].toFixed(1)} · z ${lastPoint[2].toFixed(1)} mm`;
  for(const [axis,i] of [['x',0],['y',1],['z',2]]){$('slice-'+axis).value=lastPoint[i];$('value-'+axis).textContent=lastPoint[i].toFixed(0)+' mm';}
  onLocation({mm:lastPoint,id:active||global,active,space});
 }});
 await nv.attachToCanvas($('mri'));nv.setInterpolation(true);
 // The splitter changes container size without a window resize.
 let resizeFrame=0;
 new ResizeObserver(()=>{cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(()=>{const r=$('mri').getBoundingClientRect();if(r.width>0&&r.height>0)nv.resizeListener();});}).observe($('mri').parentElement);
 const setPoint=(mm)=>{if(busy||failed||!nv.volumes.length)return;nv.scene.crosshairPos=nv.mm2frac(mm);nv.drawScene();nv.createOnLocationChange();};
 function colors(){
  if(nv.volumes.length<3)return;
  nv.volumes[1].opacity=0;
  for(let i=2;i<nv.volumes.length;i++){
   const n=data.regions.reduce((m,r)=>Math.max(m,r.id),0),lut={R:Array(n+1).fill(237),G:Array(n+1).fill(175),B:Array(n+1).fill(87),A:Array(n+1).fill(210),labels:Array(n+1).fill('ROI')};lut.A[0]=0;
   nv.volumes[i].setColormapLabel(lut);nv.volumes[i].opacity=!concealed&&$('overlay').checked?.58:0;
  }
  nv.updateGLVolume();
 }
 async function select(id,{move=true}={}){
  const mine=++token,r=roi(id);if(!r)return false;
  busy=true;failed=false;$('mri').style.visibility='hidden';$('mri-loading').hidden=false;$('mri-loading').textContent='MRI와 구조 연결 중…';
  try{
   const baseUrl=r.space==='allen'?'assets/extended/allen/ICBM2009sym.nii.gz':'assets/CIT168toMNI152-2009c_T1w_brain.nii.gz';
   const lookupUrl=r.space==='allen'?'assets/all-labels-allen.nii.gz':'assets/all-labels.nii.gz';
   const pair=data.regions.filter(x=>Math.floor((x.id-1)/2)===Math.floor((id-1)/2));
   const volumes=await Promise.all([get(baseUrl),get(lookupUrl),...pair.map(x=>get(x.url))]);
   if(mine!==token)return false;
   const switched=space!==r.space;selected=id;space=r.space;
   // Batch the public volume state before one GPU refresh. Repeated add/remove
   // would re-upload the full MRI for each intermediate overlay state.
   nv.volumes=volumes;nv.back=volumes[0];nv.overlays=volumes.slice(1);
   if(switched){nv.setPan2Dxyzmm([0,0,0,1]);$('zoom').value=1;}
   nv.opts.isColorbar=false;colors();setPlane(plane);
   $('template-name').textContent=r.space==='allen'?'ICBM2009b symmetric · 0.5 mm 복셀 · 8-bit':'CIT168 → MNI152 2009c · 1 mm 복셀 · 8-bit';
   $('mri-loading').hidden=true;busy=false;
   setPoint(move?r.anchor:lastPoint);$('mri').style.visibility='visible';nv.resizeListener();return true;
  }catch(error){if(mine===token){
   busy=false;failed=true;$('template-name').textContent='영상 연결 실패';
   $('mri-loading').hidden=false;$('mri-loading').textContent='Atlas 영상 파일을 받지 못했습니다. 로컬 서버가 실행 중인지 확인하세요. 서버가 종료됐다면 Start MRI Tutor.command를 실행한 뒤 다시 불러오세요.';
   const retry=document.createElement('button');retry.id='atlas-retry';retry.textContent='Atlas 다시 불러오기';retry.onclick=()=>onRetry?onRetry():select(id,{move});$('mri-loading').append(retry);
   $('voxel-label').textContent='영상 연결을 복구하면 구조 탐색을 계속할 수 있습니다.';
  }console.error(error);return false;}
 }
 function setPlane(value){plane=value;nv.setSliceType({axial:nv.sliceTypeAxial,coronal:nv.sliceTypeCoronal,sagittal:nv.sliceTypeSagittal,multi:nv.sliceTypeMultiplanar}[value]);document.querySelectorAll('[data-plane]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.plane===value)));}
 function hide(value){concealed=value;$('overlay').disabled=value;nv.setCrosshairWidth(value?0:1);colors();}
 for(const b of document.querySelectorAll('[data-plane]'))b.onclick=()=>setPlane(b.dataset.plane);
 for(const [axis,i] of [['x',0],['y',1],['z',2]])$('slice-'+axis).oninput=()=>{if(busy)return;const p=[...lastPoint];p[i]=Number($('slice-'+axis).value);setPoint(p);};
 $('overlay').onchange=colors;
 $('zoom').oninput=()=>nv.setPan2Dxyzmm([0,0,0,Number($('zoom').value)]);
 $('mri-reset').onclick=()=>{nv.setPan2Dxyzmm([0,0,0,1]);$('zoom').value=1;setPoint(roi(selected).anchor);};
 $('contrast').oninput=()=>{if(!nv.volumes.length)return;nv.volumes[0].cal_min=0;nv.volumes[0].cal_max=Number($('contrast').value);nv.updateGLVolume();};
 $('mri').addEventListener('keydown',e=>{if(!['ArrowUp','ArrowDown'].includes(e.key)||busy)return;e.preventDefault();const axis=plane==='sagittal'?0:plane==='coronal'?1:2,p=[...lastPoint];p[axis]+=e.key==='ArrowUp'?1:-1;setPoint(p);});
 return {select,setPoint,setPlane,hide,colors,get point(){return [...lastPoint];},get busy(){return busy;},get plane(){return plane;},get space(){return space;}};
}
