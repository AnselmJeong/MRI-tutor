# 개인 MRI / 3D 통합 구현 기록

2026-09-09. [도입 계획](ATLAS-INTEGRATION-PLAN.md)과 [기술 조사](research/2026-09-09-nervous-system-atlas-analysis.md)에 따른 첫 구현이다. 기존 작업 트리와 개인 학습 기록 형식을 유지했다. 새 개인 좌표 계약은 같은 개인 자료에 한해 기존 `trainer/PLAN.md`의 참고 모델 제한보다 우선한다. 표준 Atlas는 계속 별도 공간이다.

## 지금 사용할 수 있는 기능

- 기존 4명 각각의 좌우 해마·편도체·꼬리핵·조가비핵·시상 10개 ROI와 담창구·측뇌실·측두각·제3/4뇌실을 포함한 **18개 개인 구획**, 총 72개 GLB.
- `subject:<id>:T1-native-RAS-mm` 공간에서 원래 label affine을 한 번만 적용한다. GLB의 meter 단위는 viewer가 명시적으로 mm로 변환한다. 기존 header 보정을 다시 적용하지 않는다.
- 실제 T1 / 정합 T2의 native Axial·Coronal·Sagittal 및 3면을 3D에 표시한다. 기울어진 affine의 origin/basis/normal, voxel 중심과 반 복셀 FOV 가장자리를 보존한다.
- 단면과 같은 평면으로 구조를 잘라 표시한다. 잘린 교차점과 불투명 MRI plane 뒤에 가려진 구조는 picking에서 제외한다. 절단면을 막는 cap은 제공하지 않는다.
- MRI 클릭은 실제 위치를 유지하며 구조 선택을 연결한다. 목록 선택은 원래 mask 내부 anchor로 이동한다. 3D 클릭은 해당 표면 근처의 실제 mask 내부 복셀로 이동하며 다른 공간의 이벤트는 거부한다.
- MRI와 3D의 사례·시퀀스 변경을 독립적으로 처리한다. 이전 사례의 늦은 mesh, 손상 GLB, manifest/공간/hash 불일치는 현재 화면에 적용하지 않는다. 3D 재시도를 제공하며 MRI는 계속 사용할 수 있다.
- 첫 응답 전 연습에서는 3D와 찾는 경로를 숨긴다. 보이는 3D 노출은 기록하며, 제출 이후 노출은 기존 첫 응답을 바꾸지 않는 `helpEvents`에 사례·공간·팩 버전과 함께 저장한다. 기존 schema 1과 ID는 유지한다.
- MRI만 보기 또는 숨겨진 연습에서는 새 mesh를 미리 읽지 않는다. 접힌 3D에서는 단면 갱신을 멈추며 복원 시 최신 위치를 표시한다.

개인 모드 → **탐색** → **3D + MRI**에서 확인한다. 안내 학습은 첫 응답 뒤 **같은 단면을 개인 3D로 보기**를 사용할 수 있다. 왼쪽 아래에서 `MRI 절단면`, `단면으로 절단`, `전체 구조`를 조절한다. 개인 팩이 없는 피질 주제는 그 사실을 표시하고 다른 표면으로 대체하지 않는다.

## P0 renderer 결정

**기존 NiiVue + Three.js를 유지하고, 원래 volume에서 필요한 scalar slab만 복사 → worker에서 grayscale → unlit 2D texture** 경로를 채택했다. NiiVue의 원본 array를 worker로 넘겨 detach하거나 전체 volume을 복제하지 않는다. 현재 NiiVue의 nearest 보간과 W/L에 맞추며 영상 강도와 label은 원본에 남는다.

실행 가능한 비교 장면은 `trainer/qa/renderer-probe.html`이다. 같은 `sub-01` 원본 T1, 왼쪽 해마, native oblique Axial 단면으로 세 대안을 실행했다. 이는 전체 앱 교체나 모든 시퀀스·기기의 비교 결과가 아니다.

| 후보 | 첫 장면 준비·렌더 | 추가 GPU 영상 texture | 관찰 |
|---|---:|---:|---|
| Worker → 2D | 약 184 ms | 420,864 bytes | 추가 scalar slab도 420,864 bytes; 전체 volume 복사 없음 |
| Three.js R16I 3D texture | 약 108 ms | 80,805,888 bytes | 원본 int16 CPU array 재사용; 두 번째 renderer의 full GPU volume 필요 |
| NiiVue volume + mesh | 약 360 ms | NiiVue 관리; 정확한 peak는 미측정 | 동일 mesh를 mm로 추가하여 단면과 함께 표시 가능 |

수치는 원본 다운로드·해독 후 각 후보 초기화의 **단일 비교 실행**이며 최초 앱 방문 시간이나 통계적 속도 비교가 아니다. CPU heap 순간값도 보고서에 있으나 GC 시점이 다르므로 peak RAM이나 후보별 순증가량으로 해석하지 않는다. 고품질 shading보다 현재 학습 UI를 유지하면서 full GPU volume을 추가하지 않는 점을 선택 근거로 삼았다.

- 실제 Metal framebuffer 비교: 2D/3D texture의 검사된 grayscale 픽셀 32,063개에서 차이 0. NiiVue 화면과 worker grayscale의 확대된 voxel 중심 323개에서 최대 차이 1/255.
- 구조·단면 좌표는 같은 native frame을 사용한다. 기준은 world 축 고정 plane이나 화면 캡처가 아니다.
- 계측 환경: Apple M2 Max, 물리 RAM 64 GiB, macOS 27.0, Chrome 152.0.7977.83, ANGLE Metal, 1600×1050/DPR 1. `navigator.deviceMemory`의 32 GiB는 브라우저가 노출한 값이며 실제 RAM과 구분한다.
- Chrome SwiftShader도 기능 검증했다. 동일 입력의 p95가 약 533 ms였으므로 GPU가 없는 환경의 100 ms 반응을 보장하지 않는다.

기계 판독 결과: [renderer 비교](../trainer/qa/renderer-probe-report.json), [비교 화면](../trainer/qa/renderer-comparison.png), [개인 viewer](../trainer/qa/subject-report.json), [원본 대조](../trainer/qa/subject-data-report.json).

## 파생 팩과 재현

`trainer/assets/packs/subject-core/1/`는 약 7.7 MiB이고 `current.json`이 검증된 버전을 가리킨다. 구조별 manifest에는 source label ID, 원본 mask hash, T1/T2 hash·affine·dtype·slope/intercept, acquisition spacing, 내부 anchor, bounds, 자동 분할/참고용 구분과 QA를 저장한다. 원천 license 전문은 version 디렉터리에 함께 복사한다. `provenance.licenseFiles`는 그 version 디렉터리 기준이다.

이번 버전의 display mesh는 **평활화·decimation하지 않은 reference surface**다. 별도 원본 mask를 정답 조회에 계속 사용한다. 72개 GLB를 해독한 모든 정점이 원본 label과 비label이 만나는 cell에 있고, anchor membership와 바깥 방향 winding, source hash 보존을 검사했다. Lewiner marching cubes의 모호한 cell 처리 정점도 검사에 포함했다. 이것은 자동 분할의 해부학적 경계에 대한 전문의 검수가 아니다.

```sh
# 기존 version은 덮어쓰지 않는다. 전체 사례 검증 후 current.json만 전환한다.
npm run build:subject -- --version 2
npm test
npm run test:subject-data
MRI_QA_GPU=metal npm run test:subject-browser
npm run test:subject-failures
```

Python 의존성은 `scripts/subject-mesh-requirements.txt`에 고정했다. 제작 staging과 최종 경로는 같은 프로젝트 볼륨이다. 원본 T1, native T2, 정합 T2와 label은 수정하지 않는다. 현재 학습 앱의 기존 label/task ID와 자동 분할의 `reference-only` 의미도 유지한다.

Three.js r185의 GLTFLoader / BufferGeometryUtils / SkeletonUtils를 같은 버전으로 vendoring했다. 기존 MIT 전문을 유지하며 로컬 import 경로만 바꿨다. 새 renderer와 pipeline은 독립 구현이며 Nervous System Atlas 코드·표본 수치·콘텐츠를 복사하지 않았다.

## 검증과 남은 범위

현재 검증은 Chrome에서 실행한 단위·데이터·브라우저 검사다. 핵심 증거는 다음과 같다.

- 기존 MRI, guided/guided-recovery, nearby, navigation, resilience, atlas-recovery, split-layout, wheel-zoom, HTTP LAN ID와 확장 주제 회귀 경로.
- 4명 72개 GLB, 원본 checksum, source mask boundary cell, 실제 anchor, winding, 해독 후 mm bounds.
- 비대각·반사 affine, x-fastest 저장 순서, 반 복셀 규칙, 공간 거부, 첫 응답 보존과 additive 도움 기록.
- 실제 MRI 각 plane와 3D plane의 world 오차 0.001 mm 미만; Python/nibabel 독립 source sampling 192개와 일치.
- 20회 사례 전환에서 현재 팩 18개, worker 1개, texture 수가 누적 증가하지 않음. 같은 개인 T1/T2와 다른 개인 비교 회귀도 통과.
- 손상 GLB, 오래된 요청, worker 오류, 지원하지 않는 ROI, 두 rollback flag, 전이용 `sub-04` 첫 응답 잠금·복원.
- Metal에서 12회의 연속 단면 입력→갱신 p95 약 33 ms. 자동화 입력/대기 시간을 포함하며 장시간 사용자 연구 결과는 아니다.

`subject3D=0`은 개인 3D를 끄고, `mriSliceIn3D=0`은 개인 mesh를 유지하면서 texture plane만 끈다. URL query로 적용하며 MRI 학습과 기존 저장 자료는 유지한다. 예: `http://127.0.0.1:8091/?subject3D=0`. 손상 팩에서 다른 개인 또는 표준 Atlas로 자동 fallback하지 않는다.

**P0–P2의 핵심 경로를 구현·검증했지만 전체 계획의 완료를 뜻하지 않는다.** SDF smoothing, Meshopt/LOD, 개인 pial/white/annotation 수급, 실제 source-surface 변환 검증, 새로운 임상 교육 모듈, 전문가 answer-set, 사용성 파일럿과 P6 확장은 남아 있다. 이 버전은 원래 표면을 사용하는 보수적 경로이므로 smoothing/LOD의 정확도·압축률을 주장하지 않는다. Safari/Edge, 전체 peak RAM/GPU memory, 30 FPS 드래그의 장시간 계측과 전문의 경계 검수도 아직 완료 기준에 넣지 않는다.

검증 로그: `trainer/qa/atlas-integration-regressions.json`, `subject-report.json`, `subject-software-report.json`, `subject-data-report.json`, `subject-failures-report.json`. 브라우저 검사의 기존 Axial 기본 보기와 맞지 않는 y 좌표 기대값, 즉시 공개되던 guided route 기대값, 표준 3D에 의존하던 확장 주제 기대값은 새 동작에 맞게 변경했다. 수정 전 상태는 [baseline](research/2026-09-09-atlas-implementation-baseline.json)에 기록했다.
