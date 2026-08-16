# Provided Passage Import Adapter V0.1

## 입력

전용 Response Schema의 JSON과 현재 앱 set을 함께 받는다. Schema validation을 먼저 통과한 뒤 `mode: school_english_provided_passage`, `subject: English`, source identity, 문항 identity, 설정, evidence와 operation 의미를 검사한다.

## 내용 일치

앱의 권위 원문을 material로 유지하고 AI question의 choices, answerIndex, explanation, intention, evidence, distractor reasons를 기존 `EnglishQuestion`으로 옮긴다.

## 문장 삽입

generatedSentence, 후보 boundary, 정답 boundary, 위치별 이유와 앞뒤 근거를 `providedPassage.result.materialOperation`에 저장한다. `material`은 그대로 두며 renderer가 일시적인 insertion presentation spec을 만든다.

## 원자성

검증 중 예외가 발생하면 원본 object, aiRevision, lastImportedJson을 변경하지 않는다. 성공한 경우에만 revision을 올리고 전용 응답 JSON을 snapshot으로 저장한다. 암묵적으로 원문이나 operation 필드를 버리지 않는다.
