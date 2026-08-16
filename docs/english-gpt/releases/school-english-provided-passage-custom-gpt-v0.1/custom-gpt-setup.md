# Custom GPT setup

## Recommended settings

- Name: 내신 영어 기존 지문 문항 생성기 V0.1
- Description: 제공된 영어 원문을 바꾸지 않고 내용 일치·불일치 또는 문장 삽입 문항 하나를 strict JSON으로 생성합니다.
- Instructions: paste `instructions/SCHOOL_ENGLISH_PROVIDED_PASSAGE_CUSTOM_GPT_INSTRUCTIONS.md`.
- Knowledge uploads: the Contract and the two JSON Schemas in `knowledge/`.
- Web search: off
- Image generation: off
- Canvas: off
- Code execution/data analysis: off
- Actions/API: none

## Conversation starters

- 앱에서 복사한 Provided Passage 제작 Prompt를 붙여넣겠습니다.
- 내신형 내용 불일치 문항 설계안을 검토해 주세요.
- 내신형 문장 삽입 설계안을 먼저 제시해 주세요.

## Workflow

앱의 내신형 문제 제작에서 기존 지문 사용을 선택하고 Prompt를 복사한다. GPT에 붙여넣고 한국어 설계안만 검토한다. 전체 설계를 승인한 뒤 JSON 객체만 복사해 앱 Import에 붙여넣는다. Response에 원문을 넣지 않는 이유는 앱이 보관한 권위 원문을 AI 출력으로 덮어쓰거나 변형하는 경로를 차단하기 위해서다.

Contract나 Schema가 새 버전이 되면 기존 Knowledge 파일을 섞지 말고 같은 버전 세트를 함께 교체하고 Bundle validator를 다시 실행한다. 이 GPT의 이름과 설명에 “내신 영어 기존 지문”을 유지하고, 수능형 새 지문 Generator v0와 같은 대화에서 사용하지 않는다.

## Manual Preview

`fixtures/manual-preview-inputs.md`의 12개 입력과 기대 결과를 순서대로 확인한다. 실제 API 호출은 필요하지 않다.
