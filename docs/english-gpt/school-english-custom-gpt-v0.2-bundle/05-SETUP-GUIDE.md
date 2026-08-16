# School English Custom GPT V0.2 Setup

## Instructions

Custom GPT의 기존 V0.1 Instructions를 `SCHOOL_ENGLISH_PROVIDED_PASSAGE_CUSTOM_GPT_INSTRUCTIONS_V0.2.md` 전체 내용으로 교체한다.

## Knowledge

V0.1 Knowledge 파일을 V0.2 파일과 섞지 말고 다음 세 파일로 교체한다.

- `PROVIDED_PASSAGE_CONTRACT_V0.2.md`
- `provided-passage-request-schema-v0.2.json`
- `provided-passage-response-schema-v0.2.json`

웹 검색, 이미지 생성, Canvas, 코드 실행과 Actions는 끈 상태를 유지한다.

## 사용 순서

1. 앱에서 내신형 → 기존 지문 사용을 선택한다.
2. 기존 지문 사용이면 원문을 입력하고 문항 계획 카드를 1~8개 구성한다.
3. 각 카드에서 내용 일치·불일치, 문장 삽입 또는 어법을 선택한다. 문장 삽입을 다른 유형과 함께 구성해도 표식은 해당 카드에만 적용된다.
4. 어법은 핵심 문법과 원문 확인/별도 오류 변형 모드를 선택한다.
5. 새 자료 작성이면 일반 내신형 카드에서 원하는 유형을 구성한다. 문장 삽입은 한 세트에 한 문항까지 다른 유형과 함께 사용할 수 있다.
6. Prompt를 GPT에 붙여넣는다. 기존 지문은 설계안 승인 후 V0.2 JSON을 받고, 새 자료 작성은 첫 응답의 JSON을 받는다.
7. 반환된 JSON을 앱에 Import한다.

GPT가 원문 전체를 Response에 반환하거나 원문의 fingerprint와 다른 값을 반환하면 Import하지 않는다.
