/** Spatial identity is stricter than sharing the RAS convention. */
export const subjectSpaceId = caseId => `subject:${caseId}:T1-native-RAS-mm`;
export const subjectCoreTopics=Object.freeze(['hippocampus','amygdala','caudate','putamen','thalamus','pallidum','ventricle','third-ventricle','temporal-horn','fourth-ventricle']);
export const templateSpaces = Object.freeze({mni:'template:MNI152NLin2009cAsym:RAS-mm',allen:'template:ICBM2009bSym:RAS-mm'});
export const point3 = p => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite);
export const sameSpace = (a,b) => typeof a === 'string' && a.length > 0 && a === b;
export function transformPoint(matrix, point) {
  return matrix.slice(0,3).map(row => row[3] + row.slice(0,3).reduce((v,n,i) => v+n*point[i],0));
}
export function volumeCorners(shape, matrix) {
  return [0,1].flatMap(x=>[0,1].flatMap(y=>[0,1].map(z=>transformPoint(matrix,[x,y,z].map((v,i)=>v*(shape[i]-1))))));
}
export function validateSubjectPack(pack, current) {
  const fail = message => {throw new Error(`개인 3D 자료 확인 실패: ${message}`);};
  if (pack?.schemaVersion !== 2 || pack.caseId !== current.id) fail('사례 ID');
  const space = pack.space;
  if (!sameSpace(space?.id,subjectSpaceId(current.id)) || space.unit !== 'mm' || space.axisConvention !== 'RAS' || space.referenceImageHash !== current.sequences.T1w.sha256) fail('공간 / 기준 영상');
  if (!Array.isArray(pack.volumes) || !Array.isArray(pack.structures) || !pack.structures.length || !Array.isArray(pack.representations) || !pack.representations.length) fail('필수 목록');
  for (const [seq,s] of Object.entries(current.sequences)) {
    const v = pack.volumes.find(v=>v.id===seq);
    if (!v || v.spaceId!==space.id || v.sourceHash!==s.sha256 || v.dtype!==s.dtype || JSON.stringify(v.shape)!==JSON.stringify(s.shape) || !Number.isFinite(v.slope) || !Number.isFinite(v.intercept) || !Array.isArray(v.voxelToWorld) || v.voxelToWorld.length!==4 || v.voxelToWorld.some((r,i)=>r.length!==4||r.some((n,j)=>!Number.isFinite(n)||Math.abs(n-s.affine[i][j])>.0001))) fail('영상 계약');
  }
  const concepts = new Map(pack.structures.map(s=>[s.id,s]));
  if (concepts.size!==pack.structures.length) fail('중복 구조');
  const ids = new Set();
  for (const r of pack.representations) {
    const concept = concepts.get(r.structureId), label = current.segmentation.labels.find(l=>l.id===r.labelId);
    if (ids.has(r.id)) fail('중복 representation');
    ids.add(r.id);
    if (r.caseId!==current.id || r.spaceId!==space.id || r.kind!=='subject-segmentation' || r.assessmentUse!=='reference-only' || r.reviewStatus!=='unreviewed') fail('표현 / 평가 용도');
    if (!concept || !label || concept.topicId!==label.structure || concept.side!==label.side || JSON.stringify(r.sourceLabelIds)!==JSON.stringify(label.source_ids)) fail('구조 정의');
    if (r.referenceMask?.sha256!==current.segmentation.sha256 || r.referenceMask.url!==current.segmentation.url) fail('참고 mask');
    if (!point3(r.interiorAnchor) || r.interiorAnchor.some((n,i)=>Math.abs(n-label.anchor[i])>.001) || !r.qa?.anchorInsideMask) fail('내부 위치');
    if (!Array.isArray(r.bounds) || r.bounds.length!==2 || !r.bounds.every(point3) || r.bounds[0].some((n,i)=>n>=r.bounds[1][i])) fail('범위');
    if (r.mesh?.unit!=='m' || !/^[a-f0-9]{64}$/.test(r.mesh.sha256) || !(r.mesh.bytes>0) || !r.mesh.url?.startsWith(`assets/packs/subject-core/${pack.version}/${current.id}/`) || r.mesh.url.includes('..')) fail('GLB');
  }
  if (!pack.provenance?.license || !pack.provenance.licenseFiles?.length) fail('출처');
  return pack;
}
