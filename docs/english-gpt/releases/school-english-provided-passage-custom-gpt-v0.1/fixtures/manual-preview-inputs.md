# Manual Preview inputs

각 fixture는 최초에는 설계안만, 명시적 승인 뒤에는 Response JSON만 출력되어야 한다. 아래 JSON의 `request`를 앱 Prompt의 Request JSON과 같은 방식으로 붙여넣는다.

## 1. 내용 불일치 + 한국어 선지 + source_matched

- fixtureId: `content-mismatch-ko-source`
- expected: `ACCEPT / accepted`
- 검증: mode·subject, 승인 gate, 원문 비변경, strict JSON 및 해당 오류 조건

```json
{
  "schemaId": "english-question-lab-provided-passage-request-v0.1",
  "mode": "school_english_provided_passage",
  "subject": "English",
  "source": {
    "sourcePassageId": "source-8f97b90f65c78ef4",
    "sourceFingerprint": "sha256:8f97b90f65c78ef4a178f0dddab142a5addf393cd168af9e3dfba015f985bcf4",
    "title": "Preview 01",
    "passage": "Mina planted basil in a sunny window. She watered it only when the soil felt dry. After two weeks, new leaves appeared. Mina shared a few leaves with her neighbor. The neighbor used them in a warm soup. Both families later planted more herbs.",
    "sentences": [
      {
        "id": "s1",
        "start": 0,
        "end": 37,
        "text": "Mina planted basil in a sunny window."
      },
      {
        "id": "s2",
        "start": 38,
        "end": 81,
        "text": "She watered it only when the soil felt dry."
      },
      {
        "id": "s3",
        "start": 82,
        "end": 119,
        "text": "After two weeks, new leaves appeared."
      },
      {
        "id": "s4",
        "start": 120,
        "end": 163,
        "text": "Mina shared a few leaves with her neighbor."
      },
      {
        "id": "s5",
        "start": 164,
        "end": 202,
        "text": "The neighbor used them in a warm soup."
      },
      {
        "id": "s6",
        "start": 203,
        "end": 242,
        "text": "Both families later planted more herbs."
      }
    ],
    "boundaries": [
      {
        "id": "b0",
        "offset": 0,
        "afterSentenceId": "s1"
      },
      {
        "id": "b1",
        "offset": 37,
        "beforeSentenceId": "s1",
        "afterSentenceId": "s2"
      },
      {
        "id": "b2",
        "offset": 81,
        "beforeSentenceId": "s2",
        "afterSentenceId": "s3"
      },
      {
        "id": "b3",
        "offset": 119,
        "beforeSentenceId": "s3",
        "afterSentenceId": "s4"
      },
      {
        "id": "b4",
        "offset": 163,
        "beforeSentenceId": "s4",
        "afterSentenceId": "s5"
      },
      {
        "id": "b5",
        "offset": 202,
        "beforeSentenceId": "s5",
        "afterSentenceId": "s6"
      },
      {
        "id": "b6",
        "offset": 242,
        "beforeSentenceId": "s6"
      }
    ]
  },
  "item": {
    "itemId": "preview-01",
    "templateId": "school-content-match",
    "variantId": "standard",
    "questionType": "content_match",
    "choiceLanguage": "ko",
    "vocabularyLevel": "source_matched",
    "contentMatchPolarity": "mismatch",
    "targetLevel": "고등학교",
    "score": 2,
    "questionCount": 1,
    "requiredCandidateBoundaryCount": null
  },
  "sourcePreservation": {
    "authority": "app_stored_source",
    "responsePassage": "forbidden",
    "exactFingerprintRequired": true
  },
  "approval": {
    "firstResponse": "design_only",
    "approvalSentence": "이 설계로 JSON을 생성할까요? 수정할 카드가 있으면 카드 번호와 변경 사항을 알려주세요.",
    "afterApproval": "single_json_object"
  },
  "outputContract": "english-question-lab-provided-passage-generation-v0.1"
}
```

## 2. 내용 일치 + 영어 선지 + grade_1

- fixtureId: `content-match-en-grade1`
- expected: `ACCEPT / accepted`
- 검증: mode·subject, 승인 gate, 원문 비변경, strict JSON 및 해당 오류 조건

```json
{
  "schemaId": "english-question-lab-provided-passage-request-v0.1",
  "mode": "school_english_provided_passage",
  "subject": "English",
  "source": {
    "sourcePassageId": "source-8f97b90f65c78ef4",
    "sourceFingerprint": "sha256:8f97b90f65c78ef4a178f0dddab142a5addf393cd168af9e3dfba015f985bcf4",
    "title": "Preview 02",
    "passage": "Mina planted basil in a sunny window. She watered it only when the soil felt dry. After two weeks, new leaves appeared. Mina shared a few leaves with her neighbor. The neighbor used them in a warm soup. Both families later planted more herbs.",
    "sentences": [
      {
        "id": "s1",
        "start": 0,
        "end": 37,
        "text": "Mina planted basil in a sunny window."
      },
      {
        "id": "s2",
        "start": 38,
        "end": 81,
        "text": "She watered it only when the soil felt dry."
      },
      {
        "id": "s3",
        "start": 82,
        "end": 119,
        "text": "After two weeks, new leaves appeared."
      },
      {
        "id": "s4",
        "start": 120,
        "end": 163,
        "text": "Mina shared a few leaves with her neighbor."
      },
      {
        "id": "s5",
        "start": 164,
        "end": 202,
        "text": "The neighbor used them in a warm soup."
      },
      {
        "id": "s6",
        "start": 203,
        "end": 242,
        "text": "Both families later planted more herbs."
      }
    ],
    "boundaries": [
      {
        "id": "b0",
        "offset": 0,
        "afterSentenceId": "s1"
      },
      {
        "id": "b1",
        "offset": 37,
        "beforeSentenceId": "s1",
        "afterSentenceId": "s2"
      },
      {
        "id": "b2",
        "offset": 81,
        "beforeSentenceId": "s2",
        "afterSentenceId": "s3"
      },
      {
        "id": "b3",
        "offset": 119,
        "beforeSentenceId": "s3",
        "afterSentenceId": "s4"
      },
      {
        "id": "b4",
        "offset": 163,
        "beforeSentenceId": "s4",
        "afterSentenceId": "s5"
      },
      {
        "id": "b5",
        "offset": 202,
        "beforeSentenceId": "s5",
        "afterSentenceId": "s6"
      },
      {
        "id": "b6",
        "offset": 242,
        "beforeSentenceId": "s6"
      }
    ]
  },
  "item": {
    "itemId": "preview-02",
    "templateId": "school-content-match",
    "variantId": "standard",
    "questionType": "content_match",
    "choiceLanguage": "en",
    "vocabularyLevel": "grade_1",
    "contentMatchPolarity": "match",
    "targetLevel": "고등학교",
    "score": 2,
    "questionCount": 1,
    "requiredCandidateBoundaryCount": null
  },
  "sourcePreservation": {
    "authority": "app_stored_source",
    "responsePassage": "forbidden",
    "exactFingerprintRequired": true
  },
  "approval": {
    "firstResponse": "design_only",
    "approvalSentence": "이 설계로 JSON을 생성할까요? 수정할 카드가 있으면 카드 번호와 변경 사항을 알려주세요.",
    "afterApproval": "single_json_object"
  },
  "outputContract": "english-question-lab-provided-passage-generation-v0.1"
}
```

## 3. 문장 삽입 + grade_2

- fixtureId: `insertion-grade2`
- expected: `ACCEPT / accepted`
- 검증: mode·subject, 승인 gate, 원문 비변경, strict JSON 및 해당 오류 조건

```json
{
  "schemaId": "english-question-lab-provided-passage-request-v0.1",
  "mode": "school_english_provided_passage",
  "subject": "English",
  "source": {
    "sourcePassageId": "source-8f97b90f65c78ef4",
    "sourceFingerprint": "sha256:8f97b90f65c78ef4a178f0dddab142a5addf393cd168af9e3dfba015f985bcf4",
    "title": "Preview 03",
    "passage": "Mina planted basil in a sunny window. She watered it only when the soil felt dry. After two weeks, new leaves appeared. Mina shared a few leaves with her neighbor. The neighbor used them in a warm soup. Both families later planted more herbs.",
    "sentences": [
      {
        "id": "s1",
        "start": 0,
        "end": 37,
        "text": "Mina planted basil in a sunny window."
      },
      {
        "id": "s2",
        "start": 38,
        "end": 81,
        "text": "She watered it only when the soil felt dry."
      },
      {
        "id": "s3",
        "start": 82,
        "end": 119,
        "text": "After two weeks, new leaves appeared."
      },
      {
        "id": "s4",
        "start": 120,
        "end": 163,
        "text": "Mina shared a few leaves with her neighbor."
      },
      {
        "id": "s5",
        "start": 164,
        "end": 202,
        "text": "The neighbor used them in a warm soup."
      },
      {
        "id": "s6",
        "start": 203,
        "end": 242,
        "text": "Both families later planted more herbs."
      }
    ],
    "boundaries": [
      {
        "id": "b0",
        "offset": 0,
        "afterSentenceId": "s1"
      },
      {
        "id": "b1",
        "offset": 37,
        "beforeSentenceId": "s1",
        "afterSentenceId": "s2"
      },
      {
        "id": "b2",
        "offset": 81,
        "beforeSentenceId": "s2",
        "afterSentenceId": "s3"
      },
      {
        "id": "b3",
        "offset": 119,
        "beforeSentenceId": "s3",
        "afterSentenceId": "s4"
      },
      {
        "id": "b4",
        "offset": 163,
        "beforeSentenceId": "s4",
        "afterSentenceId": "s5"
      },
      {
        "id": "b5",
        "offset": 202,
        "beforeSentenceId": "s5",
        "afterSentenceId": "s6"
      },
      {
        "id": "b6",
        "offset": 242,
        "beforeSentenceId": "s6"
      }
    ]
  },
  "item": {
    "itemId": "preview-03",
    "templateId": "school-sentence-insertion",
    "variantId": "standard",
    "questionType": "sentence_insertion",
    "choiceLanguage": null,
    "vocabularyLevel": "grade_2",
    "contentMatchPolarity": null,
    "targetLevel": "고등학교",
    "score": 2,
    "questionCount": 1,
    "requiredCandidateBoundaryCount": 5
  },
  "sourcePreservation": {
    "authority": "app_stored_source",
    "responsePassage": "forbidden",
    "exactFingerprintRequired": true
  },
  "approval": {
    "firstResponse": "design_only",
    "approvalSentence": "이 설계로 JSON을 생성할까요? 수정할 카드가 있으면 카드 번호와 변경 사항을 알려주세요.",
    "afterApproval": "single_json_object"
  },
  "outputContract": "english-question-lab-provided-passage-generation-v0.1"
}
```

## 4. 문장 삽입 + grade_3_csat

- fixtureId: `insertion-grade3`
- expected: `ACCEPT / accepted`
- 검증: mode·subject, 승인 gate, 원문 비변경, strict JSON 및 해당 오류 조건

```json
{
  "schemaId": "english-question-lab-provided-passage-request-v0.1",
  "mode": "school_english_provided_passage",
  "subject": "English",
  "source": {
    "sourcePassageId": "source-8f97b90f65c78ef4",
    "sourceFingerprint": "sha256:8f97b90f65c78ef4a178f0dddab142a5addf393cd168af9e3dfba015f985bcf4",
    "title": "Preview 04",
    "passage": "Mina planted basil in a sunny window. She watered it only when the soil felt dry. After two weeks, new leaves appeared. Mina shared a few leaves with her neighbor. The neighbor used them in a warm soup. Both families later planted more herbs.",
    "sentences": [
      {
        "id": "s1",
        "start": 0,
        "end": 37,
        "text": "Mina planted basil in a sunny window."
      },
      {
        "id": "s2",
        "start": 38,
        "end": 81,
        "text": "She watered it only when the soil felt dry."
      },
      {
        "id": "s3",
        "start": 82,
        "end": 119,
        "text": "After two weeks, new leaves appeared."
      },
      {
        "id": "s4",
        "start": 120,
        "end": 163,
        "text": "Mina shared a few leaves with her neighbor."
      },
      {
        "id": "s5",
        "start": 164,
        "end": 202,
        "text": "The neighbor used them in a warm soup."
      },
      {
        "id": "s6",
        "start": 203,
        "end": 242,
        "text": "Both families later planted more herbs."
      }
    ],
    "boundaries": [
      {
        "id": "b0",
        "offset": 0,
        "afterSentenceId": "s1"
      },
      {
        "id": "b1",
        "offset": 37,
        "beforeSentenceId": "s1",
        "afterSentenceId": "s2"
      },
      {
        "id": "b2",
        "offset": 81,
        "beforeSentenceId": "s2",
        "afterSentenceId": "s3"
      },
      {
        "id": "b3",
        "offset": 119,
        "beforeSentenceId": "s3",
        "afterSentenceId": "s4"
      },
      {
        "id": "b4",
        "offset": 163,
        "beforeSentenceId": "s4",
        "afterSentenceId": "s5"
      },
      {
        "id": "b5",
        "offset": 202,
        "beforeSentenceId": "s5",
        "afterSentenceId": "s6"
      },
      {
        "id": "b6",
        "offset": 242,
        "beforeSentenceId": "s6"
      }
    ]
  },
  "item": {
    "itemId": "preview-04",
    "templateId": "school-sentence-insertion",
    "variantId": "standard",
    "questionType": "sentence_insertion",
    "choiceLanguage": null,
    "vocabularyLevel": "grade_3_csat",
    "contentMatchPolarity": null,
    "targetLevel": "고등학교",
    "score": 2,
    "questionCount": 1,
    "requiredCandidateBoundaryCount": 5
  },
  "sourcePreservation": {
    "authority": "app_stored_source",
    "responsePassage": "forbidden",
    "exactFingerprintRequired": true
  },
  "approval": {
    "firstResponse": "design_only",
    "approvalSentence": "이 설계로 JSON을 생성할까요? 수정할 카드가 있으면 카드 번호와 변경 사항을 알려주세요.",
    "afterApproval": "single_json_object"
  },
  "outputContract": "english-question-lab-provided-passage-generation-v0.1"
}
```

## 5. fingerprint 불일치 거부

- fixtureId: `fingerprint-mismatch`
- expected: `REJECT / request_fingerprint_mismatch`
- 검증: mode·subject, 승인 gate, 원문 비변경, strict JSON 및 해당 오류 조건

```json
{
  "schemaId": "english-question-lab-provided-passage-request-v0.1",
  "mode": "school_english_provided_passage",
  "subject": "English",
  "source": {
    "sourcePassageId": "source-8f97b90f65c78ef4",
    "sourceFingerprint": "sha256:0000000000000000000000000000000000000000000000000000000000000000",
    "title": "Preview 01",
    "passage": "Mina planted basil in a sunny window. She watered it only when the soil felt dry. After two weeks, new leaves appeared. Mina shared a few leaves with her neighbor. The neighbor used them in a warm soup. Both families later planted more herbs.",
    "sentences": [
      {
        "id": "s1",
        "start": 0,
        "end": 37,
        "text": "Mina planted basil in a sunny window."
      },
      {
        "id": "s2",
        "start": 38,
        "end": 81,
        "text": "She watered it only when the soil felt dry."
      },
      {
        "id": "s3",
        "start": 82,
        "end": 119,
        "text": "After two weeks, new leaves appeared."
      },
      {
        "id": "s4",
        "start": 120,
        "end": 163,
        "text": "Mina shared a few leaves with her neighbor."
      },
      {
        "id": "s5",
        "start": 164,
        "end": 202,
        "text": "The neighbor used them in a warm soup."
      },
      {
        "id": "s6",
        "start": 203,
        "end": 242,
        "text": "Both families later planted more herbs."
      }
    ],
    "boundaries": [
      {
        "id": "b0",
        "offset": 0,
        "afterSentenceId": "s1"
      },
      {
        "id": "b1",
        "offset": 37,
        "beforeSentenceId": "s1",
        "afterSentenceId": "s2"
      },
      {
        "id": "b2",
        "offset": 81,
        "beforeSentenceId": "s2",
        "afterSentenceId": "s3"
      },
      {
        "id": "b3",
        "offset": 119,
        "beforeSentenceId": "s3",
        "afterSentenceId": "s4"
      },
      {
        "id": "b4",
        "offset": 163,
        "beforeSentenceId": "s4",
        "afterSentenceId": "s5"
      },
      {
        "id": "b5",
        "offset": 202,
        "beforeSentenceId": "s5",
        "afterSentenceId": "s6"
      },
      {
        "id": "b6",
        "offset": 242,
        "beforeSentenceId": "s6"
      }
    ]
  },
  "item": {
    "itemId": "preview-01",
    "templateId": "school-content-match",
    "variantId": "standard",
    "questionType": "content_match",
    "choiceLanguage": "ko",
    "vocabularyLevel": "source_matched",
    "contentMatchPolarity": "mismatch",
    "targetLevel": "고등학교",
    "score": 2,
    "questionCount": 1,
    "requiredCandidateBoundaryCount": null
  },
  "sourcePreservation": {
    "authority": "app_stored_source",
    "responsePassage": "forbidden",
    "exactFingerprintRequired": true
  },
  "approval": {
    "firstResponse": "design_only",
    "approvalSentence": "이 설계로 JSON을 생성할까요? 수정할 카드가 있으면 카드 번호와 변경 사항을 알려주세요.",
    "afterApproval": "single_json_object"
  },
  "outputContract": "english-question-lab-provided-passage-generation-v0.1"
}
```

## 6. 존재하지 않는 sentence ID 거부

- fixtureId: `unknown-sentence`
- expected: `REJECT / unknown_sentence_id`
- 검증: mode·subject, 승인 gate, 원문 비변경, strict JSON 및 해당 오류 조건

```json
{
  "schemaId": "english-question-lab-provided-passage-request-v0.1",
  "mode": "school_english_provided_passage",
  "subject": "English",
  "source": {
    "sourcePassageId": "source-8f97b90f65c78ef4",
    "sourceFingerprint": "sha256:8f97b90f65c78ef4a178f0dddab142a5addf393cd168af9e3dfba015f985bcf4",
    "title": "Preview 01",
    "passage": "Mina planted basil in a sunny window. She watered it only when the soil felt dry. After two weeks, new leaves appeared. Mina shared a few leaves with her neighbor. The neighbor used them in a warm soup. Both families later planted more herbs.",
    "sentences": [
      {
        "id": "s1",
        "start": 0,
        "end": 37,
        "text": "Mina planted basil in a sunny window."
      },
      {
        "id": "s2",
        "start": 38,
        "end": 81,
        "text": "She watered it only when the soil felt dry."
      },
      {
        "id": "s3",
        "start": 82,
        "end": 119,
        "text": "After two weeks, new leaves appeared."
      },
      {
        "id": "s4",
        "start": 120,
        "end": 163,
        "text": "Mina shared a few leaves with her neighbor."
      },
      {
        "id": "s5",
        "start": 164,
        "end": 202,
        "text": "The neighbor used them in a warm soup."
      },
      {
        "id": "s6",
        "start": 203,
        "end": 242,
        "text": "Both families later planted more herbs."
      }
    ],
    "boundaries": [
      {
        "id": "b0",
        "offset": 0,
        "afterSentenceId": "s1"
      },
      {
        "id": "b1",
        "offset": 37,
        "beforeSentenceId": "s1",
        "afterSentenceId": "s2"
      },
      {
        "id": "b2",
        "offset": 81,
        "beforeSentenceId": "s2",
        "afterSentenceId": "s3"
      },
      {
        "id": "b3",
        "offset": 119,
        "beforeSentenceId": "s3",
        "afterSentenceId": "s4"
      },
      {
        "id": "b4",
        "offset": 163,
        "beforeSentenceId": "s4",
        "afterSentenceId": "s5"
      },
      {
        "id": "b5",
        "offset": 202,
        "beforeSentenceId": "s5",
        "afterSentenceId": "s6"
      },
      {
        "id": "b6",
        "offset": 242,
        "beforeSentenceId": "s6"
      }
    ]
  },
  "item": {
    "itemId": "preview-01",
    "templateId": "school-content-match",
    "variantId": "standard",
    "questionType": "content_match",
    "choiceLanguage": "ko",
    "vocabularyLevel": "source_matched",
    "contentMatchPolarity": "mismatch",
    "targetLevel": "고등학교",
    "score": 2,
    "questionCount": 1,
    "requiredCandidateBoundaryCount": null
  },
  "sourcePreservation": {
    "authority": "app_stored_source",
    "responsePassage": "forbidden",
    "exactFingerprintRequired": true
  },
  "approval": {
    "firstResponse": "design_only",
    "approvalSentence": "이 설계로 JSON을 생성할까요? 수정할 카드가 있으면 카드 번호와 변경 사항을 알려주세요.",
    "afterApproval": "single_json_object"
  },
  "outputContract": "english-question-lab-provided-passage-generation-v0.1"
}
```

## 7. 존재하지 않는 boundary ID 거부

- fixtureId: `unknown-boundary`
- expected: `REJECT / unknown_boundary_id`
- 검증: mode·subject, 승인 gate, 원문 비변경, strict JSON 및 해당 오류 조건

```json
{
  "schemaId": "english-question-lab-provided-passage-request-v0.1",
  "mode": "school_english_provided_passage",
  "subject": "English",
  "source": {
    "sourcePassageId": "source-8f97b90f65c78ef4",
    "sourceFingerprint": "sha256:8f97b90f65c78ef4a178f0dddab142a5addf393cd168af9e3dfba015f985bcf4",
    "title": "Preview 03",
    "passage": "Mina planted basil in a sunny window. She watered it only when the soil felt dry. After two weeks, new leaves appeared. Mina shared a few leaves with her neighbor. The neighbor used them in a warm soup. Both families later planted more herbs.",
    "sentences": [
      {
        "id": "s1",
        "start": 0,
        "end": 37,
        "text": "Mina planted basil in a sunny window."
      },
      {
        "id": "s2",
        "start": 38,
        "end": 81,
        "text": "She watered it only when the soil felt dry."
      },
      {
        "id": "s3",
        "start": 82,
        "end": 119,
        "text": "After two weeks, new leaves appeared."
      },
      {
        "id": "s4",
        "start": 120,
        "end": 163,
        "text": "Mina shared a few leaves with her neighbor."
      },
      {
        "id": "s5",
        "start": 164,
        "end": 202,
        "text": "The neighbor used them in a warm soup."
      },
      {
        "id": "s6",
        "start": 203,
        "end": 242,
        "text": "Both families later planted more herbs."
      }
    ],
    "boundaries": [
      {
        "id": "b0",
        "offset": 0,
        "afterSentenceId": "s1"
      },
      {
        "id": "b1",
        "offset": 37,
        "beforeSentenceId": "s1",
        "afterSentenceId": "s2"
      },
      {
        "id": "b2",
        "offset": 81,
        "beforeSentenceId": "s2",
        "afterSentenceId": "s3"
      },
      {
        "id": "b3",
        "offset": 119,
        "beforeSentenceId": "s3",
        "afterSentenceId": "s4"
      },
      {
        "id": "b4",
        "offset": 163,
        "beforeSentenceId": "s4",
        "afterSentenceId": "s5"
      },
      {
        "id": "b5",
        "offset": 202,
        "beforeSentenceId": "s5",
        "afterSentenceId": "s6"
      },
      {
        "id": "b6",
        "offset": 242,
        "beforeSentenceId": "s6"
      }
    ]
  },
  "item": {
    "itemId": "preview-03",
    "templateId": "school-sentence-insertion",
    "variantId": "standard",
    "questionType": "sentence_insertion",
    "choiceLanguage": null,
    "vocabularyLevel": "grade_2",
    "contentMatchPolarity": null,
    "targetLevel": "고등학교",
    "score": 2,
    "questionCount": 1,
    "requiredCandidateBoundaryCount": 5
  },
  "sourcePreservation": {
    "authority": "app_stored_source",
    "responsePassage": "forbidden",
    "exactFingerprintRequired": true
  },
  "approval": {
    "firstResponse": "design_only",
    "approvalSentence": "이 설계로 JSON을 생성할까요? 수정할 카드가 있으면 카드 번호와 변경 사항을 알려주세요.",
    "afterApproval": "single_json_object"
  },
  "outputContract": "english-question-lab-provided-passage-generation-v0.1"
}
```

## 8. Response 원문 전체 포함 거부

- fixtureId: `response-contains-passage`
- expected: `REJECT / response_passage_forbidden`
- 검증: mode·subject, 승인 gate, 원문 비변경, strict JSON 및 해당 오류 조건

```json
{
  "schemaId": "english-question-lab-provided-passage-request-v0.1",
  "mode": "school_english_provided_passage",
  "subject": "English",
  "source": {
    "sourcePassageId": "source-8f97b90f65c78ef4",
    "sourceFingerprint": "sha256:8f97b90f65c78ef4a178f0dddab142a5addf393cd168af9e3dfba015f985bcf4",
    "title": "Preview 01",
    "passage": "Mina planted basil in a sunny window. She watered it only when the soil felt dry. After two weeks, new leaves appeared. Mina shared a few leaves with her neighbor. The neighbor used them in a warm soup. Both families later planted more herbs.",
    "sentences": [
      {
        "id": "s1",
        "start": 0,
        "end": 37,
        "text": "Mina planted basil in a sunny window."
      },
      {
        "id": "s2",
        "start": 38,
        "end": 81,
        "text": "She watered it only when the soil felt dry."
      },
      {
        "id": "s3",
        "start": 82,
        "end": 119,
        "text": "After two weeks, new leaves appeared."
      },
      {
        "id": "s4",
        "start": 120,
        "end": 163,
        "text": "Mina shared a few leaves with her neighbor."
      },
      {
        "id": "s5",
        "start": 164,
        "end": 202,
        "text": "The neighbor used them in a warm soup."
      },
      {
        "id": "s6",
        "start": 203,
        "end": 242,
        "text": "Both families later planted more herbs."
      }
    ],
    "boundaries": [
      {
        "id": "b0",
        "offset": 0,
        "afterSentenceId": "s1"
      },
      {
        "id": "b1",
        "offset": 37,
        "beforeSentenceId": "s1",
        "afterSentenceId": "s2"
      },
      {
        "id": "b2",
        "offset": 81,
        "beforeSentenceId": "s2",
        "afterSentenceId": "s3"
      },
      {
        "id": "b3",
        "offset": 119,
        "beforeSentenceId": "s3",
        "afterSentenceId": "s4"
      },
      {
        "id": "b4",
        "offset": 163,
        "beforeSentenceId": "s4",
        "afterSentenceId": "s5"
      },
      {
        "id": "b5",
        "offset": 202,
        "beforeSentenceId": "s5",
        "afterSentenceId": "s6"
      },
      {
        "id": "b6",
        "offset": 242,
        "beforeSentenceId": "s6"
      }
    ]
  },
  "item": {
    "itemId": "preview-01",
    "templateId": "school-content-match",
    "variantId": "standard",
    "questionType": "content_match",
    "choiceLanguage": "ko",
    "vocabularyLevel": "source_matched",
    "contentMatchPolarity": "mismatch",
    "targetLevel": "고등학교",
    "score": 2,
    "questionCount": 1,
    "requiredCandidateBoundaryCount": null
  },
  "sourcePreservation": {
    "authority": "app_stored_source",
    "responsePassage": "forbidden",
    "exactFingerprintRequired": true
  },
  "approval": {
    "firstResponse": "design_only",
    "approvalSentence": "이 설계로 JSON을 생성할까요? 수정할 카드가 있으면 카드 번호와 변경 사항을 알려주세요.",
    "afterApproval": "single_json_object"
  },
  "outputContract": "english-question-lab-provided-passage-generation-v0.1"
}
```

## 9. 선지 언어 혼합 거부

- fixtureId: `mixed-choice-language`
- expected: `REJECT / choice_language_mismatch`
- 검증: mode·subject, 승인 gate, 원문 비변경, strict JSON 및 해당 오류 조건

```json
{
  "schemaId": "english-question-lab-provided-passage-request-v0.1",
  "mode": "school_english_provided_passage",
  "subject": "English",
  "source": {
    "sourcePassageId": "source-8f97b90f65c78ef4",
    "sourceFingerprint": "sha256:8f97b90f65c78ef4a178f0dddab142a5addf393cd168af9e3dfba015f985bcf4",
    "title": "Preview 01",
    "passage": "Mina planted basil in a sunny window. She watered it only when the soil felt dry. After two weeks, new leaves appeared. Mina shared a few leaves with her neighbor. The neighbor used them in a warm soup. Both families later planted more herbs.",
    "sentences": [
      {
        "id": "s1",
        "start": 0,
        "end": 37,
        "text": "Mina planted basil in a sunny window."
      },
      {
        "id": "s2",
        "start": 38,
        "end": 81,
        "text": "She watered it only when the soil felt dry."
      },
      {
        "id": "s3",
        "start": 82,
        "end": 119,
        "text": "After two weeks, new leaves appeared."
      },
      {
        "id": "s4",
        "start": 120,
        "end": 163,
        "text": "Mina shared a few leaves with her neighbor."
      },
      {
        "id": "s5",
        "start": 164,
        "end": 202,
        "text": "The neighbor used them in a warm soup."
      },
      {
        "id": "s6",
        "start": 203,
        "end": 242,
        "text": "Both families later planted more herbs."
      }
    ],
    "boundaries": [
      {
        "id": "b0",
        "offset": 0,
        "afterSentenceId": "s1"
      },
      {
        "id": "b1",
        "offset": 37,
        "beforeSentenceId": "s1",
        "afterSentenceId": "s2"
      },
      {
        "id": "b2",
        "offset": 81,
        "beforeSentenceId": "s2",
        "afterSentenceId": "s3"
      },
      {
        "id": "b3",
        "offset": 119,
        "beforeSentenceId": "s3",
        "afterSentenceId": "s4"
      },
      {
        "id": "b4",
        "offset": 163,
        "beforeSentenceId": "s4",
        "afterSentenceId": "s5"
      },
      {
        "id": "b5",
        "offset": 202,
        "beforeSentenceId": "s5",
        "afterSentenceId": "s6"
      },
      {
        "id": "b6",
        "offset": 242,
        "beforeSentenceId": "s6"
      }
    ]
  },
  "item": {
    "itemId": "preview-01",
    "templateId": "school-content-match",
    "variantId": "standard",
    "questionType": "content_match",
    "choiceLanguage": "ko",
    "vocabularyLevel": "source_matched",
    "contentMatchPolarity": "mismatch",
    "targetLevel": "고등학교",
    "score": 2,
    "questionCount": 1,
    "requiredCandidateBoundaryCount": null
  },
  "sourcePreservation": {
    "authority": "app_stored_source",
    "responsePassage": "forbidden",
    "exactFingerprintRequired": true
  },
  "approval": {
    "firstResponse": "design_only",
    "approvalSentence": "이 설계로 JSON을 생성할까요? 수정할 카드가 있으면 카드 번호와 변경 사항을 알려주세요.",
    "afterApproval": "single_json_object"
  },
  "outputContract": "english-question-lab-provided-passage-generation-v0.1"
}
```

## 10. 삽입 choice language 비-null 거부

- fixtureId: `insertion-choice-language`
- expected: `REJECT / request_response_mismatch`
- 검증: mode·subject, 승인 gate, 원문 비변경, strict JSON 및 해당 오류 조건

```json
{
  "schemaId": "english-question-lab-provided-passage-request-v0.1",
  "mode": "school_english_provided_passage",
  "subject": "English",
  "source": {
    "sourcePassageId": "source-8f97b90f65c78ef4",
    "sourceFingerprint": "sha256:8f97b90f65c78ef4a178f0dddab142a5addf393cd168af9e3dfba015f985bcf4",
    "title": "Preview 03",
    "passage": "Mina planted basil in a sunny window. She watered it only when the soil felt dry. After two weeks, new leaves appeared. Mina shared a few leaves with her neighbor. The neighbor used them in a warm soup. Both families later planted more herbs.",
    "sentences": [
      {
        "id": "s1",
        "start": 0,
        "end": 37,
        "text": "Mina planted basil in a sunny window."
      },
      {
        "id": "s2",
        "start": 38,
        "end": 81,
        "text": "She watered it only when the soil felt dry."
      },
      {
        "id": "s3",
        "start": 82,
        "end": 119,
        "text": "After two weeks, new leaves appeared."
      },
      {
        "id": "s4",
        "start": 120,
        "end": 163,
        "text": "Mina shared a few leaves with her neighbor."
      },
      {
        "id": "s5",
        "start": 164,
        "end": 202,
        "text": "The neighbor used them in a warm soup."
      },
      {
        "id": "s6",
        "start": 203,
        "end": 242,
        "text": "Both families later planted more herbs."
      }
    ],
    "boundaries": [
      {
        "id": "b0",
        "offset": 0,
        "afterSentenceId": "s1"
      },
      {
        "id": "b1",
        "offset": 37,
        "beforeSentenceId": "s1",
        "afterSentenceId": "s2"
      },
      {
        "id": "b2",
        "offset": 81,
        "beforeSentenceId": "s2",
        "afterSentenceId": "s3"
      },
      {
        "id": "b3",
        "offset": 119,
        "beforeSentenceId": "s3",
        "afterSentenceId": "s4"
      },
      {
        "id": "b4",
        "offset": 163,
        "beforeSentenceId": "s4",
        "afterSentenceId": "s5"
      },
      {
        "id": "b5",
        "offset": 202,
        "beforeSentenceId": "s5",
        "afterSentenceId": "s6"
      },
      {
        "id": "b6",
        "offset": 242,
        "beforeSentenceId": "s6"
      }
    ]
  },
  "item": {
    "itemId": "preview-03",
    "templateId": "school-sentence-insertion",
    "variantId": "standard",
    "questionType": "sentence_insertion",
    "choiceLanguage": null,
    "vocabularyLevel": "grade_2",
    "contentMatchPolarity": null,
    "targetLevel": "고등학교",
    "score": 2,
    "questionCount": 1,
    "requiredCandidateBoundaryCount": 5
  },
  "sourcePreservation": {
    "authority": "app_stored_source",
    "responsePassage": "forbidden",
    "exactFingerprintRequired": true
  },
  "approval": {
    "firstResponse": "design_only",
    "approvalSentence": "이 설계로 JSON을 생성할까요? 수정할 카드가 있으면 카드 번호와 변경 사항을 알려주세요.",
    "afterApproval": "single_json_object"
  },
  "outputContract": "english-question-lab-provided-passage-generation-v0.1"
}
```

## 11. 복수 정답 가능 결과 거부

- fixtureId: `multiple-answer-risk`
- expected: `REJECT / duplicate_choice`
- 검증: mode·subject, 승인 gate, 원문 비변경, strict JSON 및 해당 오류 조건

```json
{
  "schemaId": "english-question-lab-provided-passage-request-v0.1",
  "mode": "school_english_provided_passage",
  "subject": "English",
  "source": {
    "sourcePassageId": "source-8f97b90f65c78ef4",
    "sourceFingerprint": "sha256:8f97b90f65c78ef4a178f0dddab142a5addf393cd168af9e3dfba015f985bcf4",
    "title": "Preview 02",
    "passage": "Mina planted basil in a sunny window. She watered it only when the soil felt dry. After two weeks, new leaves appeared. Mina shared a few leaves with her neighbor. The neighbor used them in a warm soup. Both families later planted more herbs.",
    "sentences": [
      {
        "id": "s1",
        "start": 0,
        "end": 37,
        "text": "Mina planted basil in a sunny window."
      },
      {
        "id": "s2",
        "start": 38,
        "end": 81,
        "text": "She watered it only when the soil felt dry."
      },
      {
        "id": "s3",
        "start": 82,
        "end": 119,
        "text": "After two weeks, new leaves appeared."
      },
      {
        "id": "s4",
        "start": 120,
        "end": 163,
        "text": "Mina shared a few leaves with her neighbor."
      },
      {
        "id": "s5",
        "start": 164,
        "end": 202,
        "text": "The neighbor used them in a warm soup."
      },
      {
        "id": "s6",
        "start": 203,
        "end": 242,
        "text": "Both families later planted more herbs."
      }
    ],
    "boundaries": [
      {
        "id": "b0",
        "offset": 0,
        "afterSentenceId": "s1"
      },
      {
        "id": "b1",
        "offset": 37,
        "beforeSentenceId": "s1",
        "afterSentenceId": "s2"
      },
      {
        "id": "b2",
        "offset": 81,
        "beforeSentenceId": "s2",
        "afterSentenceId": "s3"
      },
      {
        "id": "b3",
        "offset": 119,
        "beforeSentenceId": "s3",
        "afterSentenceId": "s4"
      },
      {
        "id": "b4",
        "offset": 163,
        "beforeSentenceId": "s4",
        "afterSentenceId": "s5"
      },
      {
        "id": "b5",
        "offset": 202,
        "beforeSentenceId": "s5",
        "afterSentenceId": "s6"
      },
      {
        "id": "b6",
        "offset": 242,
        "beforeSentenceId": "s6"
      }
    ]
  },
  "item": {
    "itemId": "preview-02",
    "templateId": "school-content-match",
    "variantId": "standard",
    "questionType": "content_match",
    "choiceLanguage": "en",
    "vocabularyLevel": "grade_1",
    "contentMatchPolarity": "match",
    "targetLevel": "고등학교",
    "score": 2,
    "questionCount": 1,
    "requiredCandidateBoundaryCount": null
  },
  "sourcePreservation": {
    "authority": "app_stored_source",
    "responsePassage": "forbidden",
    "exactFingerprintRequired": true
  },
  "approval": {
    "firstResponse": "design_only",
    "approvalSentence": "이 설계로 JSON을 생성할까요? 수정할 카드가 있으면 카드 번호와 변경 사항을 알려주세요.",
    "afterApproval": "single_json_object"
  },
  "outputContract": "english-question-lab-provided-passage-generation-v0.1"
}
```

## 12. 정답 경계 앞뒤 근거 부족 거부

- fixtureId: `insertion-missing-adjacency`
- expected: `REJECT / answer_boundary_evidence_mismatch`
- 검증: mode·subject, 승인 gate, 원문 비변경, strict JSON 및 해당 오류 조건

```json
{
  "schemaId": "english-question-lab-provided-passage-request-v0.1",
  "mode": "school_english_provided_passage",
  "subject": "English",
  "source": {
    "sourcePassageId": "source-8f97b90f65c78ef4",
    "sourceFingerprint": "sha256:8f97b90f65c78ef4a178f0dddab142a5addf393cd168af9e3dfba015f985bcf4",
    "title": "Preview 03",
    "passage": "Mina planted basil in a sunny window. She watered it only when the soil felt dry. After two weeks, new leaves appeared. Mina shared a few leaves with her neighbor. The neighbor used them in a warm soup. Both families later planted more herbs.",
    "sentences": [
      {
        "id": "s1",
        "start": 0,
        "end": 37,
        "text": "Mina planted basil in a sunny window."
      },
      {
        "id": "s2",
        "start": 38,
        "end": 81,
        "text": "She watered it only when the soil felt dry."
      },
      {
        "id": "s3",
        "start": 82,
        "end": 119,
        "text": "After two weeks, new leaves appeared."
      },
      {
        "id": "s4",
        "start": 120,
        "end": 163,
        "text": "Mina shared a few leaves with her neighbor."
      },
      {
        "id": "s5",
        "start": 164,
        "end": 202,
        "text": "The neighbor used them in a warm soup."
      },
      {
        "id": "s6",
        "start": 203,
        "end": 242,
        "text": "Both families later planted more herbs."
      }
    ],
    "boundaries": [
      {
        "id": "b0",
        "offset": 0,
        "afterSentenceId": "s1"
      },
      {
        "id": "b1",
        "offset": 37,
        "beforeSentenceId": "s1",
        "afterSentenceId": "s2"
      },
      {
        "id": "b2",
        "offset": 81,
        "beforeSentenceId": "s2",
        "afterSentenceId": "s3"
      },
      {
        "id": "b3",
        "offset": 119,
        "beforeSentenceId": "s3",
        "afterSentenceId": "s4"
      },
      {
        "id": "b4",
        "offset": 163,
        "beforeSentenceId": "s4",
        "afterSentenceId": "s5"
      },
      {
        "id": "b5",
        "offset": 202,
        "beforeSentenceId": "s5",
        "afterSentenceId": "s6"
      },
      {
        "id": "b6",
        "offset": 242,
        "beforeSentenceId": "s6"
      }
    ]
  },
  "item": {
    "itemId": "preview-03",
    "templateId": "school-sentence-insertion",
    "variantId": "standard",
    "questionType": "sentence_insertion",
    "choiceLanguage": null,
    "vocabularyLevel": "grade_2",
    "contentMatchPolarity": null,
    "targetLevel": "고등학교",
    "score": 2,
    "questionCount": 1,
    "requiredCandidateBoundaryCount": 5
  },
  "sourcePreservation": {
    "authority": "app_stored_source",
    "responsePassage": "forbidden",
    "exactFingerprintRequired": true
  },
  "approval": {
    "firstResponse": "design_only",
    "approvalSentence": "이 설계로 JSON을 생성할까요? 수정할 카드가 있으면 카드 번호와 변경 사항을 알려주세요.",
    "afterApproval": "single_json_object"
  },
  "outputContract": "english-question-lab-provided-passage-generation-v0.1"
}
```
