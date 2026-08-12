# Generator v0 Custom GPT 문서 충돌 보고서

## 승인된 해소

이전 Bundle 초안의 사용자 우선 순서는 폐기했다. 최종 순서는 Contract/Schema → ID·blueprint → 저작권 → 승인된 Request → Core 일반 원칙 → Runtime Profile → 비충돌 사용자 후속 요구다. 이는 Core와 Cleanup 보고서에 일치한다.

## Style Manual

Style Manual은 `supplementary_reference`로 묶는다. 현행 Runtime 필수 자료가 아니며 Contract, Schema, Request, Core, Runtime과 충돌하는 경우 적용하지 않는다. 원본은 수정하지 않았다.

## 남은 경고

- 공식 OpenAI 문서는 Instructions를 행동 규칙, Knowledge를 참고자료로 구분하지만 Custom GPT Instructions의 정확한 문자 제한을 제시하지 않는다.
- 따라서 핵심 행동은 압축 Instructions에 직접 배치하고 Core 전체를 byte-identical Knowledge로 제공했다.
- Custom GPT는 Corpus Engine과 자동 동기화되지 않으며 앱 연동은 수동 복사/붙여넣기다.
