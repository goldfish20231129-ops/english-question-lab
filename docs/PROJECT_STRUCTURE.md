# 영어 문제 제작 연구소 구조 안내

## 주요 파일

| 영역 | 파일 | 역할 |
| --- | --- | --- |
| 앱 진입·화면 전환 | `src/main.tsx` | 로그인 상태, 데이터 로드, 메뉴, 백업·복원 |
| 로그인 UI | `src/CloudAccess.tsx` | 로그인, 비밀번호 재설정, 동기화·충돌 표시 |
| Supabase 연결 | `src/supabase.ts` | 공개 Project URL·Publishable key로 클라이언트 생성 |
| 클라우드 데이터 | `src/cloudSync.ts` | 작업 공간 저장, 이미지 업로드·다운로드, 버전 충돌 감지 |
| 동기화 흐름 | `src/useCloudWorkspace.ts` | 1초 자동 저장, 오프라인·충돌·복구 처리 |
| 동기화 안전장치 | `src/syncStorage.ts` | 기기별 동기화 상태와 최근 복구본 저장 |
| 제작 화면 | `src/EnglishStudio.tsx` | 세트 제작, AI 결과 가져오기, 조립, 미리보기 |
| 공통 영어 규칙 | `src/english.ts` | 프롬프트, JSON 해석, 자동 검사, 프리셋 |
| 수능형 규칙 | `src/csat.ts` | 번호 템플릿, 지문 구조, 수능형 프롬프트와 품질 규칙 |
| 시험지 출력 | `src/ExamPaper.tsx` | 문제지·해설지 React 렌더링 |
| 페이지 조판 | `src/examLayout.ts` | A4 페이지와 칼럼 배치 |
| PDF | `src/pdfExport.ts` | 페이지별 PDF 저장 |
| 저장소 | `src/studioStorage.ts` | IndexedDB 세트·시험지·이미지 저장 |
| 백업 | `src/storage.ts` | localStorage와 JSON 백업·복원 |
| 데이터 형식 | `src/types.ts` | 앱 전체 TypeScript 타입 |
| GPT 지식 | `docs/english-gpt` | Instructions, 스키마, 분석·테스트 자료 |
| 클라우드 설치 | `docs/CLOUD_SETUP.md` | Supabase와 GitHub Pages 연결 순서 |
| 보안 정책 SQL | `supabase/schema.sql` | 작업 공간·비공개 이미지 버킷·RLS 정책 |

## 변경 위치 선택

- 빠른 선택과 입력 UI: `EnglishStudio.tsx`, `english.ts`, `style.css`
- 수능 번호별 설계: `csat.ts`, `csat.test.ts`
- 외부 AI JSON 형식: `english.ts`, `types.ts`, `docs/english-gpt`, 관련 테스트
- 시험지 모양과 페이지 흐름: `ExamPaper.tsx`, `examLayout.ts`, `style.css`
- 저장·복원: `storage.ts`, `studioStorage.ts`, 백업 호환 테스트
- 로그인·PC/아이패드 동기화: `supabase.ts`, `cloudSync.ts`, `useCloudWorkspace.ts`, `syncStorage.ts`

## 데이터 경계

- IndexedDB: `english-question-lab-studio-v1`
- localStorage: `english-question-lab-ui-v1`, `english-question-lab-principles-v1`
- 동기화 상태 IndexedDB: `english-question-lab-sync-v1`
- Supabase 테이블: `user_workspaces`
- Supabase 비공개 Storage: `english-media`
- 백업 appId: `english-question-lab`
- 로컬 포트: `5174`

## 안전한 검증 순서

```powershell
pnpm lint
pnpm test
pnpm build
```

한 번에 실행할 때는 `pnpm verify`를 사용한다.

## 이후 파일 분리 권장안

기능이 더 늘어나면 `english.ts`는 프롬프트·JSON 가져오기·검사로, `csat.ts`는 템플릿·지문 처리·품질 검사로 나눈다. 동작 변경과 파일 분리를 같은 작업에서 동시에 진행하지 않는다.
