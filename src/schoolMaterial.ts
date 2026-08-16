import type { CsatMaterialSpec, EnglishQuestion, EnglishQuestionSet } from './types'

const INSERTION_SENTENCE_MARKUP = /\[\[삽입문장(?::[^\]]*)?\]\]\s*/g
const INSERTION_POSITION_MARKUP = /\s*\[\[삽입위치(?::[^\]]*)?\]\]/g
const CAPTURED_INSERTION_SENTENCE_MARKUP = /\[\[삽입문장:([^\]]+)\]\]/g
const CAPTURED_INSERTION_POSITION_MARKUP = /\[\[삽입위치:([^\]]+)\]\]/g
const INSERTION_POSITIONS = ['①', '②', '③', '④', '⑤'] as const

export function isGeneratedSchoolSet(set: EnglishQuestionSet) {
  return set.mode === 'school' && set.materialMode === 'generated'
}

export function isSchoolInsertionQuestion(question: EnglishQuestion) {
  return question.type === '문장 삽입'
}

export function orderedGeneratedSchoolQuestions(set: EnglishQuestionSet) {
  if (!isGeneratedSchoolSet(set)) return set.questions
  const regular = set.questions.filter((question) => !isSchoolInsertionQuestion(question))
  const insertion = set.questions.filter(isSchoolInsertionQuestion)
  return [...regular, ...insertion]
}

export function orderedSchoolQuestions(set: EnglishQuestionSet) {
  if (set.mode !== 'school' || (!isGeneratedSchoolSet(set) && !set.providedPassageV02)) return set.questions
  const regular = set.questions.filter((question) => !isSchoolInsertionQuestion(question))
  const insertion = set.questions.filter(isSchoolInsertionQuestion)
  return [...regular, ...insertion]
}

export function usesQuestionScopedSchoolMaterial(set: EnglishQuestionSet) {
  return isGeneratedSchoolSet(set) && set.questions.some(isSchoolInsertionQuestion)
}

export function cleanInsertionMarkupForOtherQuestion(text: string) {
  return text.replace(INSERTION_SENTENCE_MARKUP, '').replace(INSERTION_POSITION_MARKUP, '').replace(/[ \t]{2,}/g, ' ').trim()
}

export function generatedSchoolSharedMaterialPresentation(set: EnglishQuestionSet): { text: string; spec?: CsatMaterialSpec } | undefined {
  if (!usesQuestionScopedSchoolMaterial(set) || !set.questions.some((question) => !isSchoolInsertionQuestion(question))) return undefined
  if (set.materialSpec?.kind === 'insertion') return { text: cleanInsertionMarkupForOtherQuestion(set.materialSpec.body) }
  return { text: cleanInsertionMarkupForOtherQuestion(set.material) }
}

export function deriveGeneratedSchoolInsertionSpec(set: EnglishQuestionSet): Extract<CsatMaterialSpec, { kind: 'insertion' }> | undefined {
  if (!usesQuestionScopedSchoolMaterial(set)) return undefined
  if (set.materialSpec?.kind === 'insertion') return set.materialSpec
  const sentences = [...set.material.matchAll(CAPTURED_INSERTION_SENTENCE_MARKUP)]
  if (sentences.length !== 1) return undefined
  const body = set.material.replace(CAPTURED_INSERTION_SENTENCE_MARKUP, '').replace(/[ \t]{2,}/g, ' ').trim()
  return { kind: 'insertion', givenSentence: sentences[0][1].trim(), body }
}

export function generatedSchoolInsertionMarkupIssues(set: EnglishQuestionSet) {
  if (!usesQuestionScopedSchoolMaterial(set)) return []
  const sentenceCount = set.materialSpec?.kind === 'insertion'
    ? Number(Boolean(set.materialSpec.givenSentence.trim()))
    : [...set.material.matchAll(CAPTURED_INSERTION_SENTENCE_MARKUP)].length
  const body = set.materialSpec?.kind === 'insertion' ? set.materialSpec.body : set.material
  const positions = [...body.matchAll(CAPTURED_INSERTION_POSITION_MARKUP)].map((match) => match[1])
  const issues: string[] = []
  if (sentenceCount !== 1) issues.push(`삽입 문장 표식이 ${sentenceCount}개입니다. 정확히 1개가 필요합니다.`)
  if (positions.length !== INSERTION_POSITIONS.length || INSERTION_POSITIONS.some((position, index) => positions[index] !== position)) {
    issues.push('삽입 위치는 [[삽입위치:①]]부터 [[삽입위치:⑤]]까지 순서대로 각각 한 번씩 필요합니다.')
  }
  return issues
}

export function usesInlineSchoolChoices(set: EnglishQuestionSet | undefined, question: EnglishQuestion) {
  return Boolean(set && set.mode === 'school' && isSchoolInsertionQuestion(question) && (usesQuestionScopedSchoolMaterial(set) || set.providedPassageV02))
}

export function usesInlineGeneratedSchoolChoices(set: EnglishQuestionSet | undefined, question: EnglishQuestion) {
  return Boolean(set && usesQuestionScopedSchoolMaterial(set) && isSchoolInsertionQuestion(question))
}

export function schoolQuestionMaterialPresentation(set: EnglishQuestionSet, question: EnglishQuestion): { text: string; spec?: CsatMaterialSpec } {
  if (!usesQuestionScopedSchoolMaterial(set)) return { text: set.material, spec: set.materialSpec }
  if (isSchoolInsertionQuestion(question)) {
    const spec = deriveGeneratedSchoolInsertionSpec(set)
    return spec ? { text: '', spec } : { text: set.material, spec: set.materialSpec }
  }
  return { text: '' }
}
