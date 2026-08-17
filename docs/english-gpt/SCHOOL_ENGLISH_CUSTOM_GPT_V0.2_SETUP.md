# School English Custom GPT V0.2 Setup

## Instructions

Custom GPT의 기존 V0.1 Instructions를 `SCHOOL_ENGLISH_PROVIDED_PASSAGE_CUSTOM_GPT_INSTRUCTIONS_V0.2.md` 전체 내용으로 교체한다.

## Knowledge

Custom GPT 만들기 화면에 이미 올라간 V0.1 Contract·Request Schema·Response Schema와 같은 `schemaId`의 중복 Request Schema를 먼저 삭제한다. V0.2 파일을 V0.1 파일과 섞지 말고 번들의 다음 일곱 파일만 Knowledge로 업로드한다.

- `02-KNOWLEDGE-CONTRACT.md` (`PROVIDED_PASSAGE_CONTRACT_V0.2.md`의 동기화본)
- `03-KNOWLEDGE-REQUEST-SCHEMA-V0.2.10.json` (`provided-passage-request-schema-v0.2.json`의 고유 파일명 동기화본; 이전 동명 Schema 캐시를 피하기 위해 버전을 파일명에 명시)
- `04-KNOWLEDGE-RESPONSE-SCHEMA.json` (`provided-passage-response-schema-v0.2.json`의 동기화본)
- `06-KNOWLEDGE-EXPLANATION-SCHEMA.json` (`explanation-output-schema-v1.json`의 동기화본)
- `07-KNOWLEDGE-DETAILED-RULES.md` (`SCHOOL_ENGLISH_CUSTOM_GPT_DETAILED_RULES_V0.2.md`의 동기화본)
- `08-KNOWLEDGE-SCHOOL-GRAMMAR-EVIDENCE.md` (`SCHOOL_ENGLISH_CUSTOM_GPT_SCHOOL_GRAMMAR_EVIDENCE_V0.2.md`의 동기화본)
- `09-KNOWLEDGE-GRAMMAR-DESIGN-PROFILES.md` (`SCHOOL_ENGLISH_CUSTOM_GPT_GRAMMAR_DESIGN_PROFILES_V0.2.md`의 동기화본)

`01-INSTRUCTIONS.md`는 Knowledge가 아니라 Custom GPT의 Instructions 칸 전체를 교체하는 파일이다. `05-SETUP-GUIDE.md`와 `bundle-manifest.json`은 운영자 확인용이므로 Knowledge에 업로드하지 않는다.

웹 검색, 이미지 생성, Canvas, 코드 실행과 Actions는 끈 상태를 유지한다.

## 사용 순서

1. 앱에서 내신형 → 기존 지문 사용을 선택한다.
2. 기존 지문 사용이면 원문을 입력하고 문항 계획 카드를 1~5개 구성한다.
3. 각 카드에서 내용 일치·불일치, 내용 이해·추론, 어법, 요약문 완성 또는 문장 삽입을 선택한다. 일반 문항은 공통 원문을 공유하고, 요약문 완성과 문장 삽입은 시험지의 독립 지문 블록이다. 요약문은 발문 언어와 무관하게 별도 영어 `summaryText`와 영어 단어쌍 선지를 사용하며, 문장 삽입의 표식은 해당 카드에만 적용된다.
4. 어법은 우선 문법과 출제 방식을 선택한다. `원문에서 자동 선택 (권장)`이 기본이다. `①~⑤ 어법 오류 찾기`에서 선택한 우선 문법이 원문에 없으면 AI가 다른 판정 가능한 문법으로 자동 전환한다. `한 표적 구조 설명형`에서 특정 문법을 선택한 경우에만 그 구조가 원문에 실제로 있어야 한다.
5. 새 자료 작성이면 일반 내신형 카드에서 원하는 유형을 구성한다. 문장 삽입은 한 세트에 한 문항까지 다른 유형과 함께 사용할 수 있다.
6. Prompt를 GPT에 붙여넣는다. 기존 지문과 새 자료 작성 모두 유효한 요청이면 첫 응답으로 문제·정답과 시험지 표시에 필요한 최소 구조 정보만 받는다. 해설·출제 의도·오답 이유·품질 검토는 첫 응답에서 만들지 않는다.
7. 반환된 문제·정답 JSON을 앱에 Import한다.
8. 해설이 필요하면 앱의 `해설 제작 프롬프트 만들기`로 `[EXPLANATION_GENERATION_V1]` 프롬프트를 만들고, GPT의 해설 JSON을 별도 Import한다.

최종 JSON의 문자열 안에서 표현을 인용할 때는 `‘ ’`를 사용한다. ASCII 큰따옴표를 문자열 안에 사용할 때는 반드시 이스케이프하며, 반환 전 JSON.parse 가능 여부를 자체 검사한다.

GPT가 원문 전체를 Response에 반환하거나 Request의 fingerprint와 다른 값을 반환하면 Import하지 않는다. fingerprint는 앱이 계산한 불투명 식별값이므로 GPT가 원문만 직접 SHA-256 처리해 재계산하거나 유효성을 판정하지 않는다.
