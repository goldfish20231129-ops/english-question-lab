import { getCsatItems } from './csat'
import type { EnglishQuestion, EnglishQuestionSet } from './types'

export const EXPLANATION_SCHEMA_ID = 'english-question-lab-explanation-v1' as const

export type ExplanationStatus = 'not-ready' | 'not-generated' | 'partial' | 'complete' | 'stale'

function cleanJson(raw: string) {
  const trimmed = raw.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  return fenced ? fenced[1] : trimmed
}

function cleanStrings(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean) : []
}

function questionsForSet(set: EnglishQuestionSet) {
  return set.mode === 'csat' ? getCsatItems(set).flatMap((item) => item.questions) : set.questions
}

function explanationSource(set: EnglishQuestionSet) {
  const questions = questionsForSet(set).map((question) => ({
    questionId: question.id,
    type: question.type,
    stem: question.stem,
    choices: question.choices,
    answerIndex: question.answerIndex,
    score: question.score ?? 2,
    schoolSummaryText: question.schoolSummaryText ?? null,
  }))
  if (set.mode === 'csat') {
    return {
      setId: set.id,
      title: set.title,
      mode: set.mode,
      items: getCsatItems(set).map((item) => ({
        itemId: item.id,
        materialTitle: item.materialTitle,
        material: item.material,
        materialSpec: item.materialSpec ?? null,
        questions: questions.filter((question) => item.questions.some((candidate) => candidate.id === question.questionId)),
      })),
    }
  }
  return {
    setId: set.id,
    title: set.title,
    mode: set.mode,
    materialTitle: set.materialTitle,
    material: set.material,
    materialSpec: set.materialSpec ?? null,
    providedPassageOperations: set.providedPassageV02?.results ?? set.providedPassage?.result ?? null,
    questions,
  }
}

function stableFingerprint(value: unknown) {
  const text = JSON.stringify(value)
  let hash = 0x811c9dc5
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}`
}

export function explanationSourceFingerprint(set: EnglishQuestionSet) {
  return stableFingerprint(explanationSource(set))
}

export function questionHasCompleteExplanation(question: EnglishQuestion) {
  return Boolean(question.explanation.trim() && question.intention.trim() && question.evidenceRefs.length && question.distractorReasons.length >= Math.max(1, question.choices.length - 1))
}

export function explanationStatus(set: EnglishQuestionSet): ExplanationStatus {
  const questions = questionsForSet(set)
  if (!set.aiRevision || !questions.length || questions.some((question) => !question.stem.trim() || question.choices.some((choice) => !choice.trim()))) return 'not-ready'
  const completed = questions.filter(questionHasCompleteExplanation).length
  if (!completed) return 'not-generated'
  if (set.explanationSourceFingerprint && set.explanationSourceFingerprint !== explanationSourceFingerprint(set)) return 'stale'
  return completed === questions.length ? 'complete' : 'partial'
}

export const EXPLANATION_STATUS_LABELS: Record<ExplanationStatus, string> = {
  'not-ready': '문제·정답 생성 전',
  'not-generated': '해설 생성 전',
  partial: '일부 해설만 있음',
  complete: '해설 완성',
  stale: '문제 수정 후 재생성 필요',
}

export function generateExplanationPrompt(set: EnglishQuestionSet) {
  const status = explanationStatus(set)
  if (status === 'not-ready') throw new Error('먼저 문제·선지·정답 JSON을 가져와 문제지를 완성해 주세요.')
  const sourceFingerprint = explanationSourceFingerprint(set)
  const payload = explanationSource(set)
  return `[EXPLANATION_GENERATION_V1]
당신은 완성된 영어 객관식 문제의 해설 작성자다. 아래 문제를 바꾸지 말고 해설 정보만 작성한다.

[절대 규칙]
- 지문, 문항 유형, 발문, 선지, 정답 번호, 배점, ID를 수정하지 않는다.
- 선언된 정답을 지문과 모든 선지로 다시 확인한 뒤 해설을 쓴다.
- 정답이 없거나 복수 정답 가능성이 있으면 임의로 정답을 고치지 말고 explanation 첫머리에 "[정답 충돌 확인 필요]"를 표시한다.
- evidenceRefs는 지문에 실제로 존재하는 결정적 문장이나 구절을 직접 인용한다.
- distractorReasons는 정답을 제외한 각 오답의 번호와 틀린 이유를 순서대로 기록한다. 예: "② 범위를 과도하게 확대했다."
- 설명이나 마크다운 없이 아래 형식의 유효한 JSON 객체 하나만 반환한다.

[응답 식별 정보]
- schemaId: ${EXPLANATION_SCHEMA_ID}
- setId: ${set.id}
- sourceRevision: ${set.aiRevision}
- sourceFingerprint: ${sourceFingerprint}

[출력 JSON]
{"schemaId":"${EXPLANATION_SCHEMA_ID}","setId":"${set.id}","sourceRevision":${set.aiRevision},"sourceFingerprint":"${sourceFingerprint}","explanations":[{"questionId":"원본 questionId","explanation":"정답을 도출하는 독해 과정과 근거","intention":"이 문항이 평가하는 능력","evidenceRefs":["지문의 실제 직접 인용"],"distractorReasons":["오답 번호와 이유"]}]}

[완성된 문제·정답 원본]
${JSON.stringify(payload, null, 2)}`
}

function parseExplanationRecord(value: unknown, question: EnglishQuestion, index: number) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`해설 ${index + 1}번 형식이 올바르지 않습니다.`)
  const record = value as Record<string, unknown>
  if (record.questionId !== question.id) throw new Error(`해설 ${index + 1}번 questionId가 현재 문항과 일치하지 않습니다.`)
  const explanation = typeof record.explanation === 'string' ? record.explanation.trim() : ''
  const intention = typeof record.intention === 'string' ? record.intention.trim() : ''
  const evidenceRefs = cleanStrings(record.evidenceRefs)
  const distractorReasons = cleanStrings(record.distractorReasons)
  if (!explanation || !intention) throw new Error(`${index + 1}번 문항의 explanation과 intention은 비어 있을 수 없습니다.`)
  if (!evidenceRefs.length) throw new Error(`${index + 1}번 문항에는 최소 한 개의 정답 근거가 필요합니다.`)
  if (distractorReasons.length < Math.max(1, question.choices.length - 1)) throw new Error(`${index + 1}번 문항에는 정답을 제외한 모든 오답 이유가 필요합니다.`)
  return { explanation, intention, evidenceRefs, distractorReasons }
}

export function parseExplanationJson(raw: string, base: EnglishQuestionSet): EnglishQuestionSet {
  let parsed: unknown
  try { parsed = JSON.parse(cleanJson(raw)) } catch (error) { throw new Error(`해설 JSON 문법 오류입니다. (${error instanceof Error ? error.message : 'JSON을 확인해 주세요.'})`, { cause: error }) }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('해설 JSON 최상위 값은 객체여야 합니다.')
  const root = parsed as Record<string, unknown>
  if (root.schemaId !== EXPLANATION_SCHEMA_ID) throw new Error(`해설 JSON의 schemaId는 ${EXPLANATION_SCHEMA_ID}이어야 합니다.`)
  if (root.setId !== base.id) throw new Error('해설 JSON의 setId가 현재 세트와 다릅니다.')
  if (root.sourceRevision !== base.aiRevision) throw new Error(`해설 JSON은 문제 결과 v${root.sourceRevision ?? '-'}용이지만 현재 문제는 v${base.aiRevision}입니다.`)
  const expectedFingerprint = explanationSourceFingerprint(base)
  if (root.sourceFingerprint !== expectedFingerprint) throw new Error('해설 JSON의 문제 원본 fingerprint가 현재 지문·선지·정답과 다릅니다.')
  if (!Array.isArray(root.explanations)) throw new Error('해설 JSON에는 explanations 배열이 필요합니다.')
  const questions = questionsForSet(base)
  if (root.explanations.length !== questions.length) throw new Error(`현재 ${questions.length}개 문항의 해설을 모두 반환해야 합니다.`)
  const records = root.explanations as Array<Record<string, unknown>>
  const ids = records.map((record) => typeof record?.questionId === 'string' ? record.questionId : '')
  if (ids.some((id) => !id) || new Set(ids).size !== ids.length) throw new Error('해설 JSON의 questionId가 비어 있거나 중복되었습니다.')
  const recordById = new Map(records.map((record) => [String(record.questionId), record]))
  const updates = new Map(questions.map((question, index) => {
    const record = recordById.get(question.id)
    if (!record) throw new Error(`현재 문항의 해설이 누락되었습니다: ${question.id}`)
    return [question.id, parseExplanationRecord(record, question, index)]
  }))
  const patchQuestion = (question: EnglishQuestion) => ({ ...question, ...updates.get(question.id) })
  const next = base.mode === 'csat'
    ? { ...base, csatItems: getCsatItems(base).map((item) => ({ ...item, questions: item.questions.map(patchQuestion) })) }
    : { ...base, questions: base.questions.map(patchQuestion) }
  return { ...next, explanationSourceFingerprint: expectedFingerprint, updatedAt: new Date().toISOString() }
}
