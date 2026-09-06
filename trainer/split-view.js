// Keep both renderers mounted so resizing does not reset anatomy or camera state.
export function createSplitView(){
 const area=document.getElementById('viewer-split');
 const handle=document.getElementById('viewer-divider');
 const top=document.getElementById('three-pane');
 const bottom=document.getElementById('mri-pane');
 const key='mri-tutor-view-split-v1';
 let ratio=30,lastShared=30,drag=null;
 try{const saved=JSON.parse(localStorage.getItem(key));if(saved&&Number.isFinite(saved.ratio)&&saved.ratio>=0&&saved.ratio<=100)ratio=saved.ratio;if(saved&&Number.isFinite(saved.shared)&&saved.shared>0&&saved.shared<100)lastShared=saved.shared;}catch{}
 function save(){try{localStorage.setItem(key,JSON.stringify({ratio,shared:lastShared}));}catch{}}
 function render(){
  const room=Math.max(0,area.clientHeight-handle.offsetHeight);
  area.style.gridTemplateRows=`${room*ratio/100}px ${handle.offsetHeight}px ${room*(100-ratio)/100}px`;
  top.hidden=ratio===0;bottom.hidden=ratio===100;
  area.classList.toggle('compact-three',room*ratio/100<150);
  area.classList.toggle('compact-mri',room*(100-ratio)/100<250);
  area.dataset.splitView=ratio===0?'mri':ratio===100?'three':'linked';
  handle.setAttribute('aria-valuenow',String(Math.round(ratio)));
  handle.setAttribute('aria-valuetext',`3D ${Math.round(ratio)}%, MRI ${Math.round(100-ratio)}%`);
  document.getElementById('split-value').textContent=ratio===0?'MRI만 · 아래로 끌면 3D 복원':ratio===100?'3D만 · 위로 끌면 MRI 복원':`3D ${Math.round(ratio)} · MRI ${Math.round(100-ratio)}`;
  document.querySelectorAll('[data-workspace]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.workspace===area.dataset.splitView)));
 }
 function set(value,{persist=true}={}){
  ratio=Math.max(0,Math.min(100,value));if(ratio>0&&ratio<100)lastShared=ratio;
  render();if(persist)save();
 }
 handle.addEventListener('pointerdown',e=>{
  if(e.button!==0)return;e.preventDefault();handle.focus();
  drag={id:e.pointerId,startY:e.clientY,startRatio:ratio};handle.setPointerCapture(e.pointerId);area.classList.add('resizing');
 });
 handle.addEventListener('pointermove',e=>{
  if(!drag||e.pointerId!==drag.id)return;
  const room=area.clientHeight-handle.offsetHeight;
  const value=drag.startRatio+(e.clientY-drag.startY)/room*100;
  set(value<5?0:value>95?100:value,{persist:false});
 });
 const finish=()=>{if(!drag)return;drag=null;area.classList.remove('resizing');save();};
 handle.addEventListener('pointerup',finish);handle.addEventListener('pointercancel',finish);handle.addEventListener('lostpointercapture',finish);
 handle.addEventListener('keydown',e=>{
  let value;
  if(e.key==='ArrowUp')value=ratio-(e.shiftKey?10:2);
  else if(e.key==='ArrowDown')value=ratio+(e.shiftKey?10:2);
  else if(e.key==='Home')value=0;
  else if(e.key==='End')value=100;
  else if(e.key==='Enter')value=lastShared;
  else return;e.preventDefault();set(value);
 });
 handle.addEventListener('dblclick',()=>set(30));
 new ResizeObserver(render).observe(area);render();
 return {show(view){set(view==='mri'?0:view==='three'?100:lastShared);}};
}
