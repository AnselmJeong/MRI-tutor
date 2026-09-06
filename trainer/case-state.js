export const HISTORY_KEY='mri-tutor-individual-v1';
export const DRAFT_KEY='mri-tutor-individual-draft-v1';
export const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const canScore=(task,label)=>Boolean(task?.status==='expert-verified' && task?.scoring==='validated-region' && task?.case_id===label?.case_id && task?.reference_space===label?.reference_space && label?.review_status==='expert-verified' && label?.review_log?.some(r=>r.role==='expert'&&r.decision==='approved') && label?.scoreable===true);
export function readHistory(storage){
  try{
    storage ??= globalThis.localStorage;
    const data=JSON.parse(storage.getItem(HISTORY_KEY));
    return {schema:1,exposures:Array.isArray(data?.exposures)?data.exposures.filter(x=>typeof x==='string'):[],attempts:Array.isArray(data?.attempts)?data.attempts.filter(x=>typeof x.id==='string'&&typeof x.caseId==='string'&&typeof x.topic==='string'&&['present','absent','indeterminate'].includes(x.status)&&typeof x.note==='string'&&Array.isArray(x.hints)&&x.hints.every(h=>typeof h==='string')&&x.marks&&typeof x.marks==='object'&&['left','right','midline'].includes(x.side)&&['T1w','T2w'].includes(x.sequence)&&Array.isArray(x.point)&&x.point.length===3&&x.point.every(Number.isFinite)&&['axial','coronal','sagittal','multi'].includes(x.plane)).slice(-1000):[]};
  }catch{return {schema:1,exposures:[],attempts:[]};}
}
export function appendFirst(history,attempt){
  if(history.attempts.some(x=>x.id===attempt.id))return false;
  // The installed pilot has no expert-verified answer keys. Never persist a fabricated score.
  history.attempts.push({...attempt,score:null,feedbackType:'reference-only'});
  history.attempts=history.attempts.slice(-1000);return true;
}
export function writeHistory(history,storage){try{storage ??= globalThis.localStorage;storage.setItem(HISTORY_KEY,JSON.stringify(history));return true;}catch{return false;}}
export function referenceFeedback(attempt,labels,topic){
  const target=labels.find(l=>l.structure===topic.id&&(l.side===attempt.side||l.side==='midline'));
  const axis={axial:2,coronal:1,sagittal:0}[attempt.plane];
  if(!target)return {target:null,range:null,comparison:'이 구조에는 개인 참고 라벨이 없습니다. 주변 랜드마크와 본인의 설명을 대조하세요.'};
  const inside=axis==null?null:attempt.point[axis]>=target.bounds[0][axis]&&attempt.point[axis]<=target.bounds[1][axis];
  return {target,range:axis==null?null:[target.bounds[0][axis],target.bounds[1][axis]],comparison:inside===false?'제출한 깊이는 자동 분할의 전체 단면 범위 밖입니다. 실제 부재의 검수된 정답은 아니며, 다른 방향과 연속 단면에서 다시 확인하세요.':inside===true?'제출한 깊이는 자동 분할의 전체 단면 범위 안입니다. 범위 안이라는 사실만으로 현재 단면에서 경계가 보인다고 판단할 수는 없습니다.':'3면 관찰을 기록했습니다. 단면 내 존재 판단은 한 방향을 크게 열어 다시 확인하세요.'};
}
export function traceReady(marks){
  const points=['appearance','body','disappearance'].map(k=>marks?.[k]);
  if(points.some(p=>!p||!['axial','coronal','sagittal'].includes(p.plane)||!Array.isArray(p.point)||!p.point.every(Number.isFinite)))return false;
  if(new Set(points.map(p=>p.plane)).size!==1)return false;
  const axis={axial:2,coronal:1,sagittal:0}[points[0].plane];
  const values=points.map(p=>p.point[axis]);
  return Math.abs(values[0]-values[1])>=.5&&Math.abs(values[1]-values[2])>=.5&&(values[1]-values[0])*(values[2]-values[1])>0;
}
export function restoreTask(value,history){
  const point=p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite);
  const strings=p=>Array.isArray(p)&&p.every(x=>typeof x==='string');
  if(!value||typeof value.id!=='string'||typeof value.note!=='string'||!strings(value.hints)||!value.marks||!value.visited)return null;
  if(Object.values(value.marks).some(m=>!m||!point(m.point)||!['axial','coronal','sagittal','multi'].includes(m.plane)))return null;
  if(Object.values(value.visited).some(v=>!Array.isArray(v)||!v.every(Number.isFinite)))return null;
  return {id:value.id,note:value.note.slice(0,2000),hints:value.hints.slice(0,30),helpUsed:strings(value.helpUsed)?value.helpUsed.slice(0,30):[],marks:value.marks,visited:value.visited,status:['present','absent','indeterminate'].includes(value.status)?value.status:'',confidence:['uncertain','partial','confident'].includes(value.confidence)?value.confidence:'uncertain',novel:value.novel===true,comparisonUsed:value.comparisonUsed===true,candidate:null,lastPlane:['axial','coronal','sagittal','multi'].includes(value.lastPlane)?value.lastPlane:undefined,startedAt:typeof value.startedAt==='string'?value.startedAt:new Date().toISOString(),submitted:history.attempts.find(a=>a.id===value.id)??null};
}
