# School English Passage Transformer Custom GPT V1 Setup

## GPT 구성

- 이름: `영어 내신 지문 변형기`
- 설명: `기존 영어 지문의 의미를 완전히 보존하면서 표현 교체 또는 내용 동일 재구성을 수행합니다.`
- 웹 검색, 이미지 생성, Canvas, 코드 실행, Actions: 끔

## Instructions

`school-english-passage-transformer-v1-bundle/01-INSTRUCTIONS.md` 전체를 Instructions 칸에 넣는다.

## Knowledge

기존 문제 제작 GPT의 Schema·Contract와 섞지 않고 다음 세 파일만 업로드한다.

- `02-KNOWLEDGE-CONTRACT.md`
- `03-KNOWLEDGE-OUTPUT-SCHEMA.json`
- `04-KNOWLEDGE-EVIDENCE-GUIDE.md`

`05-SETUP-GUIDE.md`와 `bundle-manifest.json`은 운영자 확인용이며 업로드하지 않는다.

## 사용

앱의 `지문 변형 (선택)`에서 변형 방식을 고르고 `변형 프롬프트 만들기`를 누른다. 프롬프트를 이 GPT의 새 대화에 붙여넣고, 반환된 JSON만 앱의 `외부 AI 변형 결과 JSON`에 붙여넣는다. 결과와 changes를 사람이 비교한 뒤 `변형 지문을 새 기준 지문으로 적용`한다.

문제 제작 GPT에 변형을 동시에 요청하지 않는다. 적용 뒤 앱이 새 fingerprint와 문장·경계 ID를 만든 다음 별도의 문제 제작 프롬프트를 생성한다.
