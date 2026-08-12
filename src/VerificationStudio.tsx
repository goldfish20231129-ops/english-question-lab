import { useEffect, useMemo, useState } from 'react'
import { loadEnglishGptConfig } from './english'
import type { CsatVerificationRun, StudioBundle, VerificationDecision, VerificationTarget } from './types'
import {
  VERIFICATION_STATUS_LABELS, createVerificationPrompt, generateVerificationRepairPrompt,
  parseVerificationJson, updateVerificationFinding, verificationDisplayStatus,
} from './verification'

interface Props {
  bundle: StudioBundle
  setBundle: React.Dispatch<React.SetStateAction<StudioBundle>>
  notify: (message: string) => void
  initialTarget?: VerificationTarget
}

const DECISION_LABELS: Record<VerificationDecision, string> = {
  approve: '권고대로 수정', revise: '내 의견으로 수정', ignore: '제외', defer: '보류',
}

export function VerificationStudio({ bundle, setBundle, notify, initialTarget }: Props) {
  const [scope, setScope] = useState<'set' | 'exam'>(initialTarget?.scope ?? 'set')
  const csatSets = useMemo(() => bundle.questionSets.filter((set) => set.mode === 'csat'), [bundle.questionSets])
  const candidates = scope === 'set' ? csatSets : bundle.exams
  const [targetId, setTargetId] = useState(initialTarget?.id ?? candidates[0]?.id ?? '')
  const [workingRun, setWorkingRun] = useState<CsatVerificationRun | undefined>()
  const [prompt, setPrompt] = useState('')
  const [jsonInput, setJsonInput] = useState('')
  const [repairPrompt, setRepairPrompt] = useState('')
  const [verifierUrl, setVerifierUrl] = useState('')
  const target: VerificationTarget = { scope, id: targetId }
  const targetObject = scope === 'set' ? bundle.questionSets.find((set) => set.id === targetId) : bundle.exams.find((exam) => exam.id === targetId)
  const storedRuns = targetObject?.verificationRuns ?? []
  const latestStored = [...storedRuns].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
  const activeRun = workingRun?.targetId === targetId && workingRun.scope === scope ? workingRun : latestStored
  const status = targetId ? verificationDisplayStatus(target, storedRuns, bundle) : 'unverified'

  useEffect(() => { void loadEnglishGptConfig().then((config) => setVerifierUrl(config.csatVerifier)) }, [])
  useEffect(() => {
    if (!initialTarget) return
    setScope(initialTarget.scope); setTargetId(initialTarget.id); setWorkingRun(undefined); setPrompt(''); setJsonInput(''); setRepairPrompt('')
  }, [initialTarget])
  useEffect(() => {
    if (!candidates.some((candidate) => candidate.id === targetId)) setTargetId(candidates[0]?.id ?? '')
  }, [candidates, targetId])

  const persistRun = (run: CsatVerificationRun) => {
    setWorkingRun(run)
    setBundle((current) => scope === 'set'
      ? { ...current, questionSets: current.questionSets.map((set) => set.id === targetId ? { ...set, verificationRuns: [...(set.verificationRuns ?? []).filter((item) => item.id !== run.id), run], updatedAt: new Date().toISOString() } : set) }
      : { ...current, exams: current.exams.map((exam) => exam.id === targetId ? { ...exam, verificationRuns: [...(exam.verificationRuns ?? []).filter((item) => item.id !== run.id), run], updatedAt: new Date().toISOString() } : exam) })
  }
  const changeTarget = (nextScope: 'set' | 'exam', nextId: string) => {
    setScope(nextScope); setTargetId(nextId); setWorkingRun(undefined); setPrompt(''); setJsonInput(''); setRepairPrompt('')
  }
  const startVerification = () => {
    try {
      const result = createVerificationPrompt(target, bundle)
      setPrompt(result.prompt); setJsonInput(''); setRepairPrompt(''); persistRun(result.run)
      notify('독립 AI 검증 프롬프트를 만들었습니다.')
    } catch (error) { notify(error instanceof Error ? error.message : '검증 프롬프트를 만들지 못했습니다.') }
  }
  const importResult = () => {
    if (!activeRun) return notify('먼저 검증 프롬프트를 만들어 주세요.')
    try {
      const imported = parseVerificationJson(jsonInput, activeRun, bundle)
      persistRun(imported); setRepairPrompt(''); notify(imported.findings.length ? '검증 결과를 가져왔습니다. 수정 권고를 확인해 주세요.' : '검증 결과에 별도 수정 권고가 없습니다.')
    } catch (error) { notify(error instanceof Error ? error.message : '검증 JSON을 가져오지 못했습니다.') }
  }
  const updateRun = (next: CsatVerificationRun) => { persistRun(next); setRepairPrompt('') }
  const updateDecision = (findingId: string, decision: VerificationDecision, note: string) => {
    if (activeRun) updateRun(updateVerificationFinding(activeRun, findingId, decision, note))
  }
  const makeRepairPrompt = () => {
    if (!activeRun || scope !== 'set') return notify('수정 프롬프트는 수능형 세트 검증에서 만들어 주세요.')
    const set = bundle.questionSets.find((candidate) => candidate.id === targetId)
    if (!set) return
    try { setRepairPrompt(generateVerificationRepairPrompt(activeRun, set)); notify('승인된 의견으로 수정 프롬프트를 만들었습니다.') }
    catch (error) { notify(error instanceof Error ? error.message : '수정 프롬프트를 만들지 못했습니다.') }
  }
  const copy = async (value: string, message: string) => {
    if (!value) return notify('복사할 내용이 없습니다.')
    await navigator.clipboard.writeText(value); notify(message)
  }

  return <section className="verification-screen">
    <header className="verification-heading"><div><span className="eyebrow">OPTIONAL INDEPENDENT REVIEW</span><h2>AI 검증</h2><p>완성 문제를 검증 AI가 독립적으로 풀게 한 뒤, 사용자가 승인한 의견만 제작 GPT 수정 프롬프트에 반영합니다. 검증하지 않아도 조립·인쇄·PDF 저장에는 제한이 없습니다.</p></div><span className={`verification-status ${status}`}>{VERIFICATION_STATUS_LABELS[status]}</span></header>

    <section className="editor-card"><div className="card-title-row"><div><h3>1. 검증 대상 선택</h3><p>수능형 세트 하나 또는 조립된 시험지 전체를 선택합니다.</p></div><span className="verification-count">선택 기능</span></div><div className="verification-target-fields"><label>검증 범위<select value={scope} onChange={(event) => { const nextScope = event.target.value as 'set' | 'exam'; const nextCandidates = nextScope === 'set' ? csatSets : bundle.exams; changeTarget(nextScope, nextCandidates[0]?.id ?? '') }}><option value="set">수능형 세트</option><option value="exam">조립 시험지</option></select></label><label>대상<select value={targetId} onChange={(event) => changeTarget(scope, event.target.value)}><option value="">대상을 선택하세요</option>{candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.title}</option>)}</select></label></div>{!candidates.length && <p className="verification-empty">검증할 {scope === 'set' ? '수능형 세트' : '시험지'}가 없습니다.</p>}</section>

    <section className="editor-card"><div className="card-title-row"><div><h3>2. 검증 AI용 프롬프트</h3><p>검증 AI는 기존 정답을 설명하는 대신 모든 선지를 독립적으로 판정합니다.</p></div><button className="primary" disabled={!targetId} onClick={startVerification}>검증 프롬프트 생성</button></div><textarea className="prompt-output verification-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="검증 프롬프트 생성 버튼을 누르세요."/><div className="button-row"><button onClick={() => void copy(prompt, '검증 프롬프트를 복사했습니다.')}>프롬프트 복사</button><button disabled={!verifierUrl} onClick={() => { void copy(prompt, '검증 프롬프트를 복사하고 검증 GPT를 열었습니다.'); if (verifierUrl) window.open(verifierUrl, '_blank', 'noopener,noreferrer') }}>{verifierUrl ? '검증 GPT 열기' : '검증 GPT 링크 미설정'}</button></div></section>

    <section className="editor-card"><h3>3. 검증 결과 JSON 가져오기</h3><p>검증 AI가 반환한 JSON을 붙여 넣으세요. 검증 AI는 문제를 직접 수정하지 않습니다.</p><textarea className="json-input" value={jsonInput} onChange={(event) => setJsonInput(event.target.value)} placeholder='{"schemaId":"english-question-lab-csat-verification-v1", ...}'/><button className="primary wide" disabled={!activeRun || !jsonInput.trim()} onClick={importResult}>검증 JSON 분석하여 가져오기</button></section>

    <section className="editor-card"><div className="card-title-row"><div><h3>4. 수정 개요와 사용자 결정</h3><p>{activeRun?.overallSummary || '검증 결과를 가져오면 문제별 수정 권고가 표시됩니다.'}</p></div>{activeRun && <span className={`verification-status ${activeRun.status}`}>{VERIFICATION_STATUS_LABELS[activeRun.status]}</span>}</div>{activeRun?.importedAt && activeRun.findings.length === 0 && <div className="verification-pass"><strong>별도 수정 권고 없음</strong><span>검증은 참고 정보이며 출력 기능을 제한하지 않습니다.</span></div>}{activeRun?.findings.map((finding) => <article className={`verification-finding ${finding.severity}`} key={finding.id}><header><div><span>{finding.slot}번 · {finding.category}</span><strong>{finding.summary}</strong></div><span>{finding.severity === 'error' ? '오류 가능성' : '확인 권고'}</span></header><dl><div><dt>검증 근거</dt><dd>{finding.evidence || '-'}</dd></div><div><dt>수정 권고</dt><dd>{finding.suggestedRepair || '-'}</dd></div></dl><div className="verification-decision-row"><label>처리 선택<select value={finding.decision} onChange={(event) => updateDecision(finding.id, event.target.value as VerificationDecision, finding.userNote)}>{(Object.keys(DECISION_LABELS) as VerificationDecision[]).map((decision) => <option key={decision} value={decision}>{DECISION_LABELS[decision]}</option>)}</select></label><label>내 수정 의견<textarea value={finding.userNote} disabled={finding.decision !== 'revise'} onChange={(event) => updateDecision(finding.id, finding.decision, event.target.value)} placeholder="내 의견으로 수정할 내용을 입력하세요."/></label></div></article>)}{activeRun && <label className="verification-overall-note">전체 수정 메모<textarea value={activeRun.overallUserNote} onChange={(event) => updateRun({ ...activeRun, overallUserNote: event.target.value })} placeholder="예: 지문 길이와 소재는 유지한다."/></label>}</section>

    <section className="editor-card repair-prompt-card"><header><div><h3>5. 제작 GPT 수정 프롬프트</h3><p>권고대로 수정하거나 내 의견으로 수정하기로 한 내용만 포함합니다.</p></div><button className="primary" disabled={!activeRun || scope !== 'set'} onClick={makeRepairPrompt}>수정 프롬프트 생성</button></header><textarea className="review-output" value={repairPrompt} onChange={(event) => setRepairPrompt(event.target.value)} placeholder="사용자가 승인한 의견으로 수정 프롬프트를 만듭니다."/><button className="wide" onClick={() => void copy(repairPrompt, '수정 프롬프트를 복사했습니다.')}>수정 프롬프트 복사</button></section>
  </section>
}
