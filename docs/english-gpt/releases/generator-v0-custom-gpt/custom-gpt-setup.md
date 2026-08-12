# Generator v0 Custom GPT 설정

## 권장 이름과 설명

- 이름: `수능 영어 문항 Generator v0`
- 설명: `english-question-lab의 Request-Specific Prompt를 설계 협의 후 엄격한 Generation JSON으로 변환하는 수능 영어 읽기 전용 Generator`

## Configure

Custom GPT 편집은 ChatGPT 웹의 GPTs 영역에서 Create를 선택해 진행한다. Instructions에는 `instructions/GENERATOR_V0_CUSTOM_GPT_INSTRUCTIONS.md`의 본문을 붙여 넣는다. 정확한 입력 용량은 이 Bundle이 가정하지 않으므로 저장 전 실제 편집기에서 전체 입력 여부를 확인한다.

공식 설정 개요: https://help.openai.com/en/articles/8554397-creating-and-editing-gpts

다음 파일을 Knowledge로 업로드한다.

1. `instructions/GENERATOR_CORE_INSTRUCTIONS_V0.md`
2. `knowledge/GENERATION_CONTRACT_V0.md`
3. `knowledge/csat-output-schema.json`
4. `knowledge/GENERATION_RUNTIME_PROFILE_V0.4.md`
5. `knowledge/generation-runtime-profile-v0.4.json`
6. `knowledge/generation-runtime-profile-v0.4-schema.json`

`knowledge/CSAT_STYLE_MANUAL.md`는 supplementary reference다. 업로드할 수 있지만 필수는 아니며 다른 권위 문서와 충돌하면 적용하지 않는다.

이 v0에는 Web Search, Image Generation, Canvas, Code Interpreter, Apps, Actions가 필요하지 않다. 특히 API Action을 만들지 않는다. 기능 표시와 명칭은 계정·워크스페이스에 따라 달라질 수 있으므로 불필요한 기능을 켜지 않는다는 원칙만 적용한다.

## Conversation starters

- `english-question-lab에서 복사한 Request-Specific Prompt를 붙여 넣겠습니다. 먼저 설계안만 제시해 주세요.`
- `[VERIFICATION_REPAIR] 프롬프트와 완성 원본 JSON을 보내겠습니다. 승인된 수정만 반영해 주세요.`

## 수동 흐름

1. 앱에서 Request-Specific Prompt를 생성해 Custom GPT 채팅에 붙여 넣는다.
2. `[세트 제작 설계안]`만 받았는지 확인하고 필요한 내용을 수정한다.
3. 전체 설계를 명시적으로 승인한다.
4. JSON 객체 하나만 반환됐는지 확인해 앱의 JSON 입력 영역에 붙여 넣는다.
5. 앱 검증이나 사람 검수 후 수정이 필요하면 앱이 만든 `[VERIFICATION_REPAIR]` 프롬프트와 원본 JSON을 새 메시지로 보낸다.

## 업데이트

Runtime Profile은 Corpus Engine과 자동 동기화되지 않는다. 새 버전으로 바꿀 때 canonical 파일을 Bundle builder로 다시 snapshot하고 manifest의 SHA-256과 runtime fingerprint를 검증한 뒤 Knowledge 파일을 수동 교체한다. API 자동 연결은 별도 통합 작업이다.

## 테스트

Preview에서 initial 설계, 승인 전 JSON 금지, 승인 후 단일 JSON, ID 보존, 41~42, 43~45, repair 전체 반환, Contract 충돌 차단을 시험한다. 실제 문제를 배포하거나 앱과 자동 연결하는 테스트가 아니라 수동 계약 검증이다.
