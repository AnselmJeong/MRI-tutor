import {annotateAnatomy} from './anatomy-terms.js';
import {createAnatomyMarker,anatomyStatus} from './anatomy-marker.js';
import {pickGuidedTarget,buildGuidedSections,guidedLocationFeedback,planeAxes,guidedTopicIds} from './guided-practice.js';
import {createNearbyOverlay} from './nearby-structures.js';
import {createCaseViewer} from './case-viewer.js';
import {topics,modes,statusNames,visibilityLesson} from './case-content.js';
import {regions} from './regions.js';
import {subjectSpaceId,subjectCoreTopics} from './viewer/space-registry.js';
import {createSelectionStore} from './viewer/selection-store.js';
import {createTaskId} from './task-id.js';
import {HISTORY_KEY,DRAFT_KEY,escapeHTML as esc,readHistory,writeHistory,appendFirst,appendHelpEvent,referenceFeedback,traceReady,restoreTask} from './case-state.js';
const $=id=>document.getElementById(id);
const axisIndex={axial:2,coronal:1,sagittal:0,multi:2};
const planeNames={axial:'Axial · 축상',coronal:'Coronal · 관상',sagittal:'Sagittal · 시상',multi:'3면 동시'};
const sideNames={left:'왼쪽',right:'오른쪽',midline:'정중'};
const mm=p=>p.map(v=>Number(v).toFixed(1)).join(' / ');
const event=(name,detail)=>document.dispatchEvent(new CustomEvent(name,{detail}));

export async function initCaseTraining(){
  const main=document.querySelector('main');
  const bar=document.createElement('section');bar.id='case-bar';bar.setAttribute('aria-label','실제 MRI 사례와 학습 방식');
  bar.innerHTML=`<div class="case-picker-row"><div class="case-choice"><span>사례</span><div id="case-select" class="case-buttons" role="group" aria-label="실제 MRI 사례"></div></div><div class="case-choice"><span>영상</span><div class="sequence-switch" role="group" aria-label="MRI 시퀀스"><button data-sequence="T1w" aria-pressed="true">T1</button><button data-sequence="T2w" aria-pressed="false">T2</button></div></div><span id="case-badge" class="coordinate-chip">3T · T1 / T2</span><button id="case-provenance" class="text-button">영상 정보</button><button id="case-history" class="text-button">학습 기록</button></div><nav class="case-modes" aria-label="개인 영상 학습 방식">${Object.entries(modes).map(([id,name])=>`<button data-case-mode="${id}" aria-pressed="${id==='guided'}">${name}</button>`).join('')}</nav><p id="case-mode-note" class="small"></p><p id="case-storage-note" class="small" role="status"></p>`;
  main.insertBefore(bar,$('viewer-split'));
  const sidebar=document.createElement('div');sidebar.id='case-sidebar';sidebar.innerHTML=`<div class="section-heading"><h1>판독 주제</h1><span>${topics.length}개 관찰 경로</span></div><label class="search"><input id="case-search" type="search" placeholder="구조·랜드마크 찾기" aria-label="판독 주제 검색"></label><label class="case-category-label">관찰 부위<select id="case-category" aria-label="관찰 부위"><option value="">전체 부위</option>${[...new Set(topics.map(t=>t.category))].map(c=>`<option>${c}</option>`).join('')}</select></label><div id="case-topics"></div><details class="reference-guide"><summary>작은 핵 · 기능 회로</summary><p>${visibilityLesson.text}</p><a href="${visibilityLesson.source}" target="_blank" rel="noopener">관찰 대비의 근거 ↗</a><button id="case-atlas-all">전체 42종 해부학 Atlas 열기</button></details><p class="small muted">먼저 회색조 영상에서 관찰하고, 필요할 때만 도움을 열어보세요.</p>`;
  document.querySelector('.sidebar').prepend(sidebar);
  $('case-mri-content').innerHTML=`<div class="section-heading case-volume-title"><h3 id="case-volume-name">실제 MRI 준비 중</h3><span class="small" id="case-label-state">라벨 없음</span></div>
  <p id="guided-image-prompt" class="small" hidden></p><div class="case-toolbar"><div class="plane-switch" role="group" aria-label="실제 MRI 방향">${Object.entries(planeNames).map(([id,name])=>`<button data-case-plane="${id}" aria-pressed="${id==='axial'}">${name.split(' · ')[0]}</button>`).join('')}</div><button id="case-reset" class="text-button">영상 초기화</button></div>
  <div id="nearby-controls" hidden><label>주변 반경 <select id="nearby-radius" aria-label="주변 구조 검색 반경"><option value="10">10 mm</option><option value="15" selected>15 mm</option><option value="25">25 mm</option></select></label><span id="nearby-status" role="status">영상을 클릭하면 주변 구조를 노란 점으로 표시합니다.</span><button id="nearby-clear" class="text-button" disabled>점 지우기</button></div>
  <div id="compare-controls" hidden><label>나란히 비교 <select id="compare-select"><option value="sequence">같은 사람 · 다른 시퀀스</option></select></label><span id="compare-note">같은 T1 좌표를 공유합니다.</span><button id="compare-landmarks" class="text-button">각자의 구조 위치로</button></div>
  <div class="case-canvases"><div class="case-screen"><span class="image-caption" id="primary-caption"></span><canvas id="case-mri" tabindex="0" aria-label="실제 MRI. 클릭으로 위치, 휠과 위아래 방향키로 연속 단면 이동. Command와 휠로 확대·축소."></canvas><div id="case-loading" role="status">실제 MRI 준비 중…</div></div><div class="case-screen" id="comparison-screen" hidden><span class="image-caption" id="compare-caption"></span><canvas id="case-compare-mri" tabindex="0" aria-label="비교 MRI. 다른 개인은 독립적으로 탐색합니다."></canvas><div id="compare-loading" role="status"></div></div></div>
  <div class="case-window"><label>Window <input id="case-window" type="range" min="1" max="400" value="100"><output id="case-window-value">100</output></label><label>Level <input id="case-level" type="range" min="-100" max="400" value="50"><output id="case-level-value">50</output></label><label>확대 <input id="case-zoom" type="range" min="1" max="4" step=".01" value="1"><output id="case-zoom-value">1×</output></label><button id="case-window-reset" class="text-button">자동 대비</button></div>
  <div class="slice-controls case-slices">${['x','y','z'].map((a,i)=>`<label><span>${['Sagittal','Coronal','Axial'][i]} · ${a}</span><input id="case-slice-${a}" aria-label="실제 MRI ${a} 좌표" type="range" step=".5" min="-100" max="100"><output id="case-value-${a}">—</output></label>`).join('')}</div>
  <p id="case-cursor-status" class="small reference-note" role="status" aria-live="polite"></p><div class="mri-footer"><span>휠: 단면 · ⌘ + 휠: 확대/축소 · R / L: 환자 기준</span><span id="case-coordinate">T1 개인 공간 (mm)</span></div><div id="case-trace-tools" hidden><button id="trace-back" aria-label="이전 1 mm 단면">−1 mm</button><button id="trace-forward" aria-label="다음 1 mm 단면">+1 mm</button><button data-trace-mark="appearance">출현 기록</button><button data-trace-mark="body">형태 변화 기록</button><button data-trace-mark="disappearance">소실 기록</button><span id="trace-summary" class="small"></span></div>`;
  const dialog=document.createElement('dialog');dialog.id='case-dialog';dialog.innerHTML='<button class="dialog-close" id="case-dialog-close" aria-label="닫기">×</button><div id="case-dialog-body"></div>';document.body.append(dialog);$('case-dialog-close').onclick=()=>dialog.close();
  let manifest,atlasEntries=[],viewer,comparison,loadToken=0,compareToken=0,active=false,loading=true,loadError=false,syncing=false;
  let history=readHistory(),current,topic=topics[0],sequence='T1w',mode='guided',side='left',task=null;
  let anatomyMarker=null,unregisteredSelection=false;
  let lastPoint=null,down=null,savedState=null,nearby=null;
  const sectionCache=new Map();
  const selection=createSelectionStore();
  selection.subscribe(value=>event('subject-selection',value));
  function publishScene(){
    if(!viewer||!current||!task)return;
    selection.setContext({caseId:current.id,spaceId:subjectSpaceId(current.id)});
    event('subject-view-state',{current,viewer,attemptId:task.id,topicId:topic.id,side,sequence,loading:loading||loadError,concealed:mode!=='explore'&&!task.submitted});
  }
  function selectSubjectPoint(source,point,labelId){
    selection.publish({caseId:current.id,spaceId:subjectSpaceId(current.id),structureId:current.segmentation.labels.find(l=>l.id===labelId)?`anatomy:${current.segmentation.labels.find(l=>l.id===labelId).structure}:${current.segmentation.labels.find(l=>l.id===labelId).side}`:null,pointMm:point,source});
  }
  document.addEventListener('subject-3d-exposure',({detail})=>{
    if(!task||detail.attemptId!==task.id||detail.caseId!==current.id)return;
    if(task.submitted){appendHelpEvent(history,{...detail,hint:'subject-three',plane:viewer.plane});save();}
    else{task.helpUsed??=[];if(!task.helpUsed.includes('subject-three'))task.helpUsed.push('subject-three');saveDraft();}
  });
  document.addEventListener('subject-mesh-pick',({detail})=>{
    if(!active||loading||loadError||(mode!=='explore'&&!task.submitted)||detail.caseId!==current.id||detail.spaceId!==subjectSpaceId(current.id))return;
    const label=current.segmentation.labels.find(l=>l.id===detail.representation.labelId);
    const point=label&&viewer.nearestReferencePoint(label.id,detail.pointMm);if(!point)return;
    if(mode==='explore'){side=label.side;chooseTopic(label.structure,{point});}
    else viewer.setPoint(point);
    selectSubjectPoint('mesh',point,label.id);
  });
  try{savedState=JSON.parse(localStorage.getItem(DRAFT_KEY));}catch{}
  const save=()=>{if(!writeHistory(history))$('case-storage-note').textContent='저장소를 사용할 수 없어 이번 실행에만 기록됩니다. 학습 기록에서 JSON으로 내보낼 수 있습니다.';};
  function saveDraft(){if(!task||!current)return;try{localStorage.setItem(DRAFT_KEY,JSON.stringify({caseId:current.id,topic:topic.id,mode,side,sequence,task,point:viewer?.point}));}catch{}}
  function freshTask(){return {id:createTaskId(),hints:[],landmarkChecks:[],marks:{},visited:{},status:'',note:'',confidence:'uncertain',submitted:null,novel:!history.exposures.includes(current?.id),startedAt:new Date().toISOString(),comparisonUsed:false};}
  function labels(){return current?.segmentation.labels.filter(l=>l.structure===topic.id&&(l.side===side||l.side==='midline'))??[];}
  function cursorStatus(){
    const el=$('case-cursor-status');if(!el||!task)return;
    if(loading||loadError){el.textContent=loadError?'영상 준비 실패 · 현재 위치를 확인할 수 없습니다.':'영상과 위치를 확인하는 중…';return;}
    if(mode==='guided'&&task.guided){el.textContent=task.submitted?(viewer.referenceAt(viewer.point)===task.guided.labelId?'현재 십자선은 찾을 구조의 참고 영역 안에 있어요.':'색칠된 곳이 목표 영역입니다. 정답 위치 다시 보기로 십자선을 옮길 수 있어요.'):`찾을 구조: ${sideNames[side]} ${topic.ko} · 영상에서 위치를 찍고 ‘이 위치 확인’을 누르세요. 십자선은 정답 표시가 아닙니다.`;return;}
    const revealed=mode==='explore'||task.submitted||task.hints.some(h=>['boundary','anchor'].includes(h));
    if(!revealed){el.textContent=`학습 대상: ${topic.ko} · 십자선은 현재 탐색 위치이며, 목표 구조의 위치를 뜻하지 않습니다. 자동 라벨은 위치·경계 도움을 열면 표시됩니다.`;return;}
    const hit=current.segmentation.labels.find(l=>l.id===viewer.referenceAt(viewer.point));
    const name=hit?`${sideNames[hit.side]} ${topics.find(t=>t.id===hit.structure)?.ko??hit.structure}`:'제공된 참고 구획 없음';
    const matches=labels().some(l=>l.id===hit?.id);
    el.textContent=`현재 십자선의 자동 라벨: ${name} · ${matches?'선택 영역 안':labels().length?'선택 영역 밖':'이 주제는 전용 구획 없음'}. FreeSurfer 참고 라벨이며 경계 검수 전입니다.`;
  }
  function locateTarget(){
    if(loading||loadError||viewer.current?.id!==current.id||(mode==='transfer'&&!task.submitted))return;
    const target=labels()[0];if(!target){cursorStatus();return;}
    viewer.setPoint(target.anchor);selectSubjectPoint('list',target.anchor,target.id);useHint('anchor',false);cursorStatus();
  }
  function exploreLocation(){if(mode==='explore')locateTarget();else cursorStatus();}
  function aalReference(){return atlasEntries.find(r=>r.group===topic.group&&r.src==='aal3.nii.gz');}
  function setActive(value){anatomyMarker?.clear();if(!value)nearby?.clear();if(!value&&task&&!task.submitted){task.helpUsed??=[];if(!task.helpUsed.includes('reference-atlas'))task.helpUsed.push('reference-atlas');saveDraft();}active=value;document.body.classList.toggle('individual-mode',value);document.body.classList.toggle('guided-mode',value&&mode==='guided');$('cases-mode').setAttribute('aria-pressed',String(value));event('individual-mode',{active:value});if(value){updateHeader();cursorStatus();publishScene();requestAnimationFrame(()=>window.dispatchEvent(new Event('resize')));}}
  $('cases-mode').onclick=()=>setActive(true);
  for(const id of ['explore-mode','find-mode','mri-train','review-localization'])$(id).addEventListener('click',()=>setActive(false),true);
  $('case-atlas-all').onclick=()=>{$('explore-mode').click();};
  function updateHeader(){
    if(!active)return;
    $('viewer-status').textContent='개인 자동 분할 · 참고용 3D';
  }
  function topicList(){
    const q=$('case-search').value.trim().toLowerCase();const filtered=topics.filter(t=>(!$('case-category').value||t.category===$('case-category').value)&&(t.ko+t.en+t.landmarks.join(' ')+(t.id==='caudate'?'꼬리핵 caudate':'')).toLowerCase().includes(q));
    $('case-topics').innerHTML=filtered.map(t=>`<button data-topic="${t.id}" class="structure" aria-pressed="${!unregisteredSelection&&topic.id===t.id}"><span>${t.ko}<small>${t.en}</small></span></button>`).join('')||'<p class="empty">일치하는 주제가 없습니다. 구조 이름이나 랜드마크로 찾아보세요.</p>';
    $('case-topics').querySelectorAll('button').forEach(b=>b.onclick=()=>chooseTopic(b.dataset.topic));
  }
  function renderCaseSelect(){
    for(const option of $('compare-select').options)option.disabled=option.value===current.id;
    if($('compare-select').value===current.id)$('compare-select').value='sequence';
    $('case-select').innerHTML=manifest.cases.filter(c=>mode==='transfer'?c.cohort==='transfer':c.cohort==='learning').map(c=>`<button data-case-id="${c.id}" aria-pressed="${c.id===current.id}">사례 ${Number(c.id.split('-')[1])}</button>`).join('');
  }
  function renderMode(){
    document.querySelectorAll('[data-trace-mark]').forEach(b=>{const mark=task?.marks[b.dataset.traceMark];b.setAttribute('aria-pressed',String(Boolean(mark)));b.title=mark?mm(mark.point)+' mm':'';});
    document.querySelectorAll('[data-case-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.caseMode===mode)));
    $('case-mode-note').textContent={explore:'왼쪽에서 구조를 고르고 사례 1·2·3과 T1/T2를 바꿔 보세요. 같은 구조를 각 사람의 위치에서 보여줍니다. MRI를 클릭하면 주변 구조를 노란 점으로 표시합니다.',guided:'앱이 고른 구조를 3개 단면에서 찾아보세요. 위치를 찍고 확인하면 됩니다. 글을 쓸 필요는 없어요.',trace:'한 방향에서 출현·형태 변화·소실을 기록한 뒤 다른 방향으로 확인하세요.',compare:'같은 사람의 T1/T2 대비 또는 다른 사람의 형태를 나란히 확인하세요.',transfer:'학습용과 분리된 개인입니다. 도움은 첫 응답 이후에 열립니다. 자동 점수가 아닌 판독 설명 연습입니다.'}[mode];
    $('nearby-controls').hidden=mode!=='explore';$('case-trace-tools').hidden=mode!=='trace';$('compare-controls').hidden=mode!=='compare';$('comparison-screen').hidden=mode!=='compare';document.querySelector('.case-canvases').classList.toggle('is-comparing',mode==='compare');
    $('case-badge').textContent=`개인 3T · ${mode==='transfer'?(task.novel?'첫 노출 세션':'이전 노출 있음'):'학습 사례'}`;
    renderCaseSelect();
    document.body.classList.toggle('guided-mode',active&&mode==='guided');$('guided-image-prompt').hidden=mode!=='guided';
    const heading=$('case-sidebar').querySelector('h1');heading.textContent=mode==='guided'?'오늘의 찾기 연습':'판독 주제';
    $('case-sidebar').querySelector('.section-heading span').textContent=mode==='guided'?'앱이 문제를 골라드립니다':`${topics.length}개 관찰 경로`;
  }
  function updateLocation(e){
    if(e.caseId!==current?.id)return;
    for(const [i,a] of ['x','y','z'].entries()){$('case-slice-'+a).value=e.mm[i];$('case-value-'+a).textContent=e.mm[i].toFixed(1)+' mm';}
    $('case-coordinate').textContent=`T1 개인 공간 · ${mm(e.mm)} mm`;cursorStatus();
    if(!active)return;lastPoint=e;nearby?.locationChanged(e.mm);anatomyMarker?.refresh();
    if(task&&!task.submitted){task.candidate=null;validateForm();}
    if(task&&!task.submitted&&!loading){const axis=axisIndex[e.plane];const values=task.visited[e.plane]??[];const v=Math.round(e.mm[axis]*2)/2;if(!values.includes(v))values.push(v);task.visited[e.plane]=values.slice(-1500);$('trace-summary').textContent=`${planeNames[e.plane]} · ${values.length}개 깊이 관찰`;saveDraft();}
    publishScene();
    if(mode==='compare'&&$('compare-select').value==='sequence'&&comparison&&!comparison.busy&&!syncing){syncing=true;comparison.setPoint(e.mm);syncing=false;}
  }
  function loadState(e,secondary=false){
    const el=$(secondary?'compare-loading':'case-loading');el.hidden=!e.busy&&!e.error;el.textContent=e.error??(e.busy?'원본 상세를 유지한 개인 영상을 불러오는 중…':'');
    if(e.error){const retry=document.createElement('button');retry.textContent='다시 불러오기';retry.onclick=()=>secondary?loadComparison():loadCase(current,sequence,{preserve:true});el.append(retry);}
  }
  async function loadCase(c,seq='T1w',{preserve=false}={}){
    anatomyMarker?.clear();unregisteredSelection=false;
    nearby?.clear();const mine=++loadToken;loading=true;loadError=false;current=c;sequence=seq;publishScene();renderMode();renderDetail();
    $('case-volume-name').textContent=`${c.title} · ${seq==='T1w'?'T1':'T2 → T1 공간'}`;
    $('primary-caption').textContent=`${c.id} · ${seq==='T1w'?'원본 T1':'정합 T2'}`;
    document.querySelectorAll('[data-sequence]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.sequence===seq)));
    for(const a of ['x','y','z'])$('case-slice-'+a).disabled=true;
    const ok=await viewer.load(c,seq,{preserve});if(mine!==loadToken)return false;
    loading=false;loadError=!ok;publishScene();if(!ok){renderDetail();return false;}
    const spec=c.sequences[seq];
    for(const [i,a] of ['x','y','z'].entries()){const input=$('case-slice-'+a);input.min=spec.bounds[0][i];input.max=spec.bounds[1][i];input.disabled=false;}
    updateWindow();showZoom(viewer.snapshot().zoom);
    if(!history.exposures.includes(c.id)){history.exposures.push(c.id);save();}
    if(mode==='guided'&&task.guided&&(!labels().some(l=>l.id===task.guided.labelId)||task.guided.sections.some(s=>viewer.referenceAt(s.answer)!==task.guided.labelId||Math.abs(viewer.sectionDepth(s.answer,s.plane)-s.depth)>.1)))task=freshTask();
    if(mode==='guided'&&!task.submitted&&!task.guided)startGuided();
    applyMask();if(!preserve){if(task.guided&&mode==='guided')showGuidedSection();else exploreLocation();}renderDetail();saveDraft();if(mode==='compare')await loadComparison();return true;
  }
  function showZoom(value){$('case-zoom').value=value.toFixed(2);$('case-zoom-value').textContent=Number(value.toFixed(2))+'×';}
  function updateWindow(){
    const [lo,hi]=current.sequences[sequence].display_range;const max=Math.max(hi*3,200);
    $('case-window').max=Math.ceil(max);$('case-level').min=Math.floor(-hi);$('case-level').max=Math.ceil(max);
    $('case-window').value=Math.round(hi-lo);$('case-level').value=Math.round((hi+lo)/2);windowChanged();
  }
  function windowChanged(){const width=Number($('case-window').value),level=Number($('case-level').value);$('case-window-value').textContent=width;$('case-level-value').textContent=level;viewer.setWindow(width,level);}
  async function loadComparison(){
    const mine=++compareToken;if(mode!=='compare')return;
    const value=$('compare-select').value,matched=value==='sequence';const c=matched?current:manifest.cases.find(c=>c.id===value);if(!c)return;
    $('compare-caption').textContent=`${c.id} · ${matched?(sequence==='T1w'?'정합 T2':'원본 T1'):'원본 T1 · 독립 좌표'}`;
    $('compare-note').textContent=matched?'같은 개인의 T1 좌표를 공유합니다.':'다른 사람은 좌표를 공유하지 않습니다. 각 화면에서 독립적으로 탐색하세요.';
    if(!comparison)comparison=await createCaseViewer({canvas:$('case-compare-mri'),onLoad:e=>loadState(e,true),onLocation:e=>{if(mode==='compare'&&$('compare-select').value==='sequence'&&!syncing&&!viewer.busy){syncing=true;viewer.setPoint(e.mm);syncing=false;}}});
    if(mine!==compareToken||mode!=='compare')return;
    comparison.setPlane(viewer.plane);const ok=await comparison.load(c,matched?(sequence==='T1w'?'T2w':'T1w'):'T1w');
    if(mine!==compareToken||mode!=='compare'||!ok)return;
    comparison.setMask([],false);if(matched)comparison.setPoint(viewer.point);
    else {const ref=c.segmentation.labels.find(l=>l.structure===topic.id&&(l.side===side||l.side==='midline'));if(ref)comparison.setPoint(ref.anchor);}
    task.comparisonUsed=true;if(!task.hints.includes('comparison'))task.hints.push('comparison');saveDraft();
  }
  function setPlane(p){nearby?.clear();if(task&&!task.submitted)task.candidate=null;viewer.setPlane(p);if(comparison)comparison.setPlane(p);document.querySelectorAll('[data-case-plane]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.casePlane===p)));if(task&&!task.submitted)task.lastPlane=p;validateForm();saveDraft();}
  function applyMask(){const show=Boolean(task?.hints.includes('boundary'));viewer.setMask(labels().map(l=>l.id),show);$('case-label-state').textContent=show?'자동 분할 참고 · 미검수 경계':'라벨 없음';}
  function reference3D(){
    const hidden=mode!=='explore'&&!task?.submitted;
    event('individual-hide-reference',{hidden,note:'실제 MRI에서 먼저 위치를 제출하세요. 첫 응답 후 같은 개인의 3D를 확인할 수 있습니다.'});
    publishScene();
  }
  function chooseTopic(id,{point=null}={}){
    anatomyMarker?.clear();unregisteredSelection=false;
    if(mode==='guided')return;
    const next=topics.find(t=>t.id===id);if(!next)return;topic=next;side=topic.midline?'midline':side==='midline'?'left':side;task=freshTask();if(mode==='transfer')task.novel=false;
    event('individual-hide-reference',{hidden:mode==='transfer'});topicList();renderMode();setPlane(mode==='explore'?viewer.plane:topic.plane);applyMask();if(point)viewer.setPoint(point);else exploreLocation();renderDetail();reference3D();saveDraft();
    if(mode==='compare')loadComparison();
  }
  async function chooseMode(next){
    anatomyMarker?.clear();unregisteredSelection=false;
    if(!modes[next])return;nearby?.clear();mode=next;compareToken++;if(mode!=='compare')comparison?.cancel();
    const expected=mode==='transfer'?'transfer':'learning';const nextCase=current.cohort===expected?current:manifest.cases.find(c=>c.cohort===expected);
    current=nextCase;task=freshTask();if(mode==='explore')setPlane('axial');renderMode();applyMask();renderDetail();
    // Starting without label hints is separate from a later reference review.
    reference3D();
    if(viewer.current?.id!==current.id)await loadCase(current,'T1w');else if(mode==='compare')await loadComparison();else if(mode==='guided')startGuided();else exploreLocation();
    renderDetail();saveDraft();
  }
  function startGuided(){
    if(loading||loadError||mode!=='guided')return;
    const picked=pickGuidedTarget(topics.filter(t=>guidedTopicIds.includes(t.id)),current.segmentation.labels,topic.id);
    if(!picked)return;
    topic=picked.topic;side=picked.label.side;task=freshTask();
    const key=`${current.id}:${picked.label.id}`;
    if(!sectionCache.has(key))sectionCache.set(key,buildGuidedSections(picked.label,topic.plane,p=>viewer.referenceAt(p),viewer.guidedGeometry(picked.label)));
    const sections=sectionCache.get(key);
    task.guided={sections:structuredClone(sections),index:0,labelId:picked.label.id};
    topicList();renderMode();showGuidedSection();reference3D();renderDetail();saveDraft();
    if(active)document.querySelector('[data-workspace=mri]').click();
  }
  function guidedSection(){return task?.guided?.sections[task.guided.index];}
  function onGuidedSection(){const section=guidedSection();return !loading&&!loadError&&Boolean(viewer)&&!viewer.busy&&Boolean(section)&&viewer.plane===section.plane&&Math.abs(viewer.sectionDepth(viewer.point,section.plane)-section.depth)<.1;}
  function showGuidedSection(){
    const section=guidedSection();if(!section||loading||loadError)return;
    setPlane(section.plane);
    let p=task.submitted?[...section.answer]:viewer.pointOnSection(current.initial_point,section.plane,section.depth);
    if(!task.submitted&&viewer.referenceAt(p)===task.guided.labelId){const axis=[0,1,2].find(i=>i!==planeAxes[section.plane]);p[axis]=labels()[0].bounds[1][axis]+10;p=viewer.pointOnSection(p,section.plane,section.depth);}
    viewer.setPoint(p);applyMask();validateForm();
  }
  function finishGuided(reveal=false){
    if(loading||loadError||task.submitted||!guidedSection()||(!reveal&&!canSubmit()))return;
    const section=guidedSection(),target=labels()[0],point=reveal?null:[...task.candidate.mm];
    const result=guidedLocationFeedback(point,target,section,p=>viewer.referenceAt(p),viewer.guidedGeometry(target));
    const a={id:task.id,caseId:current.id,referenceSpace:current.reference_space,spaceId:subjectSpaceId(current.id),representationKind:labels().length?'subject-segmentation':null,assessmentUse:'reference-only',imageSHA256:current.sequences[sequence].sha256,labelSHA256:current.segmentation.sha256,topic:topic.id,side,mode,sequence,plane:section.plane,point:point??[...section.answer],status:reveal?'indeterminate':'present',note:reveal?'정답 위치를 보고 연습함':'영상에서 위치를 선택함',confidence:'uncertain',hints:[...new Set([...(task.helpUsed??[]),...task.hints,...(reveal?['answer']:[])])],marks:{},visited:structuredClone(task.visited),novel:task.novel,referenceLabel:point?viewer.referenceAt(point):0,startedAt:task.startedAt,submittedAt:new Date().toISOString(),score:null,feedbackType:'reference-only',guided:structuredClone(task.guided),locationResult:result,selfChecks:{}};
    if(!appendFirst(history,a))return;
    task.submitted=a;task.hints=['boundary'];save();showGuidedSection();renderDetail();reference3D();saveDraft();
  }
  function renderGuided(){
    const g=task.guided,section=guidedSection(),a=task.submitted;
    const unavailable=loading||loadError||!section;
    const result=a?.locationResult;
    $('guided-image-prompt').textContent=section?`${sideNames[side]} ${topic.ko} 찾기 · 단면 ${g.index+1}/${g.sections.length}${a?' · 아래에서 결과 확인':' · 영상에서 위치를 클릭하세요'}`:'찾기 문제를 준비합니다.';
    const hit=a&&current.segmentation.labels.find(l=>l.id===a.referenceLabel);
    setDetailHTML(`<p class="eyebrow">GUIDED / 구조 찾기 연습 ${section?`· ${g.index+1} / ${g.sections.length}`:''}</p>
      <h2>${section?`${sideNames[side]} ${topic.ko} 찾기`:'찾기 문제 준비 중'}</h2>
      ${section?`<p class="english">${topic.en}</p><p class="guided-instruction"><strong>${planeNames[section.plane]}</strong><br>${a?'표시된 위치를 확인한 뒤 다음 단면으로 넘어가세요.':'영상에서 위치를 찍고 <strong>이 위치 확인</strong>을 누르세요.'}</p><ol class="guided-progress" aria-label="단면 진행">${g.sections.map((s,i)=>`<li ${i===g.index?'aria-current="step"':''}>${i+1}. ${{axial:'축상면',coronal:'관상면',sagittal:'시상면'}[s.plane]}${i<g.index?' ✓':''}</li>`).join('')}</ol>`:''}
      ${loading?'<p role="status">영상을 불러온 뒤 찾기 좋은 단면을 준비합니다.</p>':loadError?'<p role="alert">영상을 불러오지 못했어요. 영상의 ‘다시 불러오기’를 눌러주세요.</p>':!section?'<p>이 구조에서는 연습할 단면을 충분히 확보하지 못했어요. 다른 문제로 시작해보세요.</p>':''}
      ${section&&!a?`<p id="guided-selection" class="small" role="status">영상에서 찾을 구조를 한 번 클릭하세요.</p><button id="guided-submit" class="primary" ${canSubmit()?'':'disabled'}>이 위치 확인</button><div class="action-row"><button id="guided-reveal" ${unavailable?'disabled':''}>모르겠어요 · 정답 보기</button><button id="guided-return" class="text-button" ${unavailable?'disabled':''}>문제 단면으로 돌아가기</button></div>`:''}
      ${a&&result?`<div class="guided-feedback" role="status" data-result="${esc(result.kind)}"><h3>${esc(result.title)}</h3><p>${esc(result.message)}</p>${result.kind==='miss'&&hit?`<p>찍은 곳은 <strong>${sideNames[hit.side]} ${esc(topics.find(t=>t.id===hit.structure)?.ko??hit.structure)}</strong>의 참고 영역입니다.</p>`:''}<p class="small">${result.kind==='match'?'확인한':'정답'} 위치를 영상에 표시했어요.</p><div class="action-row"><button id="guided-answer" ${unavailable?'disabled':''}>정답 위치 다시 보기</button>${a.status==='present'?`<button id="guided-mine" ${unavailable?'disabled':''}>내가 찍은 위치</button>`:''}</div><button id="guided-three" ${unavailable?'disabled':''}>같은 단면을 개인 3D로 보기</button><button id="guided-next" class="primary" ${unavailable?'disabled':''}>${g.index<g.sections.length-1?'다음 단면에서 찾기 →':'세 단면 완료 · 새 문제 →'}</button><button id="guided-retry" class="text-button" ${unavailable?'disabled':''}>이 단면 다시 연습</button></div>`:''}
      ${section&&a?`<div class="landmark-guide guided-route"><h3>이렇게 따라 찾아보세요</h3><p>먼저 <strong>${topic.landmarks[0]}</strong>부터 찾아보세요.</p><p>${topic.relation}</p><p class="small">함께 구별할 구조: ${topic.landmarks.slice(1).join(' · ')}</p></div><details class="clinical-context"><summary>헷갈리기 쉬운 점</summary><p>${topic.pitfall}</p></details><details class="clinical-context"><summary>정답 위치의 기준</summary><p>이 개인의 FreeSurfer 자동 분할에서 목표 영역이 넓게 포함된 단면을 골랐습니다. 색과 십자선은 이 참고 영역의 위치를 보여줍니다. 실제 영상에서 모든 경계가 선명하다는 뜻은 아닙니다.</p><p>위치 일치 여부를 연습하며, 전문의가 검수한 판독 점수는 계산하지 않습니다.</p><p>${topic.boundary}</p></details>`:''}
      <button id="guided-new" class="text-button" ${loading||loadError?'disabled':''}>다른 구조로 새 문제</button>`);
    if($('guided-submit'))$('guided-submit').onclick=()=>finishGuided();
    if($('guided-reveal'))$('guided-reveal').onclick=()=>finishGuided(true);
    if($('guided-return'))$('guided-return').onclick=showGuidedSection;
    if($('guided-answer'))$('guided-answer').onclick=showGuidedSection;
    if($('guided-three'))$('guided-three').onclick=()=>useHint('three');
    if($('guided-mine'))$('guided-mine').onclick=()=>{setPlane(a.plane);viewer.setPoint(a.point);};
    const restart=index=>{const next={...structuredClone(g),index};task=freshTask();task.guided=next;showGuidedSection();renderDetail();reference3D();saveDraft();};
    if($('guided-next'))$('guided-next').onclick=()=>{if(g.index<g.sections.length-1)restart(g.index+1);else startGuided();};
    if($('guided-retry'))$('guided-retry').onclick=()=>restart(g.index);
    $('guided-new').onclick=startGuided;cursorStatus();validateForm();
  }
  function anatomyLabels(term){return current?.segmentation.labels.filter(l=>l.structure===term.topic&&(l.side===side||l.side==='midline'))??[];}
  function setDetailHTML(html){
    event('illustration-refresh',{});
    anatomyMarker?.clear();$('case-detail').innerHTML=html;
    annotateAnatomy($('case-detail'),{onLocate:locateAnatomy,canLocate:term=>anatomyLabels(term).length>0,enabled:mode==='explore'||Boolean(task?.submitted)});
  }
  function locateAnatomy(term){
    if(!active||loading||loadError||!(mode==='explore'||task.submitted))return;
    if($('mri-pane').hidden)document.querySelector('[data-workspace=linked]').click();
    anatomyMarker?.clear();nearby?.clear();
    const candidates=anatomyLabels(term);if(!candidates.length)return;
    const found=viewer.locate(candidates.map(l=>l.id));
    if(!found){anatomyStatus($('case-detail'),'현재 영상에서 등록 위치를 확인하지 못했습니다. 다시 선택하세요.');return;}
    if(found.moved)viewer.setPoint(found.point);
    anatomyMarker.show(found.point,term.ko);
    anatomyStatus($('case-detail'),`${term.ko}(${term.en}) · 노란 원${found.moved?' · 구조가 보이는 단면으로 이동했습니다.':''}`);
  }
  function renderDetail(){
    if(!current||!task)return;
    if(mode==='explore'&&unregisteredSelection){setDetailHTML('<h2>미등록 위치</h2><p>이 위치에는 등록된 구조가 없습니다.</p>');return;}
    if(mode==='guided'&&(task.guided||!task.submitted)){renderGuided();return;}
    const t=task,exploring=mode==='explore',transfer=mode==='transfer',locked=transfer&&!t.submitted;
    const hint=(id,label)=>`<button data-hint="${id}" ${loading||loadError||locked||(id==='three'&&mode!=='explore'&&!t.submitted)?'disabled':''} aria-pressed="${t.hints.includes(id)}">${label}</button>`;
    const targets=labels(),labelsAvailable=targets.length>0,aal=aalReference();
    setDetailHTML(`<p class="eyebrow">${mode==='transfer'?'TRANSFER / FIRST RESPONSE':'READING / '+modes[mode]}</p><h2>${topic.ko}</h2><p class="english">${topic.en}</p><label class="case-side">관찰 측 <select id="case-side" ${t.submitted?'disabled':''}><option value="left">왼쪽</option><option value="right">오른쪽</option>${topic.midline?'<option value="midline">정중</option>':''}</select></label><p class="task-prompt">${topic.prompt}</p>
    <div class="reading-steps"><span>01 위치</span><span>02 형태·연속성</span><span>03 관계·확실성</span></div>
    ${loading?'<p class="small" role="status">영상 준비 후 응답할 수 있습니다.</p>':loadError?'<p role="alert">영상 로딩에 실패했습니다. 화면의 다시 불러오기를 사용하세요.</p>':''}
    <div class="hint-controls">${hint('landmarks','주변 랜드마크')}${hint('orthogonal','다른 방향')}${subjectCoreTopics.includes(topic.id)?hint('three','개인 3D'):''}${labelsAvailable?hint('boundary','참고 경계'):''}</div>
    ${labelsAvailable?`<button id="case-anchor" class="text-button" ${loading||loadError||locked?'disabled':''}>선택 구조 위치로 ↗</button>`:'<p class="small muted">이 주제의 전용 분할은 없습니다. 주변 랜드마크를 따라 직접 탐색하세요.</p>'}
    <details id="case-location-source" class="clinical-context"><summary>이 위치의 근거 · ${labelsAvailable?'FreeSurfer':'랜드마크 관찰'}</summary>${labelsAvailable?`<p>${esc(current.id)}의 자체 FreeSurfer 5.3 aparc+aseg 자동 분할입니다. 원천 라벨 ID: ${targets.flatMap(l=>l.source_ids).join(', ')}. 표준 MNI 좌표를 개인 영상에 대입하지 않습니다.</p><p>이동 지점은 선택 분할 안에서 경계까지의 거리가 최대인 대표 복셀입니다. 구조 전체의 중심·유일한 위치·수동 판독 정답을 뜻하지 않습니다. 연속 단면에서 범위를 확인하세요.</p><p>기준: ${esc(current.reference_space)} · 전문 경계 검수 전.</p>`:'<p>전용 마스크나 자동 위치를 제공하지 않습니다.</p>'}${aal?`<p>관련 AAL3 구획: ${esc(regions[topic.group].ko)} · ${sideNames[side]}. 별도 MNI 표준공간 참고이며, 이 개인의 분할과 경계 정의가 다를 수 있습니다.</p><button id="case-open-aal" class="text-button" ${locked?'disabled':''}>AAL3에서 관련 영역 보기 ↗</button>`:''}<a href="ANATOMICAL_VALIDITY.md" target="_blank">위치 산출과 검증 범위 ↗</a></details>
    ${locked?'<p class="small muted">전이 연습: 첫 응답 전에는 위치 힌트와 참고 경계가 잠깁니다. 단면·시퀀스 이동은 자유롭습니다.</p>':''}
    ${t.hints.includes('landmarks')?`<div class="landmark-guide"><h3>관찰할 랜드마크</h3><ul>${topic.landmarks.map(x=>`<li>${x}</li>`).join('')}</ul><p>${topic.relation}</p></div>`:''}
    ${!exploring&&t.hints.includes('boundary')?`<p class="reference-note">${topic.boundary}</p>`:''}
    ${exploring?'':t.submitted?feedbackHTML(t.submitted):`<form id="reading-form"><fieldset ${loading||loadError?'disabled':''}><legend>이 단면에서의 판단</legend>${Object.entries(statusNames).map(([id,name])=>`<label class="reading-choice"><input type="radio" name="presence" value="${id}" ${t.status===id?'checked':''}> ${name}</label>`).join('')}<label class="note-label" for="reading-note">관찰 근거</label><textarea id="reading-note" maxlength="2000" rows="4" placeholder="어느 쪽·어느 단면인가요? 주변 구조와의 관계, 보이는 경계와 추론한 경계를 설명하세요.">${esc(t.note)}</textarea><label class="confidence-label">확신 정도 <select id="reading-confidence"><option value="uncertain">추가 확인 필요</option><option value="partial">일부는 확인</option><option value="confident">근거를 설명할 수 있음</option></select></label><p id="reading-validation" class="small">${t.status==='present'&&!t.candidate?'MRI에서 위치도 한 번 지정하세요.':'관찰 근거를 적으면 첫 응답으로 저장됩니다.'}</p><button id="reading-submit" class="primary" type="submit" ${canSubmit()?'':'disabled'}>첫 응답 저장 · 피드백</button></fieldset></form>`}
    <details class="clinical-context"><summary>임상 관찰과 연결하기</summary><p>${topic.clinical}</p><p>${topic.boundary}</p><a href="${topic.source}" target="_blank" rel="noopener">해부학 참고 자료 ↗</a></details>`);
    $('case-side').value=side;$('case-side').disabled=(!exploring&&Boolean(t.submitted))||topic.midline;
    $('case-side').onchange=()=>{side=$('case-side').value;task=freshTask();event('individual-hide-reference',{hidden:mode==='transfer'});renderMode();applyMask();exploreLocation();renderDetail();reference3D();saveDraft();};
    $('case-detail').querySelectorAll('[data-hint]').forEach(b=>b.onclick=()=>useHint(b.dataset.hint));
    if($('case-anchor'))$('case-anchor').onclick=locateTarget;
    if($('case-open-aal'))$('case-open-aal').onclick=()=>{if(!locked)event('open-reference-atlas',{group:topic.group,side});};
    cursorStatus();
    if(exploring)return;
    if(!t.submitted){
      $('reading-confidence').value=t.confidence;
      $('reading-note').oninput=()=>{t.note=$('reading-note').value;validateForm();saveDraft();};
      $('reading-confidence').onchange=()=>{t.confidence=$('reading-confidence').value;saveDraft();};
      document.querySelectorAll('input[name=presence]').forEach(input=>input.onchange=()=>{t.status=input.value;validateForm();saveDraft();});
      $('reading-form').onsubmit=e=>{e.preventDefault();submit();};
    }else{
      $('reading-next').onclick=()=>chooseTopic(topics[(topics.indexOf(topic)+1)%topics.length].id);
      $('reading-repeat').onclick=()=>{task=freshTask();reference3D();renderMode();applyMask();renderDetail();saveDraft();};
      $('review-submitted-location').onclick=()=>{viewer.setPlane(t.submitted.plane);setPlane(t.submitted.plane);viewer.setPoint(t.submitted.point);};
      $('case-detail').querySelectorAll('[data-self-check]').forEach(input=>input.onchange=()=>{const record=history.attempts.find(a=>a.id===t.submitted.id);if(!record)return;record.selfChecks??={};record.selfChecks[input.dataset.selfCheck]=input.checked;t.submitted.selfChecks=record.selfChecks;save();saveDraft();});
    }
  }
  function canSubmit(){if(mode==='explore')return false;if(mode==='guided'&&task.guided)return !loading&&!loadError&&!task.submitted&&Boolean(task.candidate)&&onGuidedSection();return !loading&&!loadError&&!task.submitted&&Boolean(task.status)&&task.note.trim().length>=5&&(task.status!=='present'||Boolean(task.candidate))&&(mode!=='trace'||traceReady(task.marks));}
  function validateForm(){if(mode==='guided'&&task.guided){if($('guided-submit'))$('guided-submit').disabled=!canSubmit();if($('guided-selection'))$('guided-selection').textContent=loading?'영상을 준비하고 있어요.':loadError?'영상을 다시 불러온 뒤 위치를 골라주세요.':!onGuidedSection()?'다른 단면으로 이동했어요. 문제 단면으로 돌아온 뒤 위치를 찍어주세요.':task.candidate?'위치를 골랐어요. ‘이 위치 확인’을 누르세요.':'영상에서 찾을 구조를 한 번 클릭하세요.';return;}if(!$('reading-submit'))return;$('reading-submit').disabled=!canSubmit();$('reading-validation').textContent=mode==='trace'&&!traceReady(task.marks)?'같은 방향에서 출현 → 변화 → 소실을 서로 다른 깊이에 순서대로 기록하세요.':task.status==='present'&&!task.candidate?'MRI에서 판단한 위치를 한 번 지정하세요.':task.note.trim().length<5?'주변 구조와 경계에 대한 근거를 5자 이상 적어주세요.':'첫 응답을 저장할 수 있습니다.';}
  function useHint(id,redraw=true){
    if(loading||loadError||(mode==='transfer'&&!task.submitted)||(id==='three'&&mode!=='explore'&&!task.submitted))return;
    if(id==='boundary'&&task.hints.includes(id)){task.hints=task.hints.filter(h=>h!==id);}
    else if(!task.hints.includes(id))task.hints.push(id);
    task.helpUsed??=[];if(!task.helpUsed.includes(id))task.helpUsed.push(id);
    if(id==='three'){event('individual-hide-reference',{hidden:false});reference3D();document.querySelector('[data-workspace=linked]').click();}
    if(id==='orthogonal')setPlane('multi');
    applyMask();cursorStatus();saveDraft();if(redraw)renderDetail();
  }
  function feedbackHTML(a){
    const reference=referenceFeedback(a,current.segmentation.labels,topic);
    const hit=current.segmentation.labels.find(l=>l.id===a.referenceLabel);
    return `<div class="reading-feedback" role="status"><span class="kind-chip">저장됨 · 참고 피드백 / 점수 없음</span><h3>내 관찰과 대조하기</h3><p><strong>${statusNames[a.status]}</strong><br><span data-user-content>${esc(a.note)}</span></p><p class="small">첫 응답: ${a.sequence} · ${planeNames[a.plane]} · ${mm(a.point)} mm<br>도움 ${a.hints.length}종 · ${a.novel?'이 세션 시작 전 미노출':'이전 영상 노출 있음'}</p><p>${reference.comparison}</p>${a.status==='present'?`<p>제출 위치의 자동 라벨: ${hit?(topics.find(t=>t.id===hit.structure)?.ko??hit.structure)+' · '+sideNames[hit.side]:'제공된 참고 구획 없음'}. 라벨 소속은 임상 정오 판정이 아닙니다.</p>`:''}<p>${topic.pitfall}</p><p>${topic.relation}</p>${mode==='trace'?`<p>기록한 추적 지점: ${Object.entries(a.marks).map(([k,v])=>`${{appearance:'출현',body:'형태 변화',disappearance:'소실'}[k]} ${v.plane} ${mm(v.point)} mm`).join(' · ')}</p>`:''}<div class="self-review"><h3>설명에서 보완할 점 · 자기 점검</h3>${[['location','위치와 방향을 근거로 설명했다'],['relationship','이웃 구조 두 곳 이상을 구별했다'],['continuity','연속 단면에서 형태 변화를 확인했다'],['uncertainty','보이는 경계와 추론한 경계를 나눴다']].map(([id,label])=>`<label><input type="checkbox" data-self-check="${id}" ${a.selfChecks?.[id]?'checked':''}> ${label}</label>`).join('')}</div><button id="review-submitted-location" class="text-button">제출했던 단면으로 돌아가기</button><div class="action-row"><button id="reading-next" class="primary">다음 주제 →</button><button id="reading-repeat">같은 주제 재관찰</button></div></div>`;
  }
  function submit(){
    if(!canSubmit())return;
    const point=task.status==='present'?task.candidate.mm:viewer.point;
    if(mode==='explore'&&$('viewer-split').dataset.splitView!=='mri'){task.helpUsed??=[];if(!task.helpUsed.includes('three-visible'))task.helpUsed.push('three-visible');}
    const a={id:task.id,caseId:current.id,contractId:current.tasks?.find(t=>t.target===topic.id)?.id??null,referenceSpace:current.reference_space,spaceId:subjectSpaceId(current.id),representationKind:labels().length?'subject-segmentation':null,assessmentUse:'reference-only',imageSHA256:current.sequences[sequence].sha256,labelSHA256:current.segmentation.sha256,topic:topic.id,side,mode,sequence,plane:viewer.plane,point:[...point],status:task.status,note:task.note.trim(),confidence:task.confidence,hints:[...new Set([...(task.helpUsed??[]),...task.hints])],marks:structuredClone(task.marks),visited:structuredClone(task.visited),novel:task.novel,referenceLabel:task.status==='present'?task.candidate.label:0,comparisonUsed:task.comparisonUsed,startedAt:task.startedAt,submittedAt:new Date().toISOString(),score:null,feedbackType:'reference-only',selfChecks:{}};
    if(!appendFirst(history,a))return;
    task.submitted=a;save();saveDraft();reference3D();renderDetail();
  }
  function showProvenance(){
    const c=current,s=c.sequences[sequence],f=v=>v.map(x=>Number(x).toFixed(3)).join(' × ');
    $('case-dialog-body').innerHTML=`<p class="eyebrow">IMAGE PROVENANCE</p><h2>${c.title} · ${c.id}</h2><p>한 연구 참여자의 실제 구조영상입니다. 집단 평균이 아닙니다.</p><dl class="provenance-grid"><dt>촬영</dt><dd>${s.field_strength_t}T · ${s.sequence}</dd><dt>촬영 복셀</dt><dd>${f(s.acquisition_voxel_size)} mm · 공식 촬영 설명</dd><dt>파일 복셀 간격</dt><dd>${f(s.voxel_size)} mm</dd><dt>행렬 · 데이터형</dt><dd>${s.shape.join(' × ')} · ${s.dtype}</dd><dt>강도</dt><dd>${s.range.map(v=>v.toFixed(2)).join('–')} · 화면 W/L만 변경</dd><dt>좌표</dt><dd>개인 T1 scanner RAS · MNI 아님</dd><dt>정합</dt><dd>${sequence==='T1w'?'원본 파일과 SHA-256 일치':'T2 → T1 강체 정합, 원본에서 선형 보간 1회'}</dd><dt>참고 라벨</dt><dd>동일 개인 FreeSurfer 5.3 자동 분할 · 전문 경계 검수 전</dd><dt>이용 조건</dt><dd>PDDL · StudyForrest</dd></dl><p>복셀 간격은 유효 공간 해상도와 다릅니다. 확대는 새로운 해부학적 상세를 만들지 않습니다. T2는 정합 과정의 보간을 거치며 원본도 보존합니다.</p><p class="small">좌우 표시는 원본 헤더에 근거합니다. 별도의 물리적 좌우 표지로 확인된 것은 아닙니다.</p><details><summary>affine · checksum · 검수 기록</summary><pre>${esc(JSON.stringify({affine:s.affine,sha256:s.sha256,qc:c.qc,registration:c.registration,segmentation:{review_status:c.segmentation.review_status,expert_review:c.segmentation.expert_review,rawavg_to_T1_RAS:c.segmentation.rawavg_to_T1_RAS}},null,2))}</pre></details><p><a href="${c.source_url}" target="_blank" rel="noopener">원본 출처 ↗</a> · <a href="assets/cases/${c.id}/case.json" target="_blank">사례 메타데이터</a> · <a href="assets/cases/${c.id}/T2w-native.nii.gz">원본 T2</a></p>`;$('case-dialog').showModal();
  }
  function showHistory(){
    const attempts=history.attempts,rows=topics.map(t=>{const h=attempts.filter(a=>a.topic===t.id);return {t,h};}).filter(r=>r.h.length);
    $('case-dialog-body').innerHTML=`<p class="eyebrow">READING LOG</p><h2>무엇을 설명할 수 있었나요?</h2><p>${attempts.length}개 첫 응답 · ${new Set(attempts.map(a=>a.caseId)).size}명 관찰. 정답률은 계산하지 않습니다. 아래의 보완 항목은 본인의 자기 점검입니다.</p>${rows.length?`<div class="history-table"><table><thead><tr><th>구조</th><th>사례·방향</th><th>도움 사용</th><th>자기 점검 완료</th></tr></thead><tbody>${rows.map(({t,h})=>`<tr><td>${t.ko}</td><td>${new Set(h.map(a=>a.caseId)).size}명 · ${[...new Set(h.map(a=>a.plane))].join(', ')}</td><td>${h.filter(a=>a.hints?.length).length}/${h.length}</td><td>${h.filter(a=>Object.values(a.selfChecks??{}).filter(Boolean).length===4).length}/${h.length}</td></tr>`).join('')}</tbody></table></div>`:'<p>아직 저장된 응답이 없습니다. 한 구조를 관찰하고 근거를 적어 첫 응답을 저장해보세요.</p>'}<h3>최근 관찰 · 이어서 복습</h3><div class="history-attempts">${attempts.slice(-20).reverse().map(a=>`<details><summary>${esc(a.caseId)} · ${topics.find(t=>t.id===a.topic)?.ko??esc(a.topic)} · ${planeNames[a.plane]} · ${a.mode==='transfer'?'전이':'학습'}</summary><p>${esc(a.locationResult?.title??a.note)}</p><p>판단: ${statusNames[a.status]} · ${a.novel?'세션 시작 전 미노출':'이전 노출 있음'} · 첫 응답 도움 ${a.hints?.length??0}종 · 제출 후 3D 확인 ${history.helpEvents?.filter(e=>e.attemptId===a.id&&e.hint==='subject-three').length??0}회</p><button data-review="${esc(a.id)}">이 관찰 복습</button></details>`).join('')}</div><button id="export-reading">기록 JSON 내보내기</button><p class="small">기록은 이 브라우저에 저장됩니다. 전이용 사례도 한 번 열면 이전 노출로 기록되며, 동일인의 재관찰은 일반화 평가로 표시하지 않습니다.</p>`;
    $('export-reading').onclick=()=>{const blob=new Blob([JSON.stringify(history,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='mri-reading-log.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
    $('case-dialog-body').querySelectorAll('[data-review]').forEach(b=>b.onclick=async()=>{const a=attempts.find(x=>x.id===b.dataset.review);if(!a)return;topic=topics.find(t=>t.id===a.topic);current=manifest.cases.find(c=>c.id===a.caseId);if(!topic||!current)return;mode=current.cohort==='transfer'?'transfer':a.guided?'guided':'explore';side=a.side;task=freshTask();task.id=a.id;task.submitted=structuredClone(a);if(a.guided)task.guided=structuredClone(a.guided);task.hints=a.guided?['boundary']:['landmarks'];$('case-dialog').close();topicList();setPlane(a.plane);await loadCase(current,a.sequence);if(a.guided)showGuidedSection();else viewer.setPoint(a.point);reference3D();renderDetail();saveDraft();});
    $('case-dialog').showModal();
  }
  $('case-search').oninput=topicList;$('case-category').onchange=topicList;$('case-provenance').onclick=showProvenance;$('case-history').onclick=showHistory;
  $('case-select').onclick=async e=>{const id=e.target.closest('[data-case-id]')?.dataset.caseId;if(!id||id===current.id)return;const next=manifest.cases.find(c=>c.id===id);if(!next)return;current=next;task=freshTask();await loadCase(current,sequence);};
  document.querySelectorAll('[data-case-mode]').forEach(b=>b.onclick=()=>chooseMode(b.dataset.caseMode));
  document.querySelectorAll('[data-sequence]').forEach(b=>b.onclick=()=>{if(sequence!==b.dataset.sequence)loadCase(current,b.dataset.sequence,{preserve:true});});
  document.querySelectorAll('[data-case-plane]').forEach(b=>b.onclick=()=>setPlane(b.dataset.casePlane));
  $('case-window').oninput=windowChanged;$('case-level').oninput=windowChanged;$('case-window-reset').onclick=updateWindow;
  $('case-zoom').oninput=()=>{viewer.setZoom(Number($('case-zoom').value));$('case-zoom-value').textContent=$('case-zoom').value+'×';};
  $('case-reset').onclick=()=>{nearby?.clear();if(mode==='guided'&&task.guided)showGuidedSection();else if(mode==='explore'&&labels().length)locateTarget();else viewer.setPoint(current.initial_point);viewer.setZoom(1);$('case-zoom').value=1;$('case-zoom-value').textContent='1×';updateWindow();};
  for(const [i,a] of ['x','y','z'].entries())$('case-slice-'+a).oninput=()=>{const point=viewer.point;point[i]=Number($('case-slice-'+a).value);viewer.setPoint(point);};
  $('trace-back').onclick=()=>viewer.step(-1);$('trace-forward').onclick=()=>viewer.step(1);
  document.querySelectorAll('[data-trace-mark]').forEach(b=>b.onclick=()=>{if(loading||loadError||task.submitted)return;task.marks[b.dataset.traceMark]={point:viewer.point,plane:viewer.plane,sequence};b.setAttribute('aria-pressed','true');b.title=mm(viewer.point)+' mm';saveDraft();validateForm();$('trace-summary').textContent=`${Object.keys(task.marks).length}/3 지점 기록`;});
  $('compare-select').onchange=loadComparison;
  $('compare-landmarks').onclick=()=>{if(!comparison||comparison.busy||loading||loadError)return;const a=labels()[0];const b=comparison.current?.segmentation.labels.find(l=>l.structure===topic.id&&(l.side===side||l.side==='midline'));if(a)viewer.setPoint(a.anchor);if(b)comparison.setPoint(b.anchor);if(!task.hints.includes('comparison-anchor'))task.hints.push('comparison-anchor');saveDraft();};
  $('case-mri').addEventListener('pointerdown',e=>{down=e.button===0?{x:e.clientX,y:e.clientY,id:task?.id}:null;},true);
  $('case-mri').addEventListener('pointerup',e=>{const before=down;down=null;if(!before||Math.hypot(e.clientX-before.x,e.clientY-before.y)>5)return;setTimeout(()=>{
    if(!active||!task||loading||loadError||task.id!==before.id)return;
    const imagePoint=viewer.isImagePoint(e.clientX,e.clientY);
    if(mode==='explore'){
      anatomyMarker?.clear();nearby.clear();
      if(imagePoint){
        const point=viewer.point,labelId=viewer.referenceAt(point),label=current.segmentation.labels.find(l=>l.id===labelId);
        if(label&&topics.some(t=>t.id===label.structure)){side=label.side;chooseTopic(label.structure,{point});}
        else{unregisteredSelection=true;viewer.setMask([],false);$('case-label-state').textContent='라벨 없음';renderDetail();topicList();}
        nearby.search(viewer.planeAt(e.clientX,e.clientY),Number($('nearby-radius').value));
        selectSubjectPoint('mri',point,labelId);
      }
    }
    if(!task.submitted&&imagePoint&&lastPoint?.caseId===current.id){task.candidate={...structuredClone(lastPoint),label:viewer.referenceAt(lastPoint.mm)};validateForm();saveDraft();}
  },0);});
  $('nearby-clear').onclick=()=>nearby?.clear();
  $('nearby-radius').onchange=()=>{if(nearby?.searched)nearby.search(nearby.plane,Number($('nearby-radius').value));};
  setActive(false);
  const startupControls=[...document.querySelectorAll('#case-bar button,#case-bar select,#case-mri-content button,#case-mri-content input,#case-mri-content select')];startupControls.forEach(el=>el.disabled=true);
  try{
    const response=await fetch('assets/cases/manifest.json');if(!response.ok)throw new Error('manifest');manifest=await response.json();
    // Atlas metadata is optional: failure must not prevent native MRI practice.
    try{const r=await fetch('assets/roi-manifest.json');if(r.ok)atlasEntries=await r.json();}catch{}
    if(!manifest.cases?.length)throw new Error('empty manifest');
    current=manifest.cases.find(c=>c.cohort==='learning');task=freshTask();
    const restoredTask=restoreTask(savedState?.task,history);
    if(restoredTask&&manifest.cases.some(c=>c.id===savedState.caseId)&&topics.some(t=>t.id===savedState.topic)&&modes[savedState.mode]){
      current=manifest.cases.find(c=>c.id===savedState.caseId);topic=topics.find(t=>t.id===savedState.topic);mode=current.cohort==='transfer'?'transfer':savedState.mode==='transfer'?'guided':savedState.mode;side=['left','right','midline'].includes(savedState.side)?savedState.side:'left';sequence=['T1w','T2w'].includes(savedState.sequence)?savedState.sequence:'T1w';task={...freshTask(),...restoredTask};
      if(mode==='guided'&&!task.guided){try{localStorage.setItem(DRAFT_KEY+'-legacy',JSON.stringify(savedState));}catch{}task=freshTask();}
    }
    $('compare-select').insertAdjacentHTML('beforeend',manifest.cases.filter(c=>c.cohort==='learning').map(c=>`<option value="${c.id}">${c.title} · ${c.id} · 独立 좌표</option>`).join('').replaceAll('独立','독립'));
    viewer=await createCaseViewer({canvas:$('case-mri'),onLocation:updateLocation,onLoad:e=>loadState(e),onViewChange:()=>{nearby?.refresh();anatomyMarker?.refresh();publishScene();},onZoomChange:showZoom});
    anatomyMarker=createAnatomyMarker({canvas:$('case-mri'),viewer,statusRoot:$('case-detail'),scope:()=>viewer.current?.id+':'+sequence});
    nearby=createNearbyOverlay({canvas:$('case-mri'),viewer,labelName:id=>{const label=current.segmentation.labels.find(l=>l.id===id),t=topics.find(t=>t.id===label?.structure);return `${sideNames[label?.side]??''} ${t?.ko??label?.structure??''} · ${t?.en??''}`;},onChange:({count,searched})=>{$('nearby-clear').disabled=!searched;$('nearby-status').textContent=searched?(count?`${count}개 구조 · 노란 점에 마우스를 올려 이름을 확인하세요.`:'이 반경에는 등록된 구조가 없어요. 반경을 넓히거나 다른 곳을 클릭하세요.'):'영상을 클릭하면 주변 구조를 노란 점으로 표시합니다.';}});
    startupControls.forEach(el=>el.disabled=false);
    topicList();renderMode();setPlane(task.lastPlane??'axial');reference3D();
    await loadCase(current,sequence);if(!(mode==='guided'&&task.guided&&!restoredTask?.guided)&&savedState?.point&&Array.isArray(savedState.point)&&savedState.point.length===3&&savedState.point.every(Number.isFinite))viewer.setPoint(savedState.point);
    reference3D();
    // Read-only state makes data/interaction QA reproducible; no answer or scoring bypass.
    window.mriCaseQA={snapshot:()=>({active,caseId:current.id,topic:topic.id,mode,side,loading,loadError,unregisteredSelection,marker:anatomyMarker?.snapshot(),viewer:viewer.snapshot(),nearby:nearby?.snapshot(),comparison:comparison?.snapshot(),task:structuredClone(task),attemptCount:history.attempts.length}),manifest:()=>structuredClone(manifest),projectPoint:(point,plane)=>viewer.projectPoint(point,plane),pointOnSection:(point,plane)=>viewer.pointOnSection(point,plane,viewer.sectionDepth(viewer.point,plane)),referenceAt:point=>viewer.referenceAt(point),sliceEvidence:()=>viewer.sliceEvidence()};
  }catch(error){loading=false;loadError=true;$('case-loading').innerHTML='실제 MRI 자료를 열 수 없습니다. README의 자료 설치 단계를 확인하고 새로고침하세요.';$('case-detail').innerHTML='<h2>개인 영상 준비 필요</h2><p>사례 파일을 설치하면 실제 MRI 훈련을 시작할 수 있습니다.</p><a href="README.md">설치 안내</a>';console.error(error);}
  return {get active(){return active;},refresh(){updateHeader();reference3D();},
    illustrationState(){return {
      context:`individual:${current?.id}:${mode}:${task?.id}`,plane:viewer?.plane,point:viewer?.point,
      labels:current?.segmentation.labels??[],busy:loading||loadError||!viewer||viewer.busy||viewer.failed,
      revealed:mode==='explore'||Boolean(task?.submitted)||Boolean(task?.hints.includes('illustrations')),
      locked:mode==='transfer'&&!task?.submitted,comparison:mode==='compare',
    };},
    revealIllustration(){useHint('illustrations');},
  };
}
