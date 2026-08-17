import { describe, expect, it } from 'vitest'
import { createEnglishSet } from './english'
import {
  adaptProvidedPassageV02Response,
  buildProvidedPassageV02Request,
  createProvidedPassageV02Plan,
  generateProvidedPassageV02Prompt,
  providedPassageV02PresentationSpec,
  syncProvidedPassageV02Questions,
  transitionSchoolProvidedPassageV02,
} from './providedPassageV02'

const PASSAGE = 'Students compare two explanations before accepting a claim. This comparison helps them notice hidden assumptions. As a result, they revise their conclusions more carefully.'

function configuredSummarySet() {
  const seed = createEnglishSet('school')
  seed.material = PASSAGE
  let set = transitionSchoolProvidedPassageV02(seed, 'provided')
  const plan = createProvidedPassageV02Plan('summary-1', 'summary')
  set = { ...set, providedPassageV02: { ...set.providedPassageV02!, itemPlans: [plan] }, questions: syncProvidedPassageV02Questions(set, [plan]) }
  return set
}

function summaryResponse() {
  const set = configuredSummarySet()
  const request = buildProvidedPassageV02Request(set)
  const item = request.items[0]
  const sentence = request.source.sentences[0]
  return {
    set,
    value: {
      schemaId: 'english-question-lab-provided-passage-generation-v0.2',
      mode: request.mode,
      subject: request.subject,
      sourcePassageId: request.source.sourcePassageId,
      sourceFingerprint: request.source.sourceFingerprint,
      title: '요약문 테스트',
      items: [{
        itemId: item.itemId,
        templateId: item.templateId,
        variantId: item.variantId,
        questionType: item.questionType,
        choiceLanguage: item.choiceLanguage,
        vocabularyLevel: item.vocabularyLevel,
        contentMatchPolarity: item.contentMatchPolarity,
        grammarTarget: item.grammarTarget,
        grammarMode: item.grammarMode,
        question: {
          type: '요약문 완성',
          stem: item.requiredStem,
          summaryText: 'Comparing explanations [[요약빈칸:A]] students to [[요약빈칸:B]] their conclusions.',
          choices: ['encourages|revise', 'prevents|ignore', 'forces|copy', 'allows|avoid', 'teaches|forget'],
          answerIndex: 1,
          evidenceSpans: [{ sentenceId: sentence.id, start: sentence.start, end: sentence.end, text: sentence.text }],
          score: 2,
        },
        materialOperation: null,
      }],
    },
  }
}

describe('Provided Passage V0.2 summary completion', () => {
  it('builds the summary contract with English word-pair choices', () => {
    const set = configuredSummarySet()
    const item = buildProvidedPassageV02Request(set).items[0]
    expect(item).toMatchObject({ questionType: 'summary', templateId: 'school-summary', choiceLanguage: 'en' })
    expect(item.requiredStem).toContain('(A)와 (B)')
    expect(generateProvidedPassageV02Prompt(set)).toContain('question.summaryText')
  })

  it('imports and presents a separate A-B summary box while preserving the shared passage', () => {
    const { set, value } = summaryResponse()
    const next = adaptProvidedPassageV02Response(value, set)
    expect(next.material).toBe(PASSAGE)
    expect(next.questions[0]).toMatchObject({ type: '요약문 완성', schoolTemplateId: 'summary', schoolChoiceLayout: 'matrix' })
    expect(next.questions[0].schoolSummaryText).toContain('[[요약빈칸:A]]')
    expect(providedPassageV02PresentationSpec(next, 'summary-1')).toEqual({ kind: 'summary', summary: next.questions[0].schoolSummaryText })
  })

  it('rejects a summary that omits a required marker or word-pair separator', () => {
    const { set, value } = summaryResponse()
    value.items[0].question.summaryText = 'Comparing explanations helps students revise conclusions.'
    value.items[0].question.choices[0] = 'encourages'
    expect(() => adaptProvidedPassageV02Response(value, set)).toThrow(/요약문에는/)
  })
})
