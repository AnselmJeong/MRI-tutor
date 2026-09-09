// Keep both renderers mounted so resizing does not reset anatomy or camera state.
export function createSplitView(){
 const area=document.getElementById('viewer-split');
 const handle=document.getElementById('viewer-divider');
 const three=document.getElementById('three-pane');
 const mri=document.getElementById('mri-pane');
 const key='mri-tutor-view-split-width-v2';
 const defaultRatio=40;
 let ratio=defaultRatio,lastShared=defaultRatio,drag=null;
 try{const saved=JSON.parse(localStorage.getItem(key));if(saved&&Number.isFinite(saved.ratio)&&saved.ratio>=0&&saved.ratio<=100)ratio=saved.ratio;if(saved&&Number.isFinite(saved.shared)&&saved.shared>0&&saved.shared<100)lastShared=saved.shared;}catch{}
 function save(){try{localStorage.setItem(key,JSON.stringify({ratio,shared:lastShared}));}catch{}}
 function render(){
  const horizontal=area.clientWidth>=640;
  area.dataset.splitAxis=horizontal?'x':'y';
  const divider=horizontal?24:32;
  const room=Math.max(0,(horizontal?area.clientWidth:area.clientHeight)-divider);
  const tracks=`${room*ratio/100}px ${divider}px ${room*(100-ratio)/100}px`;
  area.style.gridTemplateColumns=horizontal?tracks:'minmax(0, 1fr)';
  area.style.gridTemplateRows=horizontal?'minmax(0, 1fr)':tracks;
  three.hidden=ratio===0;mri.hidden=ratio===100;
  area.classList.toggle('compact-three',room*ratio/100<(horizontal?240:150));
  area.classList.toggle('compact-mri',room*(100-ratio)/100<(horizontal?300:250));
  area.dataset.splitView=ratio===0?'mri':ratio===100?'three':'linked';
  handle.setAttribute('aria-orientation',horizontal?'vertical':'horizontal');
  handle.setAttribute('aria-label',`3D와 MRI ${horizontal?'너비':'높이'} 조절`);
  handle.title=`${horizontal?'좌우로 드래그 · ←→ 너비':'위아래로 드래그 · ↑↓ 높이'} 조절 · Home MRI만 · End 3D만 · Enter 양쪽 복원 · 두 번 클릭 기본 배치`;
  handle.setAttribute('aria-valuenow',String(Math.round(ratio)));
  handle.setAttribute('aria-valuetext',`3D ${Math.round(ratio)}%, MRI ${Math.round(100-ratio)}%`);
  document.getElementById('split-value').textContent=ratio===0?'MRI만':ratio===100?'3D만':`3D ${Math.round(ratio)} · MRI ${Math.round(100-ratio)}`;
  handle.querySelector('.split-hint').textContent=horizontal?'↔ 너비 조절':'↕ 높이 조절';
  document.querySelectorAll('[data-workspace]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.workspace===area.dataset.splitView)));
 }
 function set(value,{persist=true}={}){
  ratio=Math.max(0,Math.min(100,value));if(ratio>0&&ratio<100)lastShared=ratio;
  render();if(persist)save();
 }
 handle.addEventListener('pointerdown',e=>{
  if(e.button!==0)return;e.preventDefault();handle.focus();
  const horizontal=area.dataset.splitAxis==='x';
  drag={id:e.pointerId,horizontal,start:horizontal?e.clientX:e.clientY,startRatio:ratio};handle.setPointerCapture(e.pointerId);area.classList.add('resizing');
 });
 handle.addEventListener('pointermove',e=>{
  if(!drag||e.pointerId!==drag.id)return;
  const room=drag.horizontal?area.clientWidth-handle.offsetWidth:area.clientHeight-handle.offsetHeight;
  if(room<=0)return;
  const value=drag.startRatio+((drag.horizontal?e.clientX:e.clientY)-drag.start)/room*100;
  set(value<5?0:value>95?100:value,{persist:false});
 });
 const finish=()=>{if(!drag)return;drag=null;area.classList.remove('resizing');save();};
 handle.addEventListener('pointerup',finish);handle.addEventListener('pointercancel',finish);handle.addEventListener('lostpointercapture',finish);
 handle.addEventListener('keydown',e=>{
  let value;
  const horizontal=area.dataset.splitAxis==='x';
  if(e.key===(horizontal?'ArrowLeft':'ArrowUp'))value=ratio-(e.shiftKey?10:2);
  else if(e.key===(horizontal?'ArrowRight':'ArrowDown'))value=ratio+(e.shiftKey?10:2);
  else if(e.key==='Home')value=0;
  else if(e.key==='End')value=100;
  else if(e.key==='Enter')value=lastShared;
  else return;e.preventDefault();set(value);
 });
 handle.addEventListener('dblclick',()=>set(defaultRatio));
 new ResizeObserver(render).observe(area);render();
 return {show(view){set(view==='mri'?0:view==='three'?100:lastShared);}};
}
