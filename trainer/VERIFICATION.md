# 개인 MRI 훈련 검증 기록

2026-09-07. REDESIGN.md의 완료 경험: 처음 보는 개인 MRI에서 라벨을 가린 채 단면을 이동하고 구조의 위치·주변 관계·관찰 한계를 설명하는 흐름.

## 결과와 범위

| 문서 요구 | 구현 및 검증 근거 |
|---|---|
| 실제 개인 MRI | StudyForrest 4명 T1/T2 실파일, upstream 해시·크기 및 앱 SHA-256 대조. 원본 T1 byte-identical. |
| 원본 상세·방향·세 방향 | int16 native T1/T2, float32 정합 T2, native affine 및 scanner RAS. 단일/3면, 연속 이동, 확대, W/L. |
| 같은 사람의 T2 | 개인 brain mask + Euler3D 강체 정합, 원본 T2에서 1회 선형 resampling, 변환 및 원본 보존. |
| 개인 라벨·정답 계약 | 개인 FreeSurfer rawavg와 동일 복셀 촬영 대조 후 헤더 보정. 184개 앵커/좌우/voxel count 검사. 모든 라벨 reference-only. |
| 관찰·추적·비교 | 26개 주제별 주변 랜드마크·경계 불확실성. 출현/변화/소실을 같은 방향의 서로 다른 순서 깊이에 기록. 같은 개인 좌표 동기화, 다른 개인 독립 탐색. |
| 사례 간 전이 | 3명 학습/1명 전이. 첫 응답 전 도움·경계·3D 잠금. 과거 노출을 저장하여 재노출을 미노출로 표시하지 않음. |
| 학습 피드백 | 위치/부재/식별 곤란 구분, 첫 서술·실제 클릭·시퀀스·방향·도움·추적 기록. 구조별 이웃 관계와 피드백. 자기 점검·복습·JSON 내보내기. |
| 기존 3D·디자인 유지 | 같은 아이보리·세이지 배치, 분할 드래그/접기/복원. 개인에서는 참고 모델과 필요 이웃만 강조하며 개인 커서/정답을 정합한 것처럼 표시하지 않음. |
| 전체 구조·회로 | 기존 42종/80개 Atlas 구획과 DMN/CSTC/Papez 유지. 작은 핵/기능 영역은 참고 Atlas 위치이며 개인 직접 식별 정답이 아님. |

## 수행한 검증

- `npm test`: 데이터 격리, 원본 강도/헤더, 구조→3D 대응, 전문검수 없는 채점 차단, 첫 응답 고정, 추적 순서, 저장소 실패/손상, HTML 이스케이프, 손상된 draft 복구 계약.
- `scripts/validate_individual_cases.py`: 모든 개인 T1/T2 해시·affine·finite intensity, 184개 라벨 anchor/voxel count, 좌우 상대 순서, 104개 관찰 과제 계약 검사. `qa/data-validation.json`.
- `tests/browser.mjs`: 실제 Chrome UI를 통해 MRI 클릭/키보드, W/L, T2 좌표 보존, 잘못된 과거 클릭 무효화, 첫 응답/reload, 추적, 같은 개인/다른 개인 비교, 전이 힌트 잠금과 다음 과제 재잠금, 빠른 사례 교체, 자료 안내/기록, 기존 Atlas, 390px 레이아웃 검사. `qa/browser-report.json`.
- `tests/resilience.mjs`: 영상 HTTP 503 실패 시 이전 화면 숨김/제출 차단/재시도, 전이 재노출 기록, 기존 Atlas 위치/3D 찾기/기초 문제 및 복귀, localStorage 거부 상태의 관찰·실행 중 기록 확인. `qa/resilience-report.json`.
- `qa/sub-0*-registration.png`: 4명의 T1/T2 세 방향을 뇌량·뇌실·시상과 대조. `qa/sub-0*-labels*.png`: 양측 개인 분할의 세 방향 형태·주변 관계를 시각 검토. 정확히 검사한 해시와 관찰 범위는 `assets/cases/*/qc-review.json`에 기록.

시각 검토는 구현 에이전트의 developer QC다. 한 복셀 단위의 전문 해부학적 경계 검수나 임상적 정답 인증이 아니다. 겉보기 큰 정합 오류가 없다는 확인이 국소 정합 오차가 0임을 의미하지 않는다. 표본 4명의 사용 흐름 검증을 교육 효과 검증으로 표현하지 않는다.

## 명시적 제한

개인 MRI의 채점 가능한 임상 정답 과제는 **0개**다. 자동 label membership·단면 범위를 임상 정답으로 변환하지 않는다. 실제 경계가 보이는지, 해당 단면에 없는지에 관한 판단도 전문 검수 전에는 참고 피드백이다. 새 전문 정답을 도입하려면 사례/공간/시퀀스별 경계와 허용 영역, 검수자·검수 기록·관찰 가능성을 확인해야 한다.

현재는 공개 연구 참여자의 해부학 관찰 훈련이다. 환자 진단·병변 사례·임상 척도·FLAIR/DWI/SWI·해마 사위 재구성·표적 작은 핵 대비·교육 효과 검증을 제공하지 않는다. 기본 3T 구조영상을 7T 자료라고 표현하지 않으며, 화면 확대를 해상도 향상이라고 표시하지 않는다.

브라우저 검증은 macOS의 Chrome headless/소프트웨어 WebGL 환경과 1440px·390px 뷰포트에서 수행했다. 실제 의료기관 디스플레이·Safari·모든 GPU에서 검증한 결과는 아니다. 개발용 테스트는 별도 임시 브라우저 프로필을 사용하여 사용자의 학습 기록을 건드리지 않는다.

## 2026-09-07 후속 점검

- 사용자 탭의 `Failed to fetch`와 8091 포트 미청취를 확인했다. 종료된 로컬 서버를 재시작한 뒤, 같은 사용자 탭에서 Atlas MRI 3면과 해마 강조가 복구됨을 확인했다. 재시도 버튼·서버 안내·실패 시 이전 MRI 숨김을 추가했다.
- `tests/atlas-recovery.mjs`: 연결 거부와 HTTP 503을 재현하고 화면의 재시도 버튼으로 MNI/Allen 템플릿 및 복귀, 로딩에 실패한 Atlas 위치 연습의 과제 준비 재개를 검증한다.
- `tests/expanded.mjs`: 새 주제 전체의 좌우/정중 라벨·앵커 연결, 부위/랜드마크 검색, 정중선 첫 응답·reload, 3D 구획 없는 주제의 잘못된 이전 모델 노출 방지를 검사한다.
- `scripts/review_expanded_cases.py`와 `qa/sub-0*-expanded-*.png`: 추가 26개 라벨/개인 × 4명에 대한 양측 세 방향 앵커 위치 검토. 기존 라벨 1–20의 번호·source ID·앵커·범위·복셀 수와 모든 MRI 해시는 이전 커밋과 동일하다. 검수 로그는 라벨 ID별 범위를 명시한다.

서버는 `serve.py`의 HTTP/1.1 연결 유지와 128개 요청 대기열을 사용한다. 기본 `http.server`로 테스트하던 중 새로고침에서 ES module 요청이 중단되는 사례가 있어 서버 실행 경로도 통일했다. 이 설정은 서버 프로세스 종료 자체를 방지하지 않으므로 사용 중 서버를 유지해야 한다.

추가 주제 브라우저 검사 결과는 `qa/expanded-report.json`에 기록했다. 새로 연결한 제3뇌실을 포함해 27개 좌우/정중 경로의 표시 라벨과 앵커를 확인했다. 최신 화면 예시는 `qa/individual-expanded.png`와 `qa/atlas-recovered.png`다.

## 구조 선택과 십자선 불일치 수정 (2026-09-07)

개인 탐색에서 구조·좌우 변경 시 제목과 마스크만 바뀌고 십자선은 이전 위치에 남던 오류를 수정했다. 이제 탐색에서는 해당 개인의 자동 분할 내부 지점으로 이동한다. 현재 십자선의 라벨과 선택 영역 안/밖을 표시하고, 위치 이동 버튼을 경계 힌트와 분리했다. 안내·추적·전이에서는 현재 십자선이 목표 위치를 뜻하지 않음을 명시한다. 개인 FreeSurfer와 별도 MNI AAL3의 출처 및 처리 차이는 [ANATOMICAL_VALIDITY.md](ANATOMICAL_VALIDITY.md)에 기록했다.

- `npm run test:navigation`: 46개 구획을 일반적인 구조·좌우 선택으로 탐색해 실제 라벨 복셀에 도착하는지 검사. 수동 이동 시 소속 갱신, 위치 복귀, T2 좌표 보존, 다른 개인의 고유 위치, 안내/전이 도움 잠금, AAL3 관련 영역 전환을 확인했다. `qa/navigation-report.json`.
- `uv run --with-requirements scripts/individual-requirements.txt python scripts/audit_navigation.py`: 원본 rawavg/T1 헤더로 좌표 변환을 독립 재구성하고 저장 앵커 184개와 브라우저 위치 54회를 원천 aparc+aseg ID와 대조했다. 총 238회 일치. `qa/navigation-source-audit.json`은 사용한 브라우저 보고서의 해시도 기록한다. 원천 staging 파일은 README의 다운로드 단계가 필요하다.
- 실제 브라우저의 해마·시상·뇌량 3면 화면(`qa/navigation-*.png`)과 nibabel의 독립 그림(`qa/navigation-independent.png`)을 시각 대조했다. 독립 그림의 관상·축상은 앱과 같은 방사선학적 좌우 표시다.
- 기존 단위 검사 10개, 브라우저 흐름 16개, 오류·저장소 복구 흐름 4개를 통과했다. 첫 응답 보존, 전이 잠금, 비교 좌표, Atlas, 390px 화면을 포함한다.

검사는 UI 동작과 원천 분할 좌표의 일관성을 확인한다. 전문의의 국소 경계 승인이나 교육 효과 검증을 대신하지 않는다. 이번 수정에서 MRI·분할 자산과 공간 변환 자체는 변경하지 않았다. 개인 AAL normalization 파이프라인도 추가하지 않았다.

## 안내 학습의 위치 찾기 개선 — 2026-09-07

- 앱이 개인 참고 라벨이 있는 구조와 관찰 측을 무작위로 선택한다. 실제 라벨을 1 mm 간격으로 조회해 각 방향에서 목표 면적이 넓은 단면을 고르고, 경계 픽셀을 반복 제거해 내부의 답 위치를 찾는다. 단순한 전체 bounding box 또는 중심 좌표를 정답으로 사용하지 않는다.
- NiiVue의 native voxel plane을 기준으로 좌표 변환한다. `setSliceMM(true)`는 native oblique 영상을 world-axis 단면으로 재구성하지 않는다. 촬영 방향이 기울어진 파일에서도 클릭과 목표가 같은 표시 단면에 있는지 확인한다. 원본 MRI/마스크 파일은 수정하지 않는다.
- 클릭한 점의 실제 참고 라벨로 일치/불일치를 구분한다. 불일치 중 같은 단면의 2 mm 반경에서 목표 라벨을 찾으면 경계 근처라고 안내한다. 이것은 자동 분할과의 위치 비교이며 전문 검수된 임상 점수가 아니다.
- 오답·정답 보기 뒤 목표 마스크와 같은 단면의 내부 지점을 표시한다. 글·확신도·존재 여부 입력은 새 안내 학습에서 제거했다. 세 방향을 마치면 다른 구조를 출제한다.
- 기존 서술형 기록은 보존하고 이전 안내 학습 draft는 별도 `-legacy` 키에 백업한다. 새 진행도와 응답을 복원하며, 기록 복습은 제출 당시 응답 ID를 유지한다.

검증: `npm test` 16개 통과. `node tests/guided.mjs`에서 세 방향의 실제 마우스 클릭, 일치/오답 피드백, 마스크와 답 지점, 재연습, 다음 단면, T2, 빠른 사례 전환, 복원, 전이/탐색 유지와 390px 화면을 검증했다. `node tests/browser.mjs`와 `node tests/resilience.mjs`도 통과했다. 각 결과는 `qa/guided-report.json`, `qa/browser-report.json`, `qa/resilience-report.json`에 기록했다. 브라우저 검증은 Chrome headless / software WebGL이며 전문의의 영상 가시성 검수는 포함하지 않는다.

추가 복원 검증: `node tests/guided-recovery.mjs` 통과. 이전 안내 학습 기록/draft 보존, 같은 십자선 위치의 재클릭, 기록 복습 뒤 재로딩, 미응답 다음 단면 복원, 좁은 화면의 영상 위 문제 표시를 검증했다. 결과: `qa/guided-recovery-report.json`.

안내 학습 출제 범위는 해마·미상핵·조가비핵·담창구·시상·뇌섬엽·대상회·측뇌실·뇌량 9종으로 한정했다. 경계가 추론에 의존하는 세부 피질 구획이나 전용 라벨이 없는 내포는 탐색에서 관찰한다.

## 탐색 중 주변 구조 표시 — 2026-09-07

- 탐색 모드에서 MRI 클릭 시 동일한 native 단면의 반경 10/15/25 mm (기본 15 mm)를 1 mm 격자로 조회한다. 등록된 개인 참고 라벨만 표시하며, 구조마다 주변에 같은 라벨이 충분히 있는 실제 내부 표본을 선택한다. 곡선형 구조의 평균 좌표나 다른 깊이의 고정 anchor를 단면 위에 대신 표시하지 않는다.
- 노란 점의 hover/focus/touch는 좌우·한영 구조 이름만 표시한다. 점을 눌러도 MRI의 탐색 위치나 왼쪽 선택 구조를 바꾸지 않는다. 새로운 클릭은 이전 DOM 마커를 교체하고, 결과가 없으면 점을 제거한다.
- 단면·사례·시퀀스·학습 모드 전환 시 결과를 지운다. 같은 영상의 확대·분할 조정에서는 NiiVue 그리기 완료 후 화면 위치를 다시 계산한다. 고해상도 화면의 device pixel ratio를 CSS 좌표로 변환한다. 3면 보기에서는 실제로 클릭한 tile에만 표시한다.
- `npm test`: 21개 통과. 반경/단면/등록 라벨/곡선형 영역/기울어진 native 방향을 검증한다. 기존 `node tests/browser.mjs` 회귀 검증도 통과했다.
- `node tests/nearby.mjs` 통과: 실제 MRI 클릭, 표시된 각 점의 hover, 키보드/터치 이름 확인, 각 점의 라벨 membership과 반경, 새로운 클릭으로 기존 점 제거, 빈 결과, 3면 중 클릭한 tile, T2/다른 사례, 모드 전환, DPR 2 및 2배 확대·화면 분할·viewport 크기 변경, 390px 터치 화면을 검증했다. 가까운 점끼리 투명 hit box가 서로 가리지 않도록 조정했다. uncaught browser error 없음. 결과: `qa/nearby-report.json`; 화면: `qa/nearby-hover.png`, `qa/nearby-mobile.png`.

## Command + 휠 확대·축소 — 2026-09-07

`node tests/wheel-zoom.mjs` 통과. 실제 Meta+wheel 입력이 개인 MRI와 참고 Atlas에서 좌표를 유지하며 확대하고, modifier 없는 휠은 기존대로 단면을 이동한다. 노란 점 위에서도 단축 조작이 적용된다. 1–4배 제한, 확대 컨트롤 동기화, T2 전환 시 확대 유지, 비교 영상 독립 확대도 확인했다. 브라우저 오류 없음. 결과: `qa/wheel-zoom-report.json`.

## 개인 3D / 실제 MRI 단면 통합 (2026-09-09)

4명 × 18개 원본 label 기반 GLB를 독립 해독하여 mask 경계 cell·anchor membership·winding·mm 범위·원본 hash 보존을 검사했다. Chrome의 실제 클릭, native 기울어진 세 방향/다중면, T1/T2, 두 절단 방향, 20회 사례 전환, 손상 GLB와 worker 복구, 전이 잠금·첫 응답 불변, 별도 공간 Atlas 및 모바일을 검증했다. MRI sample은 Python/nibabel 원본 판독과도 대조했다.

세 renderer의 실제 비교와 NiiVue framebuffer 밝기 검사, Metal/SwiftShader 성능 차이 및 아직 측정하지 않은 범위는 [통합 구현 기록](../docs/ATLAS-INTEGRATION-IMPLEMENTATION.md)에 정리했다. 피질 pial/white, smoothing·LOD와 임상/교육 전문가 검수는 완료하지 않았다.
