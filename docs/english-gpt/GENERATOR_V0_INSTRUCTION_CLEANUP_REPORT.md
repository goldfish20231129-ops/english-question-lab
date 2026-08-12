# Generator v0 Instruction Cleanup Report

## 1. 작업 범위와 기준

이번 작업은 기존 AI Instructions를 직접 덮어쓰지 않고, 다음 우선순위에 따라 실행 가능한 새 Core Instructions를 재구성한 문서 작업이다.

1. `GENERATION_CONTRACT_V0.md`
2. `csat-output-schema.json`
3. `GENERATOR_V0_DESIGN.md`
4. 현재 문제 제작 AI Instructions
5. 현재 앱 Prompt Builder

생성 결과는 `GENERATOR_CORE_INSTRUCTIONS_V0.md`다. 앱 Prompt Builder, 기존 Instructions 파일, 실제 ChatGPT Project/Custom GPT 설정, Contract, Schema와 프로그램 코드는 수정하지 않았다.

## 2. 기존 Instructions에서 제거한 중복

여기서 “제거”는 기존 파일을 수정했다는 뜻이 아니라, 새 Core Instructions를 재구성하면서 중복 정의를 넣지 않았다는 뜻이다.

| 기존 반복 | 새 Core에서의 처리 | authoritative owner |
|---|---|---|
| 승인 절차가 역할 소개·승인 섹션·최종 출력에 반복 | initial mode의 단일 상태 기계로 통합 | Core |
| 카드마다 같은 저작권 문단 반복 | 전역 Copyright and originality에 한 번만 정의 | Core |
| 카드마다 같은 정답 분산 문장 반복 | Answer position policy에 한 번만 정의 | Core |
| 카드마다 일반 distractor 오류 목록 반복 | 공통 품질 원칙만 Core에 두고 유형별 특수 전략은 Request에 위임 | Core / Request |
| 카드마다 전체 `qualityReview` 필드와 점수 규칙 반복 | 의미와 행동만 Core에 두고 필드 구조는 Schema 참조 | Schema / Core |
| 전체 JSON 구조 예시 반복 | 예시를 제거하고 Contract와 Schema를 참조 | Contract / Schema |
| ID 보존이 공통부·카드부·출력부에서 반복 | ID and blueprint integrity에 통합 | Contract / Core |
| 전체 유형의 marker와 variant 세부 규칙 반복 | 불변 논리만 Type registry에 유지 | Core / Request |
| 이번 세트의 실제 ID·난이도·소재를 고정 지침에 포함 | Core에서 제외 | Request |
| hard-coded 평가원 길이 통계 | Core에서 제외 | Future Corpus Profile |

## 3. 수정한 충돌

### 3.1 JSON 빈 문자열

기존 제공 Instructions의 다음 취지는 엄격한 JSON과 충돌했다.

> `material=""` 대신 “material이 빈 문자열이다”처럼 쓴다.

새 Core에서는 이 지시를 완전히 제거하고 `"material": ""`처럼 유효한 JSON 속성값을 쓰도록 명시했다.

### 3.2 Contract와 사용자 요구의 우선순위

기존에는 사용자가 대화에서 확정한 요구가 가장 높아 Contract 위반 요구도 우선하는 것으로 해석될 수 있었다. 새 Core에서는 Contract/Schema, ID·blueprint 무결성, 저작권 규칙을 승인된 Request보다 위에 두었다.

### 3.3 누락 정보와 설계안 동시 출력

기존 “질문한 뒤 전체 설계안 제시” 문구는 답을 받기 전에 불완전한 설계를 만들 수 있었다. 새 Core에서는 설계를 막는 누락 정보가 있으면 질문하고 응답을 종료한다. Generator가 선택하도록 명시된 항목만 `AI 결정`으로 표시해 설계안에 포함한다.

### 3.4 정답 분산과 논리적 정답

정답 위치 분산이 정답 타당성보다 앞서는 해석을 막았다. 위치 계획은 세트 편집 보조 원칙이며, 단일 정답과 지문 근거를 바꾸는 이유가 될 수 없다고 명시했다.

### 3.5 importer 호환과 공식 출력

importer가 단일 Markdown fence를 호환 입력으로 처리하더라도 Generator 공식 출력에는 Markdown과 code fence를 금지했다.

### 3.6 `qualityReview` 점수와 품질 인증

자기 점수만 높이면 품질을 통과한 것으로 보일 수 있는 충돌을 제거했다. `qualityReview`는 자기평가 metadata이며 Validator, Verifier, 사람 검수를 대체하지 않는다고 명시했다.

## 4. 우선순위 변경

새 Core의 우선순위는 다음과 같다.

1. Generation Contract V0와 JSON Schema
2. ID·template·variant 및 고정 blueprint 무결성
3. 저작권과 실제 기출 복제 금지
4. 승인된 Request-Specific Prompt
5. Generator Core 일반 제작 원칙
6. provenance가 있는 선택적 Corpus Profile
7. 위 규칙과 충돌하지 않는 사용자 후속 요구

핵심 변경은 Contract와 식별자 무결성을 사용자의 가변 요구보다 위에 둔 것이다. Corpus Profile은 Core를 보정할 수 있지만 Contract, 단일 정답, 저작권과 승인 절차를 덮어쓸 수 없다.

## 5. 누락 정보 처리 변경

| 상황 | 새 동작 |
|---|---|
| ID, blueprint, 필수 자료 등 설계 진행에 필요한 값이 없음 | 필요한 항목만 질문하고 응답 종료 |
| Request가 Generator에게 선택하도록 명시 | 설계안에 `AI 결정`으로 표시 |
| 제공 자료의 보존·표식 범위가 불명확 | 승인 전에 질문 |
| repair에 완성 원본 Generation JSON이 없음 | 새 문제를 추측하지 않고 완성 원본 요청 |

질문과 불완전한 전체 설계안을 같은 응답에 강제로 섞지 않는다.

## 6. JSON 빈 문자열 문제 수정

새 Core는 다음을 명시한다.

- 빈 문자열은 `"material": ""`처럼 쓴다.
- JSON 밖의 자연어로 빈 값을 설명하지 않는다.
- Schema에 없는 필드를 추가하지 않는다.
- 설명, Markdown, code fence, 주석, trailing comma, `undefined`, `NaN`, `Infinity`를 출력하지 않는다.
- 전체 Schema 예시를 Core에 복제하지 않고 Contract와 Schema를 따른다.

따라서 기존 자연어 빈 문자열 문구와 실제 JSON 문법의 충돌은 새 Core에서 제거되었다.

## 7. qualityReview 의미 정리

`qualityReview`는 유지하되 책임을 다음처럼 분리했다.

| 책임 | owner |
|---|---|
| 필수 필드, 타입, 점수 범위 | `csat-output-schema.json` |
| 낮은 점수이면 문제를 먼저 수정하고 재평가 | Core |
| 근거 없이 9~10점을 주지 않음 | Core |
| strongest distractor와 정답의 구분 | Core |
| 이번 문항의 `expectedDifficulty` 목표 | Request |
| 실제 품질 승인 | Validator / Verifier / 사람 검수 |

자기평가 점수는 결과 품질의 증명서가 아니다. 구조 오류, 복수 정답, 근거 불일치가 있으면 높은 점수를 주지 않도록 했다.

## 8. 정답 위치 정책 정리

정답 위치에 관한 두 개념을 분리했다.

- 실제 기출 정답 분포를 모방하지 않는다.
- 현재 생성 세트 안에서는 가능한 범위에서 위치 편향을 줄인다.

추가로 다음 제한을 명시했다.

- 위치 계획 때문에 논리적으로 타당한 정답을 바꾸지 않는다.
- `answerIndex`만 변경해 오류를 숨기지 않는다.
- 문항 수가 적으면 모든 번호를 억지로 사용하지 않는다.
- 위치 계획과 정답 유일성이 충돌하면 정답 타당성을 우선한다.

## 9. Core / Request / Corpus 경계

### 9.1 Core에 남긴 규칙

- 지원 범위와 Contract boundary
- 규칙 우선순위
- initial/repair 상태 기계
- 승인 절차와 정확한 승인 문구
- 누락 정보 처리
- ID와 blueprint 무결성
- 저작권·창작성 원칙
- 공통 단일 정답·오답·근거 품질
- 정답 위치 정책
- 유형별 변하지 않는 출제 대상과 논리적 무결성
- 사용자 제공 자료의 안전한 처리
- 자체 검토 알고리즘
- `qualityReview`의 역할
- 엄격한 JSON 출력 행동

### 9.2 Request에 남겨야 할 규칙

- 이번 `title`
- 실제 `itemId`, `templateId`, `variantId`
- 선택된 template/variant blueprint
- 고정 question count와 slot
- 이번 marker와 `materialSpec.kind`
- choice language와 variant-specific 구조
- 대상 수준, 이번 난이도와 배점
- 이번 소재, 장르, 출제 의도
- 이번 목표 길이
- 자료 작성 방식과 사용자 제공 자료
- 카드별 특수 요구
- 승인된 설계 또는 repair finding·revise note

### 9.3 Future Corpus Profile로 이동할 규칙

- 유형별 실제 passage 길이 분포
- 학년·source family별 어휘 분포
- 문장 길이와 구문 복잡도
- 유형별 담화 구조 통계
- 정답 추론 거리
- distractor 유형과 분포
- 난이도 calibration
- 선택지 길이·형태 통계

새 Core에는 실제 통계값을 넣지 않았다. Profile은 `profileId`, `profileVersion`, provenance, source range, sample size, coverage가 있을 때만 참고하도록 했다.

## 10. Core에 남긴 유형 규칙 범위

Type registry에는 다음 유형의 불변 원칙만 남겼다.

- 목적·심경·주장·요지·주제·제목
- 함축 의미
- 도표
- 내용 일치·불일치 및 실용문
- 어법
- 어휘
- 빈칸
- 무관한 문장
- 글의 순서
- 문장 삽입
- 요약문 완성
- 41~42 공유 설명문
- 43~45 공유 서사문

각 유형에서 출제 대상, 단일 정답 조건과 핵심 논리 무결성만 정의했다. 정확한 marker, `materialSpec.kind`, question count, choice language, variant 구조, 목표 길이, 난이도와 소재는 Request blueprint가 결정한다.

## 11. 현재 Prompt Builder에 남아 있는 중복

이번 작업에서는 Prompt Builder를 수정하지 않았다. 다음 표는 새 Core를 실제 AI 설정에 적용한 뒤 향후 Prompt Builder에서 정리할 수 있는 후보를 나타낸다.

| 현재 Prompt Builder 반복 내용 | Core가 이미 소유 | Request에 남김 | Future Corpus로 이동 | 향후 처리 권고 |
|---|---:|---:|---:|---|
| `CSAT_GPT_APPROVAL_PROTOCOL` 전체 | 예 | 아니요 | 아니요 | Core 적용 확인 후 prompt에서 전문 제거, request mode만 전달 |
| prompt 첫머리의 역할·듣기 제외·5지선다 | 예 | 아니요 | 아니요 | Core 참조로 축약 |
| 모든 카드의 저작권·기출 복제 금지 문단 | 예 | 아니요 | 아니요 | 카드별 반복 제거 |
| 모든 카드의 일반 distractor 오류 목록 | 일부 | 유형별 요구만 | 아니요 | 공통 문장은 제거하고 선택 카드 특수 전략만 유지 |
| 카드마다 반복되는 `CSAT_QUALITY_REVIEW_INSTRUCTIONS` | 예 | `expectedDifficulty` 목표만 | 아니요 | 필드 전문 제거, 이번 목표만 유지 |
| prompt 말미의 동일 qualityReview 블록 | 예 | 아니요 | 아니요 | 중복 제거 |
| `[승인 후 출력 JSON]` 전체 예시 | Contract/Schema가 소유 | 실제 ID 값만 | 아니요 | Schema 전문 유사 예시 제거 |
| 세트·카드별 ID 보존 문장 | 원칙은 예 | 실제 ID와 연결은 예 | 아니요 | 원칙 반복 제거, 값과 청사진은 유지 |
| 정답 위치 분산의 세트·카드별 반복 | 예 | 승인된 세트 계획만 | 아니요 | 카드별 반복 제거 |
| 선택 카드의 template/variant steps | 아니요 | 예 | 아니요 | 유지 |
| marker, `materialSpec`, choice language | 일반 경계만 | 예 | 아니요 | 선택 카드의 정확한 blueprint는 유지 |
| 이번 목표 길이 범위 | 아니요 | 예 | 아니요 | 유지 |
| “실제 평가원 최소/평균/최대” hard-coded 통계 | 아니요 | 현재 요청값 아님 | 예 | provenance가 있는 Profile 전까지 authoritative 표현 제거 후보 |
| 이번 난이도·소재·출제 의도·사용자 자료 | 아니요 | 예 | 아니요 | 유지 |
| 전체 유형의 미선택 variant 설명 | 불변 원칙만 | 선택 유형만 | 아니요 | 미선택 상세 규칙 제거 |

이 표는 후속 작업의 설계 근거일 뿐 현재 Prompt Builder에 반영하지 않았다.

## 12. 아직 Prompt Builder에 남은 호환성 주의점

- 현재 승인 프로토콜은 “누락 항목을 질문한 뒤 전체 설계안 제시”라고 되어 있어 새 Core의 질문 후 종료 규칙과 표현이 다르다.
- 동일 `qualityReview` 지침이 카드마다 한 번, prompt 말미에 다시 한 번 들어간다.
- JSON 전체 예시가 Schema와 함께 이중 source of truth처럼 보일 수 있다.
- 실제 평가원 길이 통계는 profile version과 provenance 없이 prompt에 포함된다.
- 세트 수준 정답 분산 원칙이 카드별 블록에도 반복된다.
- 저작권과 일반 distractor 규칙이 모든 카드에 반복된다.

현재 source-of-truth 우선순위에서는 새 Core와 Contract가 상위이므로, 실제 적용 전 Prompt Builder를 정리하면 지시 충돌과 토큰 낭비를 줄일 수 있다.

## 13. 자체 검토 알고리즘 정리

새 Core는 출력 전 다음 순서를 고정했다.

1. ID/template/variant 보존
2. question/choice count
3. marker/materialSpec/section
4. 실제 출력 영어 길이
5. 정답 독립 풀이
6. 단일 정답
7. strongest distractor와 정답의 결정적 차이
8. explanation/evidence/distractorReasons 일치
9. 영어 자연스러움
10. 기출 복제 위험
11. `qualityReview`
12. Schema와 runtime blueprint
13. JSON 직렬화

실패하면 점수만 조정하지 않고 관련 문제와 metadata를 수정한 뒤 전체 순서를 다시 검사하도록 했다.

## 14. 다음 단계 권고

1. `GENERATOR_CORE_INSTRUCTIONS_V0.md`를 사람이 최종 검토한다.
2. 검토 후에만 ChatGPT Project 또는 Custom GPT의 고정 Instructions에 수동 적용한다.
3. 실제 적용이 확인된 뒤 별도 작업으로 Prompt Builder 중복을 제거한다.
4. Prompt Builder 수정 시 기존 generation prompt snapshot과 import 테스트를 유지한다.
5. initial 설계, 누락 정보, 승인, repair, Contract 위반, 엄격 JSON의 대화 시나리오를 각각 시험한다.
6. 정상 Generation JSON이 현재 strict importer를 그대로 통과하는지 확인한다.
7. Corpus 통계는 provenance가 확보된 후 별도 `[CORPUS_PROFILE]` 계약으로 설계한다.

## 15. 변경 여부

| 대상 | 이번 작업의 변경 |
|---|---|
| 새 Core Instructions 문서 | 생성 |
| Cleanup report | 생성 |
| 기존 AI Instructions 파일 | 변경 없음 |
| 앱 Prompt Builder | 변경 없음 |
| Generation Contract V0 | 변경 없음 |
| JSON Schema | 변경 없음 |
| importer / renderer / verification | 변경 없음 |
| 실제 ChatGPT Project/Custom GPT 설정 | 변경 없음 |
| Corpus Engine / DB / Supabase / API / production | 변경 없음 |

## 16. 최종 판정

새 Core Instructions는 Contract 경계, 우선순위, initial/repair 상태, ID 무결성, 저작권, 정답 위치 정책, 유형별 불변 원칙, `qualityReview`의 한계, 선택적 Corpus Profile과 엄격한 JSON을 충돌 없이 정의한다. 잘못된 빈 문자열 지시는 제거되었고 미검증 Corpus 통계는 포함하지 않았다.

현재 Prompt Builder의 중복은 그대로 남아 있지만, 이는 이번 작업에서 의도적으로 수정하지 않은 다음 단계 대상이며 새 Core Instructions 자체의 완성을 막지 않는다.

**READY_TO_BUILD_GENERATOR_V0**
