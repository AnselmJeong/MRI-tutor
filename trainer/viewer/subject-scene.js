import * as THREE from 'three';
import {fetchVerified} from './asset-integrity.js';
import {validateSubjectPack,subjectSpaceId} from './space-registry.js';
import {loadSubjectMeshes,disposeObject} from './mesh-loader.js';
import {framePoint} from './slice-adapter.js';

export function createSubjectScene({scene,camera,controls,draw,onPick}) {
  const root=new THREE.Group(),slices=new THREE.Group();scene.add(root,slices);
  const params=new URLSearchParams(location.search);
  const flags={subject3D:params.get('subject3D')!=='0',mriSliceIn3D:params.get('mriSliceIn3D')!=='0'};
  let state=null,pack=null,loaded=null,request=0,controller=null,failed=false,pending=false;
  let frameKey='',sliceRevision=0,worker=null,workerBusy=false,sliceScheduled=false,sliceFailed=false,frames=[],clipPlanes=[];
  let active=true,visible=false,lastCase=null,selection=null,exposureKey=null;
  const statistics={loads:0,discarded:0,sliceUpdates:0,lastSliceMs:0,slabBytes:0};
  let sliceStarted=0;
  const status=document.getElementById('subject-status'),retry=document.getElementById('subject-retry');
  const peel=document.getElementById('subject-peel');
  const palettes={hippocampus:'#bc895e',amygdala:'#caa99c',caudate:'#98b8a4',putamen:'#a5b687',thalamus:'#acabc5',pallidum:'#c9b47c',ventricle:'#88b9c3','third-ventricle':'#88b9c3','fourth-ventricle':'#88b9c3','temporal-horn':'#88b9c3'};
  function availability() {
    visible=Boolean(flags.subject3D&&active&&state&&!state.loading&&!state.concealed&&!document.getElementById('three-pane').hidden);
    root.visible=visible&&!failed&&!pending;
    slices.visible=root.visible&&flags.mriSliceIn3D&&document.getElementById('show-planes').checked;
  }
  function message(text,error=false) {status.textContent=text;retry.hidden=!error;}
  function disposeSlices() {for(const mesh of [...slices.children])disposeObject(mesh);frames=[];clipPlanes=[];}
  function cancelSlices() {
    sliceRevision++;frameKey='';worker?.terminate();worker=null;workerBusy=false;sliceScheduled=false;disposeSlices();
  }
  function clear() {
    controller?.abort();request++;cancelSlices();
    if(loaded){disposeObject(loaded);loaded=null;}pack=null;failed=false;pending=false;sliceFailed=false;
  }
  function syncMaterials() {
    availability();
    const target=selection?selection.structureId:`anatomy:${state?.topicId}:${state?.side}`;
    let targetAvailable=false;
    loaded?.traverse(mesh=>{
      if(!mesh.isMesh)return;
      const s=mesh.userData.structure,selected=s.id===target;
      if(selected)targetAvailable=true;
      const related={hippocampus:['amygdala','ventricle','temporal-horn'],amygdala:['hippocampus','temporal-horn'],caudate:['putamen','thalamus','ventricle'],putamen:['caudate','pallidum','thalamus'],thalamus:['caudate','third-ventricle'],pallidum:['putamen','thalamus'],ventricle:['caudate','thalamus','third-ventricle']}[state?.topicId]??[];
      const context=(s.topicId===state?.topicId||related.includes(s.topicId))&&(s.side===state?.side||s.side==='midline');
      mesh.visible=document.getElementById('isolate').checked?selected:selected||context||document.getElementById('cortex-context').checked;
      mesh.material.color.set(selected?'#d4a05c':palettes[s.topicId]??'#a3b597');
      mesh.material.opacity=selected?1:.42;mesh.material.transparent=!selected;mesh.material.depthWrite=selected;
      mesh.material.clippingPlanes=slices.visible&&peel.value!=='none'?clipPlanes:[];
    });
    if(pack&&!pending&&!failed&&!sliceFailed)message(`${state.current.title} · 개인 MRI와 연결 · ${state.sequence==='T2w'?'정합 T2':'T1'}${selection&&!selection.structureId?' · 미등록 위치':targetAvailable?'':' · 선택 구조의 개인 3D 없음'}`);
    const nextExposure=root.visible&&pack?`${state.attemptId}:${state.current.id}:${state.sequence}`:null;
    if(nextExposure&&nextExposure!==exposureKey){
      exposureKey=nextExposure;
      document.dispatchEvent(new CustomEvent('subject-3d-exposure',{detail:{attemptId:state.attemptId,caseId:state.current.id,spaceId:pack.space.id,packId:pack.id,packVersion:pack.version,sequence:state.sequence,at:new Date().toISOString()}}));
    }else if(!nextExposure)exposureKey=null;
    draw();
  }
  function installSlices(result) {
    disposeSlices();frames=result.slices.map(s=>s.frame);
    for(const {frame,rgba} of result.slices) {
      const texture=new THREE.DataTexture(rgba,frame.width,frame.height,THREE.RGBAFormat);
      texture.colorSpace=THREE.SRGBColorSpace;texture.minFilter=THREE.NearestFilter;texture.magFilter=THREE.NearestFilter;texture.needsUpdate=true;
      const geometry=new THREE.BufferGeometry();
      geometry.setAttribute('position',new THREE.Float32BufferAttribute([[0,0],[1,0],[1,1],[0,1]].flatMap(([u,v])=>framePoint(frame,u,v)),3));
      geometry.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,1,1,0,1],2));geometry.setIndex([0,1,2,0,2,3]);
      const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide,toneMapped:false}));
      mesh.userData.frame=frame;slices.add(mesh);
      const normal=new THREE.Vector3(...frame.normal).multiplyScalar(peel.value==='reverse'?-1:1);
      clipPlanes.push(new THREE.Plane().setFromNormalAndCoplanarPoint(normal,new THREE.Vector3(...frame.originMm)));
    }
    statistics.sliceUpdates++;statistics.lastSliceMs=performance.now()-sliceStarted;syncMaterials();
  }
  function queueSlice() {
    availability();
    if(!visible||!pack||pending||failed||sliceFailed||!flags.mriSliceIn3D||!document.getElementById('show-planes').checked)return;
    if(sliceScheduled)return;
    sliceScheduled=true;
    requestAnimationFrame(()=>{
      sliceScheduled=false;availability();if(!visible||!pack||pending||failed)return;
      const descriptor=state.viewer.sliceDescriptor();if(!descriptor)return;
      const key=JSON.stringify([descriptor,peel.value]);
      if(key===frameKey)return;
      // Once MRI has moved, the old textured plane must not keep clipping or
      // claiming to show the new location during a delayed worker response.
      if(slices.children.length){disposeSlices();syncMaterials();}
      // Keep one in-flight slab and coalesce scroll events to the newest frame.
      if(workerBusy)return;
      frameKey=key;const revision=++sliceRevision;
      try {
        const slabs=state.viewer.sliceSlabs(revision);
        if(slabs.some(s=>s.frame.spaceId!==pack.space.id))throw new Error('MRI / 3D 공간 불일치');
        statistics.slabBytes=slabs.reduce((n,s)=>n+s.values.byteLength,0);sliceStarted=performance.now();
        if(!worker) {
          worker=new Worker(new URL('./slice-worker.js',import.meta.url),{type:'module'});
          worker.onmessage=({data})=>{
            workerBusy=false;
            if(data.revision!==sliceRevision){statistics.discarded++;queueSlice();return;}
            const current=state?.viewer.sliceDescriptor();
            if(!visible||JSON.stringify([current,peel.value])!==frameKey){frameKey='';disposeSlices();queueSlice();return;}
            if(data.error){sliceFailed=true;message('MRI 절단면 준비 실패 · 3D 다시 시도로 복구',true);return;}
            installSlices(data);queueSlice();
          };
          worker.onerror=event=>{event.preventDefault();cancelSlices();sliceFailed=true;message('MRI 절단면 준비 실패 · 3D 다시 시도로 복구',true);syncMaterials();};
        }
        workerBusy=true;
        worker.postMessage({revision,slabs},slabs.map(s=>s.values.buffer));
      }catch(error){workerBusy=false;sliceFailed=true;disposeSlices();message(error.message,true);}
    });
  }
  async function load() {
    clear();if(!state||!flags.subject3D)return;
    const current=state.current,mine=request;
    controller=new AbortController();const {signal}=controller;pending=true;availability();draw();
    message(`${current.title} · 개인 3D 준비 중…`);
    try {
      const response=await fetch('assets/packs/subject-core/current.json',{signal,cache:'no-cache'});
      if(!response.ok)throw new Error('개인 3D 팩 없음');
      const index=await response.json(),entry=index.cases?.find(c=>c.caseId===current.id);
      if(index.schemaVersion!==2||!entry||!entry.url.startsWith(`assets/packs/subject-core/${index.version}/${current.id}/`)||entry.url.includes('..'))throw new Error('개인 팩 목록 불일치');
      const bytes=await fetchVerified(entry.url,entry.sha256,signal);
      const candidate=validateSubjectPack(JSON.parse(new TextDecoder().decode(bytes)),current);
      const objects=await loadSubjectMeshes(candidate,signal);
      if(mine!==request||state.current.id!==current.id){statistics.discarded++;disposeObject(objects);return;}
      pack=candidate;loaded=objects;root.add(loaded);pending=false;statistics.loads++;
      if(lastCase!==current.id){lastCase=current.id;preset('oblique');}
      syncMaterials();queueSlice();
    }catch(error){if(mine!==request||signal.aborted)return;pending=false;failed=true;message(`${current.title} · 개인 3D를 열 수 없습니다. MRI 학습은 계속할 수 있습니다.`,true);availability();draw();}
  }
  function preset(view) {
    if(!state)return;
    // The MRI FOV is defaced and much larger than the core nuclei; center on the pack.
    const center=pack?new THREE.Box3().setFromObject(root).getCenter(new THREE.Vector3()):new THREE.Vector3(...state.current.initial_point);
    const positions={front:[0,260,45],left:[-260,0,45],top:[0,0,280],oblique:[145,215,145]};
    controls.target.copy(center);camera.up.set(0,0,1);if(view==='top')camera.up.set(0,1,0);
    camera.position.copy(center).add(new THREE.Vector3(...positions[view]));controls.update();draw();
  }
  function refresh() {
    availability();
    if(visible&&!pack&&!pending&&!failed)load();
    syncMaterials();queueSlice();
  }
  retry.onclick=()=>load();peel.onchange=()=>{frameKey='';queueSlice();};
  new MutationObserver(refresh).observe(document.getElementById('three-pane'),{attributes:true,attributeFilter:['hidden']});
  return {
    update(next) {
      const changed=state?.current.id!==next.current.id;
      const sequenceChanged=state?.sequence!==next.sequence;
      const topicChanged=state?.topicId!==next.topicId||state?.side!==next.side;
      const hiddenChanged=(!state?.loading&&next.loading)||(!state?.concealed&&next.concealed);
      state=next;
      if(changed){selection=null;clear();}
      else if(topicChanged)selection=null;
      if(sequenceChanged||hiddenChanged)cancelSlices();
      if(!flags.subject3D)message('개인 3D 기능 꺼짐 · MRI 학습은 계속할 수 있습니다.');
      refresh();
    },
    setActive(value) {active=value;if(!value)cancelSlices();refresh();},
    setSelection(value) {if(value?.spaceId!==subjectSpaceId(state?.current.id))return;selection=value;syncMaterials();},
    refresh,preset,
    pick(raycaster) {
      if(!root.visible||!visible)return null;
      const meshes=[];root.traverse(o=>{if(o.isMesh&&o.visible)meshes.push(o);});
      const planeHit=slices.visible?raycaster.intersectObjects(slices.children,false)[0]:null;
      return raycaster.intersectObjects(meshes,false).find(hit=>(!planeHit||hit.distance<=planeHit.distance+1e-5)&&hit.object.material.clippingPlanes.every(p=>p.distanceToPoint(hit.point)>=-1e-6))??null;
    },
    select(hit) {if(hit&&visible)onPick({...hit.object.userData,pointMm:hit.point.toArray()});},
    snapshot() {const visibleStructureIds=[];if(root.visible)loaded?.traverse(m=>{if(m.isMesh&&m.visible)visibleStructureIds.push(m.userData.structure.id);});return {visibleStructureIds,flags,caseId:state?.current.id,spaceId:pack?.space.id,pending,failed,sliceFailed,visible:root.visible,meshCount:pack?.representations.length??0,sliceCount:slices.children.length,frames:structuredClone(frames),clipping:peel.value,selection,statistics:{...statistics},resources:{geometries:loaded?pack.representations.length:0,textures:slices.children.length,workers:worker?1:0}};}
  };
}
