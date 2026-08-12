# Generator V0 Custom GPT Release Bundle

- Bundle: `english-question-lab-generator-v0`
- Version: `0.1.0-rc.1`
- Status: release candidate
- Target: Custom GPT, manual copy/paste integration only

이 Bundle은 검증된 Core, Contract, JSON Schema와 Corpus Runtime Profile 0.4를 Custom GPT 설정에 연결하는 release snapshot이다. 앱 실행 코드, Prompt Builder, API, Corpus 자료를 변경하지 않는다.

## 사용

1. `custom-gpt-setup.md`에 따라 Custom GPT를 구성한다.
2. `instructions/GENERATOR_V0_CUSTOM_GPT_INSTRUCTIONS.md`를 Instructions에 넣는다.
3. setup 문서가 지정한 Knowledge 파일을 업로드한다.
4. 앱의 Request-Specific Prompt를 채팅에 붙여 넣고 설계안을 승인한다.
5. 반환 JSON을 앱에 수동으로 가져온다.

자동 API 호출, 자동 Corpus 동기화, 실제 문제 생성, Gold/Semantic 변경은 포함하지 않는다. 모든 snapshot의 출처와 SHA-256은 `bundle-manifest.json` 및 validation 보고서에 기록되어 있다.
