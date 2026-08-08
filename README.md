# 문제 제작 연구소

고등학교 수학·국어 문항을 직접 만드는 개인용 웹앱입니다. AI API를 호출하거나 문제를 자동으로 생성하지 않습니다. 아이디어를 간단한 출제 명세로 정리해, ChatGPT 같은 외부 AI에 붙여넣을 프롬프트를 만듭니다.

## 웹사이트 사용법

배포가 완료되면 다음 형태의 주소를 클릭해 사용합니다.

`https://<GitHub-사용자이름>.github.io/<저장소-이름>/`

웹사이트를 열면 바로 사용할 수 있으며 Node.js, 명령 프롬프트, `실행하기.bat`이 필요하지 않습니다. 정확한 주소는 GitHub 저장소의 **Settings → Pages** 또는 배포가 끝난 Actions 실행 결과에서 확인할 수 있습니다.

## 처음 한 번: 무료 웹 배포하기

이 프로젝트는 **GitHub Pages + GitHub Actions**에 맞춰 준비되어 있습니다. 공개 GitHub 저장소에서 무료로 사용할 수 있고, `main` 브랜치에 코드를 올릴 때마다 자동으로 다시 배포됩니다.

1. [GitHub](https://github.com)에 로그인합니다.
2. 오른쪽 위 `+` → **New repository**를 누릅니다.
3. 저장소 이름을 예를 들어 `problem-making-lab`으로 정하고, **Public**을 선택해 만듭니다.
4. 이 프로젝트 폴더를 새 저장소에 올립니다. GitHub Desktop을 사용하면 **File → Add local repository**로 폴더를 선택한 뒤 **Publish repository**를 누르면 됩니다.
5. GitHub 저장소에서 **Settings → Pages**로 이동합니다.
6. **Build and deployment → Source**를 **GitHub Actions**로 바꿉니다.
7. **Actions** 탭에서 `Deploy to GitHub Pages` 작업이 초록색 성공 표시가 될 때까지 기다립니다.
8. **Settings → Pages**에 표시된 웹사이트 주소를 즐겨찾기에 저장합니다.

처음 배포는 몇 분 정도 걸릴 수 있습니다. 공개 저장소의 GitHub Pages와 GitHub Actions는 무료입니다. GitHub Pages 및 Actions 구성의 공식 안내는 [GitHub 문서](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)에서 확인할 수 있습니다.

## 업데이트 방법

Codex가 코드를 수정한 뒤 변경 사항을 GitHub 저장소의 `main` 브랜치에 올리면 자동 배포됩니다.

GitHub Desktop을 쓰는 경우에는 변경 내용을 확인한 뒤 아래 순서만 하면 됩니다.

1. 왼쪽 아래에 변경 설명을 적습니다.
2. **Commit to main**을 누릅니다.
3. 위쪽의 **Push origin**을 누릅니다.

잠시 뒤 같은 웹사이트 주소에 수정 내용이 반영됩니다. 배포 상태는 GitHub의 **Actions** 탭에서 확인할 수 있습니다.

## 로컬 실행법

웹 배포와 별개로, 개발·테스트용 로컬 실행 방식도 그대로 사용할 수 있습니다.

- Windows 탐색기에서 [실행하기.bat](<C:\Users\KMG\Desktop\문제 만들기 프로젝트(코덱스)\실행하기.bat>)을 더블클릭합니다.
- 검은 창을 닫지 않은 상태에서 `http://127.0.0.1:5173`을 엽니다.

명령어를 쓰려면 Node.js 20 이상을 설치한 뒤 아래를 실행합니다.

```powershell
npm install
npm run dev
```

## 실제 사용 순서

1. 왼쪽의 **새 문제**에서 수학 또는 국어 프로젝트를 만듭니다.
2. 단원명/영역, 핵심 개념, 난이도, 출제 의도를 입력합니다.
3. 수학은 계산 범위를, 국어는 출제 방식을 입력합니다.
4. **프롬프트 생성** 후 내용을 필요하면 직접 고치고 **프롬프트 복사**를 누릅니다.
5. 복사한 프롬프트를 외부 AI에 붙여 넣어 문제를 생성합니다.

국어는 두 가지 출제 방식을 지원합니다.

- **등록한 지문 안에서 출제**: 지문 또는 작품을 직접 입력한 뒤 그 안에서 문제를 만듭니다.
- **AI가 새 지문을 만들고 출제**: 분야·소재·길이를 정하면 AI가 새 지문과 문제를 함께 만듭니다.

## 데이터 저장 주의사항

프로젝트와 출제 원칙은 서버가 아닌, 현재 브라우저의 `localStorage`에 저장됩니다. 따라서 다음을 꼭 알아두세요.

- 웹사이트 주소, 브라우저, 컴퓨터가 달라지면 데이터도 자동으로 공유되지 않습니다.
- 브라우저의 사이트 데이터 삭제 또는 시크릿 창 사용 시 저장 내용이 사라질 수 있습니다.
- 중요한 작업 전후에는 상단 **JSON 내보내기**로 백업 파일을 저장하세요.
- 다른 PC나 브라우저에서는 **가져오기**로 해당 JSON 파일을 불러와 복원할 수 있습니다.

입력 내용은 약간의 입력 대기 후 자동 저장됩니다. 상단의 `저장됨` 표시를 확인한 뒤 창을 닫는 것이 안전합니다.

## 폴더 구조

```
.github/workflows/deploy-pages.yml  GitHub Pages 자동 배포 설정
src/
  main.tsx       화면과 사용자 흐름
  types.ts        프로젝트 데이터 타입과 기본값
  prompt.ts       AI용 프롬프트 문자열 생성
  storage.ts      localStorage 저장과 백업 검증
  core.test.ts    핵심 로직 테스트
```

## 검증 명령어

```powershell
npm run test
npm run lint
npm run build
```

`npm run build` 결과물은 `dist` 폴더에 생성됩니다. GitHub Pages 배포 시에는 GitHub Actions가 이 폴더만 안전하게 업로드합니다.
