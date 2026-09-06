# MRI Tutor — 개인 MRI를 읽는 연습

정신과 전문의가 개인 MRI의 위치·형태·주변 관계를 연속 단면에서 설명하도록 돕는 로컬 웹앱입니다. 기본 화면은 실제 StudyForrest 개인 영상입니다. 기존 참고 Atlas, 3D 조작과 높이 조절 분할도 유지합니다.

## 실행

macOS의 `Start MRI Tutor.command`를 실행하거나 프로젝트 루트에서 다음을 실행합니다.

```sh
python3 trainer/serve.py
```

기본 주소는 `http://127.0.0.1:8091/`입니다. 이미 사용 중이면 다른 포트를 열고 실제 주소를 출력합니다. 같은 주소·브라우저 프로필에서 진도가 유지됩니다. Python 3와 WebGL2 브라우저가 필요합니다. Chrome에서 검증했으며 Safari의 GPU·메모리 동작은 검증하지 않았습니다. 실행 중 인터넷·API 키·AI 서비스는 사용하지 않습니다.

## 개인 영상 판독 훈련

1. **안내 학습**: 사례 01–03과 구조를 선택합니다. 회색조 영상에서 먼저 관찰한 뒤 필요할 때 주변 랜드마크·다른 방향·3D·참고 경계를 엽니다. 참고 경계 버튼은 다시 누르면 꺼집니다.
2. **연속 추적**: 같은 방향에서 서로 다른 깊이에 출현 → 형태 변화 → 소실 지점을 순서대로 기록합니다. 앞뒤 이동은 휠·↑↓·좌표 슬라이더·±1 mm 버튼으로 합니다. 자동 분할의 범위가 실제 조직의 끝을 보증하지는 않습니다.
3. **비교**: 동일인의 원본 T1과 정합 T2는 같은 T1 world 좌표를 공유합니다. 다른 개인은 독립 좌표로 탐색합니다. `각자의 구조 위치로`는 각 개인의 참고 위치로 이동하는 도움입니다. 개인 간 정밀 정합이나 동일한 절편이라는 뜻이 아닙니다.
4. **전이 연습**: 학습에 사용하지 않은 별도 사례 04입니다. 첫 응답 전 참고 힌트·경계·3D는 가리지만 단면과 시퀀스는 이동할 수 있습니다. 이 사례를 한 번 연 뒤의 새 연습은 ‘이전 노출 있음’으로 기록합니다. 첫 노출 세션의 미완성 응답은 새로고침해도 이어집니다.
5. **응답과 피드백**: 위치를 찾음 / 단면에 없음 / 현재 대비에서 식별 어려움을 구분하고 근거를 적습니다. 위치를 찾았다면 MRI에서 클릭해야 합니다. 이후 단면을 이동하면 이전 클릭은 무효가 되어 잘못된 위치가 제출되지 않습니다. 첫 응답은 잠기고 실제 영상·주변 관계·자동 분할과 대조하는 참고 피드백이 나옵니다.
6. **학습 기록**: 사례·구조·방향·도움 사용·서술·추적 지점·자기 점검을 저장합니다. 최근 관찰에서 복습하고 JSON으로 내보낼 수 있습니다. 개인 영상에서는 임상 정답률을 계산하지 않습니다.

확대, Window/Level, T1/T2, 단일 axial/coronal/sagittal 및 3면 동시 보기를 제공합니다. 파일의 강도 상세는 그대로 두고 화면 표시 범위만 바꿉니다. R/L은 환자 기준, 좌우는 방사선학적 표시입니다. 좌표는 해당 개인의 T1 scanner RAS이며 MNI 좌표가 아닙니다. 헤더에 기초한 좌우를 별도의 물리적 좌우 표지로 검증한 것은 아닙니다.

## 범위와 검수 상태

4명의 T1/T2, 44개 관찰 과제 계약, 개인별 20개 좌우·정중 참고 구획을 제공합니다. 핵심 주제는 해마, 편도체, 미상핵, 조가비핵, 담창구 전체, 시상, 뇌섬엽, 대상회, 측뇌실, 뇌량, 내포입니다. 내포는 개인 라벨 없이 주변 랜드마크로 관찰합니다.

원본 다운로드·checksum·헤더·방향·강도·양측 라벨 앵커 및 세 방향 시각 QC를 수행했습니다. 자동 FreeSurfer 분할의 전문의 경계 검수는 수행하지 않았습니다. `reference-only`, `scoreable:false`로 남기고 임상 정답으로 채점하지 않습니다. ‘단면 범위 안/밖’ 피드백은 자동 라벨의 기하학적 범위 비교이지 가시성·부재의 확정 판정이 아닙니다.

작은 핵과 기능적 영역은 기존 42종 참고 Atlas에서 탐색합니다. SN·LC 등의 표적 대비 영상은 이번 사례에 없으며 일반 T1/T2에서 작은 핵의 직접 경계 식별을 평가하지 않습니다. 기능 회로나 dlPFC/vmPFC의 경계를 T1에서 직접 보이는 구조로 다루지 않습니다. 질환 사례·FLAIR/DWI/SWI 판독, 해마 사위 재구성, MTA/Fazekas 등 임상 척도, 환자 영상 업로드, 교육 효과 검증은 포함하지 않습니다.

## 3D와 분할

3D는 공간 관계 참고 모델입니다. 개인 MRI 모드에서는 개별 영상의 커서나 절단 위치를 3D에 겹치지 않습니다. 주제와 필요한 이웃 구조를 중심으로 표시하며 회전·확대·투명도·반구 절단·전체 구조 보기를 유지합니다. 개인별 3D 재구성이나 정밀 정합은 하지 않습니다.

가로 분할선을 끌어 3D/MRI 높이를 조절합니다. 양 끝은 각각 MRI만/3D만이며 `3D + MRI`로 복원합니다. 비율은 저장되며 뷰어·카메라·MRI 위치는 유지됩니다. 분할선에서 ↑↓, Home(MRI만), End(3D만), Enter(분할 복원), 두 번 클릭(기본 30/70)도 사용할 수 있습니다.

`참고 Atlas`는 집단 평균 T1 템플릿의 별도 학습 모드입니다. 기존 Atlas 위치 연습·3D 구조 찾기·16개 기초 문제·회로 탐색을 유지합니다. Atlas ROI 포함 여부 점수는 개인 MRI 판독 능력 평가와 별개입니다.

## 재현

선택된 앱 영상·라이브러리가 저장소에 포함됩니다. 원본 staging과 파생 과정을 다시 만들려면 Python용 `uv`, 계약 생성에는 Node 20+를 사용합니다.

```sh
python3 scripts/fetch_individual_cases.py
uv run --with-requirements scripts/individual-requirements.txt python scripts/build_individual_cases.py
node scripts/build_case_contracts.mjs
uv run --with-requirements scripts/individual-requirements.txt python scripts/validate_individual_cases.py
```

다운로드는 git-annex의 크기·MD5/SHA256을 검증하고 SHA-256 기록을 추가합니다. T1과 원본 T2는 그대로 보존합니다. T2는 SimpleITK Euler3D 강체 정합 후 원본으로부터 선형 보간 1회로 T1 격자에 float32 저장합니다. 동일 촬영의 FreeSurfer rawavg와 T1을 복셀 순서로 대조하여 헤더 차이를 보정하고, 개인 분할 자체는 native 1 mm 격자에 보존합니다. 좌표·변환·checksum·검수 범위는 `assets/cases/*/case.json`에 있습니다.

기존 시각 QC는 검사한 파일 해시와 연결되어 있으며 파생 데이터가 바뀌면 계약 생성이 실패하여 재검토를 요구합니다. 재검토가 필요할 때 `qc-review.json`의 승인 상태를 임의로 올리지 마세요.

```sh
uv run --with-requirements scripts/individual-requirements.txt python scripts/review_individual_cases.py
uv run --with-requirements scripts/individual-requirements.txt python scripts/review_individual_cases.py --right
npm ci
npm test
npm run test:browser
npm run test:resilience
```

브라우저 테스트는 별도 임시 Chrome 프로필을 쓰며 실제 사용자 진도를 변경하지 않습니다. 로컬 서버를 먼저 실행해야 합니다. 테스트 코드는 운영 중 인터넷이 필요한 것이 아니며 개발용 Playwright만 사용합니다.

출처와 라이선스: [DATA-SOURCES.md](DATA-SOURCES.md). 검증 근거: [VERIFICATION.md](VERIFICATION.md).
