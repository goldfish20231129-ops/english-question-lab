# 내신 영어 기존 지문 Custom GPT V0.1 전환 준비 보고서

## 준비됨

- Provided Passage Request/Response Contract와 strict Schema
- source fingerprint 및 sentence/boundary model
- 두 유형의 Prompt Builder와 Import Adapter
- choice language·vocabulary policy
- 원문 불변성 및 파생 렌더링 테스트

## 아직 하지 않음

- 기존 Custom GPT V0 Release Bundle 수정
- Custom GPT V0.1 Instructions·Knowledge snapshot 생성
- Custom GPT 웹 편집과 Preview 대화 시험
- API·자동 동기화

## 다음 단계

별도 작업에서 내신 영어 전용 V0.1 binding Instructions를 만들고, 두 Schema와 Contract를 Knowledge로 패키징한다. 앱 fixture로 initial 설계 승인, content match ko/en, insertion 네 어휘 정책, fingerprint 거부를 Custom GPT Preview에서 수동 확인한 뒤에만 Bundle 판정을 내린다. 기존 수능형 Custom GPT V0 Bundle은 수정하거나 재생성하지 않는다.

현재 앱·계약 기반 판정: `READY_TO_BUILD_SCHOOL_ENGLISH_CUSTOM_GPT_V0_1`
