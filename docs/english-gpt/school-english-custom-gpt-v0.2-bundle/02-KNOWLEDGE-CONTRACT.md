# Provided Passage Generation Contract V0.2

## 범위

Provided Passage V0.2는 `school_english_provided_passage`와 `English`만 지원한다. 하나의 권위 원문에 1~8개 문항을 연결하며 `content_match`, `sentence_insertion`, `grammar`를 지원한다. V0.1 저장 데이터와 Schema는 삭제하거나 변경하지 않는다.

문장 삽입은 내용 일치·불일치 및 어법 문항과 한 요청에 함께 포함할 수 있다. 삽입 문장, 후보 경계와 위치 표식은 해당 `itemId`의 `materialOperation`에만 속하며 공통 원문이나 다른 문항에 전파하지 않는다.

## Custom GPT 경로 선택

같은 Custom GPT는 입력 첫 줄로 계약을 선택한다.

- `[PROVIDED_PASSAGE_GENERATION_V0.2]`: 이 문서와 Request/Response Schema V0.2를 모두 적용한다.
- `[SCHOOL_ENGLISH_GENERATION_V0.2]`: 앱의 새 자료 작성 경로다. 프롬프트 안의 일반 내신형 JSON 형식을 적용하며 Provided Passage의 ID·fingerprint·offset과 Request/Response Schema를 요구하지 않는다.

새 자료 작성 경로는 요청된 복수 문항을 한 JSON의 `questions`에 순서대로 반환한다. 문장 삽입은 다른 유형과 함께 만들 수 있지만 한 세트에 한 문항만 허용한다. `material`에 있는 삽입 문장과 위치 표식은 앱의 문항별 표시 계층에서 삽입 문항에만 보인다. 첫 응답부터 JSON 객체 하나를 반환하며 Provided Passage 승인 절차를 적용하지 않는다.

## 원문 권위

앱의 `material`과 `providedPassageV02.originalText`가 권위 원문이다. Response는 원문 전체를 반환하지 않는다. `sourcePassageId`, SHA-256 fingerprint, sentence ID, `[start,end)` offset, boundary ID는 Request와 일치해야 한다. 어법 오류 변형은 `grammar_check.presentedForm`에만 저장하고 원문을 덮어쓰지 않는다.

## 문항별 계획

각 item은 독립된 `itemId`, `questionType`, `choiceLanguage`, `vocabularyLevel`, `contentMatchPolarity`, `grammarTarget`, `grammarMode`를 가진다. Response의 items는 요청한 item과 정확히 일대일로 대응해야 한다.

## 어법 태그

- `relative_clause`: 선행사와 관계절 내부 성분
- `appositive_that`: 앞 명사의 내용과 완전한 that절, 관계대명사 that과 구별
- `subject_verb_agreement`: 전치사구·삽입구를 제외한 실제 주어와 동사의 수
- `participle_clause`: 의미상 주어, 주절 주어, 능동·수동
- `nonrestrictive_relative`: 쉼표, 선행사 범위, that 사용 불가, 문장 전체 수식
- `pronoun_agreement`: 대명사·지시어의 선행사와 수·참조 범위
- `dummy_it`: 가주어 it과 뒤의 진주어
- `cleft_it_that`: 강조 대상과 잔여 절, 가주어 구문과의 구별

어법 문항은 `testedSpan`, `sourceForm`, `presentedForm`, `ruleCheck`를 반환한다. `ruleCheck.isUniquelyDetermined`는 반드시 true다. 근거가 모호하면 해당 문항을 생성하지 않고 설계 단계에서 검토 필요를 알린다.

## 문법 모드

- `source_form_check`: 원문 형태를 그대로 판단한다. `sourceForm === presentedForm`이어야 한다.
- `controlled_error_variant`: 원문은 보존하고 별도 문제 표현만 최소 변형한다. `sourceForm !== presentedForm`이어야 한다.

## 승인과 출력

첫 응답은 `[내신 영어 기존 지문 다문항 설계안]`만 출력한다. 카드별 근거 sentence ID, 어법 태그, 판정 규칙과 오답 원리를 보여 주고 승인을 받는다. 승인 후에는 `provided-passage-response-schema-v0.2.json`을 만족하는 JSON 객체 하나만 반환한다.

Request Schema, 원문 identity, sentence·boundary offset, item 계약 또는 지원 조합이 유효하지 않으면 오류 목록만 반환한다. 이때 설계안, 임시 JSON, 승인 문장, 지원 유형으로의 임의 변경을 함께 출력하지 않는다.

앱은 `materialMode: provided`인데 V0.1/V0.2 state가 없는 구형 세트를 범용 생성 경로로 보내지 않는다. 원문과 기존 문항을 보존한 blocked 상태로 표시하고, 지원 조합을 확인한 사용자가 V0.2 연결 준비를 명시적으로 실행해야 한다.

## 비지원

API 자동 호출, 원문 자동 교정, 외부 사실 기반 정답, 9개 이상 문항, 자동 번역, 문법 근거가 유일하지 않은 문항은 지원하지 않는다.
