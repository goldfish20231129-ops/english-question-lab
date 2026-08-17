# School English Custom GPT V0.2 Setup

## Instructions

Custom GPT의 기존 V0.1 Instructions를 `SCHOOL_ENGLISH_PROVIDED_PASSAGE_CUSTOM_GPT_INSTRUCTIONS_V0.2.md` 전체 내용으로 교체한다.

## Knowledge

Custom GPT 만들기 화면에 이미 올라간 V0.1 Contract·Request Schema·Response Schema와 같은 `schemaId`의 중복 Request Schema를 먼저 삭제한다. V0.2 파일을 V0.1 파일과 섞지 말고 번들의 다음 네 파일만 Knowledge로 업로드한다.

- `02-KNOWLEDGE-CONTRACT.md` (`PROVIDED_PASSAGE_CONTRACT_V0.2.md`의 동기화본)
- `03-KNOWLEDGE-REQUEST-SCHEMA.json` (`provided-passage-request-schema-v0.2.json`의 동기화본)
- `04-KNOWLEDGE-RESPONSE-SCHEMA.json` (`provided-passage-response-schema-v0.2.json`의 동기화본)
- `06-KNOWLEDGE-EXPLANATION-SCHEMA.json` (`explanation-output-schema-v1.json`의 동기화본)

`01-INSTRUCTIONS.md`는 Knowledge가 아니라 Custom GPT의 Instructions 칸 전체를 교체하는 파일이다. `05-SETUP-GUIDE.md`와 `bundle-manifest.json`은 운영자 확인용이므로 Knowledge에 업로드하지 않는다.

웹 검색, 이미지 생성, Canvas, 코드 실행과 Actions는 끈 상태를 유지한다.

## 사용 순서

1. 앱에서 내신형 → 기존 지문 사용을 선택한다.
2. 기존 지문 사용이면 원문을 입력하고 문항 계획 카드를 1~8개 구성한다.
3. 각 카드에서 내용 일치·불일치, 내용 이해·추론, 문장 삽입 또는 어법을 선택한다. 문장 삽입을 다른 유형과 함께 구성해도 표식은 해당 카드에만 적용된다.
4. 어법은 핵심 문법과 출제 방식을 선택한다. 기본 `①~⑤ 어법 오류 찾기`는 지문 속 다섯 표적을 번호와 밑줄로 표시하고 하나만 오류형으로 제시한다. `한 표적 구조 설명형`은 기존 JSON 호환용이다.
5. 새 자료 작성이면 일반 내신형 카드에서 원하는 유형을 구성한다. 문장 삽입은 한 세트에 한 문항까지 다른 유형과 함께 사용할 수 있다.
6. Prompt를 GPT에 붙여넣는다. 기존 지문과 새 자료 작성 모두 유효한 요청이면 첫 응답으로 문제·정답 JSON을 받는다.
7. 반환된 문제·정답 JSON을 앱에 Import한다.
8. 해설이 필요하면 앱의 `해설 제작 프롬프트 만들기`로 `[EXPLANATION_GENERATION_V1]` 프롬프트를 만들고, GPT의 해설 JSON을 별도 Import한다.

GPT가 원문 전체를 Response에 반환하거나 원문의 fingerprint와 다른 값을 반환하면 Import하지 않는다.
