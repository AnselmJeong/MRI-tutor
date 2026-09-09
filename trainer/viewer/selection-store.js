import {point3,sameSpace} from './space-registry.js';

/** Monotonic events; consumers apply state without publishing it back. */
export function createSelectionStore() {
  let context=null, revision=0, value=null;
  const listeners=new Set();
  return {
    setContext(next) {if(context?.caseId!==next.caseId || context?.spaceId!==next.spaceId){context={...next};value=null;revision++;}},
    publish(event) {
      if (!context || event.caseId!==context.caseId || !sameSpace(event.spaceId,context.spaceId) || (event.pointMm!=null&&!point3(event.pointMm)) || !['mri','mesh','list'].includes(event.source)) return false;
      value=Object.freeze({...event,pointMm:event.pointMm?[...event.pointMm]:null,revision:++revision});
      for (const fn of listeners) fn(value);
      return true;
    },
    subscribe(fn) {listeners.add(fn);return ()=>listeners.delete(fn);},
    snapshot() {return value?structuredClone(value):null;}
  };
}
