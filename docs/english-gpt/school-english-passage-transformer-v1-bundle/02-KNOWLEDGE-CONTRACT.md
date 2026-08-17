# School English Passage Transformation Contract V1

## 1. 범위

이 계약은 문제 생성 전의 독립적인 지문 변형만 다룬다. 문제 제작, 정답 결정, 해설 생성, 원문 fingerprint 생성은 범위 밖이다.

## 2. 요청 경로

앱은 `[SCHOOL_PASSAGE_TRANSFORMATION_V1]` 프롬프트에 mode, 대상 수준, sourceFingerprint와 원문을 제공한다.

- `lexical`: 문장 구조를 그대로 둔 문맥 동등 표현 교체
- `restructure`: 명제 내용을 그대로 둔 문장·담화 구조 재구성

`original`은 AI 요청 없이 앱이 원문을 그대로 사용한다.

## 3. 불변 조건

- sourceFingerprint는 불투명 식별값이며 AI가 재계산하지 않는다.
- 원문의 사실, 논리 관계, 범위, 강도, 태도, 수치, 고유명사를 보존한다.
- 결과는 줄바꿈 없는 영어 한 문단이다.
- 외부 지식으로 원문을 보충하거나 교정하지 않는다.
- 문제 표식, 문항, 선지, 정답 또는 해설을 생성하지 않는다.

## 4. lexical 재현성

lexical 결과는 서로 다른 위치의 의미 동등 표현 변경을 최소 10개 포함하고 `changes`만으로 결정적으로 재현되어야 한다. 각 before는 그 시점의 문자열에 정확히 한 번 나타나며 배열 순서대로 `before → after` 치환한 결과가 transformedPassage와 같아야 한다. 문장 결합·분리·순서 변경은 lexical에서 허용되지 않는다. 안전한 후보가 10개 미만이면 억지 변경 대신 오류를 반환한다.

## 5. restructure 대응성

restructure는 단순 치환 재현성을 요구하지 않지만 원문과 결과의 정보가 양방향으로 대응해야 한다. 원문에만 있거나 결과에만 있는 명제·제약·예시가 있으면 실패다. changes는 주요 구조 변경을 사람이 검수할 수 있는 단위로 기록한다.

## 6. 적용 후 계보

앱이 결과를 승인하면 transformedPassage가 새로운 권위 원문이 되고 앱이 새 sourcePassageId, sourceFingerprint, sentence ID와 boundary ID를 계산한다. 변형 전 fingerprint를 이후 문항 Request에 재사용하지 않는다.

## 7. 근거 계층

1. 현재 요청과 원문
2. 이 Contract와 Output Schema
3. Instructions
4. Corpus·Vocabulary·학교 시험 Evidence Guide

분석 자료는 스타일 참고일 뿐 원문의 의미를 변경할 권한이 없다.
