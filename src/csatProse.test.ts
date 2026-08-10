import { describe, expect, it } from 'vitest'
import {
  applyCsatItemTemplate,
  collapseCsatProseParagraphs,
  createCsatItem,
  hasUnnecessaryPassageBreaks,
  normalizeEnglishPassage,
  normalizePassageForPresentation,
  splitCsatSummaryMaterial,
} from './csat'
import { buildExamFlowBlocks, contentEntriesForSet } from './examLayout'
import { createEnglishSet, createExamLayout, validateEnglishSet } from './english'
import type { CsatNumberTemplateId, EnglishExamDocument, EnglishMode } from './types'

function examFor(set: ReturnType<typeof createEnglishSet>): EnglishExamDocument {
  return {
    id: 'exam', title: '영어 지문 조판 검사', setIds: [set.id], contentEntries: contentEntriesForSet(set),
    layout: createExamLayout('csat'), setOverrides: {}, entryOverrides: {}, createdAt: '', updatedAt: '',
  }
}

function buildCsatMaterials(templateId: CsatNumberTemplateId, material: string) {
  const set = createEnglishSet('csat')
  set.id = `set-${templateId}`
  const item = applyCsatItemTemplate(createCsatItem(), templateId)
  item.material = material
  set.csatItems = [item]
  return buildExamFlowBlocks(examFor(set), [set], []).filter((block) => block.kind === 'material' || block.kind === 'long-expository-material' || block.kind === 'long-narrative-section')
}

function buildGeneralMaterials(mode: Exclude<EnglishMode, 'csat'>, material: string) {
  const set = createEnglishSet(mode)
  set.id = `set-${mode}`
  set.material = material
  return buildExamFlowBlocks(examFor(set), [set], []).filter((block) => block.kind === 'material')
}

describe('영어 지문 문단 조판', () => {
  it('CRLF·LF·단독 CR·유니코드 줄 구분을 모두 한 칸으로 합친다', () => {
    expect(normalizeEnglishPassage('First.\r\n\r\nSecond.\nThird.\rFourth.\u2028Fifth.\u2029Sixth.'))
      .toBe('First. Second. Third. Fourth. Fifth. Sixth.')
  })

  it('35번의 ⑤ 앞 빈 줄을 제거해 마지막 문장까지 한 문단으로 출력한다', () => {
    const material = 'Opening idea. ① First sentence. ② Second sentence. ③ Third sentence. ④ Fourth sentence.\n\n⑤ Final conclusion remains part of the same passage.'
    expect(collapseCsatProseParagraphs(material, '35')).toBe('Opening idea. ① First sentence. ② Second sentence. ③ Third sentence. ④ Fourth sentence. ⑤ Final conclusion remains part of the same passage.')
    const blocks = buildCsatMaterials('35', material)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].text).not.toContain('\n')
    expect(blocks[0].text).toContain('④ Fourth sentence. ⑤ Final conclusion')
  })

  it('내신형과 맞춤설정형 일반 지문도 출력 단계에서 한 문단으로 합친다', () => {
    for (const mode of ['school', 'custom'] as const) {
      const blocks = buildGeneralMaterials(mode, 'First paragraph.\n\nLast paragraph.')
      expect(blocks).toHaveLength(1)
      expect(blocks[0].text).toBe('First paragraph. Last paragraph.')
    }
  })

  it('36·37번은 도입문과 A·B·C 경계만 유지하고 구획 내부 줄바꿈을 제거한다', () => {
    const material = 'Lead sentence.\n\n(A) First line.\nSecond line.\n\n(B) Middle line.\n\n(C) Final line.'
    expect(normalizePassageForPresentation(material, '36')).toBe('Lead sentence.\n\n(A) First line. Second line.\n\n(B) Middle line.\n\n(C) Final line.')
    expect(buildCsatMaterials('36', material).map((block) => block.text)).toEqual([
      'Lead sentence.', '(A) First line. Second line.', '(B) Middle line.', '(C) Final line.',
    ])
    expect(hasUnnecessaryPassageBreaks('Lead.\n\n(A) A.\n\n(B) B.\n\n(C) C.', '36')).toBe(false)
    expect(hasUnnecessaryPassageBreaks('Lead.\nExtra line.\n\n(A) A.\n\n(B) B.\n\n(C) C.', '36')).toBe(true)
  })

  it('38~42번은 필수 상자·표식은 유지하면서 내부 텍스트를 한 문단으로 만든다', () => {
    expect(normalizePassageForPresentation('[[삽입문장:Given sentence.]]\n\nBody first.\nBody last.', '38'))
      .toBe('[[삽입문장:Given sentence.]] Body first. Body last.')
    expect(normalizePassageForPresentation('Source first.\n\nSource last. [[요약빈칸:A]] and [[요약빈칸:B]]', '40'))
      .toBe('Source first. Source last. [[요약빈칸:A]] and [[요약빈칸:B]]')
    expect(buildCsatMaterials('41-42', 'Long passage first.\n\nLong passage last.')).toHaveLength(1)
  })

  it('40번의 한 material 문자열을 원문과 요약문으로 분리한다', () => {
    const material = 'Source first. Source last.\n\nThe result is [[요약빈칸:A]] while the response is [[요약빈칸:B]].'
    expect(splitCsatSummaryMaterial(material)).toEqual({
      passage: 'Source first. Source last.',
      summary: 'The result is [[요약빈칸:A]] while the response is [[요약빈칸:B]].',
    })
    expect(hasUnnecessaryPassageBreaks(material, '40')).toBe(false)
  })

  it('40번은 줄바꿈이 없어도 요약 빈칸이 포함된 마지막 문장을 분리한다', () => {
    const material = 'Source first. Source last. The result is [[요약빈칸:A]] while the response is [[요약빈칸:B]].'
    expect(splitCsatSummaryMaterial(material)).toEqual({
      passage: 'Source first. Source last.',
      summary: 'The result is [[요약빈칸:A]] while the response is [[요약빈칸:B]].',
    })
  })

  it('43~45번은 A~D 경계만 유지하고 각 구획 내부를 한 문단으로 만든다', () => {
    const material = '(A) First line.\nSecond line.\n\n(B) B text.\n\n(C) C text.\n\n(D) Last line.\nFinal line.'
    expect(buildCsatMaterials('43-45', material).map((block) => block.text)).toEqual([
      'First line. Second line.', 'B text.', 'C text.', 'Last line. Final line.',
    ])
    expect(buildCsatMaterials('43-45', material).map((block) => block.sectionLabel)).toEqual(['A', 'B', 'C', 'D'])
  })

  it('구조화 자료도 인쇄 조립에서 같은 구획 규칙을 사용한다', () => {
    const orderedSet = createEnglishSet('csat')
    orderedSet.id = 'ordered-set'
    const orderedItem = applyCsatItemTemplate(createCsatItem(), '36')
    orderedItem.material = '이 문자열은 구조화 자료가 대신한다.'
    orderedItem.materialSpec = {
      kind: 'ordered',
      lead: 'Lead first.\nLead last.',
      sections: [
        { label: 'A', text: 'A first.\nA last.' },
        { label: 'B', text: 'B first.\nB last.' },
        { label: 'C', text: 'C first.\nC last.' },
      ],
    }
    orderedSet.csatItems = [orderedItem]
    const orderedBlocks = buildExamFlowBlocks(examFor(orderedSet), [orderedSet], [])
    expect(orderedBlocks.filter((block) => block.kind === 'structured-material')).toHaveLength(1)
    expect(orderedBlocks.filter((block) => block.kind === 'material')).toHaveLength(0)

    const summarySet = createEnglishSet('csat')
    summarySet.id = 'summary-set'
    const summaryItem = applyCsatItemTemplate(createCsatItem(), '40')
    summaryItem.material = 'Source first.\n\nSource last.'
    summaryItem.materialSpec = { kind: 'summary', summary: 'Summary first.\nSummary last.' }
    summarySet.csatItems = [summaryItem]
    const summaryBlocks = buildExamFlowBlocks(examFor(summarySet), [summarySet], [])
    const summaryBlock = summaryBlocks.find((block) => block.kind === 'summary-material')
    expect(summaryBlock?.text).toBe('Source first. Source last.')
    expect(summaryBlock?.summaryText).toBe('Summary first. Summary last.')
    expect(summaryBlocks.filter((block) => block.kind === 'material' || block.kind === 'structured-material')).toHaveLength(0)
  })

  it('최신 결과 검사는 일반 지문의 불필요한 문단 구분을 경고한다', () => {
    const set = createEnglishSet('csat')
    const item = applyCsatItemTemplate(createCsatItem(), '35')
    item.material = '① One. ② Two. ③ Three. ④ Four.\n\n⑤ Five.'
    set.csatItems = [item]
    expect(validateEnglishSet(set).some((issue) => issue.label === '카드 1 · 불필요한 문단 구분')).toBe(true)
  })
})
