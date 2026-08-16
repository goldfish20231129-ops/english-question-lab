# Provided Passage Generation Contract V0.1

## 범위

`materialMode: provided`를 기존 지문 사용 모드로 재사용하며 전용 Request mode는 `school_english_provided_passage`이다. 이 앱은 영어 전용이므로 subject는 `English`로 고정한다. V0.1의 사용자 화면은 내신형 세트 하나와 다음 유형만 지원한다.

- `content_match`: 내신형 내용 일치·불일치
- `sentence_insertion`: 내신형 문장 삽입

기존 `materialMode: generated`, Generation Contract V0, `csat-output-schema.json`, Custom GPT V0 Bundle은 변경하지 않는다.

## 권위 경계

앱의 `EnglishQuestionSet.material`과 `providedPassage.originalText`가 권위 원문이다. AI 응답에는 원문 필드가 없으며 Import Adapter는 응답으로 원문을 덮어쓰지 않는다. 삽입 위치 표식은 `materialOperation`과 source boundary를 사용해 렌더링할 때만 파생한다.

## Request

Request Schema는 `provided-passage-request-schema-v0.1.json`이다. source passage는 `source.passage`에 한 번만 포함한다. mode·subject, itemId·templateId·variantId, questionCount 1, sourcePassageId·sourceFingerprint, 문장·경계, 선택지 언어, 생성 어휘 수준, 발문 극성 및 원문 보존 정책을 포함한다. 문장 삽입의 choiceLanguage는 `null`이며 후보 경계 수는 5로 고정한다.

첫 응답은 `[내신 영어 기존 지문 문항 설계안]`만 허용한다. 마지막 승인 문장은 기존 시스템과 같은 다음 문장이다.

`이 설계로 JSON을 생성할까요? 수정할 카드가 있으면 카드 번호와 변경 사항을 알려주세요.`

## Response

Response Schema는 `provided-passage-response-schema-v0.1.json`이다. AI는 원문 대신 source identity, 문항, evidence span, 오답 이유, qualityReview 및 필요한 material operation만 반환한다.

- 내용 일치: `materialOperation: null`
- 문장 삽입: `insert_sentence` operation, 후보 경계 5개, 정답 경계, 위치별 이유, 앞뒤 근거

## Import 불변 조건

- sourcePassageId와 SHA-256 fingerprint 일치
- itemId·templateId·variantId 일치
- 문항 유형·선지 언어·생성 어휘 수준 일치
- sentenceId·boundaryId 존재
- evidence text가 `[start,end)` 원문과 byte-for-byte 일치
- 선택지 5개, 단일 정답, 중복 없음
- 실패 시 기존 set, revision, 원문을 변경하지 않음

## 비지원

다중 provided 문항, 두 지원 유형 이외 문항, 수능형 문항 설계 UI, API 호출, 자동 Custom GPT 설정, 원문 번역·요약·교정, 통계 기반 절대 난이도는 V0.1 범위가 아니다.
