import { Component, lazy, StrictMode, Suspense, useEffect, useRef, useState, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import '@fontsource/noto-serif-kr/400.css'
import '@fontsource/noto-serif-kr/700.css'
import './style.css'
import { CloudConflictPanel, CloudSetupRequired, LoginScreen, PasswordRecoveryPanel, SyncBadge } from './CloudAccess'
import { MODE_LABELS } from './english'
import { createBackup, loadPrinciples, loadUiSettings, parseBackup, savePrinciples, saveUiSettings } from './storage'
import { loadStudioBundle, replaceStudioBundle } from './studioStorage'
import { cloudConfigured, supabase } from './supabase'
import type { EnglishMode, StudioBundle, StudioScreen, UiSettings, VerificationTarget } from './types'
import { useCloudWorkspace } from './useCloudWorkspace'

const EMPTY_BUNDLE: StudioBundle = { questionSets: [], exams: [], mediaAssets: [] }
const EnglishStudio = lazy(() => import('./EnglishStudio').then((module) => ({ default: module.EnglishStudio })))

class WorkspaceErrorBoundary extends Component<{
  children: ReactNode
  resetKey: StudioScreen
  onRecover: () => void
}, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() { return { failed: true } }

  componentDidUpdate(previous: Readonly<{ resetKey: StudioScreen }>) {
    if (this.state.failed && previous.resetKey !== this.props.resetKey) this.setState({ failed: false })
  }

  render() {
    if (!this.state.failed) return this.props.children
    return <section className="workspace-recovery" role="alert">
      <span className="eyebrow">SAFE RECOVERY</span>
      <h2>현재 화면을 표시하지 못했습니다.</h2>
      <p>저장된 세트와 시험지는 그대로 유지됩니다. 화면을 다시 시도하거나 세트 제작으로 돌아가 다른 시험지를 선택해 주세요.</p>
      <div className="button-row"><button onClick={() => this.setState({ failed: false })}>현재 화면 다시 시도</button><button className="primary" onClick={this.props.onRecover}>세트 제작으로 돌아가기</button></div>
    </section>
  }
}

function WorkspaceApp({ client, session }: { client: SupabaseClient; session: Session }) {
  const [bundle, setBundle] = useState<StudioBundle>(EMPTY_BUNDLE)
  const [settings, setSettings] = useState<UiSettings>(loadUiSettings)
  const [principles, setPrinciples] = useState<string[]>(loadPrinciples)
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState('')
  const [verificationTarget, setVerificationTarget] = useState<VerificationTarget | undefined>()
  const importRef = useRef<HTMLInputElement>(null)
  const notify = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(''), 3000) }
  const cloud = useCloudWorkspace({ client, userId: session.user.id, localReady: !loading, bundle, principles, setBundle, setPrinciples })

  useEffect(() => {
    document.title = '영어 문제 제작 연구소'
    void loadStudioBundle().then(setBundle).catch(() => notify('영어 전용 저장소를 불러오지 못했습니다.')).finally(() => setLoading(false))
  }, [])
  useEffect(() => saveUiSettings(settings), [settings])
  useEffect(() => savePrinciples(principles), [principles])

  const setScreen = (screen: StudioScreen) => setSettings((value) => ({ ...value, screen }))
  const setMode = (activeMode: EnglishMode) => setSettings((value) => ({ ...value, activeMode }))
  const exportBackup = () => {
    const backup = createBackup(bundle, settings, principles)
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob); link.download = `영어-문제-제작-연구소-${new Date().toISOString().slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(link.href)
    notify('영어 전용 JSON 백업을 저장했습니다.')
  }
  const importBackup = (file?: File) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const backup = parseBackup(JSON.parse(String(reader.result)))
        setBundle(backup.data); setSettings(backup.preferences); setPrinciples(backup.principles); void replaceStudioBundle(backup.data)
        notify('영어 전용 백업을 복원했습니다. 클라우드 저장을 시작합니다.')
      } catch (error) { notify(error instanceof Error ? error.message : '백업 파일을 읽지 못했습니다.') }
    }
    reader.readAsText(file)
  }
  const logout = async () => {
    if (cloud.hasPending && !await cloud.flushForLogout()) {
      notify('동기화되지 않은 작업이 있습니다. 인터넷 연결과 충돌 상태를 확인해 주세요.')
      return
    }
    const { error } = await client.auth.signOut()
    if (error) notify(`로그아웃하지 못했습니다: ${error.message}`)
  }
  const downloadRecovery = async () => {
    if (!await cloud.downloadLatestRecovery()) notify('저장된 복구본이 없습니다.')
  }

  return <main className="app-shell">
    <header className="app-header"><div className="brand"><span className="brand-mark">E</span><div><span className="eyebrow">ENGLISH QUESTION DESIGN WORKBENCH</span><h1>영어 문제 제작 연구소</h1></div></div><div className="header-actions"><SyncBadge status={cloud.status} label={cloud.statusLabel} lastSyncedAt={cloud.lastSyncedAt} /><span className="account-email">{session.user.email}</span><button onClick={() => void cloud.syncNow()}>지금 동기화</button>{cloud.hasRecovery && <button onClick={() => void downloadRecovery()}>최근 복구본</button>}<button onClick={exportBackup}>JSON 백업</button><button onClick={() => importRef.current?.click()}>백업 복원</button><button onClick={() => void logout()}>로그아웃</button><input ref={importRef} type="file" accept="application/json" hidden onChange={(event) => { importBackup(event.target.files?.[0]); event.currentTarget.value = '' }} /></div></header>
    {cloud.message && <div className={`cloud-status-message ${cloud.status}`}>{cloud.message}</div>}
    <nav className="main-nav" aria-label="주요 화면"><button aria-current={settings.screen === 'sets' ? 'page' : undefined} className={settings.screen === 'sets' ? 'active' : ''} onClick={() => setScreen('sets')}><strong>영어 세트 제작</strong><small>조건 설계 · AI JSON</small></button><button aria-current={settings.screen === 'verification' ? 'page' : undefined} className={settings.screen === 'verification' ? 'active' : ''} onClick={() => setScreen('verification')}><strong>AI 검증</strong><small>선택 실행 · 사용자 확인</small></button><button aria-current={settings.screen === 'assembly' ? 'page' : undefined} className={settings.screen === 'assembly' ? 'active' : ''} onClick={() => setScreen('assembly')}><strong>시험지 조립</strong><small>유형 혼합 · 양식 설정</small></button><button aria-current={settings.screen === 'preview' ? 'page' : undefined} className={settings.screen === 'preview' ? 'active' : ''} onClick={() => setScreen('preview')}><strong>인쇄 미리보기</strong><small>문제지 · 정답 해설지</small></button></nav>
    {settings.screen === 'sets' && <><nav className="mode-nav" aria-label="영어 제작 유형">{(['school', 'csat', 'custom'] as EnglishMode[]).map((mode) => <button aria-current={settings.activeMode === mode ? 'page' : undefined} className={settings.activeMode === mode ? 'active' : ''} key={mode} onClick={() => setMode(mode)}><span>{MODE_LABELS[mode]}</span><small>{mode === 'school' ? '교과서·부교재·외부 지문' : mode === 'csat' ? '17개 수능 독해 유형' : '프리셋 기반 자유 조합'}</small></button>)}</nav><details className="principles-panel"><summary>나의 영어 출제 원칙</summary><p>한 줄에 하나씩 입력하면 세 유형의 제작 프롬프트에 공통으로 포함됩니다.</p><textarea value={principles.join('\n')} onChange={(event) => setPrinciples(event.target.value.split('\n'))} placeholder="예: 정답의 근거는 지문에서 명확히 확인되어야 한다." /></details></>}
    {notice && <div className="toast" role="status" aria-live="polite" aria-atomic="true">{notice}</div>}
    {loading || cloud.status === 'starting' ? <div className="loading">영어 작업 공간과 클라우드 자료를 불러오는 중…</div> : <WorkspaceErrorBoundary resetKey={settings.screen} onRecover={() => setScreen('sets')}><Suspense fallback={<div className="loading">영어 제작 화면을 불러오는 중…</div>}><EnglishStudio screen={settings.screen} mode={settings.activeMode} bundle={bundle} setBundle={setBundle} notify={notify} verificationTarget={verificationTarget} onOpenVerification={(target) => { setVerificationTarget(target); setScreen('verification') }} /></Suspense></WorkspaceErrorBoundary>}
    {cloud.conflict && <CloudConflictPanel message={cloud.message} useCloud={() => cloud.resolveConflict('cloud')} useLocal={() => cloud.resolveConflict('local')} />}
  </main>
}

function RootApp() {
  const [session, setSession] = useState<Session | null>(null)
  const [authLoading, setAuthLoading] = useState(cloudConfigured)
  const [recoveringPassword, setRecoveringPassword] = useState(false)
  useEffect(() => {
    if (!supabase) { setAuthLoading(false); return }
    void supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthLoading(false) })
    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession)
      if (event === 'PASSWORD_RECOVERY') setRecoveringPassword(true)
      setAuthLoading(false)
    })
    return () => data.subscription.unsubscribe()
  }, [])
  if (!cloudConfigured || !supabase) return <CloudSetupRequired />
  if (authLoading) return <main className="cloud-gate"><div className="loading">로그인 상태를 확인하는 중…</div></main>
  if (!session) return <LoginScreen client={supabase} />
  return <><WorkspaceApp client={supabase} session={session} />{recoveringPassword && <PasswordRecoveryPanel client={supabase} close={() => setRecoveringPassword(false)} />}</>
}

createRoot(document.getElementById('root')!).render(<StrictMode><RootApp /></StrictMode>)
