# Generation Interface Audit

- 감사 일자: 2026-08-11
- 감사 대상: `english-question-lab` 0.1.0
- 감사 방식: 코드, JSON Schema, 테스트, 사용자 제공 실제 프롬프트·결과 JSON의 읽기 전용 대조
- 변경 범위: 이 보고서만 신규 작성. 애플리케이션 코드·스키마·데이터·설정은 변경하지 않음

## 1. 현재 프로젝트 신원

이 프로젝트는 **영어 기출 분석 Corpus Engine이 아니라 실제 영어 문제 제작 프로그램**이다.

확인 근거는 다음과 같다.

- `src/EnglishStudio.tsx`: 내신형·수능형·맞춤설정형 조건 입력, 수능 문항 카드 편집, 프롬프트 복사, AI JSON 붙여넣기와 가져오기 UI가 존재한다.
- `src/english.ts`, `src/csat.ts`: 사용자 조건을 외부 AI용 프롬프트로 조립하고, 반환 JSON을 현재 세트에 가져오는 코드가 존재한다.
- `src/ExamPaper.tsx`, `src/CsatMaterialView.tsx`, `src/examLayout.ts`: 문제지와 정답·해설지의 화면/인쇄/PDF용 표시 구조가 존재한다.
- `src/verification.ts`, `src/VerificationStudio.tsx`: 생성 결과를 독립 AI로 검증하고 사람이 승인한 권고만 수정 프롬프트로 만드는 별도 흐름이 존재한다.
- `package.json`의 패키지명은 `english-question-lab`이며 Vite/React 기반 로컬 애플리케이션이다.

따라서 사용자가 요구한 Generation Interface Audit의 대상이 맞다. 이번 감사에서는 Corpus Engine, Supabase, 서버, 외부 API를 사용하지 않았다.

## 2. 현재 문제 제작 전체 흐름

현재의 실제 기본 흐름은 다음과 같다.

1. 사용자가 제작 모드와 세트 공통 조건을 입력한다.
2. 수능형이면 번호 템플릿별 문항 카드를 구성한다. 내신형·맞춤형이면 문항 유형 목록을 구성한다.
3. 앱이 `generateEnglishPrompt()`로 외부 AI용 프롬프트를 만든다.
4. 사용자가 프롬프트를 복사해 외부 ChatGPT/GPT에 붙여넣는다. 앱 자체가 생성 API를 호출하지 않는다.
5. 수능형 최초 제작은 AI가 먼저 설계안을 제시하고 사용자의 명시적 승인 뒤 최종 JSON 하나를 반환하는 계약이다. 내신형·맞춤형 프롬프트에는 이 2단계 승인 계약이 없다.
6. 사용자가 AI JSON을 앱에 붙여넣으면 `parseEnglishSetJson()`이 파싱하고 현재 세트의 결과 리비전으로 저장한다.
7. 사용자가 최신 결과 검사를 실행하면 `validateEnglishSet()`이 구조·표식·길이·정답/오답 근거·품질 점수를 점검한다.
8. 선택적으로 독립 검증 AI용 프롬프트를 복사하고 검증 JSON을 가져올 수 있다.
9. 검증 finding별로 사용자가 승인·직접 수정 지시·무시·보류를 선택할 수 있다. 승인된 내용만 repair prompt에 포함된다.
10. 가져온 세트는 시험지 조립 화면에서 문제지와 정답·해설지로 렌더링되며 인쇄/PDF 경로를 공유한다.

즉, 목표 v0의 `프롬프트 복사 → ChatGPT → JSON 복사 → 앱 가져오기` 방식은 현재 앱의 실제 방식과 동일하다.

## 3. 사용자 입력 옵션

### 3.1 공통 입력

| 조건 | 실제 입력 형태 | 비고 |
|---|---|---|
| 제작 모드 | `school`, `csat`, `custom` | 내신형, 수능형, 맞춤설정형 |
| 세트 제목 | 자유 입력 | 세트 식별 및 일부 렌더링에 사용 |
| 대상 수준 | 자유 입력 | 수능형 기본값 `고3·수능 대비` |
| 난이도 | 1~5 | 수능형은 카드별 덮어쓰기 가능 |
| 주제·소재 | 11개 프리셋 또는 자유 입력 | 인문·철학, 심리·인지, 교육·학습, 사회·문화, 과학·기술, 환경·생태, 경제·경영, 예술·문학, 역사·문명, 언어·소통, 건강·생활 |
| 공통 출제 의도 | 9개 프리셋 또는 자유 입력 | 카드/문항별 값이 우선할 수 있음 |
| 나의 영어 출제 원칙 | 줄 단위 자유 입력 | `localStorage`의 `english-question-lab-principles-v1`에서 읽어 세 유형 프롬프트에 삽입 |

### 3.2 내신형

- 자료 출처: 교과서 본문, 부교재 지문, 외부 지문
- 자료 제목과 사용자가 제공하는 영어 지문·자료
- 문항 유형: 어휘, 어법, 내용 이해, 순서 배열, 문장 삽입
- 문항 수: 문항 카드를 추가/삭제하는 방식
- 문항별 발문, 선지, 정답 번호, 배점, 출제 의도, 해설, 정답 근거, 오답 오류 근거
- 등록 자료를 근거로 하는 `provided` 방식으로 동작한다.

### 3.3 맞춤설정형

- 빠른 시작 프리셋: 독해, 어휘, 어법, 변형 문제, 숙제용 워크시트, 단원별 미니 테스트
- 선지 수: 2, 3, 4, 5
- 수능 대분류와 내신형 유형을 합친 문항 유형 목록 및 `세부 정보`, `문맥 추론`
- 자료 제목과 제공 지문, 문항 수, 문항별 상세 필드

### 3.4 수능형 공통/카드 입력

- 실제 하위 문항 수 기준 세트당 최대 4문항이다. `41-42`는 2문항, `43-45`는 3문항으로 계산한다.
- 17개 대분류와 번호 템플릿 `18`~`40`, `41-42`, `43-45`를 제공한다.
- 카드마다 `itemId`를 앱이 발급한다.
- 카드별 대상 수준, 난이도, 주제·소재, 출제 의도, 지문 길이(`short|medium|long`)를 덮어쓸 수 있다.
- 자료 작성 방식은 AI 새 지문(`generated`) 또는 사용자 등록 지문(`provided`)이다.
- 자료 제목, 영어 지문·자료, 지문 설계 계획, 템플릿별 추천 입력을 제공한다.
- 이미지 자료를 카드에 연결할 수 있으며 UI 제한은 파일당 3MB이다. 이미지 내용 자체는 Generation JSON에 포함되지 않는다.
- 번호 템플릿이 정한 문항 수, 유형, 기본 발문, 배점, 선지 스타일은 고정된다.

### 3.5 수능 템플릿별 추천 입력

| 템플릿 | 사용자 입력 키 |
|---|---|
| 18 | 발신자, 수신자, 상황, 원하는 행동 |
| 19 | 중심 인물, 초기 감정, 전환 사건, 최종 감정 |
| 20 | 논쟁 주제, 필자 입장, 권고·필요성 |
| 21 | 밑줄 표현, 표면 의미, 문맥상 의미, 추론 거리 |
| 22 | 중심 명제, 전개 방식 |
| 23 | 중심 명제, 전개 방식, 주제 범위 |
| 24 | 중심 명제, 전개 방식, 제목 문체 |
| 25 | 도표 주제, 단위, 범주, 수치 자료 |
| 26 | 중심 대상, 사실 목록, 왜곡할 사실 |
| 27 | 행사·서비스명, 일정·장소, 대상·신청, 비용·예외 조건 |
| 28 | 행사·상품명, 일정·장소, 활동·혜택, 신청·구매 조건 |
| 29 | 어법 항목 5개, 정답 어법 항목, 함정 설계 |
| 30 | 표적 어휘, 문맥 대립, 역접·반전 위치 |
| 31~34 | 빈칸의 담화 기능, 정답 길이, 추론 거리, 추상도 |
| 35 | 중심 흐름, 문장별 역할, 이탈 방식 |
| 36~37 | 도입문 역할, A·B·C 역할, 결속 단서 |
| 38~39 | 삽입문 역할, 선행 단서, 후행 단서, 결속 장치 |
| 40 | 원문의 핵심 관계, 요약 개념 A, 요약 개념 B |
| 41-42 | 장문 주제, 논리 단계별 계획, 표적 어휘 5개 |
| 43-45 | 인물 관계, 배경·갈등, 사건 목록, (a)~(e) 지칭 대상 |

표준 변형 외에 현재 선택 가능한 변형은 `vocabulary-box`, `long-order-content`, `long-implication-blank`, `narrative-emotion-implication-blank`이다. 각 변형은 허용된 템플릿과 조합될 때만 유지된다.

## 4. Prompt Builder 구조

### 4.1 수능형

`generateEnglishPrompt()`은 수능형에서 `generateCsatBatchPrompt()`로 분기한다. 최종 프롬프트는 다음 순서다.

1. `[역할]`
2. `[제작 원칙]`: 기출 복제 금지, 듣기 제외, 카드별 독립 지문, 공유 지문 규칙, 5지선다, 식별자 보존
3. 저장된 `[나의 영어 출제 원칙]`
4. `[대화 및 승인 절차]`
5. `[세트 공통값]`
6. `[수능형 다중 문항 일괄 제작]`
7. 카드별 `itemId`, `templateId`, `variantId`, 대상, 난이도, 지문 길이, 의도, 자료 방식
8. 템플릿 설명, 사용자 추천 입력, 고유 구조, 고정 문항 구성, 선지 규칙, 필수 표식, `materialSpec` 지침, 품질 규칙
9. `[승인 후 출력 JSON]` 예시
10. `[품질 검수]`

승인 절차의 핵심 계약은 첫 응답에서 문제나 JSON을 만들지 않고 `[세트 제작 설계안]`을 제시한 뒤, 정확한 종료 질문으로 사용자의 승인을 받는 것이다. 승인 뒤에는 설명·머리말·코드 펜스 없이 JSON 객체 하나만 반환해야 한다. 재검토 프롬프트는 이미 생성된 결과의 수정 요청이므로 다시 승인받지 않는다.

빈 공통 주제는 프롬프트 생성 직전에 11개 프리셋에서 카드별로 결정적으로 자동 배정된다. 사용자가 입력한 카드별 주제는 덮어쓰지 않는다.

### 4.2 내신형·맞춤설정형

공통 역할, 모드별 제작 원칙, 저장 원칙, 세트 명세, 문항 구성, 표식 규칙, 단일 JSON 예시로 구성된다. 수능형과 달리 `items` 래퍼가 없고 세트 최상위의 `material`, `materialSpec`, `questions`를 사용한다. 현재 프롬프트에는 별도의 설계 승인 단계가 없다.

## 5. 실제 generation prompt 구조

사용자가 제공한 실제 프롬프트 예시는 앱 코드가 만드는 수능형 프롬프트와 일치한다.

- 세트 제목: `테스트용 문제 세트`
- 카드 1: `templateId: 33`, `variantId: standard`, 빈칸 추론, 1문항
- 카드 2: `templateId: 40`, `variantId: standard`, 요약문 완성, 1문항
- 카드 3: `templateId: 41-42`, `variantId: standard`, 하나의 공유 설명문에 41·42 두 문항
- 실제 하위 문항 합계: 4문항으로 현재 최대치와 일치
- 각 카드의 UUID `itemId`가 프롬프트에 명시되고 JSON 반환 예시에도 보존을 요구
- 카드별 길이 범위, 유형별 표식, 구조화 자료 지침, `qualityReview` 요구가 포함

저작권이 있는 긴 지문을 복제하지 않기 위해 실제 프롬프트 전문은 이 보고서에 다시 싣지 않았다. 인터페이스 골격은 다음과 같다.

```text
[역할] → [제작 원칙] → [대화 및 승인 절차] → [세트 공통값]
→ [다중 문항 규칙]
→ [문항 설계 카드 1: itemId/templateId/variantId/...]
→ [문항 설계 카드 2: ...]
→ [문항 설계 카드 3: ...]
→ [승인 후 출력 JSON] → [품질 검수]
```

첨부된 현재 문제 제작 AI 지침서는 이 프롬프트보다 상위의 공통 제작 규칙, 최초 제작/검증 후 수정 모드, ID 절대 보존, 유형별 규칙, 엄격한 JSON 규칙을 추가한다. 앱 프롬프트와 지침서는 동일한 출력 골격을 사용한다.

## 6. 현재 generation JSON schema

수능형의 문서상 엄격한 스키마는 `docs/english-gpt/csat-output-schema.json`이다.

```json
{
  "title": "세트 제목",
  "items": [
    {
      "itemId": "앱이 준 UUID",
      "templateId": "33",
      "variantId": "standard",
      "materialTitle": "",
      "material": "축약된 지문 문자열",
      "materialSpec": null,
      "questions": [
        {
          "type": "빈칸 추론",
          "stem": "발문",
          "choices": ["...", "...", "...", "...", "..."],
          "answerIndex": 1,
          "explanation": "해설",
          "intention": "출제 의도",
          "evidenceRefs": ["지문 직접 인용"],
          "distractorReasons": ["...", "...", "...", "..."],
          "score": 3
        }
      ],
      "qualityReview": {
        "passage": {
          "naturalness": 9,
          "logicStructure": 9,
          "vocabularyLevel": 9,
          "templateFidelity": 9
        },
        "questions": [
          {
            "slot": "33",
            "answerInference": 9,
            "distractorPlausibility": 9,
            "choiceBalance": 9,
            "directAnswerOverlap": false,
            "strongestDistractorIndex": 2,
            "decisiveReason": "...",
            "expectedDifficulty": 5
          }
        ]
      }
    }
  ]
}
```

사용자 제공 실제 Generation JSON은 JSON 문법상 유효하며 3개 카드를 포함한다. 카드별 구조는 `33: materialSpec=null/질문 1개`, `40: summary/질문 1개`, `41-42: longExpository/질문 2개`이고 모든 질문에 5개 선지가 있다. 프롬프트의 세 `itemId`와 결과의 세 `itemId`도 일치한다.

중요하게도 현재 Generation 모델에는 `translation` 필드가 없다. 시험지 지문 번역을 별도 생성·저장·렌더링하는 계약도 없다.

## 7. 필수 필드

아래는 v0가 따라야 할 **문서상 엄격 스키마의 필수 필드**다.

| 계층 | 필수 필드 |
|---|---|
| 최상위 | `title`, `items` |
| item | `itemId`, `templateId`, `variantId`, `materialTitle`, `material`, `materialSpec`, `questions`, `qualityReview` |
| question | `type`, `stem`, `choices`, `answerIndex`, `explanation`, `intention`, `evidenceRefs`, `distractorReasons`, `score` |
| qualityReview.passage | `naturalness`, `logicStructure`, `vocabularyLevel`, `templateFidelity` |
| qualityReview.questions[] | `slot`, `answerInference`, `distractorPlausibility`, `choiceBalance`, `directAnswerOverlap`, `strongestDistractorIndex`, `decisiveReason`, `expectedDifficulty` |

추가 제약:

- `items`는 문서 스키마상 1~20개지만, 앱의 수능 제작 UI/프롬프트는 실제 하위 문항 수를 최대 4개로 제한한다.
- `questions`는 item당 1~3개이고, 실제 개수는 요청 템플릿/변형의 blueprint와 정확히 같아야 한다.
- 일반 수능 문항은 내용이 있는 선지 5개가 필요하다.
- 35·38·39는 호환용 위치 선지 `①`~`⑤`를 앱이 강제한다.
- `answerIndex`는 계약상 1~5 정수다.
- `score`는 계약상 2 또는 3이다.
- `evidenceRefs`는 문서상 하나 이상이며 실제 지문의 연속 직접 인용을 의도한다.
- `distractorReasons`는 정확히 4개다.
- `itemId`, 요청한 `templateId`, `variantId` 및 카드 집합을 보존해야 한다.

## 8. 선택 필드

문서상 수능 Generation Schema에서는 `materialSpec` 자체가 필수지만 값으로 `null`이 허용된다. 내부 variant별 객체의 모든 구성 필드는 각 kind 정의상 필수다. question 내부에 문서상 선택 필드는 없다.

그러나 **런타임 importer는 더 느슨하다**.

- 최상위 `title` 누락 시 현재 세트 제목 유지
- `materialTitle` 누락 시 빈 문자열
- `materialSpec` 누락 또는 `null`이면 내부 `undefined`
- `qualityReview` 누락/비객체이면 내부 `undefined`
- `explanation`, `intention`, `evidenceRefs`, `distractorReasons` 누락 시 빈 값
- `score` 누락 시 템플릿 blueprint 배점
- `type`은 수능형에서 반환값을 신뢰하지 않고 blueprint 유형으로 교체
- `qualityReview`의 개별 점수도 런타임에서는 선택값처럼 정리됨
- 알 수 없는 추가 필드는 런타임 변환 결과에 복사되지 않고 사실상 무시됨

따라서 “현재 정상 계약”을 안전하게 따르려면 런타임의 느슨한 허용치를 사용하지 말고 문서 스키마의 모든 필드를 채우는 편이 맞다.

## 9. shared passage 표현 방식

공유 지문은 별도 전역 passage ID로 표현하지 않는다. **카드 item 하나가 공유 지문 하나를 소유하고, 그 item의 `questions` 배열에 하위 문항을 함께 넣는 방식**이다.

- `templateId: "41-42"`: 한 item, 한 `material`, 질문 2개
- `templateId: "43-45"`: 한 item, 한 `material`, 질문 3개
- item을 41/42 또는 43/44/45로 쪼개지 않는다.
- item의 `itemId`는 하나만 유지한다.
- 각 하위 question의 런타임 `csatSlot`은 blueprint에서 결정된다.
- 렌더러는 공유 material을 한 번 출력한 뒤 해당 item의 질문을 차례로 출력한다.
- `41-42`는 `longExpository`, `43-45`는 `longNarrative` materialSpec을 사용할 수 있다.

AI가 반환한 question-level ID는 계약에 없고 importer도 사용하지 않는다. 내부 question ID는 기존 카드 질문 ID를 재사용하거나 새로 발급한다.

## 10. question material 표현 방식

문항별 구조 자료의 현재 공용 필드는 item 수준의 `material`과 `materialSpec`이다. 지원 kind는 다음과 같다.

| kind | 필드 | 주요 템플릿/표시 |
|---|---|---|
| `prose` | `paragraphs[]` | 일반 지문 |
| `chart` | `title`, `unit`, `categories[]`, `series[{name,values[]}]` | 25 도표 렌더링 |
| `practical` | `heading`, `fields`, `notes[]` | 27·28 안내문 |
| `ordered` | `lead`, `sections[A/B/C]` | 36·37 순서 배열 |
| `insertion` | `givenSentence`, `body` | 38·39 문장 삽입 |
| `summary` | `summary` | 40 요약 상자 |
| `longExpository` | `paragraphs[]` | 41~42 공유 설명문 |
| `longNarrative` | `sections[A/B/C/D]` | 43~45 공유 서사 |

문자열 내 구조 표식은 `[[밑줄:...]]`, `[[빈칸]]`, `[[삽입문장:...]]`, `[[삽입위치:①]]`~`⑤`, `[[요약빈칸:A]]`, `[[요약빈칸:B]]`, `[[선택:A|단어1|단어2]]`다.

현재 모델은 generic `questionMaterials[]` 같은 별도 배열을 사용하지 않는다. 구조 자료는 item의 `materialSpec`과 `material` 표식으로 표현한다. 이미지 자료는 별도 앱 `MediaAsset` 저장 구조이며 Generation JSON 계약에 포함되지 않는다.

## 11. JSON import/validation 방식

### 11.1 가져오기 위치와 파싱

- UI: `src/EnglishStudio.tsx`의 “AI 결과 JSON 가져오기” 입력창과 버튼
- 진입 함수: `parseEnglishSetJson(raw, base)` in `src/english.ts`
- 코드 펜스: 계약상 금지지만 importer는 전체 응답이 하나의 ```json ... ``` 블록인 경우 외부 펜스를 제거한다.
- JSON 문법: `JSON.parse` 실패 시 가져오기 실패
- 최상위: 객체가 아니면 실패
- JSON Schema 라이브러리를 실행하지 않는다. `csat-output-schema.json`은 GPT 지침/문서/테스트 기준이며 runtime validation 엔진으로 직접 호출되지 않는다.

### 11.2 수능형에서 즉시 거부하는 주요 오류

- 현재 카드에 번호 템플릿이 지정되지 않음
- `items`가 없거나 비어 있음
- 반환 item 수가 현재 카드 수와 다름
- `itemId` 누락, 중복, 알 수 없는 ID
- 카드의 `templateId` 또는 `variantId`가 요청과 다름
- `material` 문자열 또는 `questions` 배열 누락
- 질문 수가 템플릿 blueprint의 고정 개수와 다름
- 일반 문항의 채워진 선지가 정확히 5개가 아님
- `stem`이 문자열이 아님
- `materialSpec`이 객체/null이 아니거나 지원하지 않는 kind

`items`가 없는 구 단일 수능 JSON(`material + questions`)도 현재 카드가 정확히 하나일 때만 호환 경로로 받아들인다.

### 11.3 가져오기는 허용하지만 정리/기본값 처리하는 항목

- 수능 question `type`은 AI 값을 버리고 template blueprint의 type으로 고정한다.
- question ID는 AI로부터 받지 않으며 기존 내부 ID를 유지한다.
- 숫자형 `templateId`도 18~40이면 문자열로 정규화되어 비교된다.
- `answerIndex` 숫자는 절삭 후 1~5로 clamp한다. 문자열 숫자/원문자도 허용하고, 해석할 수 없으면 1번으로 기본값 처리한다.
- `materialSpec` 내부 문자열/배열은 정리하지만 모든 의미·배열 길이 관계를 import 단계에서 엄격히 검사하지는 않는다.
- 추가 필드는 내부 결과에 복사하지 않는다.
- 성공 시 `aiRevision` 증가, `validatedRevision` 초기화, `lastImportedJson` snapshot 저장이 이루어진다.

### 11.4 가져오기 후 별도 검사

`validateEnglishSet()`은 사용자가 “최신 AI 결과 검사”를 눌렀을 때 실행된다. import 거부와 별개의 후속 진단이다. 지문/선지 공백, 중복 선지, 정답 범위, 해설·정답 근거·오답 근거, 직접 인용 포함 여부, 지문 길이, 표식 개수, 불필요한 문단 구분, 25/27/28 구조 자료, 29/30 밑줄 5개, 31~34 빈칸, 35 위치, 36/37 A~C, 38/39 삽입, 40 요약, 41~45 공유 구조와 품질 점수를 검사한다.

즉 일부 품질/완성도 오류는 JSON 가져오기 자체를 막지 않고 검사 목록의 error/warning으로 남는다.

## 12. 시험지 renderer 연결 방식

렌더링의 핵심 매핑은 다음과 같다.

| JSON/내부 필드 | 문제지 표시 |
|---|---|
| `materialTitle` | 카드 자료 제목 |
| `material` | 일반 지문 또는 자료 소개문 |
| `materialSpec` | 도표, 안내문, 순서 블록, 삽입문, 요약 상자, 장문 구획 |
| `questions[].stem` | 번호와 함께 발문 |
| `questions[].choices` | ①~⑤ 선지; 35/38/39는 지문 위치형이라 별도 내용 선지를 숨김 |
| `questions[].score` | 3점 등 2점이 아닌 경우 배점 표기 |
| 구조 표식 | 밑줄, 빈칸, 삽입문장, 삽입 위치, 요약 빈칸, 박스형 어휘로 React 요소 변환 |
| 연결된 `MediaAsset` | 이미지와 선택적 caption |

`csatPrintFlow()`와 `buildExamFlowBlocks()`가 템플릿별 순서를 결정한다.

- 일반: 발문/지문/선지 흐름
- 25: 도표를 구조화 렌더링하고 도입문과 다섯 진술을 문제지 문단에 결합
- 35·38·39: 발문 뒤 지문 내부 번호 위치를 사용하며 별도 선지 목록을 출력하지 않음
- 40: 원문과 요약문을 분리하고 사이에 화살표를 표시
- 41~42, 43~45: 공유 자료를 한 번 출력한 후 하위 문항을 출력

실시간 미리보기와 조립 시험지/인쇄는 같은 핵심 renderer와 material presentation 유틸리티를 사용한다.

## 13. 정답/해설 renderer 연결 방식

`ExamAnswerPages`는 조립 순서의 각 문항마다 다음을 출력한다.

- `answerIndex` → 원문자 정답(①~⑤)
- `explanation` → 해설 본문
- `evidenceRefs` → ` / `로 연결한 정답 근거
- question `intention` → 없으면 카드 의도, 없으면 세트 공통 의도
- 세트 제목

현재 정답·해설지 renderer는 `distractorReasons`와 `qualityReview`를 출력하지 않는다. `translation` 필드가 모델에 없으므로 지문 해석도 출력하지 않는다. 별도의 단순 정답표 데이터 계약은 없고, 정답 및 해설 페이지에서 문항별 정답을 표시한다.

## 14. verification 구조

독립 검증은 수능형 세트 또는 조립 시험지를 대상으로 선택 실행한다.

### 14.1 검증 프롬프트 입력

`createVerificationPrompt()`는 다음을 포함한다.

- 대상 식별: scope, targetId, 제목
- 생성 시점 원본 fingerprint(FNV-1a)
- 각 문항의 `setId`, `itemId`, `templateId`
- `material`
- question의 내부 `questionId`, slot, stem, choices, 선언 정답, explanation, evidenceRefs, distractorReasons

검증 AI는 문제를 수정하지 않고 독립 풀이와 finding만 반환하도록 지시된다.

### 14.2 Verification JSON 예시(테스트 구조 축약)

```json
{
  "schemaId": "english-question-lab-csat-verification-v1",
  "targetId": "현재 세트 또는 시험지 ID",
  "sourceFingerprint": "fnv1a-........",
  "overallSummary": "축약 요약",
  "questionReviews": [
    {
      "setId": "...",
      "csatItemId": "...",
      "questionId": "...",
      "slot": "33",
      "predictedAnswerIndex": 1,
      "confidence": 0.9,
      "choiceAssessments": [
        {"choiceIndex": 1, "verdict": "correct", "reason": "..."}
      ],
      "evidence": ["..."],
      "explanationConsistent": true,
      "explanationNote": "...",
      "strongestDistractorIndex": 2
    }
  ],
  "findings": []
}
```

43~45의 44번은 선택적으로 `referents[{marker,entityId,evidence}]`를 사용한다.

### 14.3 검증 가져오기 보호

- schemaId, targetId, sourceFingerprint가 정확해야 한다.
- 프롬프트 생성 뒤 원본이 바뀌었으면 fingerprint 불일치로 거부한다.
- 대상의 모든 문항을 정확히 한 번 검증해야 하며 누락·중복·알 수 없는 questionId를 거부한다.
- JSON 잘림과 일반 문법 오류를 구분해 안내한다.
- 정답 불일치, 단일 정답 실패, 해설 불일치, 0.7 미만 확신도, 44번 4:1 실패는 앱이 review 결과에서 자동 finding으로 만든다.

검증 결과는 생성 JSON을 직접 수정하지 않는다.

## 15. repair 구조

finding별 사용자 결정은 `approve`, `revise`, `ignore`, `defer`다.

- `approve`: AI의 `suggestedRepair`를 repair prompt에 포함
- `revise`: 사용자의 개별 note를 포함
- `ignore`, `defer`: 수정 지시에서 제외
- 전체 사용자 메모가 있으면 별도 포함

repair prompt의 골격은 다음과 같다.

```text
[VERIFICATION_REPAIR]
승인된 검증 의견에 따라서만 수정

[세트/카드 식별]
setId: ...
itemIds: ...

[승인된 문항별 수정]
- slot · category: 승인된 suggestedRepair 또는 사용자 note

[사용자 전체 메모]
...

[현재 JSON]
lastImportedJson 전체
```

repair AI는 별도 설계 승인 없이 **패치가 아닌 모든 cards를 포함한 최종 Generation JSON 하나**를 반환해야 한다. 그 결과는 기존 `parseEnglishSetJson()` 경로로 다시 가져오므로 item/template/variant/card 수 검사가 다시 적용된다. 자동 패치 또는 자동 승인 구조는 없다.

## 16. v0 전용 AI가 반드시 지켜야 할 현재 계약

현재 앱과 가장 안전하게 연결하려면 v0 전용 AI는 다음을 지켜야 한다.

1. 최초 수능 제작에서는 먼저 한국어 전체 설계안을 제시하고 명시적 승인 전에는 문제나 JSON을 만들지 않는다.
2. 승인 후에는 설명, 인사말, 주석, Markdown 코드 펜스 없이 `JSON.parse` 가능한 객체 하나만 반환한다. importer가 한 겹의 코드 펜스를 허용하더라도 계약으로 의존하지 않는다.
3. 최상위는 정확히 `{title, items}` 형태로 만든다.
4. 앱 프롬프트에 들어 있는 모든 `itemId`를 문자 단위로 정확히 한 번 반환하고 다른 ID를 추가하지 않는다.
5. 각 item의 `templateId`와 `variantId`를 요청 문자열 그대로 보존한다.
6. 각 item의 질문 수를 템플릿/변형 blueprint와 일치시킨다. 41~42는 한 item에 2개, 43~45는 한 item에 3개다.
7. 수능형은 선지 5개와 단일 정답을 제공한다. 35·38·39의 choices는 호환용 `①`~`⑤`다.
8. `answerIndex`는 1~5의 정수로 명시한다. 원문자·문자열·누락/default 동작에 의존하지 않는다.
9. `material`, `materialSpec`, 구조 표식을 템플릿 지침에 맞춘다.
10. 문서 스키마의 question 설명/의도/근거/오답 사유/배점과 `qualityReview` 전체를 채운다.
11. `evidenceRefs`는 실제 material에 존재하는 직접 인용이어야 한다.
12. 공유 지문을 하위 item으로 쪼개거나 중복하지 않는다.
13. 앱 내부 필드(`id`, `design`, `familyId`, `materialMode`, `sourceKind`, `passageLength`, `difficulty`)를 Generation JSON에 출력하지 않는다.
14. question-level `questionId`를 생성 계약의 식별자로 사용하지 않는다.
15. JSON 문자열의 큰따옴표와 개행을 올바르게 escape하고 후행 쉼표, `undefined`, `NaN`, `Infinity`를 사용하지 않는다.
16. repair 모드에서는 `[VERIFICATION_REPAIR]`의 승인된 지시만 적용하고 전체 JSON을 반환한다.

현재 runtime은 추가 필드를 무시하지만 JSON Schema는 모든 계층에서 대부분 `additionalProperties: false`다. 따라서 v0는 허용되지 않은 추가 필드를 출력하지 않아야 한다.

## 17. 현재 구조에서 발견한 호환성 위험

### 높은 우선순위

1. **문서 스키마와 runtime importer의 필수성 차이**  
   스키마는 explanation, evidenceRefs, distractorReasons, qualityReview 등을 필수로 요구하지만 importer는 누락을 빈 값/undefined로 받아들인다. “가져오기 성공”과 “계약 준수”가 다르다.

2. **잘못된 정답 번호의 조용한 보정**  
   importer는 잘못되거나 해석 불가능한 `answerIndex`를 거부하지 않고 1번으로 만들며, 범위 밖 숫자도 1~5로 clamp한다. v0 오류가 정답 1번으로 위장될 수 있다.

3. **JSON Schema가 실제 import 경로에서 실행되지 않음**  
   `csat-output-schema.json`과 runtime 수동 파서가 독립적으로 진화할 수 있다. 현재도 추가 필드, 필수 필드, 점수 범위, qualityReview 엄격성에 차이가 있다.

4. **스키마의 items 상한과 제품 상한이 다름**  
   Schema는 items 최대 20개지만 앱은 카드 수가 아니라 실제 하위 문항 합계 최대 4개다. v0가 schema만 보면 앱 프롬프트를 만들 수 없는 크기의 batch를 생성할 수 있다.

5. **번역 계약 부재**  
   사용자 목표 설명에는 시험지/정답지/해설지가 포함되지만 현재 generation 모델과 renderer에는 `translation`이 없다. v0가 번역을 출력하면 현재 importer는 보존하거나 표시하지 않는다.

### 중간 우선순위

6. **template/variant 조합 제약이 Schema에 표현되지 않음**  
   각 enum 값은 있지만 어떤 variant가 어떤 template에 허용되는지 Schema만으로는 알 수 없다. runtime은 현재 카드의 정확한 조합으로 검사한다.

7. **수능 question.type은 출력 계약에 필수지만 runtime에서는 무시됨**  
   AI가 잘못된 type을 반환해도 blueprint type으로 대체되어 오류가 드러나지 않는다.

8. **추가 필드 정책 차이**  
   Schema는 추가 필드를 금지하지만 runtime은 대체로 무시한다. 향후 v0가 잘못된 필드명(예: `translation`)을 출력해도 사용자에게 데이터 손실이 명확히 드러나지 않을 수 있다.

9. **materialSpec의 의미 무결성은 import와 후속 검사로 분산됨**  
   예를 들어 chart categories와 각 series values 길이 일치 같은 의미 검사는 import 시 완전한 원자적 거부 계약이 아니다.

10. **내신형·맞춤형과 수능형의 top-level 구조/승인 절차가 다름**  
    하나의 v0 AI가 세 모드를 모두 담당한다면 mode별 contract 분기가 필요하다. 현재 첨부 지침은 수능형 중심이다.

11. **검증 JSON도 Schema를 직접 실행하지 않음**  
    식별자/fingerprint/모든 문항 포함은 강하게 검사하지만, 일부 enum/개수/범위는 runtime 정리 또는 자동 finding에 의존한다.

12. **renderer에 사용되지 않는 생성 필드**  
    `distractorReasons`와 `qualityReview`는 검사/편집에는 쓰이지만 현재 정답·해설지 출력에는 나타나지 않는다. v0 산출물의 사용자 기대를 분명히 해야 한다.

## 18. v0 설계 전에 결정해야 할 사항

1. v0의 권위 계약을 `csat-output-schema.json`으로 단일화할지, runtime importer의 현재 느슨한 동작까지 공식 호환으로 볼지 결정해야 한다.
2. JSON 붙여넣기 순간 엄격 Schema validation을 수행할지, 현재처럼 구조 parse와 후속 품질 검사를 분리할지 결정해야 한다.
3. 잘못된 `answerIndex`를 기본값/보정할지 즉시 거부할지 결정해야 한다. 데이터 안전 관점에서는 거부가 적절하다.
4. 제품의 batch 한도를 schema에도 “실제 하위 문항 최대 4개”로 표현할 방법을 결정해야 한다.
5. template별 질문 수와 허용 variant 조합을 기계 판독 가능한 계약으로 만들지 결정해야 한다.
6. v0 범위를 우선 수능형만으로 제한할지, 다른 top-level JSON을 쓰는 내신형·맞춤형까지 포함할지 결정해야 한다.
7. 지문 해석/번역이 필요한 산출물인지 결정해야 한다. 필요하다면 현재 모델·importer·renderer에 없는 필드이므로 별도 호환성 작업이 선행되어야 한다.
8. `distractorReasons`, `qualityReview`를 최종 해설지에 표시할지 내부 검사용으로만 유지할지 결정해야 한다.
9. 이미지/도표 자료에서 AI JSON의 `chart` 데이터와 앱 별도 `MediaAsset`의 역할을 어떻게 나눌지 결정해야 한다.
10. 코드 펜스, 추가 필드, 누락 필드에 대한 오류 정책을 명문화하고 prompt, Schema, runtime test에서 동일하게 유지할지 결정해야 한다.
11. 최초 제작 승인 프로토콜을 v0 시스템 지침에서 강제할지, 앱이 별도 상태로 승인 여부를 전달할지 결정해야 한다.
12. verification/repair contract를 Generation v0와 같은 패키지로 둘지 별도 버전 계약으로 관리할지 결정해야 한다.

현재 프로그램은 목표한 복사/붙여넣기 방식의 생성·가져오기·렌더링 흐름을 이미 갖추고 있으며, 제공된 실제 프롬프트와 결과 JSON도 그 핵심 경로와 맞는다. 다만 문서 Schema와 실제 importer 사이의 필수 필드·오류 처리 차이, 잘못된 정답 번호의 자동 보정, 번역 필드 부재가 있어 v0의 안정된 계약을 확정하기 전에 호환성 정리가 필요하다.

NEEDS_COMPATIBILITY_FIX
