import { describe, expect, it } from 'vitest'
import {
  CSAT_FAMILIES,
  CSAT_INLINE_POSITION_CHOICES,
  CSAT_TEMPLATES,
  applyCsatItemTemplate,
  createCsatDesign,
  createCsatItem,
  createCsatQuestions,
  csatPrintFlow,
  decorateCsatMaterialText,
  embedCsatChartChoices,
  generateCsatGptInstructions,
  getCsatItems,
  normalizeCsatSet,
} from './csat'
import { createEnglishSet, generateEnglishPrompt, parseEnglishSetJson, validateEnglishSet } from './english'
import type { CsatItemDesign, CsatNumberTemplateId } from './types'

const choices = ['alpha', 'beta', 'gamma', 'delta', 'epsilon']

function configuredSet(...templateIds: CsatNumberTemplateId[]) {
  const set = createEnglishSet('csat')
  set.csatItems = templateIds.map((templateId) => applyCsatItemTemplate(createCsatItem(), templateId))
  return set
}

function importedItem(item: CsatItemDesign) {
  return {
    itemId: item.id,
    templateId: item.design?.templateId,
    variantId: item.design?.variantId,
    materialTitle: 'Passage',
    material: 'Evidence sentence.',
    questions: item.questions.map((question) => ({
      ...question,
      choices,
      answerIndex: 2,
      explanation: 'The second choice follows the passage.',
      evidenceRefs: ['Evidence sentence.'],
      distractorReasons: ['too broad', 'reversed cause', 'wrong fact', 'irrelevant detail'],
    })),
  }
}

describe('수능 번호별 카탈로그와 문항 카드', () => {
  it('17개 대분류와 18~45번 읽기 구조를 빠짐없이 제공한다', () => {
    expect(CSAT_FAMILIES).toHaveLength(17)
    expect(CSAT_TEMPLATES).toHaveLength(25)
    expect(CSAT_TEMPLATES.map((template) => template.id)).toEqual([
      '18', '19', '20', '21', '22', '23', '24', '25', '26', '27', '28', '29', '30', '31', '32', '33', '34', '35', '36', '37', '38', '39', '40', '41-42', '43-45',
    ])
  })

  it('모든 템플릿을 시험지 출력 흐름 하나에만 배정한다', () => {
    const flows = CSAT_TEMPLATES.map((template) => [template.id, csatPrintFlow(template.id)])
    expect(flows.filter(([, flow]) => flow === 'lead-material-inline').map(([id]) => id)).toEqual(['35', '38', '39'])
    expect(flows.filter(([, flow]) => flow === 'lead-material-embedded-choices').map(([id]) => id)).toEqual(['25'])
    expect(flows.filter(([, flow]) => flow === 'material-questions').map(([id]) => id)).toEqual(['41-42', '43-45'])
    expect(flows).toHaveLength(CSAT_TEMPLATES.length)
  })

  it('25번 도표 진술을 별도 선지 대신 설명문 안 ①~⑤로 합친다', () => {
    const statements = ['The first value is highest.', 'The second value increased.', 'The third value fell.', 'The fourth value stayed lowest.', 'The final gap is larger.']
    const text = embedCsatChartChoices('The graph compares five values.', statements)
    expect(text).toBe('The graph compares five values. ① The first value is highest. ② The second value increased. ③ The third value fell. ④ The fourth value stayed lowest. ⑤ The final gap is larger.')
    expect(embedCsatChartChoices(text, statements)).toBe(text)
  })

  it('장문 템플릿은 한 카드 안의 고정 묶음으로 유지한다', () => {
    const expository = applyCsatItemTemplate(createCsatItem(), '41-42')
    const narrative = applyCsatItemTemplate(createCsatItem(), '43-45')
    expect(expository.questions.map((question) => question.csatSlot)).toEqual(['41', '42'])
    expect(narrative.questions.map((question) => question.csatSlot)).toEqual(['43', '44', '45'])
  })

  it('기존 43~45번 지칭 표식의 대명사를 밑줄 마크업으로 보정한다', () => {
    const raw = '(A) Mina arrived. (a) She waved. (b) He answered. (c) She smiled. (d) She waited. (e) She left.'
    const decorated = decorateCsatMaterialText(raw, '43-45', 'standard')
    expect(decorated).toContain('(a) [[밑줄:She]]')
    expect(decorated.match(/\[\[밑줄:/g)).toHaveLength(5)
  })

  it('기존 단일 수능형 데이터는 한 개 카드로 자동 정규화한다', () => {
    const legacy = createEnglishSet('csat')
    legacy.csatItems = undefined
    legacy.csatDesign = createCsatDesign('38')
    legacy.material = 'Legacy passage.'
    legacy.questions = createCsatQuestions('38')
    const normalized = normalizeCsatSet(legacy)
    expect(getCsatItems(normalized)).toHaveLength(1)
    expect(getCsatItems(normalized)[0].design?.templateId).toBe('38')
    expect(getCsatItems(normalized)[0].material).toBe('Legacy passage.')
  })

  it('일괄 프롬프트와 GPT 지침은 안정적인 itemId와 items 구조를 공유한다', () => {
    const set = configuredSet('18', '33', '43-45')
    const prompt = generateEnglishPrompt(set)
    set.csatItems?.forEach((item) => expect(prompt).toContain(item.id))
    expect(prompt).toContain('templateId: 33')
    expect(prompt).toContain('43~45번형')
    const instructions = generateCsatGptInstructions()
    expect(instructions).toContain('듣기 1~17번은 만들지 않는다')
    expect(instructions).toContain('items 배열')
    expect(instructions).toContain('25번 도표형은 material에 영어 도입부 1~2문장만')
    expect(instructions).toContain('하나의 영어 지문으로 조판')
  })
})

describe('수능 다중 JSON과 카드별 검증', () => {
  it('itemId로 여러 결과를 원자적으로 가져온다', () => {
    const base = configuredSet('18', '33')
    const items = base.csatItems ?? []
    const imported = parseEnglishSetJson(JSON.stringify({ title: 'Batch', items: items.map(importedItem) }), base)
    expect(imported.aiRevision).toBe(1)
    expect(imported.validatedRevision).toBe(0)
    expect(imported.csatItems?.map((item) => item.id)).toEqual(items.map((item) => item.id))
    expect(imported.csatItems?.every((item) => item.material === 'Evidence sentence.')).toBe(true)
  })

  it('외부 AI가 18~40번 templateId를 숫자로 반환해도 문자열 ID로 호환한다', () => {
    const base = configuredSet('33')
    const item = base.csatItems?.[0] as CsatItemDesign
    const imported = importedItem(item)
    const result = parseEnglishSetJson(JSON.stringify({ items: [{ ...imported, templateId: 33 }] }), base)
    expect(result.csatItems?.[0].design?.templateId).toBe('33')
    expect(result.csatItems?.[0].questions[0].choices).toEqual(choices)
  })

  it('누락·중복·알 수 없는 ID와 템플릿 불일치를 전체 거부한다', () => {
    const base = configuredSet('18', '33')
    const [first, second] = base.csatItems ?? []
    expect(() => parseEnglishSetJson(JSON.stringify({ items: [importedItem(first)] }), base)).toThrow(/누락/)
    expect(() => parseEnglishSetJson(JSON.stringify({ items: [importedItem(first), importedItem(first)] }), base)).toThrow(/중복/)
    expect(() => parseEnglishSetJson(JSON.stringify({ items: [{ ...importedItem(first), itemId: 'unknown' }, importedItem(second)] }), base)).toThrow(/알 수 없는/)
    expect(() => parseEnglishSetJson(JSON.stringify({ items: [{ ...importedItem(first), templateId: '20' }, importedItem(second)] }), base)).toThrow(/templateId|템플릿/)
    expect(base.aiRevision).toBe(0)
  })

  it('카드가 하나면 기존 단일 material+questions JSON도 허용한다', () => {
    const base = configuredSet('25')
    const item = base.csatItems?.[0] as CsatItemDesign
    const raw = importedItem(item)
    const imported = parseEnglishSetJson(JSON.stringify({ material: raw.material, questions: raw.questions }), base)
    expect(imported.csatItems?.[0].questions).toHaveLength(1)
  })

  it('위치 선택형은 별도 내용 선지를 위치 번호로 정규화하고 도표형 내용 선지는 보존한다', () => {
    const base = configuredSet('38', '25')
    const rawItems = (base.csatItems ?? []).map(importedItem)
    const imported = parseEnglishSetJson(JSON.stringify({ items: rawItems }), base)
    expect(imported.csatItems?.[0].questions[0].choices).toEqual([...CSAT_INLINE_POSITION_CHOICES])
    expect(imported.csatItems?.[1].questions[0].choices).toEqual(choices)
  })

  it('표식 검사를 각 카드의 지문 안에서만 수행한다', () => {
    const set = configuredSet('29', '38')
    const [grammar, insertion] = set.csatItems as CsatItemDesign[]
    grammar.material = '[[밑줄:is]] [[밑줄:used]]'
    insertion.material = '[[삽입문장:This matters.]] [[삽입위치:①]] [[삽입위치:②]]'
    for (const item of [grammar, insertion]) {
      item.questions = item.questions.map((question) => ({
        ...question, choices, explanation: 'Explanation', evidenceRefs: [], distractorReasons: ['1', '2', '3', '4'],
      }))
    }
    const issues = validateEnglishSet(set)
    expect(issues.some((issue) => issue.label === '카드 1 · 어법 표적 수')).toBe(true)
    expect(issues.some((issue) => issue.label === '카드 2 · 삽입 자료 구조')).toBe(true)
  })

  it('20개를 넘는 카드와 29·30번 비권장 배점을 경고한다', () => {
    const tooMany = configuredSet(...Array.from({ length: 21 }, () => '18' as const))
    expect(validateEnglishSet(tooMany).some((issue) => issue.label === '문항 카드 수')).toBe(true)

    const scores = configuredSet('29', '30')
    scores.csatItems?.forEach((item) => { item.questions[0].score = 2 })
    expect(validateEnglishSet(scores).some((issue) => issue.label === '29·30번 권장 배점')).toBe(true)
  })
})
