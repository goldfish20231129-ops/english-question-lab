import { getCsatItems } from './csat'
import { schoolInlineChoiceLabels, usesInlineSchoolChoices } from './schoolMaterial'
import type { EnglishQuestion, EnglishQuestionSet, ProvidedPassageInsertionOperation } from './types'

export const EXPLANATION_SCHEMA_ID = 'english-question-lab-explanation-v1' as const
const PROVIDED_PASSAGE_GENERATION_SCHEMA_ID = 'english-question-lab-provided-passage-generation-v0.2' as const
const INTERNAL_BOUNDARY_ID_PATTERN = /\bb\d+\b/i

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
    choices: explanationMarkerLabels(set, question),
    answerIndex: question.answerIndex,
    score: question.score ?? 2,
    schoolSummaryText: question.schoolSummaryText ?? null,
    schoolStemLanguage: question.schoolStemLanguage ?? null,
    schoolChoiceLanguage: question.schoolChoiceLanguage ?? null,
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

function insertionOperationForQuestion(set: EnglishQuestionSet, questionId: string): ProvidedPassageInsertionOperation | undefined {
  const current = set.providedPassageV02?.results?.find((result) => result.itemId === questionId)?.materialOperation
  if (current?.kind === 'insert_sentence') return current
  const legacy = set.providedPassage?.result?.materialOperation
  return set.questions.some((question) => question.id === questionId) && legacy?.kind === 'insert_sentence' ? legacy : undefined
}

function explanationMarkerLabels(set: EnglishQuestionSet, question: EnglishQuestion) {
  return usesInlineSchoolChoices(set, question) ? schoolInlineChoiceLabels(set, question) : question.choices
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
  const markerRules = questionsForSet(set).filter((question) => usesInlineSchoolChoices(set, question)).map((question) => `- ${question.id} (${question.type}): ${JSON.stringify(explanationMarkerLabels(set, question))}`).join('\n')
  return `[EXPLANATION_GENERATION_V1]
당신은 완성된 영어 객관식 문제의 해설 작성자다. 아래 문제를 바꾸지 말고 해설 정보만 작성한다.

[절대 규칙]
- 지문, 문항 유형, 발문, 선지, 정답 번호, 배점, ID를 수정하지 않는다.
- 선언된 정답을 지문과 모든 선지로 다시 확인한 뒤 해설을 쓴다.
- 정답이 없거나 복수 정답 가능성이 있으면 임의로 정답을 고치지 말고 explanation 첫머리에 "[정답 충돌 확인 필요]"를 표시한다.
- evidenceRefs는 지문에 실제로 존재하는 결정적 문장이나 구절을 직접 인용한다.
- distractorReasons는 정답을 제외한 각 오답의 실제 표시 기호와 틀린 이유를 순서대로 기록한다. 일반 내용 선지는 ①~⑤를 쓰고, 아래 표식형 문항은 배정된 기호를 그대로 쓴다.
- 같은 지문에 표식형 문항이 둘 이상이면 서로 다른 기호군을 사용한다. 현재 문항별 학생 표시 기호는 다음과 같다.
${markerRules || '- 별도 표식형 문항 없음'}
- 문장 삽입을 해설하기 전에 candidateBoundaryIds와 answerBoundaryId를 대조한다. answerBoundaryId가 후보 배열에서 몇 번째인지 계산한 뒤 해당 문항에 배정된 기호 배열의 같은 순번을 사용한다.
- boundary ID의 숫자를 위치 기호로 직접 변환하지 않는다. 예를 들어 후보가 ["b3","b4","b5","b6","b7"], 정답이 "b5", 표시 기호가 ["a","b","c","d","e"]이면 사용자용 정답은 c이다.
- 표식형 문항이 하나뿐이라 choices가 ["①","②","③","④","⑤"]인 기존 방식에서는 ["b3","b4","b5","b6","b7"]이고 정답이 "b5"이면 사용자용 정답은 ③이다.
- candidateBoundaryIds, answerBoundaryId, positionReasons[].boundaryId는 내부 구조화 데이터이므로 수정하지 않는다.
- explanation, intention, evidenceRefs의 설명성 문장과 distractorReasons에는 b0, b3 같은 내부 boundary ID를 절대 출력하지 않는다. 오답 이유에는 정답 위치를 제외한 해당 문항의 실제 표시 기호를 사용한다.
- 최종 출력 전에 모든 사용자용 문자열에 b숫자가 남지 않았는지, 정답 기호가 answerBoundaryId의 후보 배열 순서와 일치하는지, answerIndex와 answerBoundaryId가 같은 위치를 가리키는지 자체 검사한다.
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

function parseExplanationRecord(value: unknown, question: EnglishQuestion, index: number, insertionOperation?: ProvidedPassageInsertionOperation, positionLabels: string[] = question.choices) {
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
  if (insertionOperation) {
    const answerPosition = insertionOperation.candidateBoundaryIds.indexOf(insertionOperation.answerBoundaryId)
    if (insertionOperation.candidateBoundaryIds.length !== 5 || answerPosition < 0) throw new Error(`${index + 1}번 문장 삽입 문항의 내부 후보 경계가 올바르지 않습니다.`)
    if (question.answerIndex !== answerPosition + 1) throw new Error(`${index + 1}번 문장 삽입 문항의 answerIndex와 answerBoundaryId가 같은 위치를 가리키지 않습니다.`)
    const userFacingStrings = [explanation, intention, ...evidenceRefs, ...distractorReasons]
    if (userFacingStrings.some((text) => INTERNAL_BOUNDARY_ID_PATTERN.test(text))) throw new Error(`${index + 1}번 문장 삽입 해설의 사용자용 문자열에 내부 boundary ID가 남아 있습니다. ${positionLabels.join('·')} 기호를 사용해 주세요.`)
    const answerLabel = positionLabels[answerPosition]
    if (!explanation.includes(answerLabel)) throw new Error(`${index + 1}번 문장 삽입 explanation에는 정답 위치 ${answerLabel}를 표시해야 합니다.`)
    const distractorLabels = positionLabels.filter((_, position) => position !== answerPosition)
    if (distractorLabels.some((label) => !distractorReasons.some((reason) => reason.includes(label)))) throw new Error(`${index + 1}번 문장 삽입 오답 이유에는 정답을 제외한 각 ${positionLabels.join('·')} 위치 기호가 필요합니다.`)
  }
  return { explanation, intention, evidenceRefs, distractorReasons }
}

export function parseExplanationJson(raw: string, base: EnglishQuestionSet): EnglishQuestionSet {
  const cleaned = cleanJson(raw)
  if (new RegExp(`"schemaId"\\s*:\\s*"${PROVIDED_PASSAGE_GENERATION_SCHEMA_ID.replaceAll('.', '\\.')}"`).test(cleaned)) {
    throw new Error('붙여넣은 값은 해설 JSON이 아니라 1차 문항·정답 JSON입니다. 이 결과는 4번 문항·정답 가져오기에 넣고, 5번에는 [EXPLANATION_GENERATION_V1] 프롬프트의 결과만 넣어 주세요.')
  }
  let parsed: unknown
  try { parsed = JSON.parse(cleaned) } catch (error) { throw new Error(`해설 JSON 문법 오류입니다. JSON 문자열 안의 인용에는 ‘ ’를 사용하거나 큰따옴표를 \\"처럼 이스케이프해야 합니다. (${error instanceof Error ? error.message : 'JSON을 확인해 주세요.'})`, { cause: error }) }
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
    return [question.id, parseExplanationRecord(record, question, index, insertionOperationForQuestion(base, question.id), explanationMarkerLabels(base, question))]
  }))
  const patchQuestion = (question: EnglishQuestion) => ({ ...question, ...updates.get(question.id) })
  const next = base.mode === 'csat'
    ? { ...base, csatItems: getCsatItems(base).map((item) => ({ ...item, questions: item.questions.map(patchQuestion) })) }
    : { ...base, questions: base.questions.map(patchQuestion) }
  return { ...next, explanationSourceFingerprint: expectedFingerprint, updatedAt: new Date().toISOString() }
}
