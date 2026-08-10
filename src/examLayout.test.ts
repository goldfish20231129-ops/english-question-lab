import { describe, expect, it } from 'vitest'
import { applyCsatItemTemplate, createCsatItem } from './csat'
import { buildExamFlowBlocks, contentEntriesForSet, geometryKey, getOversizedQuestionIssues, normalizeExamDocument, paginateExamBlocks } from './examLayout'
import { createEnglishSet, createExamLayout } from './english'
import type { EnglishExamDocument, EnglishQuestionSet } from './types'

function exam(): EnglishExamDocument {
  return { id: 'exam', title: '혼합 시험지', setIds: [], contentEntries: [], layout: createExamLayout('school'), setOverrides: {}, entryOverrides: {}, createdAt: '', updatedAt: '' }
}

function csatSet(id: string, ...templates: Array<'18' | '25' | '29' | '33' | '38' | '40' | '41-42' | '43-45'>) {
  const set = createEnglishSet('csat')
  set.id = id
  set.csatItems = templates.map((template) => {
    const item = applyCsatItemTemplate(createCsatItem(), template)
    item.material = `${template} passage.`
    return item
  })
  return set
}

const numberedQuestionBlocks = (blocks: ReturnType<typeof buildExamFlowBlocks>) => blocks.filter((block) => block.kind === 'question' || block.kind === 'question-lead')

describe('문항 카드별 시험지 조립', () => {
  it('세트 전체 추가는 모든 수능 카드를 순서대로 펼친다', () => {
    const set = csatSet('csat', '18', '41-42', '33')
    const doc = exam()
    doc.contentEntries = contentEntriesForSet(set)
    doc.setIds = [set.id]
    const questions = numberedQuestionBlocks(buildExamFlowBlocks(doc, [set], []))
    expect(questions.map((block) => block.questionNumber)).toEqual([1, 2, 3, 4])
    expect(questions.map((block) => block.question?.csatSlot)).toEqual(['18', '41', '42', '33'])
  })

  it('카드를 개별 제외하고 서로 다른 세트 사이로 재정렬한다', () => {
    const first = csatSet('first', '18', '41-42', '33')
    const second = csatSet('second', '29')
    const [purpose, longReading, blank] = contentEntriesForSet(first)
    const [grammar] = contentEntriesForSet(second)
    const doc = exam()
    doc.contentEntries = [blank, grammar, longReading]
    doc.setIds = [first.id, second.id]
    const blocks = buildExamFlowBlocks(doc, [first, second], [])
    const questions = numberedQuestionBlocks(blocks)
    expect(questions.map((block) => block.question?.csatSlot)).toEqual(['33', '29', '41', '42'])
    expect(blocks.some((block) => block.id.startsWith(purpose.id))).toBe(false)
  })

  it('41~42와 43~45는 각각 분리할 수 없는 하나의 조립 항목이다', () => {
    const set = csatSet('long', '41-42', '43-45')
    const entries = contentEntriesForSet(set)
    expect(entries).toHaveLength(2)
    const doc = exam()
    doc.contentEntries = entries
    doc.setIds = [set.id]
    const questions = buildExamFlowBlocks(doc, [set], []).filter((block) => block.kind === 'question')
    expect(questions).toHaveLength(5)
  })

  it('기존 setIds 시험지는 현재 카드 순서의 contentEntries로 변환한다', () => {
    const set = csatSet('legacy', '18', '33')
    const doc = exam()
    doc.contentEntries = undefined
    doc.setIds = [set.id]
    const normalized = normalizeExamDocument(doc, [set])
    expect(normalized.contentEntries).toHaveLength(2)
  })

  it('카드별 조판 덮어쓰기로 페이지 구조를 분리한다', () => {
    const set = csatSet('layout', '18', '33')
    const doc = exam()
    doc.contentEntries = contentEntriesForSet(set)
    doc.setIds = [set.id]
    const second = doc.contentEntries[1]
    doc.entryOverrides = { [second.id]: { columns: 2 } }
    const pages = paginateExamBlocks(buildExamFlowBlocks(doc, [set], []))
    expect(pages[0].layout.columns).toBe(1)
    expect(pages.at(-1)?.layout.columns).toBe(2)
  })
})

describe('공통 조판 회귀', () => {
  it('내신형과 수능형을 함께 조립해 연속 번호를 부여한다', () => {
    const school = createEnglishSet('school'); school.id = 'school'; school.material = 'School passage.'
    const csat = csatSet('csat', '18')
    const doc = exam(); doc.setIds = [school.id, csat.id]; doc.contentEntries = [...contentEntriesForSet(school), ...contentEntriesForSet(csat)]
    const blocks = buildExamFlowBlocks(doc, [school, csat], [])
    expect(numberedQuestionBlocks(blocks).map((block) => block.questionNumber)).toEqual([1, 2])
  })

  it('여백 차이를 페이지 구조 차이로 취급한다', () => {
    const first = createExamLayout('school')
    const second = { ...first, marginLeft: first.marginLeft + 1 }
    expect(geometryKey(first)).not.toBe(geometryKey(second))
  })

  it('발문 뒤에 지문과 내용 선지를 배치하고 선지 전체는 한 블록으로 유지한다', () => {
    const set = csatSet('set', '18')
    const doc = exam(); doc.contentEntries = contentEntriesForSet(set); doc.setIds = [set.id]
    doc.layout = createExamLayout('csat')
    const blocks = buildExamFlowBlocks(doc, [set], [])
    expect(blocks.map((block) => block.kind)).toEqual(['question-lead', 'material', 'question-choices'])
    expect(blocks.find((block) => block.kind === 'question-choices')?.question?.choices).toHaveLength(5)
    expect(new Set(blocks.map((block) => block.keepTogetherId))).toEqual(new Set([doc.contentEntries?.[0].id]))
  })

  it('18~40번 일반 지문은 문자 수로 쪼개지 않고 한 재료 블록으로 유지한다', () => {
    const set = csatSet('continuous', '33')
    set.csatItems![0].material = `${'A carefully connected sentence. '.repeat(45)}The final sentence stays in the same paragraph.`
    const doc = exam(); doc.layout = createExamLayout('csat'); doc.contentEntries = contentEntriesForSet(set); doc.setIds = [set.id]
    const blocks = buildExamFlowBlocks(doc, [set], [])
    const materials = blocks.filter((block) => block.kind === 'material')
    expect(materials).toHaveLength(1)
    expect(materials[0].text).toContain('The final sentence stays in the same paragraph.')
  })

  it('40번은 발문·원문 상자·요약문 상자·선지를 하나의 조판 묶음으로 만든다', () => {
    const set = csatSet('summary', '40')
    set.csatItems![0].material = 'Source passage ends here.\n\nThe summary is [[요약빈칸:A]] and [[요약빈칸:B]].'
    const doc = exam(); doc.layout = createExamLayout('csat'); doc.contentEntries = contentEntriesForSet(set); doc.setIds = [set.id]
    const blocks = buildExamFlowBlocks(doc, [set], [])
    expect(blocks.map((block) => block.kind)).toEqual(['question-lead', 'summary-material', 'question-choices'])
    expect(blocks[1]).toMatchObject({
      text: 'Source passage ends here.',
      summaryText: 'The summary is [[요약빈칸:A]] and [[요약빈칸:B]].',
    })
    expect(new Set(blocks.map((block) => block.keepTogetherId))).toEqual(new Set([doc.contentEntries?.[0].id]))
  })

  it('18~40번의 발문·지문·선지는 공간이 부족하면 함께 다음 칼럼으로 이동한다', () => {
    const set = csatSet('atomic', '18', '33')
    const doc = exam(); doc.layout = createExamLayout('csat'); doc.contentEntries = contentEntriesForSet(set); doc.setIds = [set.id]
    const blocks = buildExamFlowBlocks(doc, [set], [])
    const firstId = doc.contentEntries![0].id
    const secondId = doc.contentEntries![1].id
    const blockHeights = Object.fromEntries(blocks.map((block) => [block.id, block.keepTogetherId === firstId ? 20 : 28]))
    const pages = paginateExamBlocks(blocks, { blockHeights, columnHeights: { '0-0': 100, '0-1': 100 } })
    expect(pages[0].columns[0].every((block) => block.keepTogetherId === firstId)).toBe(true)
    expect(pages[0].columns[1].every((block) => block.keepTogetherId === secondId)).toBe(true)
  })

  it('41~45 장문 묶음은 칼럼 연속 배치를 위해 통째 묶지 않는다', () => {
    const set = csatSet('long-flow', '41-42', '43-45')
    const doc = exam(); doc.layout = createExamLayout('csat'); doc.contentEntries = contentEntriesForSet(set); doc.setIds = [set.id]
    expect(buildExamFlowBlocks(doc, [set], []).every((block) => !block.keepTogetherId)).toBe(true)
  })

  it('41~42와 43~45를 실제 번호 범위와 장문 전용 상자 블록으로 만든다', () => {
    const set = csatSet('long-boxes', '18', '41-42', '43-45')
    set.csatItems![1].material = 'Shared expository passage.'
    set.csatItems![2].material = '(A) First section.\n\n(B) Second section.\n\n(C) Third section.\n\n(D) Fourth section.'
    const doc = exam(); doc.layout = createExamLayout('csat'); doc.contentEntries = contentEntriesForSet(set); doc.setIds = [set.id]
    const blocks = buildExamFlowBlocks(doc, [set], [])
    const expository = blocks.find((block) => block.kind === 'long-expository-material')
    const narrative = blocks.filter((block) => block.kind === 'long-narrative-section')
    expect(expository).toMatchObject({ text: 'Shared expository passage.', groupNumberLabel: '2~3' })
    expect(narrative.map((block) => block.sectionLabel)).toEqual(['A', 'B', 'C', 'D'])
    expect(narrative.map((block) => block.text)).toEqual(['First section.', 'Second section.', 'Third section.', 'Fourth section.'])
    expect(narrative[0].groupNumberLabel).toBe('4~6')
    expect(narrative.slice(1).every((block) => block.groupNumberLabel === undefined)).toBe(true)
  })

  it('한 칼럼보다 큰 수능형 문항 전체를 PDF 내보내기 오류로 표시한다', () => {
    const set = csatSet('oversized', '33')
    const doc = exam(); doc.layout = createExamLayout('csat'); doc.contentEntries = contentEntriesForSet(set); doc.setIds = [set.id]
    const blocks = buildExamFlowBlocks(doc, [set], [])
    const blockHeights = Object.fromEntries(blocks.map((block) => [block.id, 40]))
    expect(getOversizedQuestionIssues(blocks, { blockHeights, columnHeights: { '0-0': 100, '0-1': 100 } })[0]).toContain('발문·지문·선지 전체')
  })

  it('문장 삽입형과 도표형은 별도 선지 목록 없이 지문 속 번호를 사용한다', () => {
    const insertion = csatSet('insertion', '38')
    const chart = csatSet('chart', '25')
    const chartItem = chart.csatItems![0]
    chartItem.material = 'The graph compares weekly use of four spaces.'
    chartItem.materialSpec = { kind: 'chart', title: 'Weekly Use', unit: 'hours', categories: ['A', 'B'], series: [{ name: 'First', values: [4, 5] }, { name: 'Second', values: [5, 4] }] }
    chartItem.questions[0].choices = ['A rose in the second period.', 'B fell in the second period.', 'A was lower at first.', 'B was higher at first.', 'The gaps were identical.']
    const doc = exam()
    doc.layout = createExamLayout('csat')
    doc.contentEntries = [...contentEntriesForSet(insertion), ...contentEntriesForSet(chart)]
    doc.setIds = [insertion.id, chart.id]
    const blocks = buildExamFlowBlocks(doc, [insertion, chart], [])
    const insertionBlocks = blocks.filter((block) => block.setId.includes('insertion'))
    const chartBlocks = blocks.filter((block) => block.setId.includes('chart'))
    expect(insertionBlocks.map((block) => block.kind)).toEqual(['question-lead', 'material'])
    expect(chartBlocks.map((block) => block.kind)).toEqual(['question-lead', 'structured-material', 'material'])
    expect(chartBlocks.find((block) => block.kind === 'material')?.text).toContain('① A rose in the second period.')
    expect(chartBlocks.some((block) => block.kind === 'question-choices')).toBe(false)
    expect(new Set(insertionBlocks.map((block) => block.keepTogetherId)).size).toBe(1)
    expect(new Set(chartBlocks.map((block) => block.keepTogetherId)).size).toBe(1)
    expect(blocks.some((block) => block.kind === 'set-header')).toBe(false)
  })


  it('기존 수능형 기본 조판값만 새 실제 시험지 밀도로 이전한다', () => {
    const set = csatSet('layout-migration', '18')
    const legacy = exam()
    legacy.layout = { ...createExamLayout('csat'), layoutRevision: undefined, fontSize: 10.2, lineHeight: 1.62, questionGap: 6 }
    const migrated = normalizeExamDocument(legacy, [set])
    expect(migrated.layout).toMatchObject({ layoutRevision: 2, fontSize: 8.6, lineHeight: 1.32, questionGap: 3.5 })

    const customized = { ...legacy, layout: { ...legacy.layout, fontSize: 9.4 } }
    expect(normalizeExamDocument(customized, [set]).layout.fontSize).toBe(9.4)
  })

  it('관련 없는 세트 데이터는 변경하지 않는다', () => {
    const school = createEnglishSet('school') as EnglishQuestionSet
    const before = JSON.stringify(school)
    contentEntriesForSet(school)
    expect(JSON.stringify(school)).toBe(before)
    const doc = exam(); doc.contentEntries = contentEntriesForSet(school); doc.setIds = [school.id]
    expect(buildExamFlowBlocks(doc, [school], []).every((block) => !block.keepTogetherId)).toBe(true)
  })
})
