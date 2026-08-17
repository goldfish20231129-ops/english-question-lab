# Provided Passage Generation Contract V0.2

## 범위

Provided Passage V0.2는 `school_english_provided_passage`와 `English`만 지원한다. 하나의 권위 원문에 앱 기준 최대 5개 문항을 연결하며 `content_match`, `content_inference`, `sentence_insertion`, `grammar`, `summary`를 지원한다. V0.1 저장 데이터와 Schema는 삭제하거나 변경하지 않는다.

`content_inference`는 지문에 명시된 사실을 그대로 재진술하는 유형이 아니라, 지문의 단서와 관계로부터 가장 타당하게 도출되는 내용을 묻는 `내용 이해` 유형이다. 외부 배경지식 없이 지문만으로 정답이 유일해야 한다.

`summary`는 권위 원문을 공유하면서 `question.summaryText`에 별도의 영어 요약문 한 문장을 둔다. `[[요약빈칸:A]]`와 `[[요약빈칸:B]]`는 각각 정확히 한 번이어야 하며, 다섯 choices는 `A단어|B단어` 형식의 단어쌍이다.

문장 삽입은 내용 일치·불일치, 내용 이해 및 어법 문항과 한 요청에 함께 포함할 수 있다. 삽입 문장, 후보 경계와 위치 표식은 해당 `itemId`의 `materialOperation`에만 속하며 공통 원문이나 다른 문항에 전파하지 않는다.

## Custom GPT 경로 선택

같은 Custom GPT는 입력 첫 줄로 계약을 선택한다.

- `[PROVIDED_PASSAGE_GENERATION_V0.2]`: 이 문서와 Request/Response Schema V0.2를 모두 적용한다.
- `[SCHOOL_ENGLISH_GENERATION_V0.2]`: 앱의 새 자료 작성 경로다. 프롬프트 안의 일반 내신형 JSON 형식을 적용하며 Provided Passage의 ID·fingerprint·offset과 Request/Response Schema를 요구하지 않는다.
- `[EXPLANATION_GENERATION_V1]`: 확정된 문제를 변경하지 않고 `explanation-output-schema-v1.json` 형식의 해설 patch만 반환한다.

새 자료 작성 경로는 요청된 복수 문항을 한 JSON의 `questions`에 순서대로 반환한다. 문장 삽입은 다른 유형과 함께 만들 수 있지만 한 세트에 한 문항만 허용한다. `material`에 있는 삽입 문장과 위치 표식은 앱의 문항별 표시 계층에서 삽입 문항에만 보인다. 첫 응답부터 JSON 객체 하나를 반환하며 Provided Passage 승인 절차를 적용하지 않는다.

## 원문 권위

앱은 입력 중간의 줄바꿈을 한 칸으로 합쳐 일반 영어 지문을 한 문단으로 정규화한다. 정규화된 `material`과 `providedPassageV02.originalText`가 권위 원문이다. Response는 원문 전체를 반환하지 않는다. `sourcePassageId`, SHA-256 fingerprint, sentence ID, `[start,end)` offset, boundary ID는 Request와 일치해야 한다. 어법 오류 변형은 `grammar_check.presentedForm`에만 저장하고 원문을 덮어쓰지 않는다.

## 문항별 계획

각 item은 독립된 `itemId`, `questionType`, `choiceLanguage`, `vocabularyLevel`, `contentMatchPolarity`, `grammarTarget`, `grammarMode`, `requiredStem`을 가진다. `requiredStem`은 Request Schema V0.2의 `$defs.item.required`와 `$defs.item.properties.requiredStem`에 모두 정의된 비어 있지 않은 필수 문자열이다. `additionalProperties: false`는 정의되지 않은 다른 필드를 거부할 뿐 `requiredStem`을 거부하지 않는다. Response의 items는 요청한 item과 정확히 일대일로 대응해야 하며 `question.stem`은 공백과 문장부호를 포함해 `requiredStem`과 정확히 같아야 한다. Generator는 `requiredStem`을 삭제하거나 `questionType`만으로 발문을 재구성하지 않는다.

## 문장 삽입 위치 식별자

`candidateBoundaryIds`, `answerBoundaryId`, `positionReasons[].boundaryId`는 원문 위치 연결을 위한 내부 좌표이므로 Request와 Response에서 그대로 보존한다. 교사·학생용 문장은 내부 ID를 출력하지 않고 `candidateBoundaryIds[0]`부터 `[4]`까지를 각각 `①`부터 `⑤`로 표시한다. ID에 포함된 숫자를 위치 번호로 해석하지 않는다. `answerIndex`는 `candidateBoundaryIds.indexOf(answerBoundaryId) + 1`과 같아야 하며, 해설의 정답 위치 기호도 같은 계산 결과를 사용한다.

## 어법 태그

- `relative_clause`: 선행사와 관계절 내부 성분
- `appositive_that`: 앞 명사의 내용과 완전한 that절, 관계대명사 that과 구별
- `subject_verb_agreement`: 전치사구·삽입구를 제외한 실제 주어와 동사의 수
- `participle_clause`: 의미상 주어, 주절 주어, 능동·수동
- `nonrestrictive_relative`: 쉼표, 선행사 범위, that 사용 불가, 문장 전체 수식
- `pronoun_agreement`: 대명사·지시어의 선행사와 수·참조 범위
- `dummy_it`: 가주어 it과 뒤의 진주어
- `cleft_it_that`: 강조 대상과 잔여 절, 가주어 구문과의 구별

어법 문항은 `testedSpan`, `sourceForm`, `presentedForm`, `ruleCheck`를 반환한다. `testedSpan`은 실제로 밑줄 칠 최소 어법 표현만 가리키고 문장 전체를 범위로 사용하지 않는다. 새 문항의 기본 형식인 `controlled_error_variant`는 `question.evidenceSpans`에 원문 순서의 서로 겹치지 않는 최소 표적을 정확히 5개 반환하며 시험지에서는 ①~⑤와 밑줄로 표시한다. 다섯 표적은 관계사·동격 that, 수 일치, 동사·준동사, 능수동, 대명사 등 서로 다른 핵심 문법 항목을 가능한 한 분산한다. choices는 ①~⑤로 고정하고 testedSpan 및 answerIndex는 유일한 오류 표적과 일치해야 한다. `ruleCheck.isUniquelyDetermined`는 반드시 true다. 근거가 모호하면 해당 문항을 생성하지 않는다.

## 문법 모드

- `source_form_check`: 원문 형태를 그대로 판단한다. `sourceForm === presentedForm`이어야 한다.
- `controlled_error_variant`: 원문은 보존하고 다섯 밑줄 중 한 곳의 별도 문제 표현만 최소 변형한다. `sourceForm !== presentedForm`이어야 한다.

## Request 검증과 출력

Generator는 `schemaId`·`mode`, 필수 최상위 필드, `items` 배열, 각 item의 필수 필드, 실제 미정의 additional property 순으로 검증한다. `requiredStem`은 정식 property이므로 additional-properties 오류 후보에서 제외한다.

Request가 유효하면 설계안이나 승인 질문 없이 즉시 `provided-passage-response-schema-v0.2.json`을 만족하는 문제·정답 JSON 객체 하나만 반환한다. Request Schema, 원문 identity, sentence·boundary offset, item 계약 또는 지원 조합이 유효하지 않으면 오류 목록만 반환한다. 이때 임시 JSON, 승인 문장, 지원 유형으로의 임의 변경을 함께 출력하지 않는다.

1차 Response는 `evidenceSpans`와 `materialOperation`을 유지하되 `explanation`, `intention`, `distractorReasons`, `qualityReview`를 생략할 수 있다. 호환을 위해 사용자용 설명 필드를 함께 반환한다면 내부 boundary ID를 포함하지 않는다. `[EXPLANATION_GENERATION_V1]`의 2차 Response는 기존 ID, stem, choices와 `answerIndex`를 바꾸지 않고 해설 필드만 보충하며, 문장 삽입의 사용자용 문자열에는 후보 배열 순서 기반 `①~⑤`만 사용한다.

앱은 `materialMode: provided`인데 V0.1/V0.2 state가 없는 구형 세트를 범용 생성 경로로 보내지 않는다. 원문과 기존 문항을 보존한 blocked 상태로 표시하고, 지원 조합을 확인한 사용자가 V0.2 연결 준비를 명시적으로 실행해야 한다.

## 비지원

API 자동 호출, 원문 자동 교정, 외부 사실 기반 정답, 9개 이상 문항, 자동 번역, 문법 근거가 유일하지 않은 문항은 지원하지 않는다.
