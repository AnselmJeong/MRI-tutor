import * as THREE from 'three';
import {GLTFLoader} from '../vendor/GLTFLoader.js';
import {fetchVerified} from './asset-integrity.js';

export function disposeObject(root) {
  const geometries=new Set(),materials=new Set(),textures=new Set();
  root.traverse(object=>{
    if(object.geometry)geometries.add(object.geometry);
    for(const m of Array.isArray(object.material)?object.material:object.material?[object.material]:[]) {
      materials.add(m);for(const value of Object.values(m))if(value?.isTexture)textures.add(value);
    }
  });
  root.removeFromParent();textures.forEach(t=>t.dispose());materials.forEach(m=>m.dispose());geometries.forEach(g=>g.dispose());
  root.clear();
}
export async function loadSubjectMeshes(pack,signal) {
  const loader=new GLTFLoader(),root=new THREE.Group();
  let offset=0;
  const jobs=Array.from({length:Math.min(4,pack.representations.length)},async()=>{
    while(offset<pack.representations.length) {
      if(signal.aborted)throw new DOMException('Cancelled','AbortError');
      const rep=pack.representations[offset++];
      const bytes=await fetchVerified(rep.mesh.url,rep.mesh.sha256,signal);
      if(bytes.byteLength!==rep.mesh.bytes)throw new Error('GLB 크기 불일치');
      const gltf=await loader.parseAsync(bytes,'');
      const group=gltf.scene;root.add(group);
      if(signal.aborted)throw new DOMException('Cancelled','AbortError');
      // glTF is in meters. Preserve node transforms before the single unit conversion.
      group.scale.multiplyScalar(1000);group.updateMatrixWorld(true);
      let count=0;
      group.traverse(mesh=>{
        if(!mesh.isMesh)return;
        count++;
        const meta=mesh.userData;
        if(meta.caseId!==pack.caseId||meta.spaceId!==pack.space.id||meta.representationId!==rep.id||meta.unit!=='m')throw new Error('GLB 공간 metadata 불일치');
        mesh.geometry.computeVertexNormals();
        const old=mesh.material;mesh.material=new THREE.MeshStandardMaterial({color:'#9cac96',roughness:.64,side:THREE.DoubleSide});
        (Array.isArray(old)?old:[old]).forEach(m=>m.dispose());
        mesh.userData={...meta,representation:rep,structure:pack.structures.find(s=>s.id===rep.structureId)};
      });
      if(count!==1)throw new Error('GLB 구조 개수 불일치');
      const box=new THREE.Box3().setFromObject(group),bounds=[box.min.toArray(),box.max.toArray()];
      if(bounds.some((b,j)=>b.some((n,i)=>!Number.isFinite(n)||Math.abs(n-rep.bounds[j][i])>.001)))throw new Error('GLB mm 범위 불일치');
    }
  });
  const outcomes=await Promise.allSettled(jobs);
  const failure=outcomes.find(r=>r.status==='rejected');
  if(failure){disposeObject(root);throw failure.reason;}
  return root;
}
