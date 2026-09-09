import {locateOnSlice} from './anatomy-location.js';
import {installCommandWheelZoom} from './wheel-zoom.js';
import { Niivue, NVImage, MULTIPLANAR_TYPE, SHOW_RENDER } from './vendor/niivue.js';
import {subjectSpaceId} from './viewer/space-registry.js';
import {nativeSliceFrame,extractNativeSlab} from './viewer/slice-adapter.js';

// Cache only a few volumes. Four high-resolution subjects must not remain in RAM.
async function image(cache,url) {
  if (cache.has(url)) { const promise=cache.get(url);cache.delete(url);cache.set(url,promise);return promise; }
  const promise=NVImage.loadFromUrl({url,name:url.split('/').pop()}).catch(error=>{cache.delete(url);throw error;});
  cache.set(url,promise);
  while(cache.size>2)cache.delete(cache.keys().next().value);
  return promise;
}
export async function createCaseViewer({canvas,onLocation=()=>{},onLoad=()=>{},onViewChange=()=>{},onZoomChange=()=>{}}) {
  const cache=new Map();
  let nv,request=0,busy=true,current=null,sequence='T1w',plane='axial',point=[0,0,0],overlay=false,ids=[],error=null;
  let labelImage=null,base=null;
  nv=new Niivue({backColor:[.045,.055,.055,1],crosshairColor:[.92,.76,.48,.8],isRadiologicalConvention:true,
    fontMinPx:13,fontSizeScaling:0,multiplanarLayout:MULTIPLANAR_TYPE.AUTO,multiplanarShowRender:SHOW_RENDER.NEVER,
    onLocationChange(event){if(busy)return;point=Array.from(event.mm).slice(0,3);onLocation({mm:[...point],label:Number(event.values?.[1]?.value)||0,plane,caseId:current?.id,sequence});}});
  await nv.attachToCanvas(canvas);
  // This pinned NiiVue build also redraws through its own resize and pan handlers.
  // Reproject HTML markers after every completed draw, not only our toolbar calls.
  const drawScene=nv.drawScene.bind(nv);
  nv.drawScene=(...args)=>{const result=drawScene(...args);onViewChange();return result;};
  nv.setInterpolation(true);nv.setSliceMM(true);
  installCommandWheelZoom({canvas,canZoom:()=>Boolean(base)&&!busy&&!error,getPan:()=>nv.scene.pan2Dxyzmm,setPan:pan=>nv.setPan2Dxyzmm(pan),onZoom:onZoomChange});
  let frame;
  const observer=new ResizeObserver(()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{const r=canvas.getBoundingClientRect();if(r.width>0&&r.height>0){nv.resizeListener();onViewChange();}});});observer.observe(canvas.parentElement);
  function pointAt(mm) {
    if(!base||busy||!Array.isArray(mm)||mm.length!==3||!mm.every(Number.isFinite))return;
    // Clamp in image fractions, which also handles oblique native affines.
    nv.scene.crosshairPos=nv.mm2frac(mm).map(v=>Math.max(0,Math.min(1,v)));
    nv.drawScene();nv.createOnLocationChange();
  }
  function setPlane(value){if(!['axial','coronal','sagittal','multi'].includes(value))return;plane=value;nv.setSliceType({axial:nv.sliceTypeAxial,coronal:nv.sliceTypeCoronal,sagittal:nv.sliceTypeSagittal,multi:nv.sliceTypeMultiplanar}[plane]);onViewChange();}
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
  // NiiVue renders native voxel planes, even when their geometry is drawn in mm.
  // Express that frame in mm so tilted native affines keep clicks on the assigned plane.
  function fromWorld(mm){return Array.from(base.mm2vox(mm,true)).map((v,i)=>v*Math.abs(base.pixDimsRAS[i+1]));}
  function toWorld(p){return Array.from(base.vox2mm(p.map((v,i)=>v/Math.abs(base.pixDimsRAS[i+1])),base.matRAS));}
  function sectionDepth(mm,orientation=plane){return fromWorld(mm)[{axial:2,coronal:1,sagittal:0}[orientation]];}
  function pointOnSection(mm,orientation,depth){const p=fromWorld(mm);p[{axial:2,coronal:1,sagittal:0}[orientation]]=depth;return toWorld(p);}
  function guidedGeometry(label){
    const corners=[];
    for(const x of [0,1])for(const y of [0,1])for(const z of [0,1])corners.push(fromWorld([label.bounds[x][0],label.bounds[y][1],label.bounds[z][2]]));
    return {bounds:[0,1].map(hi=>[0,1,2].map(i=>(hi?Math.max:Math.min)(...corners.map(c=>c[i])))),anchor:fromWorld(label.anchor),fromWorld,toWorld};
  }
  function sliceDescriptor(){
    if(!base||busy||error||!current)return null;
    const voxel=Array.from(base.mm2vox(point,true));
    return {caseId:current.id,spaceId:subjectSpaceId(current.id),sequence,plane,voxel,range:[base.cal_min,base.cal_max]};
  }
  function sliceSlabs(revision=0){
    const descriptor=sliceDescriptor();if(!descriptor)return [];
    return (plane==='multi'?['axial','coronal','sagittal']:[plane]).map(orientation=>{
      const frame=nativeSliceFrame({...descriptor,shape:base.dimsRAS.slice(1,4),plane:orientation,revision,
        voxelToWorld:p=>Array.from(base.vox2mm(p,base.matRAS))});
      return extractNativeSlab(base,frame);
    });
  }
  return {locate(labelIds){if(busy||error||!base)return null;return locateOnSlice({base,masks:[{image:labelImage,ids:labelIds,anchors:current.segmentation.labels.filter(l=>labelIds.includes(l.id)).map(l=>l.anchor)}],point,plane});},load,setPlane,setPoint:pointAt,step,sectionDepth,pointOnSection,guidedGeometry,
    sliceDescriptor,sliceSlabs,
    sliceEvidence(){
      return sliceSlabs().map(slab=>{
        const {frame,values,slope,intercept,range}=slab;
        const samples=[];
        for(const fu of [.25,.4,.55,.7])for(const fv of [.25,.4,.55,.7]){
          const x=Math.floor(frame.width*fu),y=Math.floor(frame.height*fv),voxel=[0,0,0];
          voxel[frame.uAxis]=x;voxel[frame.vAxis]=y;voxel[frame.axis]=frame.sampleIndex;
          const world=Array.from(base.vox2mm(voxel,base.matRAS));
          samples.push({x,y,world,raw:values[y*frame.width+x],intensity:values[y*frame.width+x]*slope+intercept,niivue:base.getValue(...voxel)});
        }
        return {frame,slope,intercept,range,samples};
      });
    },
    nearestReferencePoint(labelId,mm){
      if(!labelImage||busy||error)return null;
      const center=Array.from(labelImage.mm2vox(mm));let best=null,distance=Infinity;
      for(let z=-3;z<=3;z++)for(let y=-3;y<=3;y++)for(let x=-3;x<=3;x++){
        const voxel=center.map((n,i)=>n+[x,y,z][i]);
        if(voxel.some((n,i)=>n<0||n>=labelImage.dimsRAS[i+1])||labelImage.getValue(...voxel)!==labelId)continue;
        const world=Array.from(labelImage.vox2mm(voxel,labelImage.matRAS)),d=Math.hypot(...world.map((n,i)=>n-mm[i]));
        if(d<distance&&d<=5){best=world;distance=d;}
      }
      return best;
    },
    get sliceFrame(){return {fromWorld,toWorld};},
    planeAt(clientX,clientY){
      if(busy||error)return null;
      const r=canvas.getBoundingClientRect();if(!r.width||!r.height)return null;
      const x=(clientX-r.left)*canvas.width/r.width,y=(clientY-r.top)*canvas.height/r.height;
      const tile=nv.screenSlices.find(s=>{const [left,top,width,height]=s.leftTopWidthHeight;return s.axCorSag<=2&&x>=Math.min(left,left+width)&&x<=Math.max(left,left+width)&&y>=top&&y<=top+height;});
      return tile?['axial','coronal','sagittal'][tile.axCorSag]:null;
    },
    projectPoint(mm,orientation){
      if(!base||busy||error||!['axial','coronal','sagittal'].includes(orientation)||Math.abs(sectionDepth(mm,orientation)-sectionDepth(point,orientation))>.1)return null;
      const r=canvas.getBoundingClientRect();if(!r.width||!r.height)return null;
      const result=nv.frac2canvasPosWithTile(nv.mm2frac(mm),{axial:0,coronal:1,sagittal:2}[orientation]);
      if(!result)return null;
      const p=[result.pos[0]*r.width/canvas.width,result.pos[1]*r.height/canvas.height];
      return p.every(Number.isFinite)&&p[0]>=0&&p[1]>=0&&p[0]<=r.width&&p[1]<=r.height?p:null;
    },
    isImagePoint(clientX,clientY){
      if(busy||error)return false;
      const r=canvas.getBoundingClientRect();if(!r.width||!r.height)return false;
      const frac=nv.canvasPos2frac([(clientX-r.left)*canvas.width/r.width,(clientY-r.top)*canvas.height/r.height]);
      return Array.from(frac).every(v=>Number.isFinite(v)&&v>=0&&v<=1);
    },
    setMask(labelIds,show){
      // Hidden labels need no texture upload when only the learning target changes.
      const changed=overlay!==show||(show&&(ids.length!==labelIds.length||ids.some((id,i)=>id!==labelIds[i])));
      ids=[...labelIds];overlay=show;if(changed)color();
    },
    setWindow(width,level){if(!base||busy||error)return;base.cal_min=level-width/2;base.cal_max=level+width/2;nv.updateGLVolume();},
    setZoom(value){if(!busy&&!error){nv.setPan2Dxyzmm([0,0,0,value]);onViewChange();}},
    cancel(){request++;busy=false;canvas.style.visibility='hidden';},
    snapshot(){const voxel=labelImage&&!busy&&!error?labelImage.mm2vox(point):null;const referenceLabel=voxel?Number(labelImage.getValue(...voxel))||0:0;return {zoom:nv.scene.pan2Dxyzmm[3],referenceLabel,sliceDepth:base&&plane!=='multi'?sectionDepth(point):null,caseId:current?.id,sequence,plane,point:[...point],busy,error:Boolean(error),overlay,ids:[...ids],range:base?[base.cal_min,base.cal_max]:null};},
    get point(){return [...point];},get busy(){return busy;},get failed(){return Boolean(error);},get plane(){return plane;},
    get labels(){return labelImage;},get current(){return current;},
    // Purely geometric reference lookup; caller cannot turn it into clinical scoring.
    referenceAt(mm){if(!labelImage||busy||error)return 0;const v=labelImage.mm2vox(mm);if(Array.from(v).some((n,i)=>!Number.isFinite(n)||n<0||n>=labelImage.dimsRAS[i+1]))return 0;return Number(labelImage.getValue(v[0],v[1],v[2]))||0;}
  };
}
