/** These coordinates choose a nearby textbook plate; they never move or label MRI. */
export function illustrationReferencePoint(point, labels = null) {
  if (!Array.isArray(point) || point.length !== 3 || !point.every(Number.isFinite)) return null;
  if (labels === null) return [...point];
  const thalami = ['left', 'right'].map(side => labels.find(l => l.structure === 'thalamus' && l.side === side)?.anchor);
  if (thalami.some(p => !Array.isArray(p) || p.length !== 3 || !p.every(Number.isFinite))) return null;
  const reference = [0, -18, 8];
  return point.map((v, i) => v - (thalami[0][i] + thalami[1][i]) / 2 + reference[i]);
}

export function nearestIllustration(figures, plane, point) {
  const axis = {axial: 2, coronal: 1}[plane];
  if (axis === undefined || !point?.every(Number.isFinite) || point.length !== 3) return null;
  const candidates = figures.filter(f => f.plane === plane && Number.isFinite(f.referenceMm));
  if (!candidates.length) return null;
  const figure = candidates.reduce((best, f) => Math.abs(f.referenceMm - point[axis]) < Math.abs(best.referenceMm - point[axis]) ? f : best);
  const coordinates = candidates.map(f => f.referenceMm);
  return {figure, outside: point[axis] < Math.min(...coordinates) - 10 || point[axis] > Math.max(...coordinates) + 10};
}
