import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {validateSubjectPack,subjectSpaceId,sameSpace,transformPoint,volumeCorners} from '../trainer/viewer/space-registry.js';
import {readHistory,appendFirst,appendHelpEvent,writeHistory} from '../trainer/case-state.js';
import {createSelectionStore} from '../trainer/viewer/selection-store.js';
import {nativeSliceFrame,framePoint,planeDistance,visibleAtPlane,extractNativeSlab,grayscaleSlice} from '../trainer/viewer/slice-adapter.js';
import {sha256Fallback} from '../trainer/viewer/asset-integrity.js';
const manifest=JSON.parse(fs.readFileSync('trainer/assets/cases/manifest.json'));
const index=JSON.parse(fs.readFileSync('trainer/assets/packs/subject-core/current.json'));
const readPack=caseId=>JSON.parse(fs.readFileSync('trainer/'+index.cases.find(c=>c.caseId===caseId).url));
const near=(a,b,tolerance=.0001)=>a.forEach((n,i)=>assert.ok(Math.abs(n-b[i])<tolerance,`${n} != ${b[i]}`));

test('four immutable subject packs preserve identities, label definitions, source hashes and meters',()=>{
  for(const c of manifest.cases){
    const pack=readPack(c.id);validateSubjectPack(pack,c);assert.equal(pack.representations.length,18);
    for(const r of pack.representations){
      const bytes=fs.readFileSync('trainer/'+r.mesh.url);
      assert.equal(createHash('sha256').update(bytes).digest('hex'),r.mesh.sha256);
      assert.equal(bytes.readUInt32LE(0),0x46546c67);assert.equal(bytes.readUInt32LE(8),bytes.length);
      const jsonSize=bytes.readUInt32LE(12),doc=JSON.parse(bytes.subarray(20,20+jsonSize));
      assert.equal(doc.nodes[0].extras.spaceId,subjectSpaceId(c.id));
      const positionStart=28+jsonSize,count=doc.accessors[0].count;
      const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
      for(let i=0;i<count;i++)for(let axis=0;axis<3;axis++){
        const value=bytes.readFloatLE(positionStart+(i*3+axis)*4)*1000;
        assert.ok(Number.isFinite(value));min[axis]=Math.min(min[axis],value);max[axis]=Math.max(max[axis],value);
      }
      near(min,r.bounds[0]);near(max,r.bounds[1]);
      const idxStart=positionStart+doc.bufferViews[1].byteOffset;
      for(let i=0;i<doc.accessors[1].count;i++)assert.ok(bytes.readUInt32LE(idxStart+i*4)<count);
    }
  }
});
test('space contract rejects another person, template, definition, image or scoring promotion',()=>{
  const c=manifest.cases[0],original=readPack(c.id);
  const mutations=[p=>p.caseId='sub-02',p=>p.space.id='template:MNI152NLin2009cAsym:RAS-mm',p=>p.space.unit='m',p=>p.space.referenceImageHash='wrong',p=>p.representations[0].assessmentUse='scoreable',p=>p.representations[0].sourceLabelIds=[53],p=>p.representations[0].interiorAnchor=[0,0,0],p=>p.volumes[0].voxelToWorld[0][0]*=-1];
  for(const mutate of mutations){const pack=structuredClone(original);mutate(pack);assert.throws(()=>validateSubjectPack(pack,c));}
  assert.equal(sameSpace(subjectSpaceId('sub-01'),subjectSpaceId('sub-02')),false);
});
test('native slice basis includes obliquity, reflections, all eight corners and half voxel edges',()=>{
  const matrix=[[-2,.3,0,70],[0,1.5,.4,-30],[.2,0,3,10],[0,0,0,1]],shape=[8,9,10],voxel=[2.25,4.5,6.75];
  for(const plane of ['axial','coronal','sagittal']){
    const frame=nativeSliceFrame({spaceId:'fixture',shape,voxel,plane,voxelToWorld:p=>transformPoint(matrix,p)});
    const center=framePoint(frame,(voxel[frame.uAxis]+.5)/frame.width,(voxel[frame.vAxis]+.5)/frame.height);
    near(center,transformPoint(matrix,voxel));assert.ok(Math.abs(planeDistance(frame,center))<1e-9);
    for(const x of [0,.25,1])for(const y of [0,.75,1])assert.ok(Math.abs(planeDistance(frame,framePoint(frame,x,y)))<1e-9);
    const hidden=center.map((n,i)=>n-frame.normal[i]);assert.equal(visibleAtPlane(frame,hidden),false);assert.equal(visibleAtPlane(frame,hidden,-1),true);
  }
  const corners=volumeCorners(shape,matrix);assert.equal(corners.length,8);near(corners[7],transformPoint(matrix,[7,8,9]));
});
test('slice slab reads x-fastest native storage through a reflected permutation without a volume copy',()=>{
  // Native dims 2x3x4; RAS axes are native z, reversed native x, native y.
  const image={img:new Int16Array(Array.from({length:24},(_,i)=>i-7)),img2RASstep:[6,-1,2],img2RASstart:[0,1,0],hdr:{scl_slope:2,scl_inter:-10},cal_min:-24,cal_max:22};
  const frame=nativeSliceFrame({spaceId:'fixture',shape:[4,2,3],voxel:[1,0,1],plane:'axial',voxelToWorld:p=>p});
  const slab=extractNativeSlab(image,frame);assert.equal(slab.values.length,8);
  assert.deepEqual([...slab.values],[-4,2,8,14,-5,1,7,13]);
  const pixels=grayscaleSlice(slab);assert.equal(pixels[0],Math.round(6/46*255));assert.equal(pixels[3],255);
  assert.equal(image.img.length,24);assert.equal(image.img[0],-7);
});
test('selection preserves exact MRI point, rejects foreign spaces and never recursively echoes',()=>{
  const s=createSelectionStore(),seen=[];s.setContext({caseId:'sub-01',spaceId:subjectSpaceId('sub-01')});s.subscribe(e=>seen.push(e));
  const event={caseId:'sub-01',spaceId:subjectSpaceId('sub-01'),structureId:'anatomy:hippocampus:left',pointMm:[-1.125,2.75,30.875],source:'mri'};
  assert.equal(s.publish(event),true);assert.deepEqual(s.snapshot().pointMm,event.pointMm);assert.equal(seen.length,1);
  assert.equal(s.publish({...event,caseId:'sub-02'}),false);assert.equal(s.publish({...event,spaceId:'mni'}),false);
  s.setContext({caseId:'sub-02',spaceId:subjectSpaceId('sub-02')});assert.equal(s.snapshot(),null);
});
test('SHA-256 fallback validates assets on HTTP LAN origins including multiblock payloads',()=>{
  for(const size of [0,3,55,56,64,65,65537]){
    const bytes=new Uint8Array(Array.from({length:size},(_,i)=>i%251));
    assert.equal(sha256Fallback(bytes),createHash('sha256').update(bytes).digest('hex'));
  }
});

test('additive post-answer help records round-trip without altering the first response',()=>{
  const history=readHistory({getItem:()=>null});
  const first={id:'attempt',caseId:'sub-01',topic:'hippocampus',status:'present',note:'first',hints:[],marks:{},side:'left',sequence:'T1w',point:[1,2,3],plane:'axial'};
  appendFirst(history,first);const preserved=structuredClone(history.attempts[0]);
  appendHelpEvent(history,{attemptId:'attempt',caseId:'sub-01',hint:'subject-three',at:'2026-09-09'});
  assert.deepEqual(history.attempts[0],preserved);let serialized;writeHistory(history,{setItem:(_,v)=>serialized=v});
  const restored=readHistory({getItem:()=>serialized});assert.deepEqual(restored.attempts[0],preserved);assert.equal(restored.helpEvents.length,1);
});
