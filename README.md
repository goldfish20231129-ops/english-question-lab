# 영어 문제 제작 연구소

학원·학교 영어 선생님이 출제 조건을 설계하고, 외부 AI가 만든 구조화 JSON을 가져와 세트·시험지·정답 해설지를 만드는 React + TypeScript + Vite 앱입니다. OpenAI API는 사용하지 않으며, Supabase 로그인과 클라우드 저장을 통해 PC·아이패드 작업을 자동 동기화합니다.

## 제작 메뉴

- `내신형`: 교과서 본문, 부교재, 외부 지문 기반 어휘·어법·내용 이해·순서·문장 삽입 객관식
- `수능형`: 듣기를 제외한 17개 수능 영어 독해 유형, 단일 및 장문 복수 문항 세트
- `맞춤설정형`: 독해·어휘·어법·변형·워크시트·미니 테스트 프리셋을 자유롭게 조합

모든 메뉴는 객관식만 지원합니다. 단답형·영작·서술형은 현재 버전에 포함하지 않습니다.

## 기본 작업 흐름

1. `영어 세트 제작`에서 유형과 지문·문항 조건을 설정합니다.
2. 오른쪽 실시간 미리보기로 현재 구성을 확인합니다.
3. 외부 AI용 프롬프트를 생성하고 복사합니다.
4. 외부 AI가 출력한 JSON을 가져옵니다.
5. 최신 결과를 검사하고 재검토 프롬프트를 같은 AI 대화에 전달합니다.
6. 수정된 JSON을 다시 가져와 검사합니다.
7. `시험지 조립`에서 세 유형의 세트를 자유롭게 섞고 양식을 설정합니다.
8. `인쇄 미리보기`에서 문제지와 정답·해설지를 각각 인쇄하거나 PDF로 저장합니다.

## 시험지 양식

수능형·학교형·워크시트형·사용자 설정형 프리셋을 제공합니다. A4 세로, 1·2단, 여백, 글자 크기, 줄 간격, 지문 테두리, 머리말·꼬리말, 문제지·해설지 칼럼을 설정할 수 있습니다. 세트별로 칼럼, 시작 위치, 글자 배율, 지문 폭을 덮어쓸 수 있으며 페이지 구조가 달라지면 새 페이지에서 시작합니다.

## 데이터 격리

- IndexedDB: `english-question-lab-studio-v1`
- localStorage: `english-question-lab-ui-v1`, `english-question-lab-principles-v1`
- 백업 식별자: `english-question-lab`
- GPT 설정: `public/english-gpt-config.json`

기존 국어 프로그램의 저장소와 백업 파일은 읽거나 자동 변환하지 않습니다.

## 로그인과 자동 동기화

- 앱은 이메일·비밀번호 로그인이 필요하며 회원가입 화면은 제공하지 않습니다.
- 세트·시험지·출제 원칙은 Supabase JSON 작업 공간에, 이미지는 비공개 Storage에 저장됩니다.
- 변경 사항은 브라우저에 즉시 저장되고 약 1초 후 클라우드에 반영됩니다.
- 네트워크가 끊겨도 이미 로그인해 사용하던 기기에서는 로컬 자료로 계속 작업할 수 있습니다.
- PC와 아이패드가 동시에 수정되면 자동으로 덮어쓰지 않고 보존할 버전을 선택하게 합니다.
- 기존 JSON 백업·복원과 IndexedDB 저장은 그대로 유지됩니다.

처음 연결하는 방법은 [docs/CLOUD_SETUP.md](docs/CLOUD_SETUP.md)를 순서대로 따라 하면 됩니다.

## 전용 GPT 링크

`public/english-gpt-config.json`에 세 유형의 공개 GPT 링크를 각각 넣을 수 있습니다.

```json
{
  "school": "https://chatgpt.com/g/...",
  "csat": "https://chatgpt.com/g/...",
  "custom": "https://chatgpt.com/g/..."
}
```

링크가 비어 있어도 일반 프롬프트 생성·복사와 JSON 가져오기는 정상 작동합니다. 자세한 설정은 `docs/english-gpt`를 참고하세요.

## 실행과 검사

Windows에서는 `실행하기.bat`을 열거나 다음 명령을 사용합니다.

```powershell
corepack enable
pnpm install
pnpm dev
```

기본 미리보기 주소는 `http://127.0.0.1:5174/`입니다.

클라우드 로그인을 테스트하려면 `.env.example`을 복사한 `.env.local`에 Supabase Project URL과 Publishable key를 입력해야 합니다. 설정이 없을 때는 프로그램 안에 연결 안내 화면이 표시됩니다.

```powershell
pnpm verify
```

`pnpm verify`는 lint, 자동 테스트, TypeScript와 production build를 한 번에 확인합니다. 프로젝트 구조와 수정 위치는 `docs/PROJECT_STRUCTURE.md`를 참고하세요.
