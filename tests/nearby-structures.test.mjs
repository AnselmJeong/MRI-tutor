import test from 'node:test';
import assert from 'node:assert/strict';
import {findNearbyStructures} from '../trainer/nearby-structures.js';
const identity=p=>p;
const search=(overrides={})=>findNearbyStructures({center:[0,0,0],plane:'axial',radius:10,labels:[{id:1},{id:2}],fromWorld:identity,toWorld:identity,referenceAt:p=>p[0]<0?1:2,...overrides});
test('one actual marker per registered region, in the clicked plane and physical radius',()=>{
 const results=search();assert.deepEqual(new Set(results.map(r=>r.id)),new Set([1,2]));
 for(const r of results){assert.equal(r.point[2],0);assert.ok(r.distance<=10);assert.equal(r.point[0]<0?1:2,r.id);assert.equal(r.distance,Math.hypot(...r.point));}
 assert.equal(search({referenceAt:()=>88}).length,0);
 assert.equal(search({referenceAt:()=>0}).length,0);
});
test('nearby markers do not project a labelled region from another depth',()=>{
 assert.deepEqual(search({referenceAt:p=>p[2]===5?1:0}),[]);
 const results=search({center:[0,0,5],referenceAt:p=>p[2]===5?1:0});assert.equal(results.length,1);assert.equal(results[0].point[2],5);
});
test('radius grows in mm, not screen pixels, and invalid requests return no points',()=>{
 const referenceAt=p=>p[0]>=12?1:0;
 assert.equal(search({referenceAt,radius:10}).length,0);assert.equal(search({referenceAt,radius:15}).length,1);
 for(const radius of [0,-1,Infinity,NaN,51])assert.deepEqual(search({radius}),[]);
 assert.deepEqual(search({plane:'multi'}),[]);
});
test('tilted native plane retains label membership and the true physical search radius',()=>{
 const angle=.3,c=Math.cos(angle),s=Math.sin(angle);
 const toWorld=p=>[p[0]*c-p[2]*s,p[1],p[0]*s+p[2]*c];
 const fromWorld=p=>[p[0]*c+p[2]*s,p[1],-p[0]*s+p[2]*c];
 const referenceAt=p=>fromWorld(p)[0]<0?1:2;
 const results=search({center:toWorld([0,0,4]),fromWorld,toWorld,referenceAt});
 assert.equal(results.length,2);
 for(const r of results){assert.ok(Math.abs(fromWorld(r.point)[2]-4)<1e-8);assert.equal(referenceAt(r.point),r.id);assert.ok(r.distance<=10+.001);}
});
test('curved and disconnected masks never place their dot in an empty centroid',()=>{
 const referenceAt=p=>Math.hypot(p[0],p[1])>=4&&Math.hypot(p[0],p[1])<=7?1:0;
 const [result]=search({referenceAt});assert.equal(referenceAt(result.point),1);assert.notDeepEqual(result.point,[0,0,0]);
});
