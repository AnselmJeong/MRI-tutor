// Capture before NiiVue's ordinary wheel handler so Command never scrolls slices.
export function installCommandWheelZoom({canvas,canZoom,getPan,setPan,onZoom=()=>{}}){
  canvas.parentElement.addEventListener('wheel',event=>{
    if(!event.metaKey)return;
    event.preventDefault();event.stopImmediatePropagation();
    if(!canZoom()||!Number.isFinite(event.deltaY)||event.deltaY===0)return;
    const pixels=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?canvas.clientHeight:1);
    const pan=Array.from(getPan());
    const zoom=Math.max(1,Math.min(4,pan[3]*Math.exp(-Math.max(-200,Math.min(200,pixels))*.002)));
    if(zoom===pan[3])return;
    pan[3]=zoom;setPan(pan);onZoom(zoom);
  },{capture:true,passive:false});
}
