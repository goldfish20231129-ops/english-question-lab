# 문장 삽입 내부 위치 ID 사용자용 기호 전환 보고서

## 적용 범위

Provided Passage V0.2 문장 삽입의 내부 위치 연결과 사용자용 표현을 분리한다. 수능형, 새 지문 생성, 어법 문항과 기존 JSON Schema의 필드 구조는 변경하지 않는다.

## 문제 제작 AI Instructions 추가 규칙

문장 삽입 문제의 `b0`, `b1`, `b2` 같은 boundary ID는 원문 위치 검증을 위한 내부 식별자다. 구조화 필드에서는 Request의 ID를 그대로 유지하되 `positionReasons[].reason`, 호환형 explanation·intention·distractorReasons, qualityReview, 검토 보고서 등 사용자용 문장에는 내부 ID를 노출하지 않는다. 사용자용 위치는 `candidateBoundaryIds` 배열의 순서에 따라 첫 번째부터 `①`, `②`, `③`, `④`, `⑤`로 표시한다. boundary ID의 숫자를 위치 번호로 직접 변환하지 않는다.

## 해설 제작 AI Instructions 추가 규칙

문장 삽입 문항을 해설하기 전에 `candidateBoundaryIds`와 `answerBoundaryId`를 대조한다. `answerBoundaryId`가 후보 배열에서 몇 번째인지 계산하고 그 순서에 해당하는 `①~⑤` 기호를 사용한다. 구조화 입력의 내부 ID는 수정하지 않으며 최종 해설 JSON의 모든 사용자용 문자열에서 `b숫자`를 제거한다. `answerIndex`와 `answerBoundaryId`도 같은 후보 위치를 가리켜야 한다.

## 문장 삽입 문제 JSON 예시

```json
{
  "question": {
    "type": "문장 삽입",
    "stem": "글의 흐름으로 보아, 주어진 문장이 들어가기에 가장 적절한 곳은?",
    "choices": ["①", "②", "③", "④", "⑤"],
    "answerIndex": 3,
    "evidenceSpans": [
      { "sentenceId": "s3", "start": 80, "end": 120, "text": "Third sentence gives another response." },
      { "sentenceId": "s4", "start": 121, "end": 157, "text": "Fourth sentence explains the result." }
    ],
    "score": 2
  },
  "materialOperation": {
    "kind": "insert_sentence",
    "generatedSentence": "This contrast helps explain the result.",
    "candidateBoundaryIds": ["b3", "b4", "b5", "b6", "b7"],
    "answerBoundaryId": "b5",
    "positionReasons": [
      { "boundaryId": "b3", "reason": "①은 핵심 개념이 소개되기 전이다." },
      { "boundaryId": "b4", "reason": "②는 두 반응 중 하나만 제시된 위치다." },
      { "boundaryId": "b5", "reason": "③은 두 반응과 결과 설명을 연결한다." },
      { "boundaryId": "b6", "reason": "④는 결과 설명이 이미 시작된 뒤다." },
      { "boundaryId": "b7", "reason": "⑤는 결론에 가까워 연결이 늦다." }
    ],
    "beforeEvidence": { "sentenceId": "s3", "start": 80, "end": 120, "text": "Third sentence gives another response." },
    "afterEvidence": { "sentenceId": "s4", "start": 121, "end": 157, "text": "Fourth sentence explains the result." },
    "lexicalLevel": "source_matched"
  }
}
```

구조화 필드에는 `b3`부터 `b7`까지가 그대로 남아 있다. 사용자용 reason은 후보 배열 순서에 따른 `①~⑤`를 사용한다.

## 올바른 해설 JSON 예시

```json
{
  "schemaId": "english-question-lab-explanation-v1",
  "setId": "sample-set",
  "sourceRevision": 1,
  "sourceFingerprint": "fnv1a32:12345678",
  "explanations": [
    {
      "questionId": "sample-insertion",
      "explanation": "주어진 문장은 ③에 들어갈 때 두 반응과 뒤의 결과 설명을 자연스럽게 연결한다.",
      "intention": "문장 사이의 지시 관계와 논리적 연결을 판단하는 능력을 평가한다.",
      "evidenceRefs": [
        "Third sentence gives another response.",
        "Fourth sentence explains the result."
      ],
      "distractorReasons": [
        "①은 핵심 개념이 소개되기 전이므로 연결 근거가 부족하다.",
        "②는 두 반응 중 하나만 제시된 위치이므로 요약 문장을 넣기에 이르다.",
        "④는 결과 설명이 이미 시작된 뒤이므로 같은 내용을 다시 연결하게 된다.",
        "⑤는 결론에 가까운 위치이므로 앞뒤 논리 연결이 약하다."
      ]
    }
  ]
}
```

## 자체검수 체크리스트

- [ ] `candidateBoundaryIds`, `answerBoundaryId`, `positionReasons[].boundaryId`가 원래 내부 ID를 유지한다.
- [ ] 후보 배열의 인덱스 0~4가 각각 `①~⑤`에 대응한다.
- [ ] boundary ID의 숫자를 위치 번호로 직접 사용하지 않는다.
- [ ] `answerIndex === candidateBoundaryIds.indexOf(answerBoundaryId) + 1`이다.
- [ ] explanation의 정답 기호가 위 계산 결과와 같다.
- [ ] distractorReasons는 정답을 제외한 네 위치 기호와 각각 대응한다.
- [ ] explanation, intention, evidenceRefs의 설명성 문장, distractorReasons, positionReasons의 reason, qualityReview 설명에 `\bb\d+\b`가 남지 않는다.
- [ ] 내부 ID를 삭제하거나 `①~⑤`로 덮어쓰지 않는다.

## 변경 문장 정리

기존의 “Request의 후보 경계 다섯 개와 위치별 이유를 반환한다”는 규칙은 유지한다. 여기에 다음 내용을 추가했다.

- 구조화 boundary ID 보존과 사용자용 기호 표현의 분리
- 후보 배열 순서 기반 `①~⑤` 변환
- ID 숫자의 직접 위치 변환 금지
- `answerIndex`와 `answerBoundaryId` 위치 일치 검사
- 문제 제작의 `positionReasons[].reason` 및 호환형 사용자용 필드 내부 ID 금지
- 해설 생성의 사용자용 문자열 내부 ID 금지와 정답·오답 기호 자체검사

JSON Schema의 ID 필드, 문제·선지·정답 구조와 기존 저장 데이터는 변경하지 않았다.
