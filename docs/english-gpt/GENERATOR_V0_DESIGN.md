# English Question Generator v0 설계

## 문서 상태

- 대상: `english-question-lab`의 수능형 영어 읽기 문항 제작 흐름
- 범위: Generator v0 지침 구조 설계와 규칙 소유권 정리
- 비범위: 문제 생성, Prompt Builder 수정, AI Instructions 수정, JSON Schema 수정, API 연결, Corpus Engine 수정
- 구조 계약 기준: `docs/english-gpt/GENERATION_CONTRACT_V0.md`, `docs/english-gpt/csat-output-schema.json`
- 조사 기준: 저장소의 현재 Instructions와 Prompt Builder, 실제 프로그램 생성 프롬프트, 정상 import Generation JSON

이 문서는 현재 동작이나 계약을 바꾸지 않는다. 기존 규칙을 세 계층으로 분리하고, 향후 Generator v0용 최종 지침서를 만들 때 각 규칙의 authoritative owner가 어디여야 하는지를 결정한다.

## 1. Generator v0의 목적

Generator v0는 API가 아니라 복사·붙여넣기 방식으로 동작하는 수능형 영어 읽기 문항 제작 전용 AI다.

1. 앱이 제작 조건과 식별자를 포함한 Request-Specific Prompt를 생성한다.
2. 사용자가 그 프롬프트를 Generator v0 대화에 붙여넣는다.
3. 최초 제작이면 Generator가 한국어 설계안을 제시한다.
4. 사용자가 설계안을 명시적으로 승인한다.
5. Generator가 Generation Contract V0를 만족하는 JSON 객체 하나를 반환한다.
6. 사용자가 JSON을 앱에 붙여넣는다.
7. 앱이 JSON을 parse하고 Schema 및 요청 청사진과 대조한 뒤 시험지·정답표·해설지를 렌더링한다.

Generator v0의 목표는 기존 앱 계약에 정확히 맞는 결과를 안정적으로 생성하는 것이다. 새로운 계약을 정의하거나 현재 앱의 허용 범위를 넓히는 것이 아니다.

## 2. 현재 제작 흐름

현재 흐름에는 서로 다른 책임을 가진 네 가지 규칙 원천이 있다.

| 원천 | 현재 역할 | v0에서의 권위 |
|---|---|---|
| AI Instructions | 역할, 대화 상태, 제작 원칙, 자체 검수, 출력 규율 | Generator Core Instructions의 원천 |
| 앱 Prompt Builder | 이번 세트의 사용자 조건, 카드별 ID와 청사진, 유형별 세부 요구 | Request-Specific Prompt의 원천 |
| Generation Contract V0 | 앱이 받아들이는 결과의 의미와 런타임 호환 규칙 | 비가역적 호환성 계약 |
| `csat-output-schema.json` | JSON의 구조, 필수 필드, 타입, 값 범위, 추가 필드 금지 | JSON 구조의 단일 authoritative source |

향후 Corpus Profile은 다섯 번째 선택적 입력이 될 수 있지만 현재는 검증된 통계 데이터가 충분하지 않다. 따라서 v0 Core 또는 Request에 통계값을 새로 만들어 넣지 않는다.

현재 Prompt Builder는 Request 정보뿐 아니라 승인 절차, 일반 제작 원칙, 저작권 규칙, 품질 검수 규칙, Schema 예시까지 반복한다. 이 방식은 실행 가능하지만 프롬프트가 길고, Core와 Prompt 중 어느 문장이 우선하는지 불명확해질 수 있다. Generator v0 설계에서는 책임을 분리하되 현재 앱 출력은 이번 단계에서 변경하지 않는다.

## 3. Generator Core Instructions로 이동할 규칙

Core Instructions는 요청이 바뀌어도 변하지 않는 규칙만 소유한다. 계약과 충돌할 경우 Core가 계약을 재정의해서는 안 되며, Contract와 Schema를 준수하도록 연결해야 한다.

### 3.1 역할과 지원 범위

- 대한민국 수능 영어 읽기 18~45번 구조를 따르는 창작 출제자이자 검증 결과 편집자다.
- 듣기 1~17번은 생성하지 않는다.
- 수능형 Generation JSON만 지원한다.
- 학교 시험·사용자 정의 형식은 v0 범위 밖이다.
- 실제 기출의 문체와 사고 구조는 참고할 수 있으나 문장, 선지, 인물, 기관, 장소, 수치, 고유 사례를 복제하지 않는다.

### 3.2 비가역적 우선순위

현재 Instructions의 “현재 대화에서 확정한 요구” 최우선 규칙은 계약 위반 요구까지 우선하는 것으로 오해될 수 있다. v0 Core의 권고 우선순위는 다음과 같다.

1. Generation Contract V0와 JSON Schema
2. ID·청사진 보존 및 저작권·안전 규칙
3. 승인된 Request-Specific Prompt의 제작 조건
4. Generator Core의 일반 제작 원칙
5. 선택적으로 제공된, 출처와 버전이 명시된 Corpus Profile
6. 사용자의 후속 선호 중 위 규칙과 충돌하지 않는 내용

사용자의 요구가 `itemId`, `templateId`, `variantId`, 고정 문항 수 또는 Schema를 위반하면 그대로 실행하지 않고 충돌을 알려야 한다.

### 3.3 최초 제작과 repair 상태 기계

Core는 대화 상태를 소유한다.

#### 최초 제작 모드

- `[VERIFICATION_REPAIR]`가 없는 새 요청은 최초 제작 모드다.
- 첫 응답에서 지문, 선지, 임시 JSON을 만들지 않는다.
- 한국어 `[세트 제작 설계안]`을 먼저 제시한다.
- 설계안은 세트 요약, 카드별 식별자, 유형·변형, 소재·장르, 논리 전개, 목표 길이, 난도·배점, 정답 추론 구조, 오답 전략, 필수 표식·구획, 세트 수준 정답 위치 계획을 포함한다.
- 승인 문구와 승인 판단 방식은 한 곳에서만 정의한다.
- 사용자가 전체 설계를 명시적으로 승인한 뒤에만 최종 JSON을 생성한다.
- 설계 수정이 있으면 전체 설계안을 다시 제시한다.

필수 정보가 없을 때의 모순을 없애기 위해 다음처럼 정리하는 것이 안전하다.

- 누락 정보가 설계를 막으면 필요한 항목만 질문하고 응답을 종료한다.
- 누락 정보가 Generator의 명시적 설계 선택으로 처리 가능한 항목이면 “AI 결정”으로 표시한 전체 설계안을 제시한다.
- 질문한 뒤 같은 응답에서 불완전한 전체 설계안을 강제로 제시하지 않는다.

#### repair 모드

- `[VERIFICATION_REPAIR]`가 있거나 검증 후 수정 요청임이 명시되면 repair 모드다.
- 별도의 설계 승인을 다시 요구하지 않는다.
- 승인된 수정만 반영하고, 제외·보류 항목은 반영하지 않는다.
- 지시받지 않은 카드와 내용은 보존한다.
- 기존 전체 `title`과 `items`를 유지한 완전한 앱용 JSON을 반환한다. 부분 patch는 반환하지 않는다.
- ID, Schema, 문법은 전체 세트에 대해 다시 검사한다.
- 원본 Generation JSON이 없으면 추측 생성하지 않고 완성 원본을 요청한다.

repair 입력의 승인 결과와 기존 JSON은 Request payload다. repair 절차 자체는 Core가 소유한다.

### 3.4 불변 식별자 원칙

- `itemId`는 앱이 발급한 불변 기본키다.
- 요청에 포함된 모든 `itemId`를 정확히 한 번 반환한다.
- 입력에 없는 ID를 추가하거나 기존 ID를 누락·중복·정규화하지 않는다.
- 각 `itemId`와 `templateId`·`variantId`의 연결을 유지한다.
- 41~42와 43~45 묶음은 하위 문항마다 별도 `itemId`를 만들지 않는다.
- 출력 직전 요청 식별자 집합과 결과 식별자 집합을 대조한다.

이 규칙의 의미는 Contract/Core가 소유하고, 이번 요청의 실제 ID 값은 Request가 소유한다.

### 3.5 창작·저작권 원칙

- 실제 기출의 지문·선지·정답 표현·인물·기관·장소·수치·특징적 사례를 복제하지 않는다.
- 특정 기출의 소재, 논리, 정답 표현, 오답 배열을 한꺼번에 따라 하지 않는다.
- 공식 로고, 실제 시행 기관명, 실제 시험 표제, 저작권 문구를 창작 결과에 넣지 않는다.
- 연속 핵심 내용어 중복 점검은 보조 휴리스틱일 뿐 저작권 안전을 보장하는 판정기로 취급하지 않는다.
- 비교 가능한 원문이 없는데 “중복 없음”을 확정적으로 주장하지 않는다.

저작권·복제 방지 규칙은 모든 카드에 공통이므로 Core가 소유한다. Request에는 사용자가 특정 자료의 변환 또는 보존을 요청했을 때 필요한 추가 제한만 둔다.

### 3.6 공통 출제 원칙

- 모든 실제 문항은 5지선다이며 정답은 정확히 하나다.
- 정답은 제시 자료만으로 확정되어야 한다.
- 선언된 정답을 보지 않고 독립적으로 풀어 `answerIndex`와 대조한다.
- 정답만 길이, 문법, 어휘, 추상도에서 두드러지지 않게 한다.
- 오답은 서로 다른 설명 가능한 오류를 사용한다.
- `evidenceRefs`는 실제 지문의 직접 근거와 일치해야 한다.
- 정답 위치 분산은 세트 편집 원칙이며 정답의 타당성을 절대 덮어쓰지 않는다.
- 실제 문항 수가 5개보다 적으면 “고르게 분산”은 모든 번호를 강제로 사용한다는 뜻이 아니다.
- 기출 정답 통계를 모방하지 않는다.

“기출 정답 통계를 사용하지 않는다”와 “세트 내 정답 위치를 분산한다”는 서로 다른 규칙이다. 전자는 역사적 통계 모방 금지이고, 후자는 생성 세트 내부의 편집 편향 완화다. Core에 이 구분을 명시해야 한다.

### 3.7 유형별 안정 규칙

Core는 18~45 유형의 변하지 않는 기본 의미와 품질 원칙을 소유한다. 다만 모든 요청에 전체 유형 카탈로그를 반복할 필요는 없다.

- 일반 유형: 목적, 심경, 주장, 요지, 주제, 제목, 내용 일치·불일치 유형의 판단 대상과 단일 정답 원칙
- 시각·실용 자료: 도표, 안내문, 실용문에서 자료 영역과 질문·선지의 역할 구분
- 어휘·밑줄 유형: 문항별 표식의 정확한 범위와 선택지 연결
- 빈칸 유형: 전체 논리와 빈칸의 추론 관계
- 무관 문장·순서·삽입: 고정 표식과 담화 연결 검증
- 요약 유형: 원 지문과 요약 자료의 역할 분리, A·B 대응
- 41~42 및 43~45: 하나의 공유 지문과 고정 하위 문항 수, 서로 충돌하지 않는 문항별 근거

각 요청에서 선택된 `templateId`·`variantId`의 정확한 steps, markers, fixedQuestions, choiceLanguage, materialSpec 요구는 Request가 소유한다.

### 3.8 자체 검토 절차

Core는 최종 출력 전 다음 검토 순서를 소유한다.

1. 요청 식별자와 청사진 보존 확인
2. 문항 유형, 문항 수, 선지 수, 선지 언어, 표식, 구획 확인
3. 실제 렌더링 대상 영어의 단어 수 확인
4. 정답 독립 풀이와 단일 정답 확인
5. 지문·선지·해설·근거·오답 사유의 상호 일치 확인
6. 복제 위험과 부자연스러운 영어 확인
7. Schema에 대한 최종 구조 검사
8. JSON 직렬화 가능 여부 확인

`qualityReview`의 필수 구조와 점수 범위는 Schema가 소유한다. 각 점수의 평가 의미, 낮은 점수에서 자체 수정하는 절차, 정답과 다른 strongest distractor 요구는 Core가 소유한다. 자기 보고 점수는 품질 보증이 아니며 앱 validator, 별도 verifier, 사람 검수를 대체하지 않는다.

### 3.9 엄격한 출력 규율

- 승인 후 또는 repair 완료 후에는 JSON 객체 하나만 출력한다.
- 설명, 머리말, Markdown 코드 블록, 주석, 후행 쉼표를 넣지 않는다.
- JSON 문자열의 큰따옴표를 올바르게 escape한다.
- `NaN`, `Infinity`, `undefined`를 사용하지 않는다.
- 빈 문자열은 반드시 유효한 JSON 속성값으로 쓴다. 예: `"material": ""`.
- 출력 구조와 필수·선택 필드는 Schema를 참조하고 Core에 전체 Schema를 복제하지 않는다.

앱 importer가 단일 Markdown fence를 호환 목적으로 받아들이더라도 Generator의 공식 출력 규칙은 fence 없는 JSON이다.

## 4. 프로그램 Prompt에 남길 규칙

Request-Specific Prompt는 “이번에 무엇을 만들 것인가”만 전달한다. 일반 교육학 규칙과 전체 Schema 설명을 반복하지 않는다.

### 4.1 세트 수준 요청값

- 요청 모드: initial 또는 repair
- `title`
- 세트 내 카드 수와 실제 하위 문항 총수
- 대상 수준과 시험 용도
- 공통 난이도 또는 카드별 난이도
- 공통 소재·출제 의도
- 사용자가 제공한 추가 요구
- 세트 수준 정답 위치 계획이 승인되었다면 그 계획
- 승인 상태 또는 repair 승인 결정

### 4.2 카드별 불변값

- 카드 순서
- `itemId`
- `templateId`
- `variantId`
- 해당 template/variant의 현재 청사진
- 고정 하위 문항 수와 각 slot의 기대 type
- 허용되는 `materialSpec.kind`

### 4.3 카드별 제작 조건

- 대상 수준
- 이번 난이도와 배점
- 소재, 장르, 출제 의도
- 이번 목표 지문 길이 범위
- 지문 작성 방식: AI 작성 또는 사용자 제공 자료 사용
- 사용자 제공 자료와 보존 범위
- 카드별 특수 요구
- 선택된 유형에서 필요한 구조 단계, 표식, 구획, 선지 언어
- 선택된 유형에만 적용되는 오답 설계 요구

### 4.4 repair 요청값

- `[VERIFICATION_REPAIR]` 모드 표식
- 기존의 완전한 Generation JSON
- verifier의 지적 사항
- 사용자가 승인한 수정
- 제외 또는 보류된 수정
- 지시 없는 부분 보존 요구

### 4.5 Request에 두지 않을 내용

- 전체 승인 프로토콜 전문
- 전체 18~45 유형 카탈로그
- 모든 카드에 동일한 저작권 규칙
- 모든 카드에 동일한 일반 오답 규칙
- 카드마다 반복되는 `qualityReview` 필드 설명
- 전체 JSON 예시와 Schema 전문
- 근거가 버전 관리되지 않은 “실제 평가원 평균” 통계

현재 Prompt Builder가 이 내용을 포함하더라도 이번 문서는 변경을 수행하지 않는다. 위 항목은 최종 Generator v0 지침과 Prompt Builder를 정리할 때의 목표 경계다.

## 5. Future Corpus Profile로 분리할 규칙

Corpus Profile은 현재 비어 있는 선택적 인터페이스다. v0에서 통계값을 추측하거나 임시 수치로 채우지 않는다.

### 5.1 향후 수용할 수 있는 데이터

- 학년·시험군별 어휘 빈도 및 분포
- 평가원·교육청 등 source family별 검증된 어휘 수준
- 문장 길이, 절 수, 구문 복잡도 분포
- 유형별 passage 길이 분포
- 유형별 담화 구조와 전개 패턴
- 정답 근거와 질문 사이의 추론 거리
- distractor 오류 유형과 분포
- 선택지 길이·형태 균형 통계
- 난이도 calibration과 confidence interval
- 공유 지문 하위 문항 간 근거 배치 특성

### 5.2 Profile 메타데이터 요구

향후 값을 주입하려면 최소 다음 provenance가 필요하다.

- `profileId`
- `profileVersion`
- 생성 일자 또는 `asOf`
- source family와 시험 범위
- 시행 연도·학년도·학년 구분
- 표본 수와 포함·제외 기준
- 통계 산출 방법
- 신뢰도 또는 coverage
- 사용 가능한 유형 범위

### 5.3 Profile의 권한 한계

- Profile이 없으면 Core와 Request만으로 동작해야 한다.
- 낮은 coverage의 수치를 확정 규칙처럼 사용하지 않는다.
- Profile은 Schema, ID, 단일 정답, 저작권, 승인 절차를 덮어쓸 수 없다.
- Profile의 분포는 생성 목표의 참고값이지 실제 기출 복제 지시가 아니다.
- 사용자 요청의 명시적 길이·난이도와 충돌할 때는 충돌을 드러내고 Request를 우선한다.
- 현재 Prompt에 들어 있는 실측 주장값은 provenance와 버전이 확인되기 전에는 Future Corpus Profile의 authoritative 값으로 승격하지 않는다.

## 6. 중복 규칙 목록과 authoritative owner

| 중복 규칙 | 현재 반복 위치 | authoritative owner | 이유 |
|---|---|---|---|
| 승인 절차 | AI Instructions, 앱 승인 프로토콜, 생성된 GPT 지침 | Core Instructions | 대화 상태는 요청별 데이터가 아니라 Generator의 고정 동작이다. Request는 모드와 승인 상태만 전달한다. |
| initial/repair 구분 | AI Instructions, 앱 prompt | Core Instructions | 같은 입력에서 상태 판단이 달라지면 부분 JSON이나 재승인 오류가 생긴다. |
| `qualityReview` 필드 | Instructions, 카드별 prompt, prompt 말미, JSON 예시, Schema | 필드·범위는 Schema; 평가 절차는 Core; 기대 난이도는 Request | 구조, 행동, 이번 목표를 분리해야 한다. |
| JSON 최상위 및 item 구조 | Instructions 예시, 앱 출력 예시, Contract, Schema | Schema와 Contract | 앱 importer가 실제 집행하는 구조의 단일 원천이어야 한다. |
| JSON 밖 설명 금지 | Instructions, 승인 프로토콜, Contract | Contract를 참조하는 Core | 생성 행동은 Core에 짧게 두되 허용 출력은 Contract가 결정한다. |
| ID 보존 | Instructions, 앱 세트 규칙, 카드별 prompt, JSON 예시, Contract | 의미는 Contract/Core; 실제 값은 Request | 불변성 원칙과 현재 ID 값을 분리한다. |
| 5지선다·단일 정답 | Instructions, 앱 공통 규칙, 카드별 규칙, Contract | Contract/Core | 모든 요청에 공통인 호환·품질 불변식이다. |
| 정답 번호 분산 | 설계안, 앱 세트 규칙, 카드별 prompt, Instructions | Core; 승인된 이번 계획은 Request | 원칙을 카드마다 반복하면 정답 타당성보다 위치 목표가 우선될 위험이 있다. |
| 저작권·기출 복제 방지 | Instructions, 앱 공통부, 모든 카드 말미 | Core Instructions | 전역 안전 규칙이며 카드별 반복이 필요 없다. |
| 일반 distractor 원칙 | Instructions, 모든 카드 말미, 유형별 규칙 | 일반 원칙은 Core; 유형별 전략은 선택 카드 Request | 공통과 유형별 요구를 분리한다. |
| 유형별 제작 원칙 | Instructions, 유형 카탈로그, 선택 카드 prompt | 안정 기준은 Core; 선택된 variant 청사진은 Request | Core는 의미를, Request는 실행 청사진을 소유한다. |
| 공유 지문 규칙 | Instructions, 앱 세트 규칙, 카드별 청사진, Contract | 구조 불변식은 Contract/Core; 현재 묶음은 Request | 하나의 item과 고정 questions 배열은 호환 규칙이다. |
| 지문 길이 | Instructions의 계수 원칙, 카드 목표값, 실측 주장값 | 계수 원칙은 Core; 목표 범위는 Request; 분포는 Future Corpus | 행동, 이번 조건, 경험 통계를 섞지 않는다. |
| `materialSpec` 설명 | 카드별 prompt, JSON 예시, Schema, Contract | 허용 구조는 Schema/Contract; 이번 kind는 Request | 전체 구조를 매 요청에 복제하지 않는다. |
| 출력 전 자체 검수 | Instructions, 카드별 quality block, prompt 말미 | Core Instructions | 모든 카드에 동일하게 적용되는 알고리즘이다. |

## 7. 충돌 가능성이 있는 규칙

### 7.1 실제 JSON 문법과 충돌하는 자연어 지시

사용자가 제공한 현행 제작 AI Instructions 원문에는 다음 취지의 문구가 있다.

> 가능하면 `material=""` 대신 `material이 빈 문자열이다`처럼 쓴다.

이는 엄격한 JSON 출력 규칙과 충돌한다. JSON은 자연어 서술이 아니라 `"material": ""`처럼 속성과 값을 써야 한다. 이 문구는 최종 Core Instructions에서 제거해야 하는 고우선순위 cleanup 대상이다. 저장소의 현재 계약과 Schema는 빈 문자열 표현을 이미 올바르게 정의한다.

### 7.2 사용자 요구와 Contract의 우선순위

현재 우선순위는 사용자 확정 요구가 Instructions보다 앞선다고만 되어 있다. 사용자가 ID 변경, 추가 필드, 번역 필드 또는 고정 문항 수 변경을 요구하면 Contract와 충돌할 수 있다. Contract·Schema·식별자 무결성을 비가역적 최상위로 올려야 한다.

### 7.3 누락 정보 처리 순서

“누락된 항목만 질문한다”와 “질문한 뒤 전체 설계안을 제시한다”가 함께 있어, 답을 기다리지 않고 가정으로 설계할 가능성이 있다. 설계를 막는 누락값은 질문 후 대기하고, Generator가 결정할 수 있는 값은 설계안에서 명시하는 두 갈래 절차가 필요하다.

### 7.4 정답 위치 분산과 정답 타당성

정답 분산을 카드마다 강하게 반복하면 Generator가 타당한 정답을 유지하는 대신 `answerIndex`를 맞추려 할 수 있다. 정답 위치 계획은 설계 단계의 세트 수준 편집 제약이며, 단일 정답 검증 후에도 타당할 때만 적용하도록 명시해야 한다.

### 7.5 정답 통계 금지와 세트 분산

두 문구는 본래 모순이 아니지만 설명이 없으면 충돌로 읽힐 수 있다. “기출 분포 모방 금지”와 “현재 소규모 세트의 편집 편향 완화”로 목적을 분명히 해야 한다.

### 7.6 자체 `qualityReview` 점수와 실제 품질

“8 미만이면 수정, 특정 항목은 9 이상 목표”를 출력 조건처럼만 강조하면 자기 점수 부풀리기를 유도한다. `qualityReview`는 필수 자기 보고 데이터이지 승인 인증서가 아니다. 실제 품질 판정은 import validation, 별도 verification, 사람 검수와 분리한다.

### 7.7 hard-coded 실측 통계의 권위

현재 생성 프롬프트는 유형별 목표 길이 옆에 실제 평가원 조사 최소·평균·최대라고 주장하는 값을 넣는다. 데이터 버전, 모집단, 산출 방법이 함께 전달되지 않으므로 Generator Core의 영구 규칙으로 취급하면 안 된다. 현재 앱 동작은 유지하되 향후 검증된 Corpus Profile로 이동해야 한다.

### 7.8 “모든 카드 독립”과 공유 지문 묶음

41~42, 43~45는 카드 내부에서 공유 지문을 사용한다. “독립”은 카드 간 독립을 뜻하며, 묶음 내부 하위 문항까지 독립 지문으로 만들라는 의미가 아님을 명시해야 한다.

### 7.9 5지선다와 구조형 placeholder 선택지

일부 구조형 유형은 renderer 호환을 위해 위치 또는 기호 선택지를 사용한다. Core는 “5개 실제 선택 슬롯”과 “모든 선택지가 일반 내용문이어야 한다”를 혼동하지 않아야 한다. 정확한 선택지 형태는 선택된 template/variant 청사진을 따른다.

### 7.10 사용자 제공 자료의 “그대로 사용” 범위

제공 자료 보존과 문항 표식·구조화 요구가 충돌할 수 있다. 원문 내용은 재작성하지 않되, 계약이 요구하는 비파괴적 marker와 `materialSpec` 표현은 추가할 수 있는지 Request에 명시해야 한다. 불명확하면 승인 전에 질문한다.

### 7.11 호환 입력과 공식 출력의 혼동

importer가 단일 Markdown code fence를 제거해 주는 것은 호환 입력 처리다. 이를 Generator 공식 출력 허용으로 확대하면 안 된다. 공식 출력은 fence 없는 JSON 객체 하나다.

## 8. 제거 가능한 불필요한 반복

최종 Generator v0 지침과 향후 Prompt Builder 정리 시 다음 반복을 제거할 수 있다.

1. 각 카드 말미에 동일하게 붙는 저작권·복제 금지 문단
2. 각 카드마다 전체 `qualityReview` 구조와 점수 규칙을 재설명하는 문단
3. 각 카드마다 반복되는 정답 위치 분산 문장
4. 각 카드마다 반복되는 일반 distractor 오류 목록
5. 앱 prompt 안의 전체 JSON Schema 유사 예시
6. Core, 승인 프로토콜, prompt 본문에 세 번 들어가는 승인 절차
7. Core의 전체 유형 카탈로그와 Request의 선택 유형 규칙이 완전히 겹치는 문장
8. 세트 공통부와 카드별 블록에 동시에 들어가는 ID 보존 원칙
9. prompt 시작과 끝에 반복되는 엄격한 JSON 문구
10. 모든 요청에 포함되는 미선택 유형의 상세 marker·materialSpec 설명

반복 제거는 규칙 삭제가 아니라 owner를 한 곳으로 옮기고 참조하도록 만드는 작업이다. 구조 필드는 Schema, 호환 의미는 Contract, 고정 행동은 Core, 현재 값은 Request가 각각 한 번만 정의해야 한다.

## 9. Generation Contract V0와의 연결

Generator v0는 Contract를 복제하지 않고 준수한다.

### 9.1 Contract가 결정하는 것

- 수능형 Generation JSON 적용 범위
- 최상위 `{title, items}` 구조
- `items`, `questions`, `qualityReview`, `materialSpec`의 구조
- 필수 필드와 선택 필드
- `additionalProperties: false`
- `answerIndex`의 1~5 정수 규칙
- translation 미지원
- 최대 실제 하위 문항 수
- `itemId`·`templateId`·`variantId` 청사진 일치
- shared bundle과 `materialSpec`의 런타임 의미 규칙
- importer가 거부하는 구조 오류와 별도 품질 검증의 경계

### 9.2 Core가 Contract 위에 추가하는 것

- 승인과 repair 상태 기계
- 창작·저작권 원칙
- 단일 정답을 만드는 사고 절차
- 유형별 기본 출제 원칙
- 자체 검토 순서
- JSON 외 텍스트를 출력하지 않는 행동 규율

### 9.3 Request가 Contract에 공급하는 것

- 이번 `title`
- 정확한 요청 ID 집합
- 각 ID의 template/variant 연결
- 선택된 청사진과 고정 하위 문항 수
- 사용자 제작 조건과 자료
- repair 승인 결정

### 9.4 구현 권고

최종 Core Instructions에는 Schema 전문을 붙이지 말고 다음 의미의 짧은 비가역적 지시를 둔다.

> 최종 결과는 제공된 Generation Contract V0와 `csat-output-schema.json`을 정확히 만족해야 한다. Request의 식별자와 청사진을 변경하지 않는다. 충돌하는 요청은 임의로 실행하지 않는다.

앱은 지금처럼 import 시 Schema와 요청 청사진을 실제로 검증해야 한다. Generator의 자기 검사는 런타임 검증을 대체하지 않는다.

## 10. Generator v0에서 아직 지원하지 않을 기능

- 학교 시험 및 custom 계열 Generation Contract
- 번역 필드 생성·import
- API 기반 자동 생성과 자동 import
- 자동 승인 또는 사람 승인 생략
- verifier와 generator의 단일 통합 응답 계약
- 부분 JSON patch repair
- 한 번에 실제 하위 문항 5개 이상 생성
- Schema에 없는 임의 추가 필드
- Corpus 통계를 이용한 자동 난이도 보정
- 출처·버전 없는 평가원 통계 주입
- PDF·OCR·Corpus ingestion
- 기출 텍스트 자동 비교에 의한 저작권 보증
- 문제 제작 결과의 자동 human_verified 처리

## 11. v0 제작용 최종 지침서를 만들기 위한 권고 구조

최종 Generator Core Instructions는 다음 순서로 짧고 비중복적으로 구성한다.

### 11.1 Contract 경계

- 지원 범위
- Contract와 Schema 참조
- 비가역적 우선순위
- 미지원 요청 처리

### 11.2 역할과 모드

- 수능 영어 읽기 창작 역할
- initial/repair 판별
- 각 모드의 허용 출력

### 11.3 대화 상태 기계

- 누락 정보 처리
- 설계안 형식
- 명시적 승인 판정
- 수정 후 전체 설계안 재제시
- 승인 후 JSON 전용 출력

### 11.4 무결성과 창작 안전

- ID와 청사진 보존
- 실제 기출 복제 금지
- 사용자 자료 보존 범위
- shared bundle 무결성

### 11.5 공통 제작 원칙

- 5지선다와 단일 정답
- 근거·해설·오답 일치
- 정답 위치 분산의 한계
- 자연스러운 영어와 난이도 대응

### 11.6 유형 규칙 레지스트리

- 18~45의 안정된 기본 원칙만 유지
- marker와 material의 의미
- 선택된 template/variant의 상세 청사진은 Request에서 받음
- 미선택 유형 상세 규칙을 매 요청에 반복하지 않음

### 11.7 자체 검토 알고리즘

- 구조 확인
- 독립 풀이
- distractor 확인
- 길이와 표식 확인
- `qualityReview` 평가
- Schema와 JSON 직렬화 확인

### 11.8 엄격한 출력

- JSON 객체 하나
- fence·설명·주석 금지
- 유효한 JSON escape와 빈 문자열 표현
- 전체 세트 반환

### 11.9 Request payload 인터페이스

앱 prompt는 다음 블록만 제공하는 방향이 적합하다.

```text
[REQUEST_MODE]
[SET_IDENTITY_AND_COMMON_CONDITIONS]
[CARD_BLUEPRINTS]
[USER_MATERIALS_AND_SPECIAL_REQUIREMENTS]
[APPROVED_DESIGN_OR_REPAIR_DECISIONS]
```

이 블록은 현재 JSON 출력 Contract를 바꾸지 않는 대화용 입력 인터페이스다.

### 11.10 선택적 Future Corpus Profile 인터페이스

```text
[CORPUS_PROFILE]
profileId / version / provenance / coverage
검증된 지표만 포함
```

Profile이 없을 때는 블록 자체를 생략한다. 빈 통계나 추정 통계를 채우지 않는다.

## 최종 판정

현재 Generation Contract V0와 앱 import 계약은 Generator v0 설계를 시작할 수 있을 만큼 준비되어 있다. 그러나 현행 Instructions와 앱 prompt에는 승인 절차, Schema 설명, `qualityReview`, ID, 저작권, 유형 규칙이 중복되고, 사용자 제공 Instructions에는 엄격한 JSON과 직접 충돌하는 빈 문자열 표현 문구가 남아 있다. 또한 규칙 우선순위와 누락 정보 처리 순서를 정리해야 한다.

따라서 다음 단계는 앱 동작이나 Contract 변경이 아니라, 이 문서의 owner 결정을 따라 **최종 Generator Core Instructions를 비중복 형태로 정리하는 것**이어야 한다.

**NEEDS_INSTRUCTION_CLEANUP**
