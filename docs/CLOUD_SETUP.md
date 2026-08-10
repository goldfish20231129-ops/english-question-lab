# PC·아이패드 클라우드 연결

이 앱의 화면은 GitHub Pages에서 열고, 로그인과 데이터 동기화는 Supabase가 담당합니다. 앱에는 공개 가능한 `Project URL`과 `Publishable key`만 사용합니다. `service_role` 또는 Secret key는 절대로 입력하지 마세요.

## 1. Supabase 프로젝트 만들기

1. [Supabase](https://supabase.com/dashboard)에 로그인하고 `New project`를 누릅니다.
2. 프로젝트 이름과 강한 데이터베이스 비밀번호를 정한 뒤 무료 프로젝트를 만듭니다.
3. 프로젝트가 준비되면 `SQL Editor`를 엽니다.
4. 이 프로젝트의 `supabase/schema.sql` 전체를 복사해 붙여넣고 `Run`을 누릅니다.

이 SQL은 사용자별 작업 공간 테이블, 비공개 이미지 버킷, 본인 자료만 읽고 쓸 수 있는 RLS 정책을 만듭니다.

## 2. 본인 계정 한 개 만들기

1. Supabase의 `Authentication → Users`로 이동합니다.
2. `Add user`로 본인 이메일과 비밀번호를 만들고 이메일을 확인 처리합니다.
3. 본인 계정으로 로그인이 되는 것을 확인한 다음 `Authentication` 설정에서 신규 회원가입 허용을 끕니다.

앱 화면에는 회원가입 버튼이 없습니다. 따라서 계정은 Supabase 관리자 화면에서만 만듭니다.

## 3. 웹 주소 허용하기

`Authentication → URL Configuration`에서 다음을 설정합니다.

- `Site URL`: 최종 GitHub Pages 주소
- `Redirect URLs`: 최종 주소와 로컬 주소 `http://127.0.0.1:5174/**`

비밀번호 재설정 메일을 사용할 때 이 주소로 돌아옵니다.

## 4. 로컬 설정

Supabase의 프로젝트 설정/API 화면에서 다음 두 값을 찾습니다.

- Project URL
- Publishable key (`sb_publishable_...`)

`.env.example`을 복사해 `.env.local`을 만들고 값을 넣습니다.

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
```

`.env.local`은 Git에 올라가지 않습니다. 개발 서버를 이미 열어 두었다면 종료한 뒤 다시 실행해야 설정이 반영됩니다.

## 5. GitHub Pages 설정

영어 프로젝트 전용 GitHub 저장소에서 다음을 진행합니다.

1. `Settings → Secrets and variables → Actions → Variables`를 엽니다.
2. `VITE_SUPABASE_URL` 변수에 Project URL을 넣습니다.
3. `VITE_SUPABASE_PUBLISHABLE_KEY` 변수에 Publishable key를 넣습니다.
4. `Settings → Pages → Source`를 `GitHub Actions`로 선택합니다.
5. 코드를 `main`에 push하면 자동으로 검사·빌드·배포됩니다.

이 두 값은 브라우저 앱에 포함되는 공개 설정입니다. 보안은 키 숨김이 아니라 로그인과 `supabase/schema.sql`의 RLS 정책으로 보장합니다.

## 6. 처음 동기화하기

1. 기존 자료가 들어 있는 PC 브라우저에서 먼저 로그인합니다.
2. 클라우드가 비어 있으면 현재 영어 세트·시험지·이미지·출제 원칙이 자동 업로드됩니다.
3. 상단 표시가 `클라우드 동기화 완료`가 될 때까지 기다립니다.
4. 아이패드 Safari에서 GitHub Pages 주소를 열고 같은 계정으로 로그인합니다.
5. 같은 자료가 내려오면 Safari 공유 메뉴의 `홈 화면에 추가`를 사용할 수 있습니다.

두 기기에서 동시에 수정하면 어느 쪽을 보존할지 묻습니다. 선택에서 제외된 자료도 브라우저 복구본으로 저장되며 상단 `복구본 JSON`으로 내려받을 수 있습니다.

## 주의사항

- 새 아이패드나 새 브라우저에서 처음 로그인할 때는 인터넷 연결이 필요합니다.
- 한 번 로그인하고 자료를 내려받은 기기는 일시적인 오프라인 상태에서도 로컬 저장으로 계속 작업합니다.
- 로그아웃 전에는 반드시 `클라우드 동기화 완료`인지 확인하세요.
- JSON 백업은 클라우드와 별개의 최종 안전장치이므로 주기적으로 보관하세요.
- Supabase 무료 프로젝트는 장기간 사용하지 않으면 일시 중지될 수 있습니다. 다시 활성화한 뒤 앱을 열면 동기화가 재개됩니다.
