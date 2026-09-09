export function createAnatomyMarker({canvas,viewer,scope,statusRoot}) {
  const layer=document.createElement('div');layer.className='anatomy-marker-layer';layer.setAttribute('aria-hidden','true');canvas.parentElement.append(layer);
  let marked=null,lastVisible=0;
  function clear(){marked=null;lastVisible=0;layer.replaceChildren();}
  function refresh(){
    layer.replaceChildren();if(!marked)return;
    if(marked.scope!==scope()||viewer.busy||viewer.failed){clear();return;}
    for(const plane of viewer.plane==='multi'?['axial','coronal','sagittal']:[viewer.plane]){
      const p=viewer.projectPoint(marked.point,plane);if(!p)continue;
      const ring=document.createElement('span');ring.className='anatomy-marker';ring.style.left=p[0]+'px';ring.style.top=p[1]+'px';layer.append(ring);
    }
    const visible=layer.children.length,status=statusRoot?.querySelector('.anatomy-status');
    if(status&&visible!==lastVisible)status.textContent=visible?(status.dataset.activeMessage??status.textContent):'표시 위치가 현재 단면에 없습니다. 용어를 눌러 다시 찾으세요.';
    lastVisible=visible;
  }
  return {clear,refresh,show(point,name){marked={point:[...point],name,scope:scope()};refresh();},snapshot:()=>marked?{...marked,point:[...marked.point],visible:layer.children.length}:null};
}
export function anatomyStatus(root,message){
  let status=root.querySelector('.anatomy-status');
  if(!status){status=document.createElement('p');status.className='anatomy-status';status.setAttribute('role','status');const heading=root.querySelector('h2');if(heading)heading.after(status);else root.append(status);}
  status.textContent=message;status.dataset.activeMessage=message;
}
