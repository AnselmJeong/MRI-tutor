// These are location exercises against a subject's reference mask, not clinical scores.
// Start with gross anatomical landmarks, not inferred cortical/functional parcels.
export const guidedTopicIds=['hippocampus','caudate','putamen','pallidum','thalamus','insula','cingulate','ventricle','callosum'];
export const planeAxes={axial:2,coronal:1,sagittal:0};
export function pickGuidedTarget(topics,labels,previous,random=Math.random){
  const available=topics.filter(t=>labels.some(l=>l.structure===t.id));
  const pool=available.filter(t=>t.id!==previous);
  const choices=pool.length?pool:available;
  const topic=choices[Math.min(choices.length-1,Math.floor(random()*choices.length))];
  if(!topic)return null;
  const sides=labels.filter(l=>l.structure===topic.id);
  return {topic,label:sides[Math.min(sides.length-1,Math.floor(random()*sides.length))]};
}

export function buildGuidedSections(label,preferredPlane,referenceAt,geometry=null){
  // Sample in the displayed native slice frame; a tilted image is not world-axis aligned.
  // Bounds alone cannot establish that a particular slice contains the structure.
  const bins=[new Map(),new Map(),new Map()];
  const bounds=geometry?.bounds??label.bounds,anchor=geometry?.anchor??label.anchor;
  const toWorld=geometry?.toWorld??(p=>p);
  const lo=bounds[0].map(Math.floor),hi=bounds[1].map(Math.ceil);
  for(let x=lo[0];x<=hi[0];x++)for(let y=lo[1];y<=hi[1];y++)for(let z=lo[2];z<=hi[2];z++){
    const point=[x,y,z];if(referenceAt(toWorld(point))!==label.id)continue;
    for(let axis=0;axis<3;axis++){
      const depth=point[axis];if(!bins[axis].has(depth))bins[axis].set(depth,[]);
      bins[axis].get(depth).push(point);
    }
  }
  const planes=[preferredPlane,...Object.keys(planeAxes).filter(p=>p!==preferredPlane)];
  return planes.flatMap(plane=>{
    const axis=planeAxes[plane],uv=[0,1,2].filter(i=>i!==axis);
    const entries=[...bins[axis]].sort((a,b)=>b[1].length-a[1].length||Math.abs(a[0]-anchor[axis])-Math.abs(b[0]-anchor[axis]));
    if(!entries.length||entries[0][1].length<9)return [];
    const [depth,points]=entries[0],key=p=>`${p[uv[0]]},${p[uv[1]]}`;
    const remaining=new Map(points.map(p=>[key(p),p]));
    let interior=points;
    // Peel boundary pixels to choose an actual interior location, even for curved/disjoint masks.
    while(remaining.size){
      const edge=[...remaining.values()].filter(p=>[[1,0],[-1,0],[0,1],[0,-1]].some(([u,v])=>!remaining.has(`${p[uv[0]]+u},${p[uv[1]]+v}`)));
      if(!edge.length)break;
      interior=[...remaining.values()];edge.forEach(p=>remaining.delete(key(p)));
    }
    const center=points.reduce((sum,p)=>sum.map((v,i)=>v+p[i]/points.length),[0,0,0]);
    interior.sort((a,b)=>a.reduce((s,v,i)=>s+(v-center[i])**2,0)-b.reduce((s,v,i)=>s+(v-center[i])**2,0));
    return [{plane,depth,answer:[...toWorld(interior[0])],sampleCount:points.length}];
  });
}

export function guidedLocationFeedback(point,label,section,referenceAt,geometry=null){
  if(!point)return {kind:'revealed',title:'괜찮아요. 표시된 위치부터 함께 살펴보세요.',message:'색칠된 영역이 이번에 찾을 구조입니다. 십자선은 그 안의 한 지점을 가리킵니다.'};
  const axis=planeAxes[section.plane];
  const hit=referenceAt(point);
  if(hit===label.id)return {kind:'match',title:'잘 찾았어요!',message:'찍은 점이 찾을 구조의 참고 영역 안에 있습니다. 주변 구조와의 관계를 확인하고 다음 단면에서도 찾아보세요.'};
  // A small in-plane neighbourhood avoids calling an uncertain edge a definite error.
  const uv=[0,1,2].filter(i=>i!==axis);
  const origin=geometry?.fromWorld(point)??point;
  for(let u=-2;u<=2;u++)for(let v=-2;v<=2;v++){
    if(u*u+v*v>4)continue;
    const p=[...origin];p[uv[0]]+=u;p[uv[1]]+=v;
    if(referenceAt(geometry?.toWorld(p)??p)===label.id)return {kind:'near',title:'경계 가까이까지 찾았어요.',message:'찍은 점은 참고 영역의 경계에서 약 2 mm 이내입니다. 색칠된 영역과 십자선을 보고 조금 더 안쪽을 확인해보세요.'};
  }
  return {kind:'miss',title:'찾을 위치와 조금 달라요. 함께 다시 볼까요?',message:'색칠된 영역이 찾을 구조이고, 십자선은 그 안의 한 지점입니다. 아래 설명을 따라 주변 구조부터 다시 찾아보세요.',hit};
}
