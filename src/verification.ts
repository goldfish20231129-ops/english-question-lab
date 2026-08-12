import { getCsatItems } from './csat'
import { resolveExamEntries } from './examLayout'
import type {
  CsatQuestionVerification, CsatVerificationFinding, CsatVerificationRun,
  EnglishQuestion, EnglishQuestionSet, StudioBundle, VerificationDecision, VerificationTarget,
} from './types'

export const VERIFICATION_SCHEMA_ID = 'english-question-lab-csat-verification-v1'

export type VerificationDisplayStatus = 'unverified' | 'in-progress' | 'needs-review' | 'complete' | 'stale'

export const VERIFICATION_STATUS_LABELS: Record<VerificationDisplayStatus, string> = {
  unverified: '검증 안 함',
  'in-progress': '검증 중',
  'needs-review': '사용자 확인 대기',
  complete: '검증 완료',
  stale: '수정 후 재검증 필요',
}

interface VerificationQuestionSource {
  setId: string
  setTitle: string
  csatItemId: string
  templateId: string
  material: string
  question: EnglishQuestion
}

interface VerificationSource {
  targetTitle: string
  revision: string
  questions: VerificationQuestionSource[]
}

const objectValue = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
const stringValue = (value: unknown) => typeof value === 'string' ? value.trim() : ''
const numberValue = (value: unknown, fallback = 0) => typeof value === 'number' && Number.isFinite(value) ? value : fallback

function sourceForTarget(target: VerificationTarget, bundle: StudioBundle): VerificationSource {
  if (target.scope === 'set') {
    const set = bundle.questionSets.find((candidate) => candidate.id === target.id)
    if (!set) throw new Error('검증할 세트를 찾지 못했습니다.')
    if (set.mode !== 'csat') throw new Error('AI 검증은 수능형 세트만 지원합니다.')
    const questions = getCsatItems(set).flatMap((item) => item.questions.map((question) => ({
      setId: set.id, setTitle: set.title, csatItemId: item.id,
      templateId: item.design?.templateId ?? question.csatTemplateId ?? '', material: item.material, question,
    })))
    if (!questions.length) throw new Error('검증할 완성 문항이 없습니다.')
    return { targetTitle: set.title, revision: String(set.aiRevision), questions }
  }
  const exam = bundle.exams.find((candidate) => candidate.id === target.id)
  if (!exam) throw new Error('검증할 시험지를 찾지 못했습니다.')
  const questions = resolveExamEntries(exam, bundle.questionSets).flatMap(({ set, csatItem }) => {
    if (set.mode !== 'csat') return []
    const items = csatItem ? [csatItem] : getCsatItems(set)
    return items.flatMap((item) => item.questions.map((question) => ({
      setId: set.id, setTitle: set.title, csatItemId: item.id,
      templateId: item.design?.templateId ?? question.csatTemplateId ?? '', material: item.material, question,
    })))
  })
  if (!questions.length) throw new Error('시험지에 검증할 수능형 문항이 없습니다.')
  return { targetTitle: exam.title, revision: questions.map((entry) => `${entry.setId}:${bundle.questionSets.find((set) => set.id === entry.setId)?.aiRevision ?? 0}`).join('|'), questions }
}

function fingerprintSource(source: VerificationSource) {
  const text = JSON.stringify(source.questions.map((entry) => ({
    setId: entry.setId, itemId: entry.csatItemId, templateId: entry.templateId, material: entry.material,
    question: {
      id: entry.question.id, stem: entry.question.stem, choices: entry.question.choices,
      answerIndex: entry.question.answerIndex, explanation: entry.question.explanation,
      evidenceRefs: entry.question.evidenceRefs, distractorReasons: entry.question.distractorReasons,
    },
  })))
  let hash = 2166136261
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`
}

export function createVerificationPrompt(target: VerificationTarget, bundle: StudioBundle) {
  const source = sourceForTarget(target, bundle)
  const sourceFingerprint = fingerprintSource(source)
  const now = new Date().toISOString()
  const run: CsatVerificationRun = {
    id: crypto.randomUUID(), scope: target.scope, targetId: target.id, targetTitle: source.targetTitle,
    sourceFingerprint, sourceRevision: source.revision, status: 'in-progress', createdAt: now,
    overallSummary: '', questionReviews: [], findings: [], overallUserNote: '',
  }
  const payload = source.questions.map((entry) => ({
    setId: entry.setId, setTitle: entry.setTitle, itemId: entry.csatItemId, templateId: entry.templateId,
    material: entry.material,
    question: {
      questionId: entry.question.id, slot: entry.question.csatSlot ?? entry.templateId,
      stem: entry.question.stem, choices: entry.question.choices, declaredAnswerIndex: entry.question.answerIndex,
      explanation: entry.question.explanation, evidenceRefs: entry.question.evidenceRefs,
      distractorReasons: entry.question.distractorReasons,
    },
  }))
  const prompt = `[CSAT_INDEPENDENT_VERIFICATION]\n당신은 한국교육과정평가원형 영어 독해 문항을 독립적으로 검증하는 AI이다. 문제를 수정하거나 새 문제를 만들지 말고, 먼저 정답과 근거를 스스로 판정한 뒤 기존 정답·해설과 비교하라.\n\n[검증 범위]\n${target.scope === 'exam' ? '조립 시험지' : '수능형 세트'}: ${source.targetTitle}\n\n[핵심 원칙]\n- 선언된 정답을 출발점으로 삼지 말고 모든 선지를 독립적으로 판정한다.\n- 정답이 하나인지, 복수 정답이나 정답 없음 가능성이 있는지 확인한다.\n- 해설이 실제 지문 근거와 일치하는지 확인한다.\n- 44번 지칭 문항은 다섯 표식이 반드시 4:1 대상 구조인지 entityId로 검증한다.\n- 문제를 직접 수정하지 말고 문제점과 수정 권고만 findings에 기록한다.\n- 설명이나 마크다운 없이 유효한 JSON 하나만 반환한다.\n\n[출력 길이와 완결성]\n- 전체 JSON은 가급적 8,000자 이하의 한 줄로 작성한다. 분석을 반복하거나 문제·지문·선지 전체를 다시 인용하지 않는다.\n- overallSummary는 180자, 선지별 reason은 45자, explanationNote는 120자 이하로 쓴다.\n- evidence는 문항당 최대 2개, 각 120자 이하의 결정적 근거만 기록한다. 지칭 referent의 evidence는 각 60자 이하로 쓴다.\n- findings의 summary, evidence, suggestedRepair는 각각 120자 이하로 쓰고 같은 문제를 중복 등록하지 않는다.\n- 정답 불일치·정답 유일성·해설 불일치·낮은 확신도·44번 4:1 오류는 questionReviews에서 프로그램이 자동 판정하므로 findings에 반복하지 않는다. findings에는 그 밖의 품질 문제만 기록한다.\n- 길이가 부족하면 자유 서술을 더 압축하되 필수 문항을 빼거나 JSON 문자열 중간에서 출력을 끝내지 않는다. 반환 직전에 따옴표와 모든 ], }가 닫혔는지 확인한다.\n\n[응답 식별 정보]\nschemaId: ${VERIFICATION_SCHEMA_ID}\ntargetId: ${target.id}\nsourceFingerprint: ${sourceFingerprint}\n\n[필수 JSON 구조]\n{"schemaId":"${VERIFICATION_SCHEMA_ID}","targetId":"${target.id}","sourceFingerprint":"${sourceFingerprint}","overallSummary":"...","questionReviews":[{"setId":"...","csatItemId":"...","questionId":"...","slot":"33","predictedAnswerIndex":1,"confidence":0.9,"choiceAssessments":[{"choiceIndex":1,"verdict":"correct|incorrect|ambiguous","reason":"..."}],"evidence":["..."],"explanationConsistent":true,"explanationNote":"...","strongestDistractorIndex":2,"referents":[{"marker":"(a)","entityId":"인물 식별자","evidence":"..."}]}],"findings":[{"setId":"...","csatItemId":"...","questionId":"...","slot":"...","severity":"error|warning","category":"...","summary":"...","evidence":"...","suggestedRepair":"..."}]}\n\n[검증 대상]\n${JSON.stringify(payload, null, 2)}`
  return { run, prompt }
}

function findingFor(source: VerificationQuestionSource, category: string, summary: string, evidence: string, suggestedRepair: string, severity: 'error' | 'warning' = 'error'): CsatVerificationFinding {
  return {
    id: crypto.randomUUID(), setId: source.setId, csatItemId: source.csatItemId,
    questionId: source.question.id, slot: source.question.csatSlot ?? source.templateId,
    severity, category, summary, evidence, suggestedRepair, decision: 'defer', userNote: '',
  }
}

export function parseVerificationJson(text: string, run: CsatVerificationRun, bundle: StudioBundle): CsatVerificationRun {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  if (!cleaned) throw new Error('검증 JSON을 붙여 넣어 주세요.')
  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned) as unknown
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const appearsTruncated = !cleaned.endsWith('}') || /unterminated|unexpected end|end of json/i.test(message)
    if (appearsTruncated) {
      throw new Error('검증 AI의 JSON이 문장 중간에서 잘렸습니다. 기존 응답을 이어 붙이지 말고, 전체 결과를 간결한 완전한 JSON 하나로 다시 생성해 주세요.', { cause: error })
    }
    throw new Error(`검증 JSON 문법 오류입니다. 검증 AI에 JSON만 다시 출력하도록 요청해 주세요. (${message})`, { cause: error })
  }
  const root = objectValue(parsed)
  if (stringValue(root.schemaId) !== VERIFICATION_SCHEMA_ID) throw new Error('검증 JSON 식별자가 올바르지 않습니다.')
  if (stringValue(root.targetId) !== run.targetId) throw new Error('검증 대상 ID가 현재 작업과 다릅니다.')
  if (stringValue(root.sourceFingerprint) !== run.sourceFingerprint) throw new Error('검증 결과가 현재 문제 원본과 일치하지 않습니다.')
  const source = sourceForTarget({ scope: run.scope, id: run.targetId }, bundle)
  if (fingerprintSource(source) !== run.sourceFingerprint) throw new Error('문제가 검증 프롬프트 생성 후 수정되었습니다. 새 검증을 시작해 주세요.')
  const sourceByQuestion = new Map(source.questions.map((entry) => [entry.question.id, entry]))
  const rawReviews = Array.isArray(root.questionReviews) ? root.questionReviews : []
  const seen = new Set<string>()
  const reviews: CsatQuestionVerification[] = rawReviews.map((raw) => {
    const value = objectValue(raw)
    const questionId = stringValue(value.questionId)
    const expected = sourceByQuestion.get(questionId)
    if (!expected || seen.has(questionId)) throw new Error('검증 문항 ID가 누락되었거나 중복되었습니다.')
    seen.add(questionId)
    const choices = Array.isArray(value.choiceAssessments) ? value.choiceAssessments.map((assessment) => {
      const item = objectValue(assessment)
      const rawVerdict = stringValue(item.verdict)
      const verdict: 'correct' | 'incorrect' | 'ambiguous' = rawVerdict === 'correct' || rawVerdict === 'ambiguous' ? rawVerdict : 'incorrect'
      return { choiceIndex: numberValue(item.choiceIndex), verdict, reason: stringValue(item.reason) }
    }) : []
    const referents = Array.isArray(value.referents) ? value.referents.map((referent) => {
      const item = objectValue(referent)
      return { marker: stringValue(item.marker), entityId: stringValue(item.entityId), evidence: stringValue(item.evidence) }
    }) : undefined
    return {
      setId: expected.setId, csatItemId: expected.csatItemId, questionId,
      slot: stringValue(value.slot) || expected.question.csatSlot || expected.templateId,
      predictedAnswerIndex: numberValue(value.predictedAnswerIndex), confidence: numberValue(value.confidence),
      choiceAssessments: choices, evidence: Array.isArray(value.evidence) ? value.evidence.map(stringValue).filter(Boolean) : [],
      explanationConsistent: value.explanationConsistent === true, explanationNote: stringValue(value.explanationNote),
      strongestDistractorIndex: value.strongestDistractorIndex == null ? undefined : numberValue(value.strongestDistractorIndex), referents,
    }
  })
  if (seen.size !== source.questions.length) throw new Error('일부 문항의 검증 결과가 누락되었습니다.')

  const findings: CsatVerificationFinding[] = []
  reviews.forEach((review) => {
    const expected = sourceByQuestion.get(review.questionId)!
    if (review.predictedAnswerIndex !== expected.question.answerIndex) findings.push(findingFor(expected, '정답 불일치', `검증 AI는 ${review.predictedAnswerIndex}번을 정답으로 판단했지만 기존 정답은 ${expected.question.answerIndex}번입니다.`, review.evidence.join(' / '), '정답과 모든 선지를 다시 검토해 단일 정답을 확정한다.'))
    if (review.choiceAssessments.filter((assessment) => assessment.verdict === 'correct' || assessment.verdict === 'ambiguous').length !== 1) findings.push(findingFor(expected, '정답 유일성', '정답 또는 애매한 선지가 하나로 확정되지 않습니다.', review.choiceAssessments.map((assessment) => `${assessment.choiceIndex}:${assessment.verdict}`).join(', '), '복수로 성립하는 선지를 수정해 정답을 하나로 만든다.'))
    if (!review.explanationConsistent) findings.push(findingFor(expected, '해설 불일치', review.explanationNote || '해설과 독립 풀이 결과가 일치하지 않습니다.', review.evidence.join(' / '), '정답 근거를 다시 확인해 해설과 근거 인용을 수정한다.'))
    if (review.confidence < 0.7) findings.push(findingFor(expected, '낮은 검증 확신도', `검증 확신도가 ${review.confidence}입니다.`, review.explanationNote, '정답 근거와 오답 배제 근거를 더 명확하게 만든다.', 'warning'))
    if (review.slot === '44') {
      const counts = new Map<string, number>()
      ;(review.referents ?? []).forEach((referent) => counts.set(referent.entityId, (counts.get(referent.entityId) ?? 0) + 1))
      const distribution = [...counts.values()].sort((a, b) => b - a)
      if ((review.referents?.length ?? 0) !== 5 || distribution.length !== 2 || distribution[0] !== 4 || distribution[1] !== 1) findings.push(findingFor(expected, '지칭 4:1 구조 오류', '44번의 다섯 지칭 표식이 네 개의 동일 대상과 하나의 다른 대상 구조가 아닙니다.', (review.referents ?? []).map((referent) => `${referent.marker}:${referent.entityId}`).join(', '), '네 표식은 같은 인물, 한 표식만 다른 인물을 가리키도록 지문과 해설을 함께 수정한다.'))
    }
  })
  const rawFindings = Array.isArray(root.findings) ? root.findings : []
  rawFindings.forEach((raw) => {
    const value = objectValue(raw)
    const expected = sourceByQuestion.get(stringValue(value.questionId))
    if (!expected) return
    findings.push(findingFor(expected, stringValue(value.category) || 'AI 검증 권고', stringValue(value.summary), stringValue(value.evidence), stringValue(value.suggestedRepair), stringValue(value.severity) === 'warning' ? 'warning' : 'error'))
  })
  return { ...run, importedAt: new Date().toISOString(), overallSummary: stringValue(root.overallSummary), questionReviews: reviews, findings, status: findings.length ? 'needs-review' : 'complete' }
}

export function updateVerificationFinding(run: CsatVerificationRun, findingId: string, decision: VerificationDecision, userNote = '') {
  const findings = run.findings.map((finding) => finding.id === findingId ? { ...finding, decision, userNote } : finding)
  const pending = findings.some((finding) => finding.decision === 'defer')
  return { ...run, findings, status: pending ? 'needs-review' as const : 'complete' as const }
}

export function generateVerificationRepairPrompt(run: CsatVerificationRun, set: EnglishQuestionSet) {
  const approved = run.findings.filter((finding) => finding.decision === 'approve' || finding.decision === 'revise')
  if (!approved.length && !run.overallUserNote.trim()) throw new Error('수정에 반영할 권고나 사용자 의견이 없습니다.')
  const instructions = approved.map((finding) => `- ${finding.slot}번 · ${finding.category}: ${finding.decision === 'revise' ? finding.userNote : finding.suggestedRepair}`).join('\n')
  return `[VERIFICATION_REPAIR]\n아래 수능형 영어 세트 JSON을 승인된 검증 의견에 따라서만 수정하라. 제외하거나 보류한 의견은 반영하지 말고, 지정되지 않은 문항과 지문은 보존하라. 설명이나 마크다운 없이 기존 다중 items JSON 구조의 최종 JSON 하나만 반환하라.\n\n[세트/카드 식별]\nsetId: ${set.id}\nitemIds: ${getCsatItems(set).map((item) => item.id).join(', ')}\n\n[승인된 문항별 수정]\n${instructions || '- 없음'}\n\n[사용자 전체 메모]\n${run.overallUserNote.trim() || '- 없음'}\n\n[현재 JSON]\n${set.lastImportedJson || JSON.stringify({ title: set.title, items: getCsatItems(set) }, null, 2)}`
}

export function verificationDisplayStatus(target: VerificationTarget, runs: CsatVerificationRun[] | undefined, bundle: StudioBundle): VerificationDisplayStatus {
  const latest = [...(runs ?? [])].filter((run) => run.scope === target.scope && run.targetId === target.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
  if (!latest) return 'unverified'
  try {
    if (fingerprintSource(sourceForTarget(target, bundle)) !== latest.sourceFingerprint) return 'stale'
  } catch { return 'stale' }
  return latest.status
}
