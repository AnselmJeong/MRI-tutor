import test from 'node:test';
import assert from 'node:assert/strict';
import {buildGuidedSections,guidedLocationFeedback,pickGuidedTarget,planeAxes,guidedTopicIds} from '../trainer/guided-practice.js';
import {restoreTask} from '../trainer/case-state.js';
const label={id:4,structure:'target',side:'left',bounds:[[-7,-7,-7],[7,7,7]],anchor:[0,0,0]};
// A hollow centre: bounds and centroid both give false positive locations.
const lookup=p=>p.every(v=>Math.abs(v)<=6)&&Math.hypot(...p)>=3?4:0;
test('guided sections contain actual target pixels and interior answer, not bounding-box centres',()=>{
 const sections=buildGuidedSections(label,'coronal',lookup);
 assert.deepEqual(sections.map(s=>s.plane),['coronal','axial','sagittal']);
 for(const s of sections){assert.equal(s.answer[planeAxes[s.plane]],s.depth);assert.equal(lookup(s.answer),4);assert.ok(s.sampleCount>=9);}
 assert.equal(lookup(label.anchor),0);
 assert.deepEqual(buildGuidedSections(label,'axial',()=>0),[]);
});
test('location feedback separates a match, uncertain edge, miss and revealed answer',()=>{
 const lookup=p=>p[0]>=0&&p[0]<=6&&p[1]>=0&&p[1]<=6&&p[2]===0?4:0,section={plane:'axial'};
 assert.equal(guidedLocationFeedback([3,3,0],label,section,lookup).kind,'match');
 assert.equal(guidedLocationFeedback([-1,3,0],label,section,lookup).kind,'near');
 assert.equal(guidedLocationFeedback([-10,3,0],label,section,lookup).kind,'miss');
 assert.equal(guidedLocationFeedback(null,label,section,lookup).kind,'revealed');
});
test('random questions use available subject labels, avoid immediately repeating a structure',()=>{
 const topics=[{id:'a'},{id:'b'},{id:'no-mask'}],labels=[{structure:'a',side:'left'},{structure:'b',side:'right'}];
 assert.equal(pickGuidedTarget(topics,labels,'a',()=>0).topic.id,'b');
 assert.equal(pickGuidedTarget(topics,labels,'b',()=>.99).label.side,'left');
 assert.equal(pickGuidedTarget(topics,[],'a'),null);
});
test('guided progress survives restore while malformed coordinates cannot become an answer',()=>{
 const draft={id:'x',note:'',hints:[],marks:{},visited:{},guided:{labelId:4,index:1,sections:[{plane:'axial',depth:0,answer:[3,3,0]},{plane:'coronal',depth:2,answer:[3,2,0]}]}};
 assert.deepEqual(restoreTask(draft,{attempts:[]}).guided,draft.guided);
 draft.guided.sections[0].answer[2]=Infinity;
 assert.equal(restoreTask(draft,{attempts:[]}).guided,undefined);
});
test('tilted native slices use transformed mask samples and return world-space answers',()=>{
 const toWorld=p=>[p[0],p[1],p[2]+p[0]*.25+10],fromWorld=p=>[p[0],p[1],p[2]-p[0]*.25-10];
 const geometry={bounds:label.bounds,anchor:label.anchor,toWorld,fromWorld};
 const ref=p=>lookup(fromWorld(p));
 const sections=buildGuidedSections(label,'axial',ref,geometry);
 for(const s of sections){assert.equal(fromWorld(s.answer)[planeAxes[s.plane]],s.depth);assert.equal(ref(s.answer),label.id);}
 const axial=sections[0];assert.notEqual(axial.answer[2],axial.depth);
});

test('guided curriculum starts with gross anatomy, excludes inferred parcels and unlabelled capsule',()=>{
 assert.ok(guidedTopicIds.includes('pallidum'));
 assert.equal(guidedTopicIds.includes('entorhinal'),false);
 assert.equal(guidedTopicIds.includes('internal-capsule'),false);
});
