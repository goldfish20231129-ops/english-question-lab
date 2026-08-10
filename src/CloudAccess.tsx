import { useState, type FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { CloudSyncStatus } from './useCloudWorkspace'

export function CloudSetupRequired() {
  return <main className="cloud-gate"><section className="cloud-auth-card"><span className="cloud-mark">☁</span><p className="eyebrow">CLOUD SETUP REQUIRED</p><h1>클라우드 연결 설정이 필요합니다</h1><p>아이패드와 PC에서 같은 작업을 사용하려면 Supabase 프로젝트 정보가 필요합니다.</p><ol><li>프로젝트 루트에 <code>.env.local</code> 파일을 만듭니다.</li><li><code>VITE_SUPABASE_URL</code>과 <code>VITE_SUPABASE_PUBLISHABLE_KEY</code>를 입력합니다.</li><li><code>supabase/schema.sql</code>을 Supabase에서 실행합니다.</li></ol><p className="cloud-help">자세한 순서는 <code>docs/CLOUD_SETUP.md</code>에 있습니다. 설정 전에도 빌드는 가능하지만 로그인 화면과 작업 공간은 열리지 않습니다.</p></section></main>
}

export function LoginScreen({ client }: { client: SupabaseClient }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const login = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage('')
    const { error } = await client.auth.signInWithPassword({ email: email.trim(), password })
    if (error) setMessage(error.message === 'Invalid login credentials' ? '이메일 또는 비밀번호가 올바르지 않습니다.' : error.message)
    setBusy(false)
  }
  const reset = async () => {
    if (!email.trim()) { setMessage('먼저 이메일을 입력해 주세요.'); return }
    setBusy(true); setMessage('')
    const redirectTo = `${window.location.origin}${window.location.pathname}`
    const { error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo })
    setMessage(error ? error.message : '비밀번호 재설정 메일을 보냈습니다.')
    setBusy(false)
  }
  return <main className="cloud-gate"><form className="cloud-auth-card" onSubmit={(event) => void login(event)}><span className="cloud-mark">E</span><p className="eyebrow">ENGLISH QUESTION DESIGN WORKBENCH</p><h1>영어 문제 제작 연구소</h1><p>PC와 아이패드에서 같은 작업을 이어가려면 본인 계정으로 로그인하세요.</p><label>이메일<input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label>비밀번호<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>{message && <p className="cloud-auth-message" role="status">{message}</p>}<button className="primary" type="submit" disabled={busy}>{busy ? '로그인 중…' : '로그인'}</button><button type="button" disabled={busy} onClick={() => void reset()}>비밀번호 재설정 메일 받기</button><p className="cloud-help">회원가입은 제공하지 않습니다. Supabase에서 만든 본인 계정만 로그인할 수 있습니다.</p></form></main>
}

export function PasswordRecoveryPanel({ client, close }: { client: SupabaseClient; close: () => void }) {
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage('')
    const { error } = await client.auth.updateUser({ password })
    if (error) setMessage(error.message)
    else { setMessage('새 비밀번호를 저장했습니다.'); window.setTimeout(close, 800) }
    setBusy(false)
  }
  return <div className="cloud-modal-backdrop"><form className="cloud-modal" onSubmit={(event) => void submit(event)}><h2>새 비밀번호 설정</h2><label>새 비밀번호<input type="password" minLength={8} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>{message && <p role="status">{message}</p>}<button className="primary" disabled={busy}>{busy ? '저장 중…' : '비밀번호 저장'}</button></form></div>
}

export function SyncBadge({ status, label, lastSyncedAt }: { status: CloudSyncStatus; label: string; lastSyncedAt: string }) {
  const title = lastSyncedAt ? `마지막 동기화: ${new Date(lastSyncedAt).toLocaleString('ko-KR')}` : '아직 동기화되지 않았습니다.'
  return <span className={`sync-badge ${status}`} title={title}>● {label}</span>
}

export function CloudConflictPanel({ message, useLocal, useCloud }: { message: string; useLocal: () => Promise<void>; useCloud: () => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  const run = async (action: () => Promise<void>) => { setBusy(true); try { await action() } finally { setBusy(false) } }
  return <div className="cloud-modal-backdrop"><section className="cloud-modal conflict"><h2>어느 작업을 보존할까요?</h2><p>{message || '이 기기와 클라우드에서 모두 변경된 내용이 발견되었습니다.'}</p><p className="cloud-help">선택하지 않은 버전도 최근 복구본으로 보존됩니다.</p><div className="button-row"><button disabled={busy} onClick={() => void run(useCloud)}>클라우드 자료 받기</button><button className="primary" disabled={busy} onClick={() => void run(useLocal)}>이 기기 자료 올리기</button></div></section></div>
}
