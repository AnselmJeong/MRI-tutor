import { Niivue, NVImage, MULTIPLANAR_TYPE, SHOW_RENDER } from './vendor/niivue.js';

// Cache only a few volumes. Four high-resolution subjects must not remain in RAM.
async function image(cache,url) {
  if (cache.has(url)) { const promise=cache.get(url);cache.delete(url);cache.set(url,promise);return promise; }
  const promise=NVImage.loadFromUrl({url,name:url.split('/').pop()}).catch(error=>{cache.delete(url);throw error;});
  cache.set(url,promise);
  while(cache.size>2)cache.delete(cache.keys().next().value);
  return promise;
}
export async function createCaseViewer({canvas,onLocation=()=>{},onLoad=()=>{}}) {
  const cache=new Map();
  let nv,request=0,busy=true,current=null,sequence='T1w',plane='coronal',point=[0,0,0],overlay=false,ids=[],error=null;
  let labelImage=null,base=null;
  nv=new Niivue({backColor:[.045,.055,.055,1],crosshairColor:[.92,.76,.48,.8],isRadiologicalConvention:true,
    fontMinPx:13,fontSizeScaling:0,multiplanarLayout:MULTIPLANAR_TYPE.AUTO,multiplanarShowRender:SHOW_RENDER.NEVER,
    onLocationChange(event){if(busy)return;point=Array.from(event.mm).slice(0,3);onLocation({mm:[...point],label:Number(event.values?.[1]?.value)||0,plane,caseId:current?.id,sequence});}});
  await nv.attachToCanvas(canvas);nv.setInterpolation(true);nv.setSliceMM(true);
  let frame;
  const observer=new ResizeObserver(()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{const r=canvas.getBoundingClientRect();if(r.width>0&&r.height>0)nv.resizeListener();});});observer.observe(canvas.parentElement);
  function pointAt(mm) {
    if(!base||busy||!Array.isArray(mm)||mm.length!==3||!mm.every(Number.isFinite))return;
    // Clamp in image fractions, which also handles oblique native affines.
    nv.scene.crosshairPos=nv.mm2frac(mm).map(v=>Math.max(0,Math.min(1,v)));
    nv.drawScene();nv.createOnLocationChange();
  }
  function setPlane(value){if(!['axial','coronal','sagittal','multi'].includes(value))return;plane=value;nv.setSliceType({axial:nv.sliceTypeAxial,coronal:nv.sliceTypeCoronal,sagittal:nv.sliceTypeSagittal,multi:nv.sliceTypeMultiplanar}[plane]);}
  function color() {
    if(!base)return;
    if(labelImage){
      const count=Math.max(2,...current.segmentation.labels.map(l=>l.id+1)),lut={R:Array(count).fill(227),G:Array(count).fill(175),B:Array(count).fill(91),A:Array(count).fill(0),labels:Array(count).fill('참고 영역')};
      ids.forEach(id=>{lut.A[id]=180;});labelImage.setColormapLabel(lut);labelImage.opacity=overlay?.48:0;
    }
    nv.updateGLVolume();
  }
  async function load(c,seq='T1w',{preserve=false}={}) {
    const mine=++request,previous=[...point];busy=true;error=null;onLoad({busy:true,caseId:c.id,sequence:seq});
    // No previous subject remains visible beneath a new subject's title while loading.
    canvas.style.visibility='hidden';
    try {
      const [volume,labels]=await Promise.all([image(cache,c.sequences[seq].url),NVImage.loadFromUrl({url:c.segmentation.url})]);
      if(mine!==request)return false;
      current=c;sequence=seq;base=volume;labelImage=labels;
      const range=c.sequences[seq].display_range;base.cal_min=range[0];base.cal_max=range[1];
      nv.volumes=[base,labelImage];nv.back=base;nv.overlays=[labelImage];color();setPlane(plane);
      if(!preserve)nv.setPan2Dxyzmm([0,0,0,1]);
      busy=false;nv.setCrosshairWidth(1);pointAt(preserve?previous:c.initial_point);canvas.style.visibility='visible';nv.resizeListener();
      onLoad({busy:false,caseId:c.id,sequence:seq});return true;
    } catch(e) {if(mine!==request)return false;busy=false;error=e;onLoad({busy:false,error:'영상을 불러오지 못했습니다. 파일과 로컬 서버를 확인한 뒤 다시 시도하세요.'});return false;}
  }
  function step(delta){if(busy||error)return;const axis={sagittal:0,coronal:1,axial:2,multi:2}[plane],p=[...point];p[axis]+=delta;pointAt(p);}
  canvas.addEventListener('keydown',e=>{if(!['ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();step(e.key==='ArrowUp'?1:-1);});
  return {load,setPlane,setPoint:pointAt,step,
    setMask(labelIds,show){ids=labelIds;overlay=show;color();},
    setWindow(width,level){if(!base||busy||error)return;base.cal_min=level-width/2;base.cal_max=level+width/2;nv.updateGLVolume();},
    setZoom(value){if(!busy&&!error)nv.setPan2Dxyzmm([0,0,0,value]);},
    cancel(){request++;busy=false;canvas.style.visibility='hidden';},
    snapshot(){return {caseId:current?.id,sequence,plane,point:[...point],busy,error:Boolean(error),overlay,ids:[...ids],range:base?[base.cal_min,base.cal_max]:null};},
    get point(){return [...point];},get busy(){return busy;},get failed(){return Boolean(error);},get plane(){return plane;},
    get labels(){return labelImage;},get current(){return current;},
    // Purely geometric reference lookup; caller cannot turn it into clinical scoring.
    referenceAt(mm){if(!labelImage||busy||error)return 0;const v=labelImage.mm2vox(mm);return Number(labelImage.getValue(v[0],v[1],v[2]))||0;}
  };
}
