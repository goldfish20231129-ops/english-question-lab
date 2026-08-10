import { describe, expect, it } from 'vitest'
import {
  CSAT_PASSAGE_LENGTH_STATS,
  CSAT_TEMPLATES,
  applyCsatItemTemplate,
  countCsatPassageWords,
  createCsatItem,
  generateCsatGptInstructions,
  getCsatPassageLengthRange,
  normalizeCsatSet,
} from './csat'
import { createEnglishSet, generateEnglishPrompt, generateReviewPrompt, parseEnglishSetJson, validateEnglishSet } from './english'
import type { CsatItemDesign, CsatNumberTemplateId, CsatQualityReview } from './types'

const expectedStats = {
  '18': [100, 110.6, 122], '19': [105, 122.5, 135], '20': [123, 138.9, 169], '21': [145, 160.4, 187],
  '22': [145, 160.5, 177], '23': [143, 158.2, 180], '24': [140, 164.5, 186], '25': [113, 136.3, 171],
  '26': [125, 140.4, 153], '27': [77, 96, 108], '28': [86, 93.4, 117], '29': [149, 157.4, 169],
  '30': [157, 177.1, 203], '31': [145, 162.1, 172], '32': [131, 153.9, 171], '33': [126, 156.1, 179],
  '34': [147, 163.3, 178], '35': [150, 164.8, 182], '36': [145, 163.5, 179], '37': [139, 164.8, 179],
  '38': [131, 169.6, 185], '39': [155, 171, 193], '40': [150, 163.5, 175], '41-42': [216, 237.5, 278],
  '43-45': [321, 347.1, 381],
} satisfies Record<CsatNumberTemplateId, [number, number, number]>

function configured33() {
  const set = createEnglishSet('csat')
  const item = applyCsatItemTemplate(createCsatItem(), '33')
  set.csatItems = [item]
  return { set, item }
}

function qualityReview(slot = '33'): CsatQualityReview {
  return {
    passage: { naturalness: 9, logicStructure: 9, vocabularyLevel: 9, templateFidelity: 9 },
    questions: [{ slot, answerInference: 9, distractorPlausibility: 9, choiceBalance: 9, directAnswerOverlap: false, strongestDistractorIndex: 2, decisiveReason: 'The conclusion requires comparison, not passive reception.', expectedDifficulty: 4 }],
  }
}

function importPayload(item: CsatItemDesign, review?: CsatQualityReview) {
  return {
    items: [{
      itemId: item.id, templateId: '33', variantId: 'standard', materialTitle: '',
      material: `${Array.from({ length: 145 }, (_, index) => `word${index}`).join(' ')} [[빈칸]]`, materialSpec: null,
      questions: [{
        type: '빈칸 추론', stem: '다음 빈칸에 들어갈 말로 가장 적절한 것을 고르시오.',
        choices: ['compare several explanations carefully', 'memorize every detail immediately', 'avoid all uncertain conclusions', 'prefer a simpler unrelated account', 'accept the first answer passively'],
        answerIndex: 1, explanation: 'The passage supports comparison.', intention: '논리 종합',
        evidenceRefs: [], distractorReasons: ['정보량 중심', '불확실성 회피', '무관한 단순화', '수동적 수용'], score: 3,
      }],
      qualityReview: review,
    }],
  }
}

describe('수능 지문 길이 카탈로그', () => {
  it('모든 템플릿의 최소·평균·최대 통계를 단일 원본으로 제공한다', () => {
    expect(Object.keys(CSAT_PASSAGE_LENGTH_STATS)).toHaveLength(CSAT_TEMPLATES.length)
    Object.entries(expectedStats).forEach(([templateId, [min, average, max]]) => {
      expect(CSAT_PASSAGE_LENGTH_STATS[templateId as CsatNumberTemplateId]).toEqual({ min, average, max })
    })
  })

  it('짧음·중간·김 범위가 겹치거나 비지 않고 전체 통계를 덮는다', () => {
    CSAT_TEMPLATES.forEach((template) => {
      const stats = CSAT_PASSAGE_LENGTH_STATS[template.id]
      const short = getCsatPassageLengthRange(template.id, 'short')
      const medium = getCsatPassageLengthRange(template.id, 'medium')
      const long = getCsatPassageLengthRange(template.id, 'long')
      expect(short.min).toBe(stats.min)
      expect(medium.min).toBe(short.max + 1)
      expect(long.min).toBe(medium.max + 1)
      expect(long.max).toBe(stats.max)
    })
    expect(getCsatPassageLengthRange('33', 'medium')).toEqual({ min: 142, max: 167 })
  })

  it('기존 카드에는 중간 길이를 기본 적용한다', () => {
    const { set, item } = configured33()
    item.passageLength = undefined
    expect(normalizeCsatSet(set).csatItems?.[0].passageLength).toBe('medium')
  })

  it('일반 지문과 구조화 자료에서 실제 출력되는 영어 단어를 센다', () => {
    expect(countCsatPassageWords('One two [[밑줄:three]] [[빈칸]] four.')).toBe(4)
    expect(countCsatPassageWords('ignored', { kind: 'practical', heading: 'Summer Workshop', fields: { Date: 'June third' }, notes: ['Bring your notebook'] })).toBe(8)
    expect(countCsatPassageWords('ignored', { kind: 'ordered', lead: 'Ideas begin here', sections: [{ label: 'A', text: 'First link' }, { label: 'B', text: 'Second link' }, { label: 'C', text: 'Final link' }] })).toBe(9)
    expect(countCsatPassageWords('ignored', { kind: 'longNarrative', sections: [{ label: 'A', text: 'Mina opened the door' }, { label: 'B', text: 'She waited outside' }, { label: 'C', text: 'A friend arrived' }, { label: 'D', text: 'They entered together' }] })).toBe(13)
    expect(countCsatPassageWords('The graph compares values.', { kind: 'chart', title: 'Chart', unit: '%', categories: [], series: [] }, ['One value rose.', 'Another value fell.'])).toBe(10)
  })
})

describe('품질 검수 JSON과 경고', () => {
  it('프롬프트와 전용 GPT 지침이 길이 범위와 같은 품질 스키마를 사용한다', () => {
    const { set, item } = configured33()
    item.passageLength = 'long'
    const prompt = generateEnglishPrompt(set)
    expect(prompt).toContain('김 168~179단어')
    expect(prompt).toContain('distractorPlausibility')
    expect(prompt).toContain('어느 점수든 8점 미만')
    const instructions = generateCsatGptInstructions()
    expect(instructions).toContain('조사 단어 수 126/156.1/179')
    expect(instructions).toContain('qualityReview')
  })

  it('품질 검수를 파싱·저장하고, 없는 기존 JSON은 가져온 뒤 경고한다', () => {
    const first = configured33()
    const imported = parseEnglishSetJson(JSON.stringify(importPayload(first.item, qualityReview())), first.set)
    expect(imported.csatItems?.[0].qualityReview?.passage.templateFidelity).toBe(9)
    expect(imported.lastImportedJson).toContain('qualityReview')

    const legacy = configured33()
    const withoutReview = parseEnglishSetJson(JSON.stringify(importPayload(legacy.item)), legacy.set)
    expect(withoutReview.csatItems?.[0].qualityReview).toBeUndefined()
    expect(validateEnglishSet(withoutReview).some((issue) => issue.label === '카드 1 · AI 품질 검수 누락')).toBe(true)
  })

  it('길이 이탈·기준 미달·잘못된 강력한 오답과 정답 직접 재현을 경고한다', () => {
    const { set, item } = configured33()
    item.passageLength = 'short'
    item.material = 'Active learning grows when students compare competing explanations instead of merely receiving them. [[빈칸]]'
    item.questions[0] = {
      ...item.questions[0],
      choices: ['students compare competing explanations instead of merely receiving them', 'memorize facts', 'avoid judgments', 'simplify every account', 'accept one explanation'],
      answerIndex: 1, explanation: 'Comparison is required.', distractorReasons: ['1', '2', '3', '4'],
    }
    item.qualityReview = {
      passage: { naturalness: 7, logicStructure: 9, vocabularyLevel: 9, templateFidelity: 8 },
      questions: [{ slot: '33', answerInference: 7, distractorPlausibility: 8, choiceBalance: 7, directAnswerOverlap: true, strongestDistractorIndex: 1, decisiveReason: '', expectedDifficulty: 7 }],
    }
    const issues = validateEnglishSet(set)
    expect(issues.some((issue) => issue.label === '카드 1 · 지문 길이 범위')).toBe(true)
    expect(issues.some((issue) => issue.label === '카드 1 · 품질 기준 미달')).toBe(true)
    expect(issues.some((issue) => issue.label === '카드 1 · 강력한 오답 번호 오류')).toBe(true)
    expect(issues.some((issue) => issue.label === '카드 1 · 정답 직접 재현')).toBe(true)
    expect(issues.some((issue) => issue.label === '카드 1 · 결정적 구분 근거 없음')).toBe(true)
  })

  it('재검토 프롬프트는 최소·적극 수정안을 내부 비교하고 품질 검수를 갱신한다', () => {
    const { set } = configured33()
    const prompt = generateReviewPrompt(set, [])
    expect(prompt).toContain('최소 수정안과 적극 수정안을 내부적으로 비교')
    expect(prompt).toContain('qualityReview를 갱신')
    expect(prompt).toContain('최종 JSON 하나만')
  })
})
