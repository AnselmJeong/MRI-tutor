import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import { createMRI } from './mri.js';
import { initCaseTraining } from './cases.js';
import { createSplitView } from './split-view.js';
import { regions, palette, kindNames, networks } from './regions.js';

const $ = (id) => document.getElementById(id);
const content = window.MRI_CONTENT;
let individualMode=true;
let caseTrainer=null;
document.addEventListener('individual-mode',e=>{individualMode=e.detail.active;if(individualMode){explore();mode='explore';document.querySelector('.layout').classList.remove('is-training','is-mri-test','answer-revealed');$('find-mode').setAttribute('aria-pressed','false');$('mri-train').setAttribute('aria-pressed','false');$('explore-mode').setAttribute('aria-pressed','false');}else{document.querySelector('.workspace-head h2').textContent='같은 구조, 세 단면.';document.querySelector('.workspace-head .eyebrow').textContent='REFERENCE ATLAS / SPATIAL LOCALIZATION';document.querySelector('.workspace-head .muted').textContent='집단 평균 템플릿과 atlas 위치를 학습하는 참고 모드입니다.';}updateCursor(latestLocation?.mm??[0,0,0]);renderState();});
document.addEventListener('reference-structure',e=>{if(!ready)return;select(e.detail.group*2+(e.detail.side==='right'?2:1));});
document.addEventListener('individual-hide-reference',e=>{document.body.classList.toggle('reference-concealed',e.detail.hidden);document.querySelector('.hidden-3d-note').textContent='개인 MRI에서 먼저 관찰하세요. 첫 응답 후 참고 모델을 열 수 있습니다.';});
const KEY = 'mri-tutor-training-v1';
let stored = {answers:{}, find:{}};
try {
  const value = JSON.parse(localStorage.getItem(KEY));
  if (value && typeof value === 'object') {
    for (const q of content.questions) if (typeof value.answers?.[q.id] === 'boolean') stored.answers[q.id] = value.answers[q.id];
    for (let id=1; id<=32; id++) if (typeof value.find?.[id] === 'boolean') stored.find[id] = value.find[id];
  }
} catch { /* Corrupt or unavailable storage must not stop learning. */ }
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(stored)); }
  catch { $('quiz-count').title = '저장할 수 없어 이번 실행 동안만 진도가 유지됩니다.'; }
  $('quiz-count').textContent = `${Object.keys(stored.answers).length}/16`;
}
save();
const labelName = (id) => !id ? '선택 없음' : `${regions[Math.floor((id-1)/2)]?.midline?'':id%2?'왼쪽':'오른쪽'} ${regions[Math.floor((id-1)/2)]?.ko??'라벨 없음'}`;
const groupOf = (id) => Math.floor((id-1)/2);
let selected = 3, side = 'both', mode = 'explore', ready = false, mriReady = false;
let nv, scene, camera, renderer, controls, brainMesh, allenBrainMesh, meshData, cursor, slicePlanes=[];
let currentSpace="mni", network=null, mriSession=null, latestLocation=null,locationVersion=0;
let meshes = [], session = null, hovered = null;
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const clip = new THREE.Plane(new THREE.Vector3(-1,0,0),0);
let suppressedLocation = false;

function list() {
  const query = $('search').value.trim().toLowerCase();
  $('structures').replaceChildren();
  regions.forEach((r,i) => {
    if (!`${r.ko} ${r.en}`.toLowerCase().includes(query)) return;
    const b = document.createElement('button');
    b.className = 'structure'; b.dataset.group = i;
    b.setAttribute('aria-pressed', String(mode==='explore' && groupOf(selected)===i));
    b.disabled = mode!=='explore' || !ready;
    const dot = document.createElement('span'); dot.className='dot'; dot.style.background=palette[i];
    const name = document.createElement('span'); name.textContent=r.ko;
    const en = document.createElement('small'); en.textContent=r.en; name.append(en);
    b.append(dot,name); b.onclick=()=>select(i*2+(side==='right'&&!r.midline?2:1)); $('structures').append(b);
  });
  if (!$('structures').children.length) $('structures').textContent = '검색 결과가 없습니다.';
}
function draw() { if (renderer) renderer.render(scene,camera); }
function renderState() {
  if (!ready) return;
  const focus = (mode==='find' && !session?.answered)||(mode==='mri-test'&&!mriSession?.answered) ? null : selected;
  const cut = $('cut').value;
  for (const m of meshes) {
    const id=m.userData.id;
    const visibleSide = regions[groupOf(id)].midline || side==='both' || (side==='left')===(id%2===1);
    const visibleCut = regions[groupOf(id)].midline || cut==='none' || (cut==='left')===(id%2===1);
    const active = focus!==null && (id===focus || (side==='both' && groupOf(id)===groupOf(focus)));
    const neighbors={17:[16,37,39],16:[17,39],1:[0,4,5,28],0:[1,4,5,28],4:[0,5,28],5:[0,4,28],28:[1,0,4,5],21:[0],19:[18,26,37],18:[19,26]};
    const context=individualMode?(active||(neighbors[groupOf(selected)]??[]).includes(groupOf(id))||$('cortex-context').checked):id<=32 || active || (network && networks[network].nodes.includes(groupOf(id))) || $('cortex-context').checked;
    m.visible = m.userData.space===currentSpace && context && visibleSide && visibleCut && (!$('isolate').checked || active);
    m.material.color.set(active ? '#d4a05c' : palette[groupOf(id)]);
    m.material.emissive.set(id===hovered ? '#3c3525' : '#000000');
    m.material.opacity=focus!==null && !active ? .28 : 1;
    m.material.transparent=m.material.opacity<1;
    m.material.depthWrite=m.material.opacity===1;
  }
  brainMesh.visible=currentSpace==='mni'&&Number($('brain-opacity').value)>0;
  allenBrainMesh.visible=currentSpace==='allen'&&Number($('brain-opacity').value)>0;
  allenBrainMesh.material.opacity=Number($('brain-opacity').value)/100;
  allenBrainMesh.material.clippingPlanes=cut==='none'?[]:[clip];
  brainMesh.material.opacity=Number($('brain-opacity').value)/100;
  clip.normal.set(cut==='left'?-1:1,0,0);
  brainMesh.material.clippingPlanes=cut==='none'?[]:[clip];
  draw();
}
function updateMriColors(){if(mriReady)nv.colors();}
async function moveMRI(id){if(mriReady&&!individualMode)return nv.select(id);}
function updateCursor(mm){
 if(!cursor)return;cursor.position.set(...mm);
 cursor.visible=!individualMode&&(mode!=='mri-test'||Boolean(mriSession?.answered));
 for(let axis=0;axis<3;axis++){
  const p=slicePlanes[axis];p.position.set(0,0,0);p.position.setComponent(axis,mm[axis]);
  p.visible=$('show-planes').checked&&cursor.visible;
 }
 draw();
}
function select(id,{move=true}={}) {
  if (!ready || !meshData.regions.some(r=>r.id===id)) return;
  if(mode==='mri-test')return;
  if (mode==='find') { answerFind(id);return; }
  selected=id;currentSpace=regions[groupOf(id)].space;
  // Clicking a slice must reveal its hemisphere even after a previous view filter.
  if (!regions[groupOf(id)].midline && side!=='both' && (side==='left')!==(id%2===1)) setSide(id%2?'left':'right',false);
  if ($('cut').value!=='none' && ($('cut').value==='left')!==(id%2===1)) $('cut').value='none';
  renderState();detail();list();if(mriReady&&!individualMode)nv.select(id,{move});
}
function detail() {
  if(mode==='find'){findDetail();return;}
  if(mode==='mri-test'){mriDetail();return;}
  const r=regions[groupOf(selected)];
  $('detail').innerHTML=`<p class="eyebrow">SELECTED STRUCTURE</p><span class="coordinate-chip">${r.midline?'MIDLINE · 정중':selected%2?'LEFT · 왼쪽':'RIGHT · 오른쪽'}${side==='both'&&!r.midline?' / 양측 함께 강조':''}</span><h2>${r.ko}</h2><p class="english">${r.en}</p><span class="kind-chip">${kindNames[r.kind]}</span><p>${r.description}</p><div class="action-row"><button class="primary" id="focus-structure">가까이 보기</button><button id="locate-mri">MRI 위치로 이동</button></div><h3>위치 관계</h3><p class="relation">${r.relation}</p><h3>단면 추적</h3><p>Axial · Coronal · Sagittal을 바꾸고 깊이를 이동하세요. MRI 십자선과 3D의 점·절단면 테두리는 같은 좌표입니다.</p><p class="small">${r.space==="allen"?"Allen · ICBM2009b symmetric. 다른 구조를 선택하면 해당 표준 공간으로 돌아갑니다.":"MNI152 2009c asymmetric. Atlas 간 정합 오차와 개인차가 존재합니다."}</p>`;
  $('focus-structure').onclick=()=>{
    if(!ready)return;
    const target=new THREE.Vector3(...meshData.regions.find(r=>r.id===selected).anchor);
    const direction=camera.position.clone().sub(controls.target).normalize();
    controls.target.copy(target);camera.position.copy(target).addScaledVector(direction,150);controls.update();draw();
  };
  $('locate-mri').onclick=()=>{moveMRI(selected);$('mri').scrollIntoView({block:'nearest',behavior:'auto'});};
}
function setSide(value,refresh=true) {
  side=value; document.querySelectorAll('[data-side]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.side===value)));
  if(!regions[groupOf(selected)].midline && value==='left' && selected%2===0) selected--;
  if(!regions[groupOf(selected)].midline && value==='right' && selected%2===1) selected++;
  if(refresh){renderState();detail();list();moveMRI(selected);}
}
function preset(view) {
  if (!ready) return;
  controls.target.set(0,-12,5); camera.up.set(0,0,1);
  const positions={front:[0,290,35],left:[-290,0,35],top:[0,-12,310],oblique:[160,225,135]};
  camera.position.set(...positions[view]); if(view==='top')camera.up.set(0,1,0);
  controls.update();draw();
}
function pick(event) {
  const rect=$('brain').getBoundingClientRect();
  pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
  raycaster.setFromCamera(pointer,camera);
  return raycaster.intersectObjects(meshes.filter(m=>m.visible),false)[0]?.object;
}
function directionLabel(text,position) {
  const canvas=document.createElement('canvas');canvas.width=64;canvas.height=64;
  const ctx=canvas.getContext('2d');ctx.font='28px sans-serif';ctx.fillStyle='#819076';ctx.textAlign='center';ctx.fillText(text,32,42);
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(canvas),depthTest:false,transparent:true}));
  sprite.position.set(...position);sprite.scale.set(14,14,1);scene.add(sprite);
}
async function init3D() {
  renderer=new THREE.WebGLRenderer({canvas:$('brain'),antialias:true,alpha:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.localClippingEnabled=true;
  scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(38,1,1,1600);camera.up.set(0,0,1);
  controls=new OrbitControls(camera,$('brain'));controls.minDistance=60;controls.maxDistance=650;controls.enablePan=true;
  controls.addEventListener('change',draw);
  scene.add(new THREE.AmbientLight(0xffffff,1.7));
  for(const [pos,intensity] of [[[100,200,300],2.8],[[-150,-120,80],1.2]]){
    const light=new THREE.DirectionalLight(0xfff9e8,intensity);light.position.set(...pos);scene.add(light);
  }
  const response=await fetch('assets/atlas-meshes.json');if(!response.ok)throw new Error(`atlas ${response.status}`);
  meshData=await response.json();
  const geometry=(d)=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(d.positions,3));g.setIndex(d.indices);g.computeVertexNormals();return g;};
  brainMesh=new THREE.Mesh(geometry(meshData.brain),new THREE.MeshStandardMaterial({color:'#b9c5ab',transparent:true,opacity:.12,depthWrite:false,roughness:.85,side:THREE.FrontSide}));
  brainMesh.renderOrder=2;scene.add(brainMesh);
  allenBrainMesh=new THREE.Mesh(geometry(meshData.allenBrain),brainMesh.material.clone());allenBrainMesh.renderOrder=2;scene.add(allenBrainMesh);
  cursor=new THREE.Mesh(new THREE.SphereGeometry(1.7,16,12),new THREE.MeshBasicMaterial({color:'#faf9df',depthTest:false}));cursor.renderOrder=10;scene.add(cursor);
  for(let axis=0;axis<3;axis++){
    const corners=axis===0?[[0,-110,-65],[0,90,-65],[0,90,105],[0,-110,105]]:axis===1?[[-85,0,-65],[85,0,-65],[85,0,105],[-85,0,105]]:[[-85,-110,0],[85,-110,0],[85,90,0],[-85,90,0]];
    const g=new THREE.BufferGeometry().setFromPoints(corners.map(p=>new THREE.Vector3(...p)));
    const plane=new THREE.LineLoop(g,new THREE.LineBasicMaterial({color:['#c77878','#7fac92','#d0aa6f'][axis],transparent:true,opacity:.6}));scene.add(plane);slicePlanes.push(plane);
  }
  for(const r of meshData.regions){
    const m=new THREE.Mesh(geometry(r),new THREE.MeshStandardMaterial({color:palette[groupOf(r.id)],roughness:.52,metalness:0,side:THREE.DoubleSide}));
    m.userData.id=r.id;m.userData.space=r.space;meshes.push(m);scene.add(m);
  }
  directionLabel('L',[-107,0,0]);directionLabel('R',[107,0,0]);directionLabel('A',[0,115,0]);directionLabel('P',[0,-130,0]);directionLabel('S',[0,0,110]);
  ready=true;
  const resize=()=>{const r=$('brain').getBoundingClientRect();if(r.width<1||r.height<1)return;renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();draw();};
  new ResizeObserver(resize).observe($('brain'));resize();preset('oblique');renderState();
  $('loading').hidden=true;$('viewer-status').innerHTML=`<i></i> ${meshData.regions.length}개 영역 · MRI 연동`; list();detail();
  let down=null;
  $('brain').addEventListener('pointerdown',e=>{down=[e.clientX,e.clientY];$('tooltip').hidden=true;});
  $('brain').addEventListener('pointerup',e=>{if(down && Math.hypot(e.clientX-down[0],e.clientY-down[1])<5){const m=pick(e);if(m)select(m.userData.id);}down=null;});
  $('brain').addEventListener('pointerleave',()=>{hovered=null;$('tooltip').hidden=true;renderState();});
  $('brain').addEventListener('pointermove',e=>{
    if(e.buttons || mode!=='explore'){$('tooltip').hidden=true;return;}
    const m=pick(e);const id=m?.userData.id??null;if(id!==hovered){hovered=id;renderState();}
    $('brain').style.cursor=m?'pointer':'grab';$('tooltip').hidden=!m;
    if(m){const rect=$('brain').getBoundingClientRect();$('tooltip').textContent=labelName(id);$('tooltip').style.left=`${Math.min(e.clientX-rect.left+14,rect.width-175)}px`;$('tooltip').style.top=`${e.clientY-rect.top+16}px`;}
  });
  $('brain').addEventListener('keydown',e=>{
    const offset=camera.position.clone().sub(controls.target);
    if(['ArrowLeft','ArrowRight'].includes(e.key))offset.applyAxisAngle(new THREE.Vector3(0,0,1),e.key==='ArrowLeft'?.12:-.12);
    else if(['ArrowUp','ArrowDown'].includes(e.key)){const axis=new THREE.Vector3().crossVectors(offset,camera.up).normalize();offset.applyAxisAngle(axis,e.key==='ArrowUp'?.1:-.1);}
    else if(['+','=','-'].includes(e.key))offset.multiplyScalar(e.key==='-'?1.1:.9);
    else return;
    e.preventDefault();offset.clampLength(60,650);camera.position.copy(controls.target).add(offset);controls.update();draw();
  });
}
async function initMRI(){
 nv=await createMRI({data:meshData,onLocation(event){
  latestLocation=event;locationVersion++;updateCursor(event.mm);
  const hidden=mode==='mri-test'&&!mriSession?.answered || mode==='find'&&!session?.answered;
  $('voxel-label').textContent=hidden?'답 제출 전: 라벨 숨김':event.id?labelName(event.id):'이 위치의 선택 ROI / 탐색 atlas 라벨 없음';
  // Continuous scrolling keeps the selected learning target. Only a direct
  // canvas click changes the structure, handled after pointerup below.
 }});mriReady=true;await moveMRI(selected);
}

function shuffle(items){const copy=[...items];for(let i=copy.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]];}return copy;}
function startFind(ids=null) {
  if(!ready)return;
  explore();setWorkspace('linked');mode='find';currentSpace='mni';selected=3;document.querySelector('.layout').classList.add('is-training');hovered=null;$('tooltip').hidden=true;
  session={ids:shuffle(ids??[1,4,5,10,11,16,27,32]),index:0,score:0,answered:false,choice:null};
  $('isolate').checked=false;$('isolate').disabled=true;$('cut').value='none';$('cut').disabled=true;
  $('brain-opacity').value='6';$('brain-opacity-value').textContent='6%';setSide('both',false);
  document.querySelectorAll('[data-side]').forEach(b=>b.disabled=true);
  $('find-mode').setAttribute('aria-pressed','true');$('explore-mode').setAttribute('aria-pressed','false');
  $('list-hint').textContent='구조 찾기에서는 3D 또는 MRI를 클릭하세요.';
  nextFindView();list();
}
function nextFindView(){
  session.answered=false;session.choice=null;$('isolate').checked=false;
  preset('front');renderState();updateMriColors();
  if(mriReady){nv.hide(true);nv.select(3).then(()=>{if(mode==='find')nv.setPoint([0,0,0]);});}
  findDetail();
}
function findDetail(){
  if(!session)return;
  if(session.index>=session.ids.length){
    const wrong=Object.entries(stored.find).filter(([,correct])=>!correct).map(([id])=>Number(id));
    $('detail').innerHTML=`<p class="eyebrow">SESSION COMPLETE</p><h2>${session.score} / ${session.ids.length}</h2><p>이번 세션에서 처음 선택한 답의 점수입니다.</p><div class="action-row"><button class="primary" id="find-again">다시 훈련</button><button id="find-review" ${wrong.length?'':'disabled'}>오답 ${wrong.length}개</button></div><button class="text-button" id="return-explore">탐색으로 돌아가기 →</button>`;
    $('find-again').onclick=()=>startFind();$('find-review').onclick=()=>startFind(wrong);$('return-explore').onclick=explore;return;
  }
  const target=session.ids[session.index];
  $('detail').innerHTML=`<p class="eyebrow">FIND THE STRUCTURE · ${session.index+1} / ${session.ids.length}</p><progress max="${session.ids.length}" value="${session.index}"></progress><h2 class="training-title">${labelName(target)}을<br>찾아보세요.</h2><p>입체를 회전하여 구조를 클릭하거나, MRI 단면의 해당 위치를 클릭하세요. L·R은 환자 기준입니다.</p>${session.answered?`<div class="result feedback ${session.choice===target?'':'wrong'}" role="status"><strong>${session.choice===target?'정답입니다.':`선택한 답: ${labelName(session.choice)}`}</strong><p>정답은 ${labelName(target)}입니다. 정답과 양측 짝을 금색으로 강조했습니다.</p><p>${regions[groupOf(target)].relation}</p></div><button class="primary" id="find-next">${session.index===session.ids.length-1?'결과 보기':'다음 구조 →'}</button>`:'<p class="relation">첫 선택으로 채점합니다. 이름표는 잠시 숨겨집니다.</p><button class="text-button" id="find-reveal">모르겠어요 · 정답 확인</button>'}`;
  if(session.answered)$('find-next').onclick=()=>{session.index++;if(session.index<session.ids.length)nextFindView();else findDetail();};
  else $('find-reveal').onclick=()=>answerFind(0);
}
function answerFind(id){
  if(!session||session.answered||session.index>=session.ids.length)return;
  const target=session.ids[session.index];session.answered=true;session.choice=id;
  const correct=id===target;session.score+=Number(correct);stored.find[target]=correct;save();selected=target;
  currentSpace=regions[groupOf(target)].space;renderState();if(mriReady){nv.hide(false);$('overlay').checked=true;moveMRI(target);}findDetail();
}
function explore(){
  mode='explore';mriSession=null;document.querySelector('.layout').classList.remove('is-training','is-mri-test','answer-revealed');if(mriReady)nv.hide(false);$('mri-train').setAttribute('aria-pressed','false');$('mri-reset').disabled=false;document.querySelectorAll('[data-plane]').forEach(b=>b.disabled=false);document.querySelectorAll('[data-node]').forEach(b=>b.disabled=false);session=null;$('isolate').disabled=false;$('cut').disabled=false;
  document.querySelectorAll('[data-side]').forEach(b=>b.disabled=false);
  $('explore-mode').setAttribute('aria-pressed','true');$('find-mode').setAttribute('aria-pressed','false');
  $('list-hint').textContent='구조를 선택하면 MRI 위치도 이동합니다.';list();detail();renderState();updateMriColors();moveMRI(selected);
}

let practiceHistory=[];
try{const h=JSON.parse(localStorage.getItem('mri-tutor-localization-v2'));if(Array.isArray(h))practiceHistory=h.filter(x=>Number.isInteger(x.id)&&['axial','coronal','sagittal'].includes(x.plane)&&typeof x.correct==='boolean').slice(-1000);}catch{}
const splitView=createSplitView();
function setWorkspace(value){splitView.show(value);}
for(const b of document.querySelectorAll('[data-workspace]'))b.onclick=()=>setWorkspace(b.dataset.workspace);
const planeNames={axial:'Axial · 축상',coronal:'Coronal · 관상',sagittal:'Sagittal · 시상'};
function practiceStats(){return Object.entries(planeNames).map(([key,label])=>{const h=practiceHistory.filter(x=>x.plane===key);return `<span>${label.split(' · ')[0]} <b>${h.filter(x=>x.correct).length}/${h.length}</b></span>`;}).join('');}
async function startMRIPractice(review=false){
 if(!mriReady||!ready)return;
 explore();mode='mri-test';network=null;$('network').value='';$('network-panel').hidden=true;
 const difficulty=$('practice-kind').value;
 let pool=meshData.regions.filter(x=>regions[groupOf(x.id)].trainable && (difficulty==='all' || ['anatomy','parcel'].includes(regions[groupOf(x.id)].kind)));
 if(review){const latest=new Map(practiceHistory.map(x=>[x.id,x.correct]));pool=pool.filter(x=>latest.get(x.id)===false);}
 if(!pool.length){explore();$('practice-status').textContent='이 범위에 복습할 오답이 없습니다.';return;}
 const ids=shuffle(pool.map(x=>x.id)).slice(0,6);
 mriSession={ids,index:0,score:0,answered:false,candidate:null,loading:true};
 document.querySelector('.layout').classList.add('is-training','is-mri-test');setWorkspace('mri');
 $('mri-train').setAttribute('aria-pressed','true');$('explore-mode').setAttribute('aria-pressed','false');
 $('isolate').checked=false;$('isolate').disabled=true;$('cut').value='none';$('cut').disabled=true;side='both';
 document.querySelectorAll('[data-side]').forEach(b=>b.disabled=true);document.querySelectorAll('[data-node]').forEach(b=>b.disabled=true);
 $('mri-reset').disabled=true;list();await nextMRIQuestion();
}
async function nextMRIQuestion(){
 const s=mriSession;if(!s)return;
 s.answered=false;s.candidate=null;s.loading=true;document.querySelector('.layout').classList.remove('answer-revealed');
 const id=s.ids[s.index],r=meshData.regions.find(x=>x.id===id);selected=id;currentSpace=r.space;
 s.plane=['axial','coronal','sagittal'][Math.floor(Math.random()*3)];
 mriDetail();nv.hide(true);$('overlay').checked=false;
 const loaded=await nv.select(id);if(mriSession!==s||!loaded)return;
 nv.setPlane(s.plane);document.querySelectorAll('[data-plane]').forEach(b=>b.disabled=true);
 const sample=r.samples[Math.floor(Math.random()*r.samples.length)],axis={axial:2,coronal:1,sagittal:0}[s.plane];
 const point=[0,-18,12];point[axis]=sample[axis];nv.setPoint(point);
 s.loading=false;s.candidate=null;renderState();mriDetail();
}
function mriDetail(){
 const s=mriSession;if(!s)return;
 if(s.index>=s.ids.length){
  $('detail').innerHTML=`<p class="eyebrow">LOCALIZATION SESSION</p><h2>${s.score} / ${s.ids.length}</h2><p>첫 제출 위치가 해당 atlas ROI 안에 포함되었는지 채점했습니다.</p><div class="plane-stats">${practiceStats()}</div><div class="action-row"><button class="primary" id="mri-again">새 단면 훈련</button><button id="mri-review">오답 복습</button><button id="mri-exit">탐색으로</button></div>`;
  $('mri-again').onclick=()=>startMRIPractice();$('mri-review').onclick=()=>startMRIPractice(true);$('mri-exit').onclick=explore;return;
 }
 const id=s.ids[s.index],r=regions[groupOf(id)];
 $('detail').innerHTML=`<p class="eyebrow">MRI LOCALIZATION · ${s.index+1} / ${s.ids.length}</p><progress max="${s.ids.length}" value="${s.index}"></progress><span class="coordinate-chip">${planeNames[s.plane]}</span><h2 class="training-title">${labelName(id)}</h2><span class="kind-chip">${kindNames[r.kind]}</span><p>${r.kind==='micro'||r.kind==='proxy'?'주변 해부학을 기준으로 atlas상 위치를 추정하세요. 직접 보이는 핵 경계의 식별 점수는 아닙니다.':'연속 단면의 형태와 주변 구조를 근거로 위치를 지정하세요.'}</p>${s.loading?'<p>무작위 단면 준비 중…</p>':s.answered?`<div class="result ${s.correct?'':'wrong'}"><strong>${s.correct?'ROI 안의 위치입니다.':'해당 ROI 밖의 위치입니다.'}</strong><p>${s.candidate?`제출 좌표: ${s.candidate.mm.map(x=>x.toFixed(1)).join(' / ')} mm`:'정답 확인을 선택했습니다.'}</p><p>${r.relation}</p></div><div class="action-row"><button id="mri-answer-location">정답 중심으로</button><button class="primary" id="mri-next">${s.index===s.ids.length-1?'결과 보기':'다음 단면 →'}</button></div>`:`<p class="relation">MRI에서 위치를 클릭한 뒤 제출하세요. 스크롤·슬라이더로 주변 절편을 확인할 수 있습니다. 정답 색과 3D 구조는 제출 후 나타납니다.</p><p id="candidate-status">${s.candidate?`지정 좌표 ${s.candidate.mm.map(x=>x.toFixed(1)).join(' / ')} mm`:'위치가 아직 지정되지 않았습니다.'}</p><button class="primary" id="mri-submit" ${s.candidate?'':'disabled'}>이 위치 제출</button><button class="text-button" id="mri-reveal">모르겠어요 · 정답 확인</button>`}`;
 if(s.loading)return;
 if(s.answered){$('mri-answer-location').onclick=()=>nv.setPoint(meshData.regions.find(x=>x.id===id).anchor);$('mri-next').onclick=()=>{s.index++;if(s.index<s.ids.length)nextMRIQuestion();else mriDetail();};}
 else{$('mri-submit').onclick=()=>gradeMRI(false);$('mri-reveal').onclick=()=>gradeMRI(true);}
}
function gradeMRI(reveal){
 const s=mriSession;if(!s||s.answered||s.loading||(!reveal&&!s.candidate))return;
 s.answered=true;if(reveal)s.candidate=null;s.correct=!reveal&&s.candidate.active===s.ids[s.index];s.score+=Number(s.correct);
 practiceHistory.push({id:s.ids[s.index],plane:s.plane,correct:s.correct,mm:s.candidate?.mm??null,date:new Date().toISOString()});practiceHistory=practiceHistory.slice(-1000);
 try{localStorage.setItem('mri-tutor-localization-v2',JSON.stringify(practiceHistory));}catch{$('practice-status').textContent='현재 브라우저에 진도를 저장하지 못했습니다.';}
 $('overlay').checked=true;nv.hide(false);document.querySelector('.layout').classList.add('answer-revealed');
 nv.setPoint(reveal?meshData.regions.find(x=>x.id===selected).anchor:nv.point);
 updateCursor(latestLocation?.mm??[0,0,0]);renderState();mriDetail();
}
let mriDown=null;
$('mri').addEventListener('pointerdown',e=>mriDown={xy:[e.clientX,e.clientY],version:locationVersion},true);
$('mri').addEventListener('pointerup',e=>{
 const down=mriDown;if(down&&Math.hypot(e.clientX-down.xy[0],e.clientY-down.xy[1])<5){setTimeout(()=>{if(mode==='mri-test'&&mriSession&&!mriSession.answered&&!mriSession.loading&&latestLocation&&locationVersion>down.version){mriSession.candidate={mm:[...latestLocation.mm],active:latestLocation.active};mriDetail();}else if(mode==='find'&&locationVersion>down.version&&latestLocation?.id){answerFind(latestLocation.id);}else if(mode==='explore'&&locationVersion>down.version&&latestLocation?.id&&latestLocation.id!==selected){select(latestLocation.id,{move:false});}},0);}mriDown=null;
});
$('review-localization').onclick=()=>startMRIPractice(true);
let historyBackup=null;
$('reset-localization').onclick=()=>{
 historyBackup={mri:[...practiceHistory],find:{...stored.find}};practiceHistory=[];stored.find={};save();
 try{localStorage.setItem('mri-tutor-localization-v2','[]');$('storage-status').textContent='위치 훈련 기록(MRI·3D)을 초기화했습니다. 새로고침 전 이 화면에서 되돌릴 수 있습니다.';}catch{$('storage-status').textContent='현재 실행의 기록만 초기화했습니다. 브라우저 저장소에는 접근하지 못했습니다.';}
 $('undo-localization').disabled=false;
};
$('undo-localization').onclick=()=>{
 if(!historyBackup)return;practiceHistory=historyBackup.mri;stored.find=historyBackup.find;save();historyBackup=null;
 try{localStorage.setItem('mri-tutor-localization-v2',JSON.stringify(practiceHistory));$('storage-status').textContent='MRI 기록을 복원했습니다.';}catch{$('storage-status').textContent='현재 실행에만 기록을 복원했습니다.';}
 $('undo-localization').disabled=true;
};

$('network').onchange=()=>{
 if(mode!=='explore')explore();network=$('network').value||null;const panel=$('network-panel');panel.hidden=!network;
 if(!network){renderState();return;}const n=networks[network];
 panel.innerHTML=`<p>${n.description}</p><div class="network-nodes">${n.nodes.map((g,i)=>`<button data-node="${g}">${n.steps[i]}</button>`).join('')}</div><p class="small muted">${n.edge}</p>`;
 panel.querySelectorAll('[data-node]').forEach(b=>b.onclick=()=>select(Number(b.dataset.node)*2+1));select(n.nodes[0]*2+1);renderState();
};

let quizSession=null;
function quizHome(){
  const wrong=content.questions.filter(q=>stored.answers[q.id]===false);
  $('quiz-body').innerHTML=`<p class="eyebrow">FOUNDATIONS / KNOWLEDGE CHECK</p><h2>이유까지 설명할 수 있나요?</h2><p>단면과 방향, 깊은 구조, 시퀀스, 확산의 기초를 16문제로 확인합니다.</p><p>${Object.keys(stored.answers).length} / 16문제 학습 · 오답 ${wrong.length}개</p><div class="quiz-actions"><button id="quiz-review" ${wrong.length?'':'disabled'}>오답 복습</button><button id="quiz-start" class="primary">전체 문제 시작</button></div>`;
  $('quiz-start').onclick=()=>startQuiz(content.questions);$('quiz-review').onclick=()=>startQuiz(wrong);
}
function startQuiz(questions){quizSession={queue:shuffle(questions),index:0,score:0,choice:null};quizQuestion();}
function quizQuestion(){
  const s=quizSession;
  if(s.index>=s.queue.length){$('quiz-body').innerHTML=`<p class="eyebrow">SESSION COMPLETE</p><h2>${s.score} / ${s.queue.length} 정답</h2><p>이번 세션의 첫 답변 점수입니다. 틀린 문제는 오답 복습에 남고, 복습에서 맞히면 해제됩니다.</p><button class="primary" id="quiz-home">학습 현황으로</button>`;$('quiz-home').onclick=quizHome;return;}
  const q=s.queue[s.index],lesson=content.lessons.find(l=>l.id===q.lesson);
  $('quiz-body').innerHTML=`<p class="eyebrow">${lesson.title} · ${s.index+1} / ${s.queue.length}</p><progress max="${s.queue.length}" value="${s.index}"></progress><h2>${q.prompt}</h2><div class="quiz-options"></div><div id="quiz-feedback" role="status"></div><div class="quiz-actions"><button id="quiz-next" class="primary" disabled>${s.index===s.queue.length-1?'결과 보기':'다음 문제 →'}</button></div>`;
  const container=$('quiz-body').querySelector('.quiz-options');
  q.options.forEach((option,i)=>{const b=document.createElement('button');b.textContent=option;b.dataset.answer=i;b.onclick=()=>{
    if(s.choice!==null)return;s.choice=i;const correct=i===q.answer;s.score+=Number(correct);stored.answers[q.id]=correct;save();
    [...container.children].forEach((button,index)=>{button.disabled=true;if(index===q.answer)button.classList.add('correct');else if(index===i)button.classList.add('wrong');});
    $('quiz-feedback').innerHTML=`<div class="result feedback ${correct?'':'wrong'}"><strong>${correct?'정답입니다.':'다시 짚어볼까요?'}</strong><p>${q.explanation}</p></div>`;$('quiz-next').disabled=false;$('quiz-next').focus();
  };container.append(b);});
  $('quiz-next').onclick=()=>{if(s.choice===null)return;s.index++;s.choice=null;quizQuestion();};
}

$('search').oninput=list;
$('brain-opacity').oninput=()=>{$('brain-opacity-value').textContent=$('brain-opacity').value+'%';renderState();};
$('isolate').onchange=renderState;$('cut').onchange=()=>{if($('cut').value!=='none'&&!regions[groupOf(selected)].midline)select(groupOf(selected)*2+($('cut').value==='left'?1:2));renderState();};$('cortex-context').onchange=renderState;$('show-planes').onchange=()=>updateCursor(latestLocation?.mm??[0,0,0]);
$('reset-view').onclick=()=>preset('oblique');
for(const b of document.querySelectorAll('button[data-view]'))b.onclick=()=>preset(b.dataset.view);
for(const b of document.querySelectorAll('[data-side]'))b.onclick=()=>setSide(b.dataset.side);
$('find-mode').onclick=()=>startFind();$('mri-train').onclick=()=>startMRIPractice();$('explore-mode').onclick=explore;
$('about-open').onclick=()=>$('about').showModal();$('quiz-open').onclick=()=>{quizHome();$('quiz').showModal();};
for(const b of document.querySelectorAll('[data-close]'))b.onclick=()=>$(b.dataset.close).close();
for(const [name,url] of content.sources){const li=document.createElement('li'),a=document.createElement('a');a.textContent=name;a.href=url;a.target='_blank';a.rel='noopener';li.append(a);$('source-list').append(li);}
list();detail();
const caseStart=initCaseTraining().then(value=>{caseTrainer=value;});
try {await init3D();updateCursor([0,0,0]);caseTrainer?.refresh();}catch(error){console.error(error);$('loading').textContent='3D 화면을 열 수 없습니다. WebGL을 지원하는 브라우저에서 새로고침해 주세요. 기초 문제는 계속 사용할 수 있습니다.';}
await caseStart;caseTrainer?.refresh();
try {await initMRI();}catch(error){console.error(error);$('mri-loading').textContent='MRI를 열 수 없습니다. 로컬 서버로 실행했는지 확인하고 새로고침해 주세요.';}
