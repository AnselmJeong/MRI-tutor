// Link authored tasks to the installed individual's exact reference space and label provenance.
import fs from 'node:fs';
import {topics} from '../trainer/case-content.js';
const root=new URL('../trainer/assets/cases/',import.meta.url);
const file=new URL('manifest.json',root),manifest=JSON.parse(fs.readFileSync(file));
for(const c of manifest.cases){
 for(const l of c.segmentation.labels){
  const t=topics.find(t=>t.id===l.structure);
  Object.assign(l,{case_id:c.id,reference_space:c.reference_space,observability:{T1w:'reference-localization; visible boundaries require individual inspection',T2w:'reference-localization on rigidly aligned T2; visibility not certified'},boundary_uncertainty:t?.boundary??l.boundary_uncertainty});
 }
 c.tasks=topics.map(t=>({id:`${c.id}:${t.id}:observation-v1`,case_id:c.id,target:t.id,reference_space:c.reference_space,planes:['axial','coronal','sagittal'],sequences:['T1w','T2w'],landmarks:t.landmarks,scoring:'reference-feedback-only',status:'enabled-observation',scoreable:false,allowed_region:null,reference_regions:c.segmentation.labels.filter(l=>l.structure===t.id).map(l=>({id:l.id,side:l.side,reference_extent:l.bounds,range_status:'automatic-extent-not-validated-presence-key'})),absence_answer_key:null,unidentifiable_answer_key:null,boundary_uncertainty:t.boundary,source:t.source}));
 const review=new URL(`${c.id}/qc-review.json`,root);
 if(fs.existsSync(review)){
  const qc=JSON.parse(fs.readFileSync(review));
  if(qc.reviewed_hashes?.T1w!==c.sequences.T1w.sha256||qc.reviewed_hashes?.T2w!==c.sequences.T2w.sha256||qc.reviewed_hashes?.labels!==c.segmentation.sha256)throw new Error(`${c.id}: QC hashes changed; repeat visual review before publishing contracts`);
  c.qc=qc;c.registration.review_status=qc.status;
  c.segmentation.labels.forEach(l=>{l.review_log=qc.label_review_logs?.filter(r=>r.side===l.side||r.side==='all')??[];});
 }
 fs.writeFileSync(new URL(`${c.id}/case.json`,root),JSON.stringify(c,null,2));
}
fs.writeFileSync(file,JSON.stringify(manifest,null,2));
console.log(`${manifest.cases.length} case contracts, ${manifest.cases.reduce((n,c)=>n+c.tasks.length,0)} observation tasks; no clinical answer key activated.`);
