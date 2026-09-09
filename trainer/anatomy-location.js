// Search the displayed native slice, sampling only the registered label masks.
// Never reuse a standard-space coordinate for an individual scan.
export function labelAt(image, world) {
  const v=Array.from(image.mm2vox(world));
  return v.some((n,i)=>!Number.isFinite(n)||n<0||n>=image.dimsRAS[i+1])?0:Number(image.getValue(...v))||0;
}
export function locateOnSlice({base,masks,point,plane}) {
  if(!base||!masks.length)return null;
  const axis={axial:2,coronal:1,sagittal:0,multi:2}[plane],axes=[0,1,2].filter(i=>i!==axis);
  const origin=Array.from(base.mm2vox(point,true)),width=base.dimsRAS[axes[0]+1],height=base.dimsRAS[axes[1]+1];
  const hits=new Uint8Array(width*height),worldAt=(x,y)=>{const v=[...origin];v[axes[0]]=x;v[axes[1]]=y;return Array.from(base.vox2mm(v,base.matRAS));};
  const contains=world=>masks.some(m=>m.ids.includes(labelAt(m.image,world)));
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(contains(worldAt(x,y)))hits[y*width+x]=1;
  let best=null,bestSupport=-1,bestDistance=Infinity;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    if(!hits[y*width+x])continue;
    let support=0;
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(x+dx>=0&&x+dx<width&&y+dy>=0&&y+dy<height)support+=hits[(y+dy)*width+x+dx];
    const world=worldAt(x,y),distance=Math.hypot(...world.map((v,i)=>v-point[i]));
    if(support>bestSupport||(support===bestSupport&&distance<bestDistance)){best=world;bestSupport=support;bestDistance=distance;}
  }
  if(best)return {point:best,moved:false};
  // Anchors come from the same mask metadata and are checked against its voxels.
  const anchors=masks.flatMap(m=>(m.anchors??[]).filter(p=>m.ids.includes(labelAt(m.image,p))));
  anchors.sort((a,b)=>Math.hypot(...a.map((v,i)=>v-point[i]))-Math.hypot(...b.map((v,i)=>v-point[i])));
  return anchors.length?{point:[...anchors[0]],moved:true}:null;
}
