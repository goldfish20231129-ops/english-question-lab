import { describe, expect, it } from 'vitest'
import { applyCsatItemTemplate, createCsatItem } from './csat'
import { buildExamFlowBlocks, contentEntriesForSet, examFlowMeasurementKey, geometryKey, getOversizedQuestionIssues, moveExamContentEntry, normalizeExamDocument, paginateAtomicAnswerBlocks, paginateExamBlocks } from './examLayout'
import { createEnglishSet, createExamLayout, createQuestion } from './english'
import { createProvidedPassageV02Plan, syncProvidedPassageV02Questions, transitionSchoolProvidedPassageV02 } from './providedPassageV02'
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

  it('손상된 참조·중복 항목·잘못된 조판값을 안전하게 정리한다', () => {
    const set = csatSet('recoverable', '18', '33')
    const [first] = contentEntriesForSet(set)
    const damaged = {
      ...exam(),
      setIds: undefined,
      layout: { preset: 'csat', columns: 7, fontSize: Number.NaN },
      contentEntries: [first, first, null, { id: 'missing-entry', setId: 'missing-set' }],
      entryOverrides: { [first.id]: { fontScale: 0.9 }, 'missing-entry': { columns: 2 } },
    } as unknown as EnglishExamDocument

    const normalized = normalizeExamDocument(damaged, [set])
    expect(normalized.contentEntries).toEqual([first])
    expect(normalized.setIds).toEqual([set.id])
    expect(normalized.layout.columns).toBe(1)
    expect(Number.isFinite(normalized.layout.fontSize)).toBe(true)
    expect(normalized.entryOverrides).toEqual({ [first.id]: { fontScale: 0.9 } })
  })

  it('표시 순서가 아니라 문항 고유 ID로 안전하게 이동한다', () => {
    const set = csatSet('reorder', '18', '33', '41-42')
    const entries = contentEntriesForSet(set)
    const moved = moveExamContentEntry(entries, entries[1].id, -1)

    expect(moved.map((entry) => entry.id)).toEqual([entries[1].id, entries[0].id, entries[2].id])
    expect(moveExamContentEntry(entries, 'unknown-entry', 1)).toBe(entries)
    expect(moveExamContentEntry(entries, entries[0].id, -1)).toBe(entries)
  })

  it('같은 문항을 빠르게 연속 이동해도 직전 순서를 이어서 적용한다', () => {
    const set = csatSet('rapid-reorder', '33', '40', '41-42')
    const entries = contentEntriesForSet(set)
    const movingId = entries[0].id

    const movedOnce = moveExamContentEntry(entries, movingId, 1)
    const movedTwice = moveExamContentEntry(movedOnce, movingId, 1)

    expect(movedTwice.map((entry) => entry.id)).toEqual([
      entries[1].id,
      entries[2].id,
      movingId,
    ])
  })

  it('문항 순서가 바뀌면 기존 조판 측정값을 재사용하지 않는다', () => {
    const set = csatSet('measurement-reset', '33', '40', '41-42')
    const doc = exam()
    doc.contentEntries = contentEntriesForSet(set)
    doc.setIds = [set.id]
    const before = buildExamFlowBlocks(doc, [set], [])

    doc.contentEntries = moveExamContentEntry(doc.contentEntries, doc.contentEntries[1].id, -1)
    const after = buildExamFlowBlocks(doc, [set], [])

    expect(examFlowMeasurementKey(after)).not.toBe(examFlowMeasurementKey(before))
    expect(after[0].setId).toBe(doc.contentEntries[0].id)
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

describe('실측 기반 페이지 분할 회귀', () => {
  it('새 페이지에서도 같은 조판의 실측 칼럼 높이를 사용해 장문 블록을 자르지 않는다', () => {
    const set = csatSet('long-pagination', '43-45')
    const doc = exam()
    doc.layout = createExamLayout('csat')
    doc.contentEntries = contentEntriesForSet(set)
    doc.setIds = [set.id]
    const blocks = buildExamFlowBlocks(doc, [set], [])
    const blockHeights = Object.fromEntries(blocks.map((block) => [block.id, 60]))
    const capacity = 100
    const pages = paginateExamBlocks(blocks, {
      blockHeights,
      columnHeights: { '0-0': capacity, '0-1': capacity },
      layoutHeights: { [geometryKey(doc.layout)]: capacity },
    })

    expect(pages.length).toBeGreaterThan(1)
    pages.forEach((page) => page.columns.forEach((column) => {
      expect(column.reduce((sum, block) => sum + blockHeights[block.id], 0)).toBeLessThanOrEqual(capacity)
    }))
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

  it('학교형 2단의 긴 공유 지문도 고정 문자 수로 나누지 않는다', () => {
    const set = createEnglishSet('school')
    set.id = 'continuous-school-passage'
    set.material = `${'A connected school passage continues without a paragraph break. '.repeat(24)}The final sentence remains attached to the same passage.`
    const doc = exam()
    doc.layout = createExamLayout('school-exam')
    doc.contentEntries = contentEntriesForSet(set)
    doc.setIds = [set.id]

    const materials = buildExamFlowBlocks(doc, [set], []).filter((block) => block.kind === 'material')

    expect(set.material.length).toBeGreaterThan(980)
    expect(materials).toHaveLength(1)
    expect(materials[0].text).toBe(set.material)
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

  it('기존 학교형 2단 기본값만 실제 학교 시험지 밀도로 이전한다', () => {
    const set = createEnglishSet('school')
    const legacy = exam()
    legacy.layout = { ...createExamLayout('school-exam'), layoutRevision: 1, marginTop: 8, marginBottom: 11, fontSize: 9.2, lineHeight: 1.42, questionGap: 3.5 }
    const migrated = normalizeExamDocument(legacy, [set])
    expect(migrated.layout).toMatchObject({ layoutRevision: 2, marginTop: 7.5, marginBottom: 9, fontSize: 8.4, lineHeight: 1.3, questionGap: 3 })

    const customized = { ...legacy, layout: { ...legacy.layout, fontSize: 9 } }
    expect(normalizeExamDocument(customized, [set]).layout.fontSize).toBe(9)
  })

  it('관련 없는 세트 데이터는 변경하지 않는다', () => {
    const school = createEnglishSet('school') as EnglishQuestionSet
    const before = JSON.stringify(school)
    contentEntriesForSet(school)
    expect(JSON.stringify(school)).toBe(before)
    const doc = exam(); doc.contentEntries = contentEntriesForSet(school); doc.setIds = [school.id]
    expect(buildExamFlowBlocks(doc, [school], []).every((block) => !block.keepTogetherId)).toBe(true)
  })

  it('기존 지문 V0.2 복수 문항은 공통 지문을 한 번만 두고 삽입 문항만 독립 지문 공간을 계산한다', () => {
    const seed = createEnglishSet('school')
    seed.material = 'First sentence explains the topic. Second sentence adds evidence. Third sentence gives a contrast. Fourth sentence states a result. Fifth sentence closes the discussion. Sixth sentence confirms the point.'
    let set = transitionSchoolProvidedPassageV02(seed, 'provided')
    const plans = [createProvidedPassageV02Plan('content', 'content_match'), createProvidedPassageV02Plan('insert', 'sentence_insertion')]
    set = { ...set, providedPassageV02: { ...set.providedPassageV02!, itemPlans: plans }, questions: syncProvidedPassageV02Questions(set, plans) }
    const doc = exam(); doc.contentEntries = contentEntriesForSet(set); doc.setIds = [set.id]
    const blocks = buildExamFlowBlocks(doc, [set], [])
    const questions = blocks.filter((block) => block.kind === 'question')
    expect(blocks.filter((block) => block.kind === 'material')).toHaveLength(1)
    expect(questions).toHaveLength(2)
    expect(questions.map((block) => block.question?.type)).toEqual(['내용 일치 및 불일치', '문장 삽입'])
    expect(questions[0].units).toBeLessThan(questions[1].units)
  })

  it('새 자료 문장 삽입 혼합 세트는 공통 지문을 한 번만 두고 삽입 문항을 마지막에 계산한다', () => {
    const set = createEnglishSet('school')
    set.material = 'First sentence. [[삽입위치:①]] [[삽입문장:Given sentence.]] Second sentence. [[삽입위치:②]] Third sentence. [[삽입위치:③]] Fourth sentence. [[삽입위치:④]] Fifth sentence. [[삽입위치:⑤]]'
    set.questions = [createQuestion('문장 삽입'), createQuestion('어법'), createQuestion('내용 이해')]
    const doc = exam(); doc.contentEntries = contentEntriesForSet(set); doc.setIds = [set.id]
    const blocks = buildExamFlowBlocks(doc, [set], [])
    const materials = blocks.filter((block) => block.kind === 'material')
    const questions = blocks.filter((block) => block.kind === 'question')
    expect(materials).toHaveLength(1)
    expect(materials[0].text).not.toContain('[[삽입')
    expect(questions.map((block) => block.question?.type)).toEqual(['어법', '내용 이해', '문장 삽입'])
    expect(questions.map((block) => block.questionNumber)).toEqual([1, 2, 3])
    expect(questions[2].units).toBeGreaterThanOrEqual(questions[1].units)
  })

  it('새 자료 문장 삽입 단독 세트는 별도 공통 지문을 만들지 않는다', () => {
    const set = createEnglishSet('school')
    set.material = 'First sentence. [[삽입위치:①]] [[삽입문장:Given sentence.]] Second sentence. [[삽입위치:②]] Third sentence. [[삽입위치:③]] Fourth sentence. [[삽입위치:④]] Fifth sentence. [[삽입위치:⑤]]'
    set.questions = [createQuestion('문장 삽입')]
    const doc = exam(); doc.contentEntries = contentEntriesForSet(set); doc.setIds = [set.id]
    const blocks = buildExamFlowBlocks(doc, [set], [])
    expect(blocks.some((block) => block.kind === 'material' || block.kind === 'structured-material')).toBe(false)
    expect(blocks.filter((block) => block.kind === 'question')).toHaveLength(1)
  })

  it('학교형-2단 시험은 공유 지문 범위를 묶음 제목으로 만들고 2단 기본값을 유지한다', () => {
    const set = createEnglishSet('school')
    set.title = '신규 창작 공유 지문'
    set.material = 'A newly written passage supports several independent school questions.'
    set.questions = [createQuestion('내용 이해'), createQuestion('어법'), createQuestion('주제')]
    const doc = exam()
    doc.layout = createExamLayout('school-exam')
    doc.contentEntries = contentEntriesForSet(set)
    doc.setIds = [set.id]

    const normalized = normalizeExamDocument(doc, [set])
    const blocks = buildExamFlowBlocks(normalized, [set], [])
    expect(normalized.layout).toMatchObject({ preset: 'school-exam', layoutRevision: 2, columns: 2, answerColumns: 1, fontSize: 8.4, lineHeight: 1.3, questionGap: 3 })
    expect(blocks.find((block) => block.kind === 'set-header')).toMatchObject({ groupNumberLabel: '1~3', keepWithNext: true })
    expect(blocks.filter((block) => block.kind === 'material')).toHaveLength(1)
    expect(blocks.filter((block) => block.kind === 'question').map((block) => block.questionNumber)).toEqual([1, 2, 3])
  })

  it('해설 문항은 남은 높이가 부족하면 문항 전체를 다음 페이지로 넘긴다', () => {
    const pages = paginateAtomicAnswerBlocks([180, 180, 180, 180], [600, 700], 1, 20)
    expect(pages).toEqual([[[0, 1, 2]], [[3]]])
  })

  it('2단 해설지는 문항을 쪼개지 않고 다음 칼럼과 다음 페이지를 사용한다', () => {
    const pages = paginateAtomicAnswerBlocks([300, 300, 300, 300, 300], [620, 620], 2, 20)
    expect(pages).toEqual([[[0, 1], [2, 3]], [[4], []]])
  })
})
