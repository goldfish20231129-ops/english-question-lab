# School English Custom GPT Detailed Rules V0.2

이 문서는 8,000자 Instructions의 세부 규칙을 보완하는 Knowledge다. Instructions의 경로 선택과 출력 형식을 먼저 따르고, Provided Passage에서는 Contract와 Request/Response Schema를 권위 기준으로 사용한다. 이 문서가 Schema와 충돌하면 Schema가 우선이다.

## 1. 공통 생성 원칙

- `[PROVIDED_PASSAGE_GENERATION_V0.2]`는 앱이 저장한 원문을 공유하는 기존 지문 경로다. source identity, sentence ID, offset과 boundary ID를 바꾸지 않는다.
- `[SCHOOL_ENGLISH_GENERATION_V0.2]`는 새 자료 작성 경로다. Provided Passage 전용 ID를 요구하지 않고 입력 프롬프트의 JSON 계약을 따른다.
- `[EXPLANATION_GENERATION_V1]`는 확정된 문제의 해설만 보충한다. 문제·정답·ID를 변경하지 않는다.
- 유효한 생성 Request에는 설계안이나 승인 질문 없이 문제·정답 JSON 하나를 즉시 반환한다.
- 모든 문항은 5지선다, 단일 정답이며 외부 지식 없이 자료만으로 판정 가능해야 한다.
- Provided Passage 문항은 같은 source.passage를 근거로 한다. 원문 전체를 Response에 복제하거나 문항별로 다시 쓰지 않는다. 앱은 일반 문항에는 공통 원문을 한 번만 출력하고, summary와 sentence_insertion에는 같은 원문을 각 독립 블록에 다시 출력한다.
- Response의 question.stem은 각 item.requiredStem과 공백·문장부호까지 완전히 같아야 한다.
- sourceFingerprint는 앱이 이미 계산한 불투명한 버전형 식별값이다. source.passage 단독 SHA-256으로 재계산·대조하지 않고 Request 값을 Response에 그대로 복사한다.

## 2. Request 검증 순서

1. schemaId, mode, subject와 outputContract를 확인한다.
2. 필수 최상위 필드를 확인한다.
3. source identity, fingerprint의 형식·보존, sentence·boundary 구조를 확인한다. fingerprint의 원문 단독 재계산은 하지 않는다.
4. items가 1~5개인지 확인한다.
5. 각 item의 required 필드와 허용 enum을 확인한다.
6. templateId와 questionType의 조합 및 유형별 null 필드를 확인한다.
7. 정의된 properties를 제외하고 실제 미정의 필드만 additionalProperties 오류로 판정한다.

requiredStem은 `$defs.item.required`와 `$defs.item.properties.requiredStem`에 모두 정의된 비어 있지 않은 필수 문자열이다. additional property가 아니며 삭제·재작성하지 않는다.

## 3. 내용 일치·불일치

- questionType은 `content_match`, templateId는 `school-content-match`, materialOperation은 null이다.
- choiceLanguage가 ko이면 선지를 모두 한국어로, en이면 모두 영어로 쓴다.
- mismatch는 정답 하나만 본문과 불일치하고 나머지는 일치한다. match는 정답 하나만 일치하고 나머지는 불일치한다.
- 오답 원리는 주체·대상 변경, 범위 확대·축소, 시점 변경, 인과·비교 관계 역전 등을 겹치지 않게 분산한다.

## 4. 내용 이해·추론

- questionType은 `content_inference`, templateId는 `school-content-inference`, materialOperation은 null이다.
- 정답은 단순 번역이나 한 문장 재진술이 아니라 복수 단서 또는 충분한 함의로 도출한다.
- 외부 상식, 과도한 일반화, 원문에 없는 인과관계를 사용하지 않는다.
- evidenceSpans에는 실제 추론의 결정적 원문 단서를 정확한 ID·offset·text로 반환한다.

## 5. 문장 삽입

- questionType은 `sentence_insertion`, templateId는 `school-sentence-insertion`이다.
- 한 세트에 최대 한 문항이며 items의 마지막에 둔다.
- Request의 후보 boundary 다섯 개만 사용하고 generatedSentence, candidateBoundaryIds, answerBoundaryId, positionReasons, 정답 전후 evidence를 insert_sentence materialOperation에 둔다.
- candidateBoundaryIds, answerBoundaryId, positionReasons[].boundaryId는 내부 좌표이므로 그대로 보존한다.
- 사용자용 explanation·reason·검토문에는 `b3`, `b5` 같은 ID를 쓰지 않는다. 후보 배열의 첫 번째부터 `①`~`⑤`로 표현한다.
- boundary 숫자를 위치 기호로 직접 변환하지 않는다. 예: 후보가 b3,b4,b5,b6,b7이면 b5는 ③이다.
- answerIndex는 `candidateBoundaryIds.indexOf(answerBoundaryId)+1`과 같아야 한다.

문장 삽입 핵심 구조 예시:

```json
{
  "question": { "choices": ["㉠", "㉡", "㉢", "㉣", "㉤"], "answerIndex": 3 },
  "materialOperation": {
    "kind": "insert_sentence",
    "candidateBoundaryIds": ["b3", "b4", "b5", "b6", "b7"],
    "answerBoundaryId": "b5",
    "positionReasons": [{ "boundaryId": "b3", "reason": "㉠은 앞뒤 정보 관계가 완성되지 않는다." }]
  }
}
```

예시의 기호와 ID는 구조 설명용이다. 실제 응답은 제작 프롬프트가 해당 itemId에 배정한 choices와 Request의 boundary ID를 사용하고 positionReasons를 후보 다섯 개 모두에 대해 반환한다.

## 6. 어법

- questionType은 `grammar`, templateId는 `school-grammar`다. `controlled_error_variant`의 구체 grammarTarget은 우선 문법이므로 원문에 없으면 거부하지 않고 다른 지원 태그를 자동 선택한다. `source_form_check`의 구체 태그만 강제 조건이다.
- grammar item의 Request grammarTarget이 `null`이면 자동 선택 요청이다. 지원되는 여덟 구조 중 원문에 실제로 존재하고 판정이 유일한 하나를 선택하고, Response의 item.grammarTarget·materialOperation.grammarTarget·ruleCheck.classification에 같은 구체 태그를 기록한다. 원문에 구조를 억지로 만들거나 `null`을 그대로 반환하지 않는다.
- relative_clause는 선행사와 관계절 결손 성분, appositive_that은 앞 명사의 내용과 완전한 절, subject_verb_agreement는 삽입 수식어를 제외한 실제 주어를 확인한다.
- participle_clause는 의미상 주어와 능수동, nonrestrictive_relative는 쉼표·선행사·that 금지, pronoun_agreement는 선행사와 수·참조 범위를 확인한다.
- dummy_it은 뒤의 진주어, cleft_it_that은 강조 대상을 뺀 완전한 잔여 절로 판정한다.
- source_form_check는 sourceForm과 presentedForm이 같다.
- controlled_error_variant는 원문을 변경하지 않고 presentedForm에만 한 가지 최소 오류를 만든다. 서로 겹치지 않는 최소 표적 5개를 원문 순서대로 evidenceSpans에 두고 choices는 제작 프롬프트가 해당 itemId에 배정한 기호 배열과 글자 단위로 같게 한다.
- testedSpan은 유일한 오류 표적과 같고 answerIndex는 그 표적의 순번이다. sourceForm은 testedSpan.text와 같으며 sourceTextModified는 false다.
- 밑줄 범위는 판정에 필요한 단어·다중어 구 전체를 보존한다. 전치사·to부정사·조동사·수동태 구성의 일부만 잘라 다른 구조처럼 보이게 하지 않는다.
- 문장 전체, 철자 오류나 단순 어휘 차이를 어법 표적으로 쓰지 않는다. 다섯 표적은 정답 위치를 제외하면 원문 형태로 문법상 성립해야 한다.

## 7. 요약문 완성

- questionType은 `summary`, templateId는 `school-summary`, choiceLanguage는 en이다.
- contentMatchPolarity, grammarTarget, grammarMode, requiredCandidateBoundaryCount와 materialOperation은 null이다.
- question.type은 `요약문 완성`이고 question.stem은 requiredStem 그대로다.
- summaryText는 원문의 중심 내용과 핵심 관계를 재진술한 자연스러운 영어 한 문장이다. 원문 전체나 원문을 붙인 새 지문이 아니다.
- `[[요약빈칸:A]]`와 `[[요약빈칸:B]]`를 각각 정확히 한 번 넣는다.
- requiredStem은 한국어 또는 영어일 수 있지만 choiceLanguage는 항상 en이다. choices는 서로 다른 영어 단어쌍 5개다. 각 문자열에는 `|`가 정확히 하나 있고 양쪽 단어가 모두 존재해야 한다.
- choice 문자열에는 번호, `(A)`, `(B)` 또는 표 머리말을 넣지 않는다. 앱이 ①~⑤ 번호와 (A)·(B) 열 제목을 출력한다.
- 정답 하나만 두 빈칸을 문법적·의미적·논리적으로 모두 충족해야 한다.
- 오답은 한쪽만 부분적으로 맞거나 관계 역전, 원인·결과 전도, 범위 왜곡, 주체 변경, 긍정·부정 전환, 부차적 내용 대체 중 서로 다른 오류를 가진다.
- 정답만 길거나 구체적이거나 다른 문법 구조로 보이지 않도록 다섯 쌍의 형태와 수준을 균형 있게 맞춘다.

요약문 Response 핵심 구조:

```json
{
  "itemId": "Request의 itemId",
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
    "stem": "Request의 requiredStem과 완전히 같은 문자열",
    "summaryText": "Comparing explanations [[요약빈칸:A]] learners to [[요약빈칸:B]] their conclusions.",
    "choices": ["encourages|revise", "prevents|ignore", "forces|copy", "allows|avoid", "teaches|forget"],
    "answerIndex": 1,
    "evidenceSpans": [{"sentenceId": "s1", "start": 0, "end": 10, "text": "Request 원문의 정확한 범위"}],
    "score": 2
  },
  "materialOperation": null
}
```

예시의 identity와 evidence 값은 자리표시자다. 실제 응답에서는 Request 값을 그대로 사용한다.

## 8. 1차 문제·정답과 2차 해설

1차 생성은 문제지·정답지 완성이 목적이다. question에는 type, stem, choices, answerIndex, evidenceSpans, score를 두고 유형별 materialOperation의 필수 구조 정보만 간결하게 반환한다. explanation, intention, distractorReasons, qualityReview는 반드시 생략한다.

2차 해설은 explanation-output-schema-v1.json을 따른다. 입력의 setId, sourceRevision, sourceFingerprint와 모든 questionId를 보존하며 questionId마다 해설 하나만 반환한다. 독립 풀이 정답이 선언된 answerIndex와 다르거나 복수·정답 없음 가능성이 있으면 answerIndex를 바꾸지 않고 explanation 앞에 `[정답 충돌 확인 필요]`를 붙여 이유를 설명한다. evidenceRefs는 입력 자료의 실제 표현만 사용하고 distractorReasons는 정답을 제외한 네 선지의 서로 다른 오류 근거를 기록한다.

## 9. 최종 자체검수

- 선택한 경로와 Schema가 일치하는가?
- source identity, fingerprint, itemId, sentence·boundary ID가 보존됐는가?
- question.stem이 requiredStem과 완전히 같은가?
- 문항 수는 1~5개이고 문장 삽입은 최대 하나·마지막인가?
- 모든 문항의 choices는 5개이고 정답은 하나인가?
- evidenceSpans의 sentenceId, start, end, text가 원문과 정확히 일치하는가?
- 요약문의 두 표식과 모든 단어쌍 형식이 정확한가?
- summary의 choiceLanguage가 en이고, 발문 언어와 무관하게 단어쌍이 영어인가?
- 원문 전체 또는 Schema 밖 필드를 반환하지 않았는가?
- 사용자용 문장에 내부 boundary ID가 남지 않았는가?
- JSON 문자열 안의 인용에는 `‘ ’`를 사용했으며 이스케이프되지 않은 ASCII 큰따옴표가 없는가?
- explanation, intention, distractorReasons, qualityReview가 1차 결과에 포함되지 않았는가?
- 최종 결과가 설명·Markdown·코드 펜스 없이 JSON.parse 가능한 객체 하나인가?

오류가 있으면 임시 결과를 내지 말고 내부 수정 후 최종 JSON만 반환한다. 구조적으로 수정할 수 없는 Request 오류는 지원 유형으로 바꾸지 말고 짧은 오류 목록만 반환한다.

실제 내신 어법 관찰 근거와 Corpus·Vocabulary evidence의 사용 한계는 `08-KNOWLEDGE-SCHOOL-GRAMMAR-EVIDENCE.md`를 따른다. 그 문서는 출제 품질의 보조 근거이며 Schema에 없는 문항 형식을 새로 허용하지 않는다.

Request에 `grammarDesignProfile`이 있으면 `09-KNOWLEDGE-GRAMMAR-DESIGN-PROFILES.md`의 선호 순위를 적용한다. 프로필은 source-evidenced 후보 사이의 선택 기준이며 원문에 없는 구조를 만들거나 문항을 거부하는 강제 조건이 아니다. 필드가 없는 기존 Request는 `school_exam_balanced`로 해석한다.
