# Provided Passage Source Identity V0.1

## 원본과 비교용 값

- `originalText`: 사용자가 입력한 문자열을 그대로 보존한다.
- `normalizedForFingerprint`: BOM 하나를 제거하고 CRLF·CR·U+2028·U+2029를 LF로 통일한 뒤 Unicode NFC만 적용한다.
- 대소문자, 문장부호, 일반 공백, 줄바꿈 위치는 축약하거나 교정하지 않는다.

## Fingerprint

`SHA-256("provided-passage-v0.1\n" + normalizedForFingerprint)`을 소문자 64자리 hex로 만들고 `sha256:` 접두사를 붙인다.

`sourcePassageId`는 `source-`와 fingerprint hex 앞 16자리로 결정적으로 만든다. fingerprint는 비교 식별자이며 원문 대체물이 아니다.

offset은 JavaScript 문자열의 UTF-16 code unit 기준 `[start,end)`이다. 원문 변경 시 sourcePassageId, fingerprint, sentence/boundary 목록과 미검수 AI 결과를 함께 새로 만든다.
