import {illustrationReferencePoint, nearestIllustration} from './illustration-matching.js';

const names = {axial: 'Axial · 축상면', coronal: 'Coronal · 관상면'};
const viewNames = {labeled:'라벨 포함', unlabeled:'삽화만', fullPlate:'원본 전체'};
const assetUrl = (path, revision) => revision ? `${path}?v=${encodeURIComponent(revision)}` : path;
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function createIllustrations({getState, onHint}) {
  const root = document.createElement('section');
  root.id = 'reference-illustrations';
  root.setAttribute('aria-label', '현재 단면의 해부 도식');
  document.querySelector('.inspector').prepend(root);
  const dialog = document.createElement('dialog');
  dialog.id = 'illustration-dialog';
  dialog.setAttribute('aria-labelledby', 'illustration-dialog-title');
  dialog.innerHTML = `<div class="illustration-dialog-head"><div><p class="eyebrow">TELENCEPHALON / 해부 도식</p><h2 id="illustration-dialog-title"></h2></div><button data-action="close" autofocus aria-label="해부 도식 닫기">닫기 ×</button></div>
    <div class="illustration-toolbar"><button data-action="previous" aria-label="이전 도식">← 이전</button><span id="illustration-dialog-level"></span><button data-action="next" aria-label="다음 도식">다음 →</button><label class="illustration-view-label">보기 <select id="illustration-view" aria-label="도식 보기 방식">${Object.entries(viewNames).map(([value,label])=>`<option value="${value}">${label}</option>`).join('')}</select></label><span class="illustration-toolbar-spacer"></span><button data-action="zoom-out" aria-label="도식 축소">−</button><output id="illustration-zoom">100%</output><button data-action="zoom-in" aria-label="도식 확대">＋</button><button data-action="fit">화면에 맞춤</button></div>
    <div class="illustration-viewport" tabindex="0" aria-label="확대된 해부 도식. 확대 후 스크롤하거나 드래그하여 이동."><img id="illustration-large" alt="" draggable="false"><p id="illustration-image-loading" role="status" hidden>큰 그림을 불러오는 중…</p><p id="illustration-image-error" hidden>그림을 불러오지 못했습니다. <button data-action="retry-image">다시 불러오기</button></p></div>
    <p class="illustration-source" id="illustration-dialog-source"></p>`;
  document.body.append(dialog);
  let figures = [], loadError = false, pending = false, frame = 0, key = '', context = '', manual = null, multiPlane = 'axial';
  let current = null, dialogFigure = null, zoom = 1, drag = null, view = 'labeled';
  const large = dialog.querySelector('img');
  const viewport = dialog.querySelector('.illustration-viewport');
  const imageError = dialog.querySelector('#illustration-image-error');
  const imageLoading = dialog.querySelector('#illustration-image-loading');
  const viewSelect = dialog.querySelector('#illustration-view');
  const displayedAsset = () => view === 'labeled' ? dialogFigure : dialogFigure?.[view] ?? dialogFigure;
  const list = plane => figures.filter(f => f.plane === plane);
  const source = f => `Telencephalon · 그림 ${f.figure} · 책 p. ${f.printedPage} / PDF ${f.pdfPage}쪽`;

  async function load() {
    if (pending) return;
    pending = true; loadError = false; key = ''; schedule();
    try {
      const response = await fetch('assets/illustrations/telencephalon/manifest.json', {cache:'no-cache'});
      if (!response.ok) throw new Error('illustration manifest');
      const data = await response.json();
      if (data.schemaVersion !== 1 || data.figures?.length !== 20 || data.figures.some(f => !names[f.plane] || !Number.isFinite(f.referenceMm) || !f.image?.startsWith('assets/illustrations/telencephalon/') || !f.thumbnail?.startsWith('assets/illustrations/telencephalon/'))) throw new Error('illustration data');
      figures = data.figures;
    } catch { loadError = true; }
    finally { pending = false; key = ''; schedule(); }
  }
  function schedule() { if (!frame) frame = requestAnimationFrame(() => { frame = 0; render(); }); }
  function render() {
    const state = getState();
    if (!state) { root.hidden = true; if (dialog.open) dialog.close(); return; }
    root.hidden = false;
    const nextContext = `${state.context}:${state.plane}`;
    if (context !== nextContext) {
      context = nextContext; manual = null; key = '';
      if (dialog.open) dialog.close();
    }
    const plane = state.plane === 'multi' ? multiPlane : state.plane;
    const point = illustrationReferencePoint(state.point, state.labels ?? null);
    const nearest = nearestIllustration(figures, plane, point);
    current = figures.find(f => f.id === manual && f.plane === plane) ?? nearest?.figure ?? list(plane)[0];
    const hidden = state.busy || !state.revealed || !names[plane] || pending || loadError;
    if (hidden && dialog.open) dialog.close();
    const nextKey = JSON.stringify([context, plane, current?.id, manual, nearest?.outside, Boolean(point), state.busy, state.revealed, state.locked, pending, loadError]);
    if (key === nextKey) return;
    key = nextKey;
    let html = '<div class="illustration-heading"><h3>해부 도식</h3><span>단면 참고</span></div>';
    if (state.busy) html += '<p class="illustration-note">MRI를 불러오면 가까운 도식을 표시합니다.</p>';
    else if (!names[plane]) html += '<p class="illustration-note">축상면·관상면 도식 20장이 있습니다. MRI를 Axial 또는 Coronal로 바꾸면 표시됩니다.</p>';
    else if (!state.revealed) html += `<p class="illustration-note">${state.locked ? '위치를 제출한 뒤 이름이 표시된 도식을 볼 수 있습니다.' : '구조명이 표시된 참고 그림입니다. 필요할 때 힌트로 열어보세요.'}</p>${state.locked ? '' : '<button data-action="hint">도식 힌트 보기</button>'}`;
    else if (loadError) html += '<p class="illustration-note" role="status">도식 자료를 불러오지 못했습니다.</p><button data-action="retry">다시 불러오기</button>';
    else if (pending || !current) html += '<p class="illustration-note">도식을 준비하고 있습니다…</p>';
    else {
      const entries = list(plane), i = entries.indexOf(current);
      if (state.plane === 'multi') html += `<div class="illustration-planes" role="group" aria-label="참고 도식 방향">${Object.entries(names).map(([id, name]) => `<button data-action="plane" data-illustration-plane="${id}" aria-pressed="${id === plane}">${name}</button>`).join('')}</div>`;
      html += `<button class="illustration-preview" data-action="open" aria-label="${escape(current.title)} 도식 크게 보기"><img src="${assetUrl(current.thumbnail, current.thumbnailSHA256 ?? current.sha256)}" width="${current.width}" height="${current.height}" alt="${escape(current.title)} 구조명과 연결선이 표시된 ${names[plane]} 도식"><span>클릭하여 크게 보기 ↗</span></button>
        <p class="illustration-title">${escape(current.title)}</p><div class="illustration-navigation"><button data-action="previous" aria-label="이전 참고 도식" ${i === 0 ? 'disabled' : ''}>←</button><span>${names[plane]} · ${current.level} / 10</span><button data-action="next" aria-label="다음 참고 도식" ${i === entries.length - 1 ? 'disabled' : ''}>→</button></div>
        <button class="illustration-follow" data-action="follow" ${!manual && point ? 'disabled' : ''}>${manual ? '현재 MRI 단면 따라가기' : point ? '현재 MRI 단면을 따라가는 중' : '자동 대응 위치 없음 · 수동 탐색'}</button>
        <p class="illustration-note">${manual ? '직접 고른 도식' : !point ? '위치 기준이 없어 첫 도식부터 표시합니다.' : nearest?.outside ? '도식 범위 밖 · 가장 가까운 끝 단면' : '현재 단면과 가까운 해부학적 위치'} · 실제 MRI와 모양·각도가 다를 수 있습니다.${state.comparison ? ' 왼쪽 주 영상 기준입니다.' : ''}</p><p class="illustration-source">${source(current)}</p>`;
    }
    root.innerHTML = html;
    const thumbnail = root.querySelector('img');
    if (thumbnail) thumbnail.onerror = () => {
      thumbnail.hidden = true;
      const button = thumbnail.closest('button');
      button.querySelector('span').textContent = '미리보기 로드 실패 · 클릭하여 큰 그림 열기';
    };
  }
  function navigate(delta, modal = false) {
    const selected = modal ? dialogFigure : current;
    if (!selected) return;
    const entries = list(selected.plane), target = entries[entries.indexOf(selected) + delta];
    if (!target) return;
    if (modal) showFigure(target);
    else { manual = target.id; schedule(); }
  }
  function fit() {
    if (!dialogFigure) return;
    const asset = displayedAsset();
    const width = Math.max(1, Math.min(viewport.clientWidth - 24, (viewport.clientHeight - 24) * asset.width / asset.height));
    large.style.width = `${width * zoom}px`;
    dialog.querySelector('#illustration-zoom').textContent = `${Math.round(zoom * 100)}%`;
    dialog.querySelector('[data-action="zoom-out"]').disabled = zoom <= 1;
    dialog.querySelector('[data-action="zoom-in"]').disabled = zoom >= 4;
    viewport.classList.toggle('is-zoomed', zoom > 1);
  }
  function showFigure(figure) {
    dialogFigure = figure; zoom = 1; imageError.hidden = true; large.hidden = true; imageLoading.hidden = false;
    if (view !== 'labeled' && !figure[view]) view = 'labeled';
    viewSelect.value = view;
    for (const option of viewSelect.options) option.disabled = option.value !== 'labeled' && !figure[option.value];
    dialog.querySelector('h2').textContent = figure.title;
    dialog.querySelector('#illustration-dialog-level').textContent = `${names[figure.plane]} · ${figure.level} / 10`;
    dialog.querySelector('#illustration-dialog-source').textContent = `${source(figure)} · ${viewNames[view]} · 근사 위치의 참고 도식 · 확대 후 드래그/스크롤로 이동`;
    const entries = list(figure.plane), i = entries.indexOf(figure);
    dialog.querySelector('[data-action="previous"]').disabled = i === 0;
    dialog.querySelector('[data-action="next"]').disabled = i === entries.length - 1;
    large.alt = `${figure.title} · ${viewNames[view]} · ${names[figure.plane]} 해부 도식`;
    const asset = displayedAsset();
    large.src = assetUrl(asset.image, asset.sha256);
    viewport.scrollTo(0, 0); fit();
  }
  large.onload = () => { imageLoading.hidden = true; large.hidden = false; fit(); };
  large.onerror = () => { large.hidden = true; imageLoading.hidden = true; imageError.hidden = false; };
  root.addEventListener('click', e => {
    const button = e.target.closest('button'); if (!button || button.disabled) return;
    switch (button.dataset.action) {
      case 'open': if (current) { view = 'labeled'; dialog.showModal(); showFigure(current); } break;
      case 'previous': navigate(-1); break;
      case 'next': navigate(1); break;
      case 'follow': manual = null; schedule(); break;
      case 'plane': multiPlane = button.dataset.illustrationPlane; manual = null; schedule(); break;
      case 'hint': onHint(); schedule(); break;
      case 'retry': load(); break;
    }
  });
  viewSelect.addEventListener('change', () => {
    if (!dialogFigure || !Object.hasOwn(viewNames, viewSelect.value)) return;
    view = viewSelect.value;
    showFigure(dialogFigure);
  });
  dialog.addEventListener('click', e => {
    const button = e.target.closest('button'); if (!button || button.disabled) return;
    switch (button.dataset.action) {
      case 'close': dialog.close(); break;
      case 'previous': navigate(-1, true); break;
      case 'next': navigate(1, true); break;
      case 'zoom-out': zoom = Math.max(1, zoom - .5); fit(); break;
      case 'zoom-in': zoom = Math.min(4, zoom + .5); fit(); break;
      case 'fit': zoom = 1; fit(); viewport.scrollTo(0, 0); break;
      case 'retry-image': showFigure(dialogFigure); break;
    }
  });
  dialog.addEventListener('keydown', e => {
    if (e.target.closest('select')) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); navigate(e.key === 'ArrowLeft' ? -1 : 1, true); }
  });
  viewport.addEventListener('pointerdown', e => {
    if (zoom <= 1 || e.pointerType !== 'mouse' || e.button !== 0 || e.target !== large) return;
    drag = {x:e.clientX, y:e.clientY, left:viewport.scrollLeft, top:viewport.scrollTop};
    viewport.setPointerCapture(e.pointerId); e.preventDefault();
  });
  viewport.addEventListener('pointermove', e => { if (drag) viewport.scrollTo(drag.left + drag.x - e.clientX, drag.top + drag.y - e.clientY); });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) viewport.addEventListener(name, () => { drag = null; });
  dialog.addEventListener('close', () => { drag = null; });
  new ResizeObserver(() => { if (dialog.open) fit(); }).observe(viewport);
  for (const name of ['subject-view-state', 'individual-mode', 'illustration-refresh']) document.addEventListener(name, schedule);
  load();
  return {refresh:schedule};
}
