# 영어 전용 GPT 자료

현재 완성된 자료는 **수능형 영어 읽기 18~45번 전용 GPT**용이다. 듣기 1~17번, 내신형, 맞춤설정형은 이 GPT에 섞지 않는다.

## 사용 파일

- [CSAT_GPT_INSTRUCTIONS.md](./CSAT_GPT_INSTRUCTIONS.md): GPT Instructions에 붙여 넣는 전체 지침
- [CSAT_STYLE_MANUAL.md](./CSAT_STYLE_MANUAL.md): 11개 평가원 시험지 분석을 통합한 Knowledge
- [csat-output-schema.json](./csat-output-schema.json): 앱 호환 최종 JSON Knowledge
- [GPT_SETUP_GUIDE.md](./GPT_SETUP_GUIDE.md): 생성·업로드·공유·사용 순서
- [GPT_TEST_CASES.md](./GPT_TEST_CASES.md): 비공개 상태에서 실행할 검수 시나리오

## 기본 흐름

`앱 프롬프트 붙여 넣기 → 한국어 세트 제작 설계안 → 사용자 수정·승인 → 최종 JSON → 앱 가져오기 → 검사·재검토`

GPT 공유 링크는 사용자가 GPT를 만든 뒤 `public/english-gpt-config.json`의 `csat`에 별도로 등록한다. 현재는 빈 값을 유지한다. 웹 검색, 이미지 생성, Actions, 외부 API는 필요하지 않다.

