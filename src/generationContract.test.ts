import { describe, expect, it } from 'vitest'
import { CSAT_INLINE_POSITION_CHOICES, applyCsatItemTemplate, createCsatItem } from './csat'
import { createEnglishSet, parseEnglishSetJson } from './english'
import type { CsatItemDesign, CsatMaterialSpec, CsatNumberTemplateId, EnglishQuestionSet } from './types'

function configuredSet(...templateIds: CsatNumberTemplateId[]) {
  const set = createEnglishSet('csat')
  set.csatItems = templateIds.map((templateId) => applyCsatItemTemplate(createCsatItem(), templateId))
  return set
}

function validMaterialSpec(templateId: CsatNumberTemplateId): CsatMaterialSpec | null {
  if (templateId === '25') return { kind: 'chart', title: 'Weekly Reading', unit: 'hours', categories: ['A', 'B'], series: [{ name: '2025', values: [2, 3] }] }
  if (templateId === '36' || templateId === '37') return { kind: 'ordered', lead: 'Lead sentence.', sections: [{ label: 'A', text: 'First section.' }, { label: 'B', text: 'Second section.' }, { label: 'C', text: 'Third section.' }] }
  if (templateId === '40') return { kind: 'summary', summary: 'A summary with [[요약빈칸:A]] and [[요약빈칸:B]].' }
  if (templateId === '41-42') return { kind: 'longExpository', paragraphs: ['A shared explanatory passage with five vocabulary targets.'] }
  if (templateId === '43-45') return { kind: 'longNarrative', sections: [{ label: 'A', text: 'First event.' }, { label: 'B', text: 'Second event.' }, { label: 'C', text: 'Third event.' }, { label: 'D', text: 'Final event.' }] }
  return null
}

function validItem(item: CsatItemDesign) {
  const templateId = item.design!.templateId
  const inline = templateId === '35' || templateId === '38' || templateId === '39'
  return {
    itemId: item.id,
    templateId,
    variantId: item.design!.variantId,
    materialTitle: '',
    material: 'A concise synthetic passage supplies direct evidence for the question.',
    materialSpec: validMaterialSpec(templateId),
    questions: item.questions.map((question, index) => ({
      type: question.type,
      stem: question.stem,
      choices: inline ? [...CSAT_INLINE_POSITION_CHOICES] : ['first choice', 'second choice', 'third choice', 'fourth choice', 'fifth choice'],
      answerIndex: (index % 5) + 1,
      explanation: 'The declared answer follows from the supplied evidence.',
      intention: '유형에 맞는 독해 능력을 평가한다.',
      evidenceRefs: ['direct evidence'],
      distractorReasons: ['too broad', 'reversed relation', 'wrong detail', 'irrelevant idea'],
      score: question.score ?? 2,
    })),
    qualityReview: {
      passage: { naturalness: 9, logicStructure: 9, vocabularyLevel: 9, templateFidelity: 9 },
      questions: item.questions.map((question, index) => ({
        slot: question.csatSlot ?? templateId,
        answerInference: 9,
        distractorPlausibility: 9,
        choiceBalance: 9,
        directAnswerOverlap: false,
        strongestDistractorIndex: ((index + 1) % 5) + 1,
        decisiveReason: 'The evidence supports only the declared answer.',
        expectedDifficulty: 3,
      })),
    },
  }
}

function validPayload(set: EnglishQuestionSet) {
  return { title: 'Generation Contract fixture', items: set.csatItems!.map(validItem) }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function firstQuestion(payload: ReturnType<typeof validPayload>) {
  return payload.items[0].questions[0] as Record<string, unknown>
}

describe('수능형 Generation Contract v0 strict import', () => {
  it('valid current generation JSON imports successfully', () => {
    const base = configuredSet('33')
    expect(parseEnglishSetJson(JSON.stringify(validPayload(base)), base).aiRevision).toBe(1)
  })

  it('answerIndex 0 rejected', () => {
    const base = configuredSet('33'); const payload = validPayload(base); firstQuestion(payload).answerIndex = 0
    expect(() => parseEnglishSetJson(JSON.stringify(payload), base)).toThrow(/answerIndex/)
  })

  it('answerIndex 6 rejected', () => {
    const base = configuredSet('33'); const payload = validPayload(base); firstQuestion(payload).answerIndex = 6
    expect(() => parseEnglishSetJson(JSON.stringify(payload), base)).toThrow(/answerIndex/)
  })

  it('answerIndex numeric string rejected', () => {
    const base = configuredSet('33'); const payload = validPayload(base); firstQuestion(payload).answerIndex = '5'
    expect(() => parseEnglishSetJson(JSON.stringify(payload), base)).toThrow(/answerIndex/)
  })

  it('answerIndex circled string rejected', () => {
    const base = configuredSet('33'); const payload = validPayload(base); firstQuestion(payload).answerIndex = '⑤'
    expect(() => parseEnglishSetJson(JSON.stringify(payload), base)).toThrow(/answerIndex/)
  })

  it('missing answerIndex rejected', () => {
    const base = configuredSet('33'); const payload = validPayload(base); delete firstQuestion(payload).answerIndex
    expect(() => parseEnglishSetJson(JSON.stringify(payload), base)).toThrow(/answerIndex|필수 필드 누락/)
  })

  it('decimal answerIndex rejected', () => {
    const base = configuredSet('33'); const payload = validPayload(base); firstQuestion(payload).answerIndex = 2.5
    expect(() => parseEnglishSetJson(JSON.stringify(payload), base)).toThrow(/answerIndex/)
  })

  it('missing explanation rejected', () => {
    const base = configuredSet('33'); const payload = validPayload(base); delete firstQuestion(payload).explanation
    expect(() => parseEnglishSetJson(JSON.stringify(payload), base)).toThrow(/explanation|필수 필드 누락/)
  })

  it('missing evidenceRefs rejected', () => {
    const base = configuredSet('33'); const payload = validPayload(base); delete firstQuestion(payload).evidenceRefs
    expect(() => parseEnglishSetJson(JSON.stringify(payload), base)).toThrow(/evidenceRefs|필수 필드 누락/)
  })

  it('missing distractorReasons rejected', () => {
    const base = configuredSet('33'); const payload = validPayload(base); delete firstQuestion(payload).distractorReasons
    expect(() => parseEnglishSetJson(JSON.stringify(payload), base)).toThrow(/distractorReasons|필수 필드 누락/)
  })

  it('missing qualityReview rejected', () => {
    const base = configuredSet('33'); const payload = validPayload(base); delete (payload.items[0] as Partial<typeof payload.items[0]>).qualityReview
    expect(() => parseEnglishSetJson(JSON.stringify(payload), base)).toThrow(/qualityReview|필수 필드 누락/)
  })

  it('unsupported additional field rejected', () => {
    const base = configuredSet('33'); const payload = validPayload(base); (payload as Record<string, unknown>).unexpected = true
    expect(() => parseEnglishSetJson(JSON.stringify(payload), base)).toThrow(/지원되지 않는 필드.*unexpected/)
  })

  it('unexpected translation field rejected', () => {
    const base = configuredSet('33'); const payload = validPayload(base); (payload.items[0] as Record<string, unknown>).translation = 'unsupported'
    expect(() => parseEnglishSetJson(JSON.stringify(payload), base)).toThrow(/지원되지 않는 필드.*translation/)
  })

  it('wrong question.type rejected', () => {
    const base = configuredSet('33'); const payload = validPayload(base); firstQuestion(payload).type = '제목'
    expect(() => parseEnglishSetJson(JSON.stringify(payload), base)).toThrow(/type.*예상값/)
  })

  it('wrong templateId rejected', () => {
    const base = configuredSet('33'); const payload = validPayload(base); payload.items[0].templateId = '34'
    expect(() => parseEnglishSetJson(JSON.stringify(payload), base)).toThrow(/templateId/)
  })

  it('wrong variantId rejected', () => {
    const base = configuredSet('30'); const payload = validPayload(base); payload.items[0].variantId = 'vocabulary-box'
    expect(() => parseEnglishSetJson(JSON.stringify(payload), base)).toThrow(/variantId/)
  })

  it('duplicate itemId rejected', () => {
    const base = configuredSet('18', '33'); const payload = validPayload(base); payload.items[1].itemId = payload.items[0].itemId
    expect(() => parseEnglishSetJson(JSON.stringify(payload), base)).toThrow(/중복/)
  })

  it('unknown itemId rejected', () => {
    const base = configuredSet('33'); const payload = validPayload(base); payload.items[0].itemId = 'unknown-item'
    expect(() => parseEnglishSetJson(JSON.stringify(payload), base)).toThrow(/알 수 없는 itemId/)
  })

  it('wrong question count rejected', () => {
    const base = configuredSet('41-42'); const payload = validPayload(base); payload.items[0].questions.pop()
    expect(() => parseEnglishSetJson(JSON.stringify(payload), base)).toThrow(/문항 2개가 고정/)
  })

  it('batch total question count over four rejected', () => {
    const base = configuredSet('18', '33', '43-45')
    expect(() => parseEnglishSetJson(JSON.stringify(validPayload(base)), base)).toThrow(/하위 문항 합계.*최대 4개/)
  })

  it('33 plus 40 plus 41-42 equals four and is accepted', () => {
    const base = configuredSet('33', '40', '41-42')
    const payload = validPayload(base)
    payload.items[2].questions[1].type = '문맥상 어휘'
    const imported = parseEnglishSetJson(JSON.stringify(payload), base)
    expect(imported.csatItems?.flatMap((item) => item.questions)).toHaveLength(4)
    expect(imported.csatItems?.[2].questions[1].type).toBe('어휘')
  })

  it('43-45 single item equals three and is accepted', () => {
    const base = configuredSet('43-45')
    const imported = parseEnglishSetJson(JSON.stringify(validPayload(base)), base)
    expect(imported.csatItems?.[0].questions).toHaveLength(3)
  })

  it('malformed chart relation rejected', () => {
    const base = configuredSet('25'); const payload = validPayload(base)
    payload.items[0].materialSpec = { kind: 'chart', title: 'Chart', unit: '%', categories: ['A', 'B', 'C'], series: [{ name: 'Only', values: [1, 2] }] }
    expect(() => parseEnglishSetJson(JSON.stringify(payload), base)).toThrow(/categories.*series\.values/)
  })

  it('malformed ordered material rejected', () => {
    const base = configuredSet('36'); const payload = validPayload(base)
    payload.items[0].materialSpec = { kind: 'ordered', lead: 'Lead.', sections: [{ label: 'A', text: 'A.' }, { label: 'B', text: 'B.' }, { label: 'B', text: 'Duplicate.' }] } as CsatMaterialSpec
    expect(() => parseEnglishSetJson(JSON.stringify(payload), base)).toThrow(/A\/B\/C section/)
  })

  it('malformed summary material rejected', () => {
    const base = configuredSet('40'); const payload = validPayload(base)
    payload.items[0].materialSpec = { kind: 'summary', summary: '   ' }
    expect(() => parseEnglishSetJson(JSON.stringify(payload), base)).toThrow(/summary 문자열/)
  })

  it('malformed longNarrative material rejected', () => {
    const base = configuredSet('43-45'); const payload = validPayload(base)
    payload.items[0].materialSpec = { kind: 'longNarrative', sections: [{ label: 'A', text: 'A.' }, { label: 'B', text: 'B.' }, { label: 'C', text: 'C.' }, { label: 'C', text: 'Duplicate.' }] } as CsatMaterialSpec
    expect(() => parseEnglishSetJson(JSON.stringify(payload), base)).toThrow(/A\/B\/C\/D section/)
  })

  it('validation failure does not mutate existing revision', () => {
    const base = configuredSet('33'); base.aiRevision = 7
    const payload = validPayload(base); firstQuestion(payload).answerIndex = 0
    expect(() => parseEnglishSetJson(JSON.stringify(payload), base)).toThrow()
    expect(base.aiRevision).toBe(7)
  })

  it('validation failure does not replace lastImportedJson', () => {
    const base = configuredSet('33'); base.lastImportedJson = '{"preserved":true}'
    const payload = clone(validPayload(base)); firstQuestion(payload).translation = 'unsupported'
    expect(() => parseEnglishSetJson(JSON.stringify(payload), base)).toThrow()
    expect(base.lastImportedJson).toBe('{"preserved":true}')
  })

  it('missing intention and score are rejected instead of defaulted', () => {
    const base = configuredSet('33'); const payload = validPayload(base); delete firstQuestion(payload).intention; delete firstQuestion(payload).score
    expect(() => parseEnglishSetJson(JSON.stringify(payload), base)).toThrow(/intention|score|필수 필드 누락/)
  })

  it('missing materialTitle and materialSpec are rejected', () => {
    const base = configuredSet('33'); const payload = validPayload(base)
    delete (payload.items[0] as Partial<typeof payload.items[0]>).materialTitle
    delete (payload.items[0] as Partial<typeof payload.items[0]>).materialSpec
    expect(() => parseEnglishSetJson(JSON.stringify(payload), base)).toThrow(/materialTitle|materialSpec|필수 필드 누락/)
  })

  it('missing qualityReview inner field is rejected', () => {
    const base = configuredSet('33'); const payload = validPayload(base)
    delete (payload.items[0].qualityReview.passage as Partial<typeof payload.items[0]['qualityReview']['passage']>).templateFidelity
    expect(() => parseEnglishSetJson(JSON.stringify(payload), base)).toThrow(/templateFidelity|필수 필드 누락/)
  })

  it('school and custom importers retain their existing non-v0 behavior', () => {
    for (const mode of ['school', 'custom'] as const) {
      const base = createEnglishSet(mode)
      const payload = {
        title: `${mode} fixture`, material: 'Provided passage.', translation: 'ignored by the existing non-CSAT contract',
        questions: [{ type: base.questions[0].type, stem: base.questions[0].stem, choices: ['a', 'b', 'c', 'd', 'e'], answerIndex: '⑤' }],
      }
      const imported = parseEnglishSetJson(JSON.stringify(payload), base)
      expect(imported.questions[0].answerIndex).toBe(5)
    }
  })
})
