# AI 결과 JSON

```json
{
  "title": "세트 제목",
  "materialTitle": "지문 제목 또는 빈 문자열",
  "material": "전체 영어 지문 또는 자료",
  "questions": [
    {
      "type": "문항 유형",
      "stem": "발문",
      "choices": ["선지 1", "선지 2", "선지 3", "선지 4", "선지 5"],
      "answerIndex": 1,
      "explanation": "상세 해설",
      "intention": "출제 의도",
      "evidenceRefs": ["지문 직접 인용"],
      "distractorReasons": ["2번 오류", "3번 오류", "4번 오류", "5번 오류"],
      "score": 2
    }
  ]
}
```

선지 배열 길이는 앱에서 지정한 2~5개와 정확히 일치해야 하며 `answerIndex`는 1부터 시작합니다.
