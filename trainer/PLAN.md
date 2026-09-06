# MRI Tutor — knowledge-first 3D training

> 2026-09-06 방향 수정: 향후 구현 기준은 [개인 MRI 판독 훈련 재설계](REDESIGN.md)이다. 아래는 기존 atlas 기반 구현 이력이며, 개인 MRI 판독 훈련의 완료 기준으로 사용하지 않는다. 현재 MRI 기본 자료는 개인 촬영 영상이 아닌 집단 평균 템플릿이다.

> 3D 역할 명확화: 3D는 공간적 이해를 돕는 단순화된 보조 모델로 유지한다. 개인 MRI와의 정밀 정합·개인별 표면 재구성·3D 모델 판독은 요구하지 않는다. 과도한 정교함이 학습을 저해하지 않도록 명료함을 우선한다. 정확성 검수는 실제 MRI와 그 위의 라벨·채점 정답에 집중한다.

Implementation boundary: an independent Korean 3D brain trainer in `trainer/`, plus the reproducible derivative builder in `scripts/build_training_atlas.py`. Preserve previous PDFs, extraction results, and the first-pair demo.

Visual thesis: a quiet ivory and sage anatomical workspace, with one dominant rotatable brain, warm selected structures, and real MRI slices directly below.
Content plan: searchable structure navigation; 3D and MRI workspace; concise bilingual anatomical inspector; direct structure-finding practice; sixteen authored foundation questions and targeted review.
Interaction thesis: selection links 3D to MRI; orbit, zoom, hemisphere filtering, and transparency reveal relationships; immediate first-answer feedback supports learning. Reduced motion and keyboard navigation apply to UI controls and camera.

Delivered scope: CIT168's 16 subcortical classes, split into 32 hemispheric labels. Most probable label at >=64/255 generates both mesh and MRI overlay. A contextual brain outer surface comes from the matched T1 template. No invented MRI, no PDF extraction, no runtime AI service, and no whole-cortex parcellation claim. Explain probabilistic boundaries and all dataset transformations in-app and in the README.

Verification: check all 32 selected anchors against actual MRI labels; real browser picking, quiz/review/reload flows, camera and mobile layout; syntax and data integrity checks. Document limits accurately.

## Specialist MRI integration (user refinement, 2026-09-06)
Preserve all existing 3D interactions. Add a dominant real-MRI workspace with axial/coronal/sagittal planes only, continuous mm controls, a synchronized 3D cursor and orthogonal reference planes. Individual selected ROI masks preserve overlaps. Expand coverage to the requested cortical/limbic/brainstem structures and network node navigation. Make functional proxies and nuclei localization explicit. Allen-only claustrum and septal region must use the matched 2009b symmetric MRI, never be mixed with 2009c. Septal region is not an isolated lateral septal nucleus and must be excluded from scored LSN identification. MRI practice hides the answer, randomizes plane and a real target-containing depth, records first submitted voxel and per-plane results, and reveals the mask and target on demand. Preserve foundation questions as secondary content. Verify native masks, anchors, plane switching, matching template switching, stale-load protection, real click grading, 3D controls, and responsive layout.

## Resizable MRI-first split (2026-09-06)
Keep the 3D viewer above MRI inside a shared-height container. Drag the horizontal divider continuously; endpoints collapse either panel completely without destroying its renderer. MRI gets 70% initially, with explicit MRI-only / 3D-only / restore-both actions, keyboard resizing, and persisted proportions. Resizing must update both WebGL canvases without changing anatomy, selected slice, or camera. Verify drag, both endpoints and restoration, persistence, training modes, and narrow screens.

Verified split behavior in Chromium: actual drag to both endpoints; button/keyboard collapse and restoration; persisted split after reload including starting with MRI hidden; MRI coordinates unchanged across resize; MRI practice opens MRI-only; 390px document fits viewport. Fixed a data attribute collision with legacy camera presets; final browser run had zero page errors. No atlas or training answer data changed.


## 개인 MRI 구현 상태 (2026-09-06)

REDESIGN.md를 기준으로 개인 StudyForrest T1/T2 4명, 11개 관찰 주제, 안내·추적·비교·별도 개인 전이 흐름을 구현했다. 기존 디자인과 3D/분할/Atlas 기능은 유지한다. 개인 자동 라벨은 전문 경계 검수 전 참고용이며, 임상 정답률을 계산하지 않는다. 데이터·브라우저 검증과 제약은 [VERIFICATION.md](VERIFICATION.md), 실행·재현 방법은 [README.md](README.md)를 참조한다.
