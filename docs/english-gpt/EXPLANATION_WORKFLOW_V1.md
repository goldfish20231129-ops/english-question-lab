# 문제·정답과 해설의 2단계 생성

영어 문제 제작 연구소는 AI 응답이 길어져 JSON이 잘리는 문제를 줄이기 위해 생성 작업을 두 단계로 나눈다.

1. 제작 프롬프트의 1차 JSON은 지문, 문항, 선지, 정답 번호와 배점만 생성한다.
2. 앱은 1차 JSON만으로 문제지와 정답지를 완성한다.
3. 사용자가 해설을 원할 때 앱의 `해설 제작 프롬프트 만들기`를 누른다.
4. AI는 문제 본체를 다시 출력하거나 수정하지 않고 `english-question-lab-explanation-v1` JSON만 반환한다.
5. 앱은 setId, revision, fingerprint와 모든 questionId를 확인한 뒤 해설 필드만 추가한다.

기존처럼 1차 JSON에 해설 필드와 qualityReview까지 포함된 결과도 계속 가져올 수 있다. 문제나 정답을 수정한 뒤에는 이전 해설 JSON의 fingerprint가 일치하지 않으므로 새 해설 프롬프트를 만들어야 한다.

## 해설 제작 AI용 문장 삽입 규칙

- `b0`, `b1`, `b3` 같은 boundary ID는 내부 식별자이며 교사·학생용 문장에 출력하지 않는다.
- 문장 삽입 해설 전에 `candidateBoundaryIds`와 `answerBoundaryId`를 대조한다.
- 후보 배열의 첫 번째부터 다섯 번째를 해당 문항의 `question.choices[0]`부터 `[4]`로 표시한다. 같은 지문의 표식형 문항이 둘 이상이면 `ㄱ~ㅁ`, `a~e`처럼 문항별로 겹치지 않는 기호군을 유지한다.
- boundary ID 자체의 숫자를 위치 번호로 바꾸지 않는다. 후보가 `["b3","b4","b5","b6","b7"]`이면 `b5`는 `③`이다.
- explanation, intention, evidenceRefs의 설명성 문장과 distractorReasons에는 내부 ID를 남기지 않는다.
- 구조화 입력의 `candidateBoundaryIds`, `answerBoundaryId`, `positionReasons[].boundaryId`는 변경하지 않는다.
- 최종 출력 전에 사용자용 문자열의 `\bb\d+\b` 잔존 여부, 정답 위치 기호, `answerIndex`와 `answerBoundaryId`의 위치 일치를 검사한다.
