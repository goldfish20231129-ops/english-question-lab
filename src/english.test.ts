import { describe, expect, it } from 'vitest'
import { applyCsatItemTemplate, createCsatItem, createCsatQuestions } from './csat'
import { applyCustomPreset, createEnglishSet, generateEnglishPrompt, generateReviewPrompt, parseEnglishSetJson } from './english'
import { createBackup, parseBackup } from './storage'

describe('영어 세트 공통 흐름', () => {
  it('수능형은 템플릿 선택 전 생성을 막고 선택 후 일괄 프롬프트를 만든다', () => {
    const set = createEnglishSet('csat')
    expect(() => generateEnglishPrompt(set)).toThrow(/템플릿/)
    set.csatItems = [applyCsatItemTemplate(createCsatItem(), '18')]
    expect(generateEnglishPrompt(set)).toContain('수능형 다중 문항 일괄 제작')
  })

  it('내신형과 맞춤설정형의 기존 프롬프트 흐름을 유지한다', () => {
    expect(generateEnglishPrompt(createEnglishSet('school'))).toContain('서술형은 만들지 않고 객관식만')
    expect(generateEnglishPrompt(createEnglishSet('custom'))).toContain('맞춤설정형')
  })

  it('맞춤형 프리셋은 기존 문항 조합을 유지한다', () => {
    const set = createEnglishSet('custom')
    const patch = applyCustomPreset(set, '단원별 미니 테스트')
    expect(patch.questions).toHaveLength(5)
    expect(patch.customPreset).toBe('단원별 미니 테스트')
  })

  it('수정 JSON 재가져오기는 세트 리비전을 한 번만 올린다', () => {
    const base = createEnglishSet('csat')
    const item = applyCsatItemTemplate(createCsatItem(), '18')
    base.csatItems = [item]
    const question = { ...item.questions[0], choices: ['a', 'b', 'c', 'd', 'e'], answerIndex: 2, explanation: '해설', evidenceRefs: ['Evidence.'], distractorReasons: ['1', '2', '3', '4'] }
    const raw = '```json\n' + JSON.stringify({ title: 'Set', items: [{ itemId: item.id, templateId: '18', variantId: 'standard', material: 'Evidence.', questions: [question] }] }) + '\n```'
    const next = parseEnglishSetJson(raw, base)
    expect(next.aiRevision).toBe(1)
    expect(next.validatedRevision).toBe(0)
    expect(next.csatItems?.[0].questions[0].answerIndex).toBe(2)
  })

  it('재검토 프롬프트는 최신 일괄 JSON 스냅샷을 사용한다', () => {
    const set = createEnglishSet('csat')
    set.csatItems = [applyCsatItemTemplate(createCsatItem(), '18')]
    set.aiRevision = 3
    set.lastImportedJson = '{"marker":"latest"}'
    expect(generateReviewPrompt(set, [])).toContain('AI 결과 리비전 3')
    expect(generateReviewPrompt(set, [])).toContain('latest')
  })
})

describe('저장과 백업 호환성', () => {
  it('영어 백업 식별자를 유지하고 기존 단일 수능 세트를 카드로 복원한다', () => {
    const legacy = createEnglishSet('csat')
    legacy.csatItems = undefined
    legacy.material = 'Legacy passage.'
    legacy.questions = createCsatQuestions('18')
    const backup = createBackup({ questionSets: [legacy], exams: [], mediaAssets: [] }, { screen: 'sets', activeMode: 'csat' })
    const restored = parseBackup(backup)
    expect(restored.appId).toBe('english-question-lab')
    expect(restored.data.questionSets[0].csatItems).toHaveLength(1)
    expect(() => parseBackup({ projects: [] })).toThrow(/기존 국어 데이터/)
  })
})
