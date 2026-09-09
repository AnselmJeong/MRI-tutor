const axes={axial:2,coronal:1,sagittal:0};

// Each marker is a sampled point in a registered mask on the clicked native plane.
// The disk is measured in physical millimetres, independently of screen zoom.
export function findNearbyStructures({center,plane,radius,labels,fromWorld,toWorld,referenceAt}){
  if(!(plane in axes)||!Number.isFinite(radius)||radius<=0||radius>50)return [];
  const known=new Set(labels.map(l=>l.id)),origin=fromWorld(center),uv=[0,1,2].filter(i=>i!==axes[plane]);
  const samples=new Map(),groups=new Map();
  for(let u=-Math.floor(radius);u<=radius;u++)for(let v=-Math.floor(radius);v<=radius;v++){
    if(u*u+v*v>radius*radius)continue;
    const local=[...origin];local[uv[0]]+=u;local[uv[1]]+=v;
    const point=toWorld(local),distance=Math.hypot(...point.map((n,i)=>n-center[i]));
    if(distance>radius+.001)continue;
    const id=referenceAt(point);if(!known.has(id))continue;
    const sample={id,u,v,point,distance};samples.set(`${u},${v}`,sample);
    if(!groups.has(id))groups.set(id,[]);groups.get(id).push(sample);
  }
  return [...groups].map(([id,points])=>{
    // Prefer an interior sample, then the one nearest the click. This separates
    // neighbouring regions' dots without inventing a centre outside a curved mask.
    for(const p of points){p.support=0;for(let u=-2;u<=2;u++)for(let v=-2;v<=2;v++)if(samples.get(`${p.u+u},${p.v+v}`)?.id===id)p.support++;}
    points.sort((a,b)=>b.support-a.support||a.distance-b.distance);
    const {point,distance}=points[0];return {id,point,distance,plane};
  }).sort((a,b)=>a.distance-b.distance||a.id-b.id);
}

export function createNearbyOverlay({canvas,viewer,labelName,onChange=()=>{}}){
  const layer=document.createElement('div');layer.className='nearby-markers';layer.setAttribute('aria-label','클릭 지점 주변 구조');
  const tooltip=document.createElement('div');tooltip.id='nearby-tooltip';tooltip.className='nearby-tooltip';tooltip.setAttribute('role','tooltip');tooltip.hidden=true;
  canvas.parentElement.append(layer,tooltip);
  let center=null,plane=null,items=[],buttons=[],frame=0,activeButton=null;
  function hideTip(){tooltip.hidden=true;activeButton=null;buttons.forEach(b=>b.removeAttribute('aria-describedby'));}
  function showTip(button,item){
    hideTip();activeButton=button;button.setAttribute('aria-describedby',tooltip.id);
    tooltip.textContent=labelName(item.id);
    tooltip.hidden=false;positionTip();
  }
  function positionTip(){
    if(!activeButton||activeButton.hidden){hideTip();return;}
    const bounds=layer.getBoundingClientRect(),r=activeButton.getBoundingClientRect();
    const x=r.left-bounds.left+r.width/2,y=r.top-bounds.top;
    tooltip.style.left=`${Math.max(8,Math.min(bounds.width-tooltip.offsetWidth-8,x-tooltip.offsetWidth/2))}px`;
    tooltip.style.top=`${y>tooltip.offsetHeight+16?y-tooltip.offsetHeight-8:Math.min(bounds.height-tooltip.offsetHeight-8,y+r.height+8)}px`;
  }
  function render(){
    frame=0;
    if(!center)return;
    const positions=items.map(item=>viewer.projectPoint(item.point,plane));
    positions.forEach((p,i)=>{
      const button=buttons[i];button.hidden=!p;if(!p)return;
      // Large invisible hit boxes must not cover a neighbouring visible dot.
      const nearest=Math.min(Infinity,...positions.flatMap((q,j)=>q&&i!==j?[Math.max(Math.abs(p[0]-q[0]),Math.abs(p[1]-q[1]))]:[]));
      const size=Math.min(24,nearest*1.5);
      button.style.width=`${size}px`;button.style.height=`${size}px`;
      button.style.left=`${p[0]}px`;button.style.top=`${p[1]}px`;
    });
    if(activeButton)positionTip();
  }
  function refresh(){if(center&&!frame)frame=requestAnimationFrame(render);}
  function clear(){cancelAnimationFrame(frame);frame=0;center=null;plane=null;items=[];buttons=[];layer.replaceChildren();hideTip();onChange({count:0,searched:false});}
  function search(orientation,radius){
    clear();if(!orientation||viewer.busy||viewer.failed)return;
    center=viewer.point;plane=orientation;
    items=findNearbyStructures({center,plane,radius,labels:viewer.current.segmentation.labels,...viewer.sliceFrame,referenceAt:p=>viewer.referenceAt(p)});
    buttons=items.map(item=>{
      const button=document.createElement('button');button.type='button';button.className='nearby-dot';button.dataset.labelId=String(item.id);button.setAttribute('aria-label',labelName(item.id));
      button.addEventListener('pointerenter',()=>showTip(button,item));button.addEventListener('pointerleave',()=>{if(document.activeElement!==button)hideTip();});
      button.addEventListener('focus',()=>showTip(button,item));button.addEventListener('blur',hideTip);
      button.addEventListener('click',e=>{e.stopPropagation();showTip(button,item);});
      button.addEventListener('keydown',e=>{if(e.key==='Escape'){hideTip();canvas.focus();}});
      layer.append(button);return button;
    });
    render();onChange({count:items.length,searched:true,plane});
  }
  // Native panning and contrast gestures complete after the input event. Reproject
  // on the next frame, without retaining an animation loop while the viewer is idle.
  canvas.addEventListener('pointermove',refresh);canvas.addEventListener('wheel',refresh,{passive:true});
  return {search,clear,refresh,
    locationChanged(point){if(center&&point.some((v,i)=>Math.abs(v-center[i])>.01))clear();},
    get plane(){return plane;},get searched(){return center!==null;},
    snapshot(){return {center:center&&[...center],plane,items:structuredClone(items)};}
  };
}
