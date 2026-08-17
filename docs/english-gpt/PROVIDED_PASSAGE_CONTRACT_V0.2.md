# Provided Passage Generation Contract V0.2

## 범위

Provided Passage V0.2는 `school_english_provided_passage`와 `English`만 지원한다. 하나의 권위 원문에 앱 기준 최대 5개 문항을 연결하며 `content_match`, `content_inference`, `sentence_insertion`, `grammar`, `summary`를 지원한다. V0.1 저장 데이터와 Schema는 삭제하거나 변경하지 않는다.

`content_inference`는 지문에 명시된 사실을 그대로 재진술하는 유형이 아니라, 지문의 단서와 관계로부터 가장 타당하게 도출되는 내용을 묻는 `내용 이해` 유형이다. 외부 배경지식 없이 지문만으로 정답이 유일해야 한다.

`summary`는 권위 원문을 공유하면서 `question.summaryText`에 별도의 자연스러운 영어 요약문 한 문장을 둔다. `[[요약빈칸:A]]`와 `[[요약빈칸:B]]`는 각각 정확히 한 번이어야 하며, 다섯 choices는 `A단어|B단어` 형식의 단어쌍이다. 각 choice의 `|`는 정확히 하나이고 양쪽 값은 비어 있지 않아야 한다. 정답 하나만 두 빈칸을 문법적·의미적·논리적으로 모두 충족한다.

문장 삽입은 내용 일치·불일치, 내용 이해 및 어법 문항과 한 요청에 함께 포함할 수 있다. 삽입 문장, 후보 경계와 위치 표식은 해당 `itemId`의 `materialOperation`에만 속하며 공통 원문이나 다른 문항에 전파하지 않는다.

## Custom GPT 경로 선택

같은 Custom GPT는 입력 첫 줄로 계약을 선택한다.

- `[PROVIDED_PASSAGE_GENERATION_V0.2]`: 이 문서와 Request/Response Schema V0.2를 모두 적용한다.
- `[SCHOOL_ENGLISH_GENERATION_V0.2]`: 앱의 새 자료 작성 경로다. 프롬프트 안의 일반 내신형 JSON 형식을 적용하며 Provided Passage의 ID·fingerprint·offset과 Request/Response Schema를 요구하지 않는다.
- `[EXPLANATION_GENERATION_V1]`: 확정된 문제를 변경하지 않고 `explanation-output-schema-v1.json` 형식의 해설 patch만 반환한다.

새 자료 작성 경로는 요청된 복수 문항을 한 JSON의 `questions`에 순서대로 반환한다. 문장 삽입은 다른 유형과 함께 만들 수 있지만 한 세트에 한 문항만 허용한다. `material`에 있는 삽입 문장과 위치 표식은 앱의 문항별 표시 계층에서 삽입 문항에만 보인다. 첫 응답부터 JSON 객체 하나를 반환하며 Provided Passage 승인 절차를 적용하지 않는다.

## 원문 권위

앱은 입력 중간의 줄바꿈을 한 칸으로 합쳐 일반 영어 지문을 한 문단으로 정규화한다. 정규화된 `material`과 `providedPassageV02.originalText`가 권위 원문이다. Response는 원문 전체를 반환하지 않는다. `sourcePassageId`, 앱이 계산한 버전형 SHA-256 fingerprint, sentence ID, `[start,end)` offset, boundary ID는 Request와 일치해야 한다. 어법 오류 변형은 `grammar_check.presentedForm`에만 저장하고 원문을 덮어쓰지 않는다.

`sourceFingerprint`는 앱이 버전 접두어와 정규화 규칙을 적용해 생성한 불투명 식별값이다. Generator는 `source.passage`만 직접 SHA-256 처리해 이 값을 재계산하거나 독자적인 해시와 비교하지 않는다. `sourcePreservation.exactFingerprintRequired: true`는 Request에 있는 `sourceFingerprint`를 Response에 글자 단위로 그대로 복사하라는 뜻이다. 실제 원문과 fingerprint의 일치는 앱이 생성 전후에 검증한다. Generator는 Request의 fingerprint를 수정하거나 자체 계산 결과를 이유로 유효한 Request를 거부하지 않는다.

## 문항별 계획

각 item은 독립된 `itemId`, `questionType`, `choiceLanguage`, `vocabularyLevel`, `contentMatchPolarity`, `grammarTarget`, `grammarMode`, `requiredStem`을 가진다. `requiredStem`은 Request Schema V0.2의 `$defs.item.required`와 `$defs.item.properties.requiredStem`에 모두 정의된 비어 있지 않은 필수 문자열이다. `additionalProperties: false`는 정의되지 않은 다른 필드를 거부할 뿐 `requiredStem`을 거부하지 않는다. Response의 items는 요청한 item과 정확히 일대일로 대응해야 하며 `question.stem`은 공백과 문장부호를 포함해 `requiredStem`과 정확히 같아야 한다. Generator는 `requiredStem`을 삭제하거나 `questionType`만으로 발문을 재구성하지 않는다.

## 문장 삽입 위치 식별자

`candidateBoundaryIds`, `answerBoundaryId`, `positionReasons[].boundaryId`는 원문 위치 연결을 위한 내부 좌표이므로 Request와 Response에서 그대로 보존한다. 교사·학생용 문장은 내부 ID를 출력하지 않고 `candidateBoundaryIds[0]`부터 `[4]`까지를 해당 문항의 `question.choices[0]`부터 `[4]`로 표시한다. 표식형 문항이 하나면 `①~⑤`, 같은 지문에 둘 이상이면 문항 순서대로 `㉠~㉤`, `ⓐ~ⓔ`처럼 동그라미가 포함된 겹치지 않는 기호군을 사용한다. 발문에는 그 문항의 선택 기호 범위를 함께 표시한다. ID에 포함된 숫자를 위치 번호로 해석하지 않는다. `answerIndex`는 `candidateBoundaryIds.indexOf(answerBoundaryId) + 1`과 같아야 하며, 해설의 정답 위치 기호도 같은 계산 결과를 사용한다.

발문과 내용 선지는 `stemLanguage` 하나로 통일한다. `stemLanguage`가 `ko`이면 발문과 내용 선지를 모두 한국어로, `en`이면 모두 영어로 작성한다. 위치·표식·배열 기호에는 언어를 적용하지 않는다.

## 어법 태그

어법 item의 Request `grammarTarget`은 구체적인 여덟 태그 또는 `null`이다. `null`은 자동 선택 요청이며 Generator가 지원 태그 중 원문에 실제로 존재하고 판정이 유일한 하나를 선택한다. `controlled_error_variant`의 구체 태그는 우선 문법이다. 원문에 해당 구조가 없으면 Request를 거부하지 않고 다른 지원 태그 중 원문 근거가 분명한 하나를 자동 선택한다. `source_form_check`의 구체 태그만 원문에서 반드시 확인해야 하는 강제 조건이다. Response는 실제 선택한 구체 태그를 item의 `grammarTarget`, `materialOperation.grammarTarget`, `ruleCheck.classification`에 동일하게 기록하며 `null`을 반환하지 않는다.

- `relative_clause`: 선행사와 관계절 내부 성분
- `appositive_that`: 앞 명사의 내용과 완전한 that절, 관계대명사 that과 구별
- `subject_verb_agreement`: 전치사구·삽입구를 제외한 실제 주어와 동사의 수
- `participle_clause`: 의미상 주어, 주절 주어, 능동·수동
- `nonrestrictive_relative`: 쉼표, 선행사 범위, that 사용 불가, 문장 전체 수식
- `pronoun_agreement`: 대명사·지시어의 선행사와 수·참조 범위
- `dummy_it`: 가주어 it과 뒤의 진주어
- `cleft_it_that`: 강조 대상과 잔여 절, 가주어 구문과의 구별

어법 문항은 `testedSpan`, `sourceForm`, `presentedForm`, `ruleCheck`를 반환한다. `testedSpan`은 실제로 밑줄 칠 최소 어법 표현만 가리키고 문장 전체를 범위로 사용하지 않는다. 새 문항의 기본 형식인 `controlled_error_variant`는 `question.evidenceSpans`에 원문 순서의 서로 겹치지 않는 최소 표적을 정확히 5개 반환하며 시험지에서는 해당 문항에 배정된 다섯 기호와 밑줄로 표시한다. 다섯 표적은 관계사·동격 that, 수 일치, 동사·준동사, 능수동, 대명사 등 서로 다른 핵심 문법 항목을 가능한 한 분산한다. choices는 제작 프롬프트에 명시된 기호 배열과 같고 testedSpan 및 answerIndex는 유일한 오류 표적과 일치해야 한다. `ruleCheck.isUniquelyDetermined`는 반드시 true다. 근거가 모호하면 해당 문항을 생성하지 않는다.

## 문법 모드

- `source_form_check`: 원문 형태를 그대로 판단한다. `sourceForm === presentedForm`이어야 한다.
- `controlled_error_variant`: 원문은 보존하고 다섯 밑줄 중 한 곳의 별도 문제 표현만 최소 변형한다. `sourceForm !== presentedForm`이어야 한다.

## Request 검증과 출력

Generator는 `schemaId`·`mode`, 필수 최상위 필드, `items` 배열, 각 item의 필수 필드, 실제 미정의 additional property 순으로 검증한다. `requiredStem`은 정식 property이므로 additional-properties 오류 후보에서 제외한다. sourceFingerprint는 형식과 존재 여부만 확인하고, 원문 단독 해시를 계산해 값의 일치 여부를 판정하지 않는다.

Request가 유효하면 설계안이나 승인 질문 없이 즉시 `provided-passage-response-schema-v0.2.json`을 만족하는 문제·정답 JSON 객체 하나만 반환한다. Request Schema, 원문 identity, sentence·boundary offset, item 계약 또는 지원 조합이 유효하지 않으면 오류 목록만 반환한다. 이때 임시 JSON, 승인 문장, 지원 유형으로의 임의 변경을 함께 출력하지 않는다.

1차 Response는 `evidenceSpans`와 `materialOperation`을 유지하되 `explanation`, `intention`, `distractorReasons`, `qualityReview`를 생략할 수 있다. 호환을 위해 사용자용 설명 필드를 함께 반환한다면 내부 boundary ID를 포함하지 않는다. `[EXPLANATION_GENERATION_V1]`의 2차 Response는 기존 ID, stem, choices와 `answerIndex`를 바꾸지 않고 해설 필드만 보충하며, 문장 삽입의 사용자용 문자열에는 후보 배열 순서에 대응하는 실제 `question.choices` 기호만 사용한다.

앱은 `materialMode: provided`인데 V0.1/V0.2 state가 없는 구형 세트를 범용 생성 경로로 보내지 않는다. 원문과 기존 문항을 보존한 blocked 상태로 표시하고, 지원 조합을 확인한 사용자가 V0.2 연결 준비를 명시적으로 실행해야 한다.

## 요약문 완성 Request와 Response 예시

요약문 item은 `questionType: summary`, `templateId: school-summary`, `choiceLanguage: en`을 사용하며 극성·문법·삽입 전용 필드는 null이다. `requiredStem`은 앱에서 전달된 문자열을 그대로 보존한다.

```json
{
  "itemId": "요청에서 받은 itemId",
  "templateId": "school-summary",
  "variantId": "standard",
  "questionType": "summary",
  "choiceLanguage": "en",
  "vocabularyLevel": "source_matched",
  "contentMatchPolarity": null,
  "grammarTarget": null,
  "grammarMode": null,
  "question": {
    "type": "요약문 완성",
    "stem": "다음 글의 내용을 한 문장으로 요약하고자 한다. 빈칸 (A)와 (B)에 들어갈 말로 가장 적절한 것은?",
    "summaryText": "Comparing competing explanations [[요약빈칸:A]] learners to [[요약빈칸:B]] their conclusions.",
    "choices": [
      "encourages|revise",
      "prevents|ignore",
      "forces|copy",
      "allows|avoid",
      "teaches|forget"
    ],
    "answerIndex": 1,
    "evidenceSpans": [
      {
        "sentenceId": "s1",
        "start": 0,
        "end": 50,
        "text": "Request 원문에 실제로 존재하는 정확한 근거 범위"
      }
    ],
    "score": 2
  },
  "materialOperation": null
}
```

예시의 evidence 값은 형식 설명용이다. 실제 응답에서는 Request 원문의 sentence ID, `[start,end)`와 text가 정확히 일치하는 범위만 사용한다. 원문 전체나 요약문이 합쳐진 새 지문은 반환하지 않는다.

## 비지원

API 자동 호출, 원문 자동 교정, 외부 사실 기반 정답, 6개 이상 문항, 자동 번역, 문법 근거가 유일하지 않은 문항은 지원하지 않는다.
