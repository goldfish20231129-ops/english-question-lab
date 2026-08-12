import { describe, expect, it } from 'vitest'
import { applyCsatItemTemplate, createCsatItem, createCsatQuestions } from './csat'
import { ENGLISH_TOPIC_PRESETS, applyCustomPreset, assignAutomaticCsatTopics, createEnglishSet, createExamLayout, generateEnglishPrompt, generateReviewPrompt, layoutForFirstSelectedSet, parseEnglishSetJson, preferredExamPresetForSets } from './english'
import { createBackup, normalizeUiSettings, parseBackup } from './storage'

describe('영어 세트 공통 흐름', () => {
  it('인쇄 미리보기에서 종료했어도 다음 실행은 안전한 세트 제작 화면에서 시작한다', () => {
    expect(normalizeUiSettings({ screen: 'preview', activeMode: 'csat' })).toEqual({ screen: 'sets', activeMode: 'csat' })
    expect(normalizeUiSettings({ screen: 'assembly', activeMode: 'school' })).toEqual({ screen: 'assembly', activeMode: 'school' })
  })

  it('수능형은 템플릿 선택 전 생성을 막고 선택 후 일괄 프롬프트를 만든다', () => {
    const set = createEnglishSet('csat')
    expect(() => generateEnglishPrompt(set)).toThrow(/템플릿/)
    set.csatItems = [applyCsatItemTemplate(createCsatItem(), '18')]
    expect(generateEnglishPrompt(set)).toContain('수능형 다중 문항 일괄 제작')
  })

  it('비어 있는 수능형 카드 소재만 빠른 선택 후보에서 자동 배정하고 사용자 설정은 보존한다', () => {
    const set = createEnglishSet('csat')
    const first = applyCsatItemTemplate(createCsatItem(), '18')
    const second = { ...applyCsatItemTemplate(createCsatItem(), '33'), topic: '사용자가 정한 생태학 소재' }
    set.csatItems = [first, second]
    const prepared = assignAutomaticCsatTopics(set)
    const repeated = assignAutomaticCsatTopics(set)

    expect(ENGLISH_TOPIC_PRESETS).toContain(prepared.csatItems?.[0].topic as typeof ENGLISH_TOPIC_PRESETS[number])
    expect(prepared.csatItems?.[0].topic).toBe(repeated.csatItems?.[0].topic)
    expect(prepared.csatItems?.[1].topic).toBe('사용자가 정한 생태학 소재')
    const prompt = generateEnglishPrompt(set)
    expect(prompt).toContain(`주제·소재 “${prepared.csatItems?.[0].topic}”`)
    expect(prompt).toContain('주제·소재 “사용자가 정한 생태학 소재”')
    expect(prompt).not.toContain('교육적이고 중립적인 주제')
  })

  it('사용자가 세트 공통 소재를 정하면 카드별 자동 배정을 하지 않는다', () => {
    const set = createEnglishSet('csat')
    set.topic = '사용자가 정한 공통 주제'
    set.csatItems = [applyCsatItemTemplate(createCsatItem(), '18')]
    const prepared = assignAutomaticCsatTopics(set)
    expect(prepared).toBe(set)
    expect(generateEnglishPrompt(set)).toContain('주제·소재 “사용자가 정한 공통 주제”')
  })

  it('내신형과 맞춤설정형의 기존 프롬프트 흐름을 유지한다', () => {
    expect(generateEnglishPrompt(createEnglishSet('school'))).toContain('서술형은 만들지 않고 객관식만')
    expect(generateEnglishPrompt(createEnglishSet('custom'))).toContain('맞춤설정형')
  })

  it('수능형 세트가 있으면 새 시험지의 권장 기본 양식을 수능형으로 정한다', () => {
    expect(preferredExamPresetForSets([createEnglishSet('school')])).toBe('school')
    expect(preferredExamPresetForSets([createEnglishSet('school'), createEnglishSet('csat')])).toBe('csat')
  })

  it('빈 학교형 시험지에 첫 수능형 세트를 넣을 때만 수능형 양식을 적용한다', () => {
    const schoolLayout = { ...createExamLayout('school'), institution: '테스트 학원' }
    const csatSet = createEnglishSet('csat')
    const next = layoutForFirstSelectedSet(schoolLayout, csatSet, false)
    expect(next).toMatchObject({ preset: 'csat', columns: 2, institution: '테스트 학원' })
    expect(layoutForFirstSelectedSet(schoolLayout, csatSet, true)).toBe(schoolLayout)
    const customLayout = createExamLayout('custom')
    expect(layoutForFirstSelectedSet(customLayout, csatSet, false)).toBe(customLayout)
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
    const question = { type: '목적', stem: item.questions[0].stem, choices: ['a', 'b', 'c', 'd', 'e'], answerIndex: 2, explanation: '해설', intention: '목적 파악', evidenceRefs: ['Evidence.'], distractorReasons: ['1', '2', '3', '4'], score: 2 }
    const qualityReview = { passage: { naturalness: 9, logicStructure: 9, vocabularyLevel: 9, templateFidelity: 9 }, questions: [{ slot: '18', answerInference: 9, distractorPlausibility: 9, choiceBalance: 9, directAnswerOverlap: false, strongestDistractorIndex: 1, decisiveReason: 'Evidence.', expectedDifficulty: 1 }] }
    const raw = '```json\n' + JSON.stringify({ title: 'Set', items: [{ itemId: item.id, templateId: '18', variantId: 'standard', materialTitle: '', material: 'Evidence.', materialSpec: null, questions: [question], qualityReview }] }) + '\n```'
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
