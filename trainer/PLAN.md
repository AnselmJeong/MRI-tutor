# MRI Tutor — knowledge-first 3D training

> 2026-09-09 개인 3D 통합: 같은 개인의 분할과 MRI 연결에는 [ATLAS-INTEGRATION-PLAN](../docs/ATLAS-INTEGRATION-PLAN.md)이 아래의 과거 참고 모델 제한보다 우선한다. 4명 × 18개 개인 구획과 실제 native MRI 단면·clipping·선택을 구현했다. 표준 Atlas는 별도 공간이며 자동 분할은 계속 참고용이다. [구현·검증 범위](../docs/ATLAS-INTEGRATION-IMPLEMENTATION.md).

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

REDESIGN.md를 기준으로 개인 StudyForrest T1/T2 4명, 26개 관찰 주제, 안내·추적·비교·별도 개인 전이 흐름을 구현했다. 기존 디자인과 3D/분할/Atlas 기능은 유지한다. 개인 자동 라벨은 전문 경계 검수 전 참고용이며, 임상 정답률을 계산하지 않는다. 데이터·브라우저 검증과 제약은 [VERIFICATION.md](VERIFICATION.md), 실행·재현 방법은 [README.md](README.md)를 참조한다.

## 안내 학습 개선 (2026-09-07)

사용자 요청: 구조를 직접 고르고 긴 서술을 작성하는 대신 앱이 무작위로 문제를 내고, 목표가 포함된 여러 단면에서 위치를 찾게 한다. 틀린 위치에는 실제 목표 위치와 찾는 경로를 보여준다.

구현 범위:
- 개인 자동 분할이 있는 구조에서 무작위 문제 선택, 목표 영역이 충분히 포함된 세 방향 단면을 실제 마스크 조회로 준비.
- 영상 클릭과 위치 확인만으로 응답. 모르겠으면 정답 보기. 각 단면 뒤 다음 단면, 세 단면 뒤 새 무작위 문제.
- 제출 좌표를 실제 개인 라벨과 대조하고, 불일치하면 같은 단면의 목표 영역과 내부 지점을 표시. 경계 근접은 별도로 안내.
- 기존 랜드마크 설명과 관계 설명 유지. 전문 검수 여부는 접힌 근거 설명으로 이동.
- 탐색/추적/비교/전이 기능 및 기존 기록 보존. 새 안내 학습 진행도와 응답 복원.
- 단면 생성/판정 단위 검증, 실제 MRI 브라우저 클릭 및 복원/초기화/다음 문제/오류/모바일 검증.

## 탐색 중 주변 구조 표시 (2026-09-07)

사용자 요청: MRI 클릭 위치 주변의 등록된 구조에 노란 점을 표시하고 hover로 이름을 확인한다. 다음 클릭은 이전 점들을 교체한다.

구현 범위: 탐색 모드의 현재 클릭 단면에서 반경 15 mm (10/15/25 선택) 이내 개인 참고 라벨을 조회한다. 구조마다 실제 참고 영역 내부의 점 하나를 표시한다. 다른 깊이의 고정 anchor를 현재 단면에 투영하지 않는다. 점 hover/키보드 focus/터치로 좌우·구조명을 표시한다. 다음 클릭, 단면/사례/모드 전환으로 이전 결과를 지우고, 확대/축소/패널 크기 변화에는 화면 좌표를 다시 계산한다. 기존 구조 선택 및 안내 학습을 유지한다. 반경·단면·라벨 membership 단위 검증과 실제 MRI 클릭/hover/다중 단면/resize/전환 브라우저 검증을 수행한다.

탐색 우측 pane에서는 경계 안내 상자와 서술형 응답/피드백 영역을 제거한다. 구조 설명·위치 이동·참고 경계 도구는 유지하며, 서술형 응답은 추적·비교·전이에서 제공한다.

MRI 조작: 일반 휠의 단면 이동을 유지하고 ⌘ Command + 휠은 1–4배 확대·축소로 처리한다. 개인/비교/Atlas에서 단면·십자선·pan을 유지하고 확대 컨트롤과 동기화한다.

## 좌우 분할과 Axial 기본 보기 (2026-09-08)

사용자 요청에 따라 넓은 화면에서는 3D를 왼쪽, MRI를 오른쪽에 배치한다. 기본 너비는 40:60이며 세로 경계선을 드래그하거나 좌우 방향키로 조절한다. 기존 MRI만/3D만/양쪽 복원, 렌더러와 좌표 유지, 너비 저장을 유지한다. 기존 높이 비율은 새 너비 비율과 분리해 보존한다. 좁은 작업 영역에서는 읽을 수 있는 크기를 확보하기 위해 위아래 배치와 상하 조절을 사용한다. 참고 Atlas와 개인 MRI 기본 탐색은 Axial 단일 단면으로 시작하며, 안내 학습의 지정 단면과 저장된 학습 진행은 유지한다. 실제 브라우저에서 좌우 위치, 드래그/키보드/접기/복원/재실행, 단면 및 좌표 유지, 작은 화면을 검증한다.

검증 완료: `node tests/split-layout.mjs`에서 좌우 위치, 실제 가로 드래그·좌우 키, 접기/복원/저장, Axial 기본 탐색, MRI 좌표 유지(0.001 mm 이내), 1600/1440/1024/390px 배치를 확인했다. 좁은 3D 패널에서 뇌가 잘리지 않도록 짧은 축 기준 시야각을 유지한다. Chrome 스크린샷으로 데스크톱과 모바일을 확인했으며 페이지 오류는 없었다. `npm test` 23개와 `git diff --check`도 통과했다.
