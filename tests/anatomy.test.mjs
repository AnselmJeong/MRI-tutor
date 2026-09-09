import {test} from 'node:test';
import assert from 'node:assert/strict';
import {anatomyText,anatomySegments} from '../trainer/anatomy-terms.js';
import {locateOnSlice,labelAt} from '../trainer/anatomy-location.js';
test('longest anatomy term wins and existing English is not repeated',()=>{
 assert.equal(anatomyText('측뇌실 전각과 내포 앞다리(anterior limb of the internal capsule)'), '측뇌실 전각(anterior horn of the lateral ventricle)과 내포 앞다리(anterior limb of the internal capsule)');
 const sentence=anatomyText('해마 머리와 해마, 정중 시상면에서 시상 확인');
 assert.equal(anatomyText(sentence),sentence);
 assert.equal(anatomyText('Sagittal · 시상'),'시상면(sagittal plane)');
 assert.deepEqual(anatomySegments('해마 머리')[0].term.groups,[]);
 assert.deepEqual(anatomySegments('최외포')[0].term.groups,[]);
});
const image=(sample,origin=[0,0,0])=>({dimsRAS:[3,8,8,8],matRAS:null,mm2vox:(p,f)=>p.map((n,i)=>f?n-origin[i]:Math.round(n-origin[i])),vox2mm:p=>p.map((n,i)=>n+origin[i]),getValue:sample});
test('ring stays inside real mask on current native slice; independent of world origin',()=>{
 const base=image(()=>0,[30,-10,5]),mask=image((x,y,z)=>x>=2&&x<=5&&y>=2&&y<=5&&z===3?7:0,[30,-10,5]);
 const found=locateOnSlice({base,masks:[{image:mask,ids:[7],anchors:[[33,-7,8]]}],point:[31,-9,8.2],plane:'axial'});
 assert.equal(found.moved,false);assert.equal(found.point[2],8.2);assert.equal(labelAt(mask,found.point),7);
 assert.ok(found.point[0]>=33&&found.point[0]<=34); // interior support beats boundary proximity
});
test('off-slice lookup uses only a verified same-mask anchor',()=>{
 const base=image(()=>0),mask=image((x,y,z)=>x===3&&y===3&&z===3?7:0);
 assert.deepEqual(locateOnSlice({base,masks:[{image:mask,ids:[7],anchors:[[3,3,3]]}],point:[0,0,0],plane:'coronal'}),{point:[3,3,3],moved:true});
 assert.equal(locateOnSlice({base,masks:[{image:mask,ids:[7],anchors:[[0,0,0]]}],point:[0,0,0],plane:'axial'}),null);
 assert.equal(labelAt(mask,[-1,3,3]),0);
});
