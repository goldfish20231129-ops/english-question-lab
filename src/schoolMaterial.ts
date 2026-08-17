import type { CsatMaterialSpec, EnglishQuestion, EnglishQuestionSet } from './types'
import { allocateSchoolMarkerLabels, schoolMarkerRange, SCHOOL_NUMERIC_MARKER_LABELS } from './schoolMarkerLabels'

const INSERTION_SENTENCE_MARKUP = /\[\[삽입문장(?::[^\]]*)?\]\]\s*/g
const INSERTION_POSITION_MARKUP = /\s*\[\[삽입위치(?::[^\]]*)?\]\]/g
const CAPTURED_INSERTION_SENTENCE_MARKUP = /\[\[삽입문장:([^\]]+)\]\]/g
const CAPTURED_INSERTION_POSITION_MARKUP = /\[\[삽입위치:([^\]]+)\]\]/g
const INSERTION_POSITIONS = SCHOOL_NUMERIC_MARKER_LABELS

export function isGeneratedSchoolSet(set: EnglishQuestionSet) {
  return set.mode === 'school' && set.materialMode === 'generated' && !set.providedPassageV02
}

export function isSchoolInsertionQuestion(question: EnglishQuestion) {
  return question.type === '문장 삽입'
}

export function isSchoolSummaryQuestion(question: EnglishQuestion) {
  return question.type === '요약문 완성'
}

export function orderedGeneratedSchoolQuestions(set: EnglishQuestionSet) {
  if (!isGeneratedSchoolSet(set)) return set.questions
  if (set.schoolInsertionPresentation === 'shared') return set.questions
  const regular = set.questions.filter((question) => !isSchoolInsertionQuestion(question))
  const insertion = set.questions.filter(isSchoolInsertionQuestion)
  return [...regular, ...insertion]
}

export function orderedSchoolQuestions(set: EnglishQuestionSet) {
  if (set.mode !== 'school' || (!isGeneratedSchoolSet(set) && !set.providedPassageV02)) return set.questions
  if (set.schoolInsertionPresentation === 'shared') return set.questions
  const regular = set.questions.filter((question) => !isSchoolInsertionQuestion(question))
  const insertion = set.questions.filter(isSchoolInsertionQuestion)
  return [...regular, ...insertion]
}

function isInlineSchoolMarkerQuestion(set: EnglishQuestionSet, question: EnglishQuestion) {
  if (isSchoolInsertionQuestion(question) && (isGeneratedSchoolSet(set) || Boolean(set.providedPassageV02))) return true
  if (question.schoolTemplateId === 'grammar-error') return true
  const plan = set.providedPassageV02?.itemPlans.find((item) => item.itemId === question.id)
  return question.type === '어법' && plan?.questionType === 'grammar' && plan.grammarMode === 'controlled_error_variant'
}

export function schoolInlineMarkerQuestionIds(set: EnglishQuestionSet) {
  if (set.mode !== 'school') return []
  return orderedSchoolQuestions(set).filter((question) => isInlineSchoolMarkerQuestion(set, question)).map((question) => question.id)
}

export function schoolInlineChoiceLabels(set: EnglishQuestionSet, question: EnglishQuestion) {
  return allocateSchoolMarkerLabels(schoolInlineMarkerQuestionIds(set), question.id)
}

export function schoolQuestionDisplayStem(set: EnglishQuestionSet, question: EnglishQuestion) {
  if (!isInlineSchoolMarkerQuestion(set, question)) return question.stem
  const range = schoolMarkerRange(schoolInlineChoiceLabels(set, question))
  const english = question.schoolStemLanguage === 'en'
  const fallback = isSchoolInsertionQuestion(question)
    ? english
      ? 'Which position is the most appropriate for the given sentence?'
      : '글의 흐름으로 보아, 주어진 문장이 들어가기에 가장 적절한 곳은?'
    : english
      ? 'Which of the underlined parts is grammatically incorrect?'
      : '다음 글의 밑줄 친 부분 중, 어법상 틀린 것은?'
  const stem = question.stem.trim() || fallback
  if (stem.includes(range)) return stem
  return `${stem} (${english ? 'Choice symbols' : '선택 기호'}: ${range})`
}

function relabelGeneratedSchoolInsertionBody(set: EnglishQuestionSet, body: string) {
  const insertion = orderedSchoolQuestions(set).find(isSchoolInsertionQuestion)
  if (!insertion) return body
  const labels = schoolInlineChoiceLabels(set, insertion)
  let positionIndex = 0
  return body.replace(CAPTURED_INSERTION_POSITION_MARKUP, () => `[[삽입위치:${labels[positionIndex++] ?? labels.at(-1)}]]`)
}

function relabelGeneratedSchoolGrammarTargets(set: EnglishQuestionSet, text: string) {
  const grammar = orderedSchoolQuestions(set).find((question) => question.schoolTemplateId === 'grammar-error')
  if (!grammar || schoolInlineMarkerQuestionIds(set).length < 2) return text
  const labels = schoolInlineChoiceLabels(set, grammar)
  let targetIndex = 0
  return text.replace(/(?:[①②③④⑤㉠㉡㉢㉣㉤ⓐⓑⓒⓓⓔⒶⒷⒸⒹⒺㄱㄴㄷㄹㅁa-eA-E]\s*)?\[\[밑줄:([^\]]+)\]\]/g, (_match, target: string) => {
    const label = labels[targetIndex++]
    return label ? `${label} [[밑줄:${target}]]` : `[[밑줄:${target}]]`
  })
}

export function relabelGeneratedSchoolSharedMaterial(set: EnglishQuestionSet, text: string) {
  return relabelGeneratedSchoolGrammarTargets(set, relabelGeneratedSchoolInsertionBody(set, text))
}

export function usesQuestionScopedSchoolMaterial(set: EnglishQuestionSet) {
  if (!isGeneratedSchoolSet(set)) return false
  const hasIsolatedInsertion = set.schoolInsertionPresentation !== 'shared' && set.questions.some(isSchoolInsertionQuestion)
  return hasIsolatedInsertion || set.questions.some(isSchoolSummaryQuestion)
}

function hasGeneratedSchoolInsertion(set: EnglishQuestionSet) {
  return isGeneratedSchoolSet(set) && set.questions.some(isSchoolInsertionQuestion)
}

export function cleanInsertionMarkupForOtherQuestion(text: string) {
  return text.replace(INSERTION_SENTENCE_MARKUP, '').replace(INSERTION_POSITION_MARKUP, '').replace(/[ \t]{2,}/g, ' ').trim()
}

export function generatedSchoolSharedMaterialPresentation(set: EnglishQuestionSet): { text: string; spec?: CsatMaterialSpec } | undefined {
  if (hasGeneratedSchoolInsertion(set) && set.schoolInsertionPresentation === 'shared') {
    const spec = deriveGeneratedSchoolInsertionSpec(set)
    return spec ? { text: '', spec } : { text: relabelGeneratedSchoolSharedMaterial(set, set.material), spec: set.materialSpec }
  }
  if (!usesQuestionScopedSchoolMaterial(set) || !set.questions.some((question) => !isSchoolInsertionQuestion(question))) return undefined
  if (set.materialSpec?.kind === 'insertion') return { text: relabelGeneratedSchoolSharedMaterial(set, cleanInsertionMarkupForOtherQuestion(set.materialSpec.body)) }
  return { text: relabelGeneratedSchoolSharedMaterial(set, cleanInsertionMarkupForOtherQuestion(set.material)) }
}

export function deriveGeneratedSchoolInsertionSpec(set: EnglishQuestionSet): Extract<CsatMaterialSpec, { kind: 'insertion' }> | undefined {
  if (!hasGeneratedSchoolInsertion(set)) return undefined
  if (set.materialSpec?.kind === 'insertion') return { ...set.materialSpec, body: relabelGeneratedSchoolSharedMaterial(set, set.materialSpec.body) }
  const sentences = [...set.material.matchAll(CAPTURED_INSERTION_SENTENCE_MARKUP)]
  if (sentences.length !== 1) return undefined
  const body = set.material.replace(CAPTURED_INSERTION_SENTENCE_MARKUP, '').replace(/[ \t]{2,}/g, ' ').trim()
  return { kind: 'insertion', givenSentence: sentences[0][1].trim(), body: relabelGeneratedSchoolSharedMaterial(set, body) }
}

export function generatedSchoolInsertionMarkupIssues(set: EnglishQuestionSet) {
  if (!hasGeneratedSchoolInsertion(set)) return []
  const sentenceCount = set.materialSpec?.kind === 'insertion'
    ? Number(Boolean(set.materialSpec.givenSentence.trim()))
    : [...set.material.matchAll(CAPTURED_INSERTION_SENTENCE_MARKUP)].length
  const body = set.materialSpec?.kind === 'insertion' ? set.materialSpec.body : set.material
  const positions = [...body.matchAll(CAPTURED_INSERTION_POSITION_MARKUP)].map((match) => match[1])
  const insertionQuestion = orderedSchoolQuestions(set).find(isSchoolInsertionQuestion)
  const expectedPositions = insertionQuestion ? schoolInlineChoiceLabels(set, insertionQuestion) : [...INSERTION_POSITIONS]
  const issues: string[] = []
  if (sentenceCount !== 1) issues.push(`삽입 문장 표식이 ${sentenceCount}개입니다. 정확히 1개가 필요합니다.`)
  const isExpected = positions.length === expectedPositions.length && expectedPositions.every((position, index) => positions[index] === position)
  const isLegacy = positions.length === INSERTION_POSITIONS.length && INSERTION_POSITIONS.every((position, index) => positions[index] === position)
  if (!isExpected && !isLegacy) {
    issues.push(`삽입 위치는 ${expectedPositions.map((position) => `[[삽입위치:${position}]]`).join(', ')}를 순서대로 각각 한 번씩 사용해야 합니다.`)
  }
  return issues
}

export function usesInlineSchoolChoices(set: EnglishQuestionSet | undefined, question: EnglishQuestion) {
  if (!set || set.mode !== 'school') return false
  return isInlineSchoolMarkerQuestion(set, question)
}

export function usesInlineGeneratedSchoolChoices(set: EnglishQuestionSet | undefined, question: EnglishQuestion) {
  return Boolean(set && usesQuestionScopedSchoolMaterial(set) && isSchoolInsertionQuestion(question))
}

export function schoolQuestionMaterialPresentation(set: EnglishQuestionSet, question: EnglishQuestion): { text: string; spec?: CsatMaterialSpec } {
  if (isSchoolSummaryQuestion(question)) {
    const summary = question.schoolSummaryText ?? (set.materialSpec?.kind === 'summary' ? set.materialSpec.summary : '')
    return summary ? { text: '', spec: { kind: 'summary', summary } } : { text: '' }
  }
  if (set.schoolInsertionPresentation === 'shared') return { text: '' }
  if (!usesQuestionScopedSchoolMaterial(set)) return { text: set.material, spec: set.materialSpec }
  if (isSchoolInsertionQuestion(question)) {
    const spec = deriveGeneratedSchoolInsertionSpec(set)
    return spec ? { text: '', spec } : { text: set.material, spec: set.materialSpec }
  }
  return { text: '' }
}
