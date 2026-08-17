import { describe, expect, it } from 'vitest'
import { applyCsatItemTemplate, createCsatItem, createCsatQuestions } from './csat'
import { ENGLISH_TOPIC_PRESETS, applyCustomPreset, assignAutomaticCsatTopics, createEnglishSet, createExamLayout, createQuestion, defaultQuestionStem, generateEnglishPrompt, generateReviewPrompt, layoutForFirstSelectedSet, parseEnglishSetJson, preferredExamPresetForSets } from './english'
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
    const prompt = generateEnglishPrompt(createEnglishSet('school'))
    expect(prompt).toContain('서술형은 만들지 않고 객관식만')
    expect(prompt).toContain('explanation, intention, evidenceRefs, distractorReasons는 출력하지 않는다')
    expect(generateEnglishPrompt(createEnglishSet('custom'))).toContain('맞춤설정형')
  })

  it('내신형 문항 유형마다 계약에 맞는 기본 발문을 제공한다', () => {
    expect(defaultQuestionStem('내용 이해')).toBe('다음 글의 내용으로부터 추론할 수 있는 것은?')
    expect(defaultQuestionStem('내용 일치 및 불일치')).toBe('다음 글의 내용과 일치하지 않는 것은?')
    expect(defaultQuestionStem('순서 배열')).toBe('주어진 글 다음에 이어질 글의 순서로 가장 적절한 것은?')
    expect(defaultQuestionStem('문장 삽입')).toBe('글의 흐름으로 보아, 주어진 문장이 들어가기에 가장 적절한 곳은?')
    expect(defaultQuestionStem('어법')).toBe('다음 글의 밑줄 친 부분 중, 어법상 틀린 것은?')
    expect(defaultQuestionStem('요약문 완성')).toContain('(A)와 (B)')
    expect(defaultQuestionStem('내용 이해', 'en')).toBe('Which of the following can be inferred from the passage?')
    expect(defaultQuestionStem('문장 삽입', 'en')).toBe('Where is the most appropriate place for the given sentence?')
    expect(defaultQuestionStem('요약문 완성', 'en')).toContain('blanks (A) and (B)')
  })

  it('새 자료 내신형 프롬프트와 가져오기가 문항별 영어 발문·선지 설정을 보존한다', () => {
    const set = createEnglishSet('school')
    const question = createQuestion('내용 이해', 5, 'school')
    question.schoolStemLanguage = 'en'
    question.schoolChoiceLanguage = 'en'
    question.stem = defaultQuestionStem(question.type, 'en')
    set.questions = [question]
    const prompt = generateEnglishPrompt(set)
    expect(prompt).toContain('발문 언어: 영어')
    expect(prompt).toContain('선지 언어: 영어')

    const choices = ['The student compares two accounts.', 'The teacher removes every uncertainty.', 'The class ignores conflicting evidence.', 'The learner memorizes one explanation.', 'The group avoids making judgments.']
    const imported = parseEnglishSetJson(JSON.stringify({ title: 'English labels', materialTitle: '', material: 'Students compare accounts before reaching a conclusion.', materialSpec: null, questions: [{ type: question.type, stem: question.stem, choices, answerIndex: 1, score: 2 }] }), set)
    expect(imported.questions[0]).toMatchObject({ schoolStemLanguage: 'en', schoolChoiceLanguage: 'en', stem: question.stem, choices })

    const invalidChoices = [...choices]
    invalidChoices[2] = '학생은 근거를 비교한다.'
    expect(() => parseEnglishSetJson(JSON.stringify({ title: 'Mixed labels', materialTitle: '', material: 'Students compare accounts before reaching a conclusion.', materialSpec: null, questions: [{ type: question.type, stem: question.stem, choices: invalidChoices, answerIndex: 1, score: 2 }] }), set)).toThrow(/영어 선지/)
  })

  it('새 자료 내신형은 문장 삽입을 포함한 다문항을 한 번의 전용 경로로 요청한다', () => {
    const set = createEnglishSet('school')
    set.questions = [createQuestion('내용 이해'), createQuestion('문장 삽입'), createQuestion('어법')]
    const prompt = generateEnglishPrompt(set)
    expect(prompt.startsWith('[SCHOOL_ENGLISH_GENERATION_V0.2]')).toBe(true)
    expect(prompt).toContain('mode는 school_english_generated_passage다')
    expect(prompt).toContain('- 문항 2: 어법')
    expect(prompt).toContain('- 문항 3: 문장 삽입')
    expect(prompt).toContain('하나의 공통 material을 공유')
    expect(prompt).toContain('questions 배열의 마지막 문항')
    expect(prompt).toContain('글의 흐름으로 보아, 주어진 문장이 들어가기에 가장 적절한 곳은?')
    expect(prompt).not.toContain('sourcePassageId가 비어')
  })

  it('새 자료 한 세트에 서로 다른 문장 삽입 두 개를 요청하지 못하게 막는다', () => {
    const set = createEnglishSet('school')
    set.questions = [createQuestion('문장 삽입'), createQuestion('문장 삽입')]
    expect(() => generateEnglishPrompt(set)).toThrow(/한 문항만/)
  })

  it('내신형 새 자료는 한 번에 최대 5문항까지만 생성한다', () => {
    const set = createEnglishSet('school')
    set.questions = Array.from({ length: 5 }, () => createQuestion('내용 이해'))
    expect(generateEnglishPrompt(set)).toContain('한 세트에서 생성하는 문항은 최대 5개')

    set.questions = [...set.questions, createQuestion('내용 일치 및 불일치')]
    expect(() => generateEnglishPrompt(set)).toThrow(/최대 5문항/)
  })

  it('새 자료 내신형 JSON은 일반 문항 뒤에 삽입 문항을 정규화하고 설계 유형·발문을 보존한다', () => {
    const set = createEnglishSet('school')
    const content = createQuestion('내용 이해')
    const insertion = createQuestion('문장 삽입')
    const grammar = createQuestion('어법')
    set.questions = [content, insertion, grammar]
    const questionJson = (question: ReturnType<typeof createQuestion>) => ({
      type: question.type,
      stem: question.stem,
      choices: question.type === '문장 삽입' ? ['①', '②', '③', '④', '⑤'] : ['a', 'b', 'c', 'd', 'e'],
      answerIndex: 2,
      explanation: '해설',
      intention: '출제 의도',
      evidenceRefs: ['First sentence.'],
      distractorReasons: ['1', '2', '3', '4'],
      score: 2,
    })
    const material = 'First sentence. [[삽입위치:①]] [[삽입문장:Given sentence.]] Second sentence. [[삽입위치:②]] Third sentence. [[삽입위치:③]] Fourth sentence. [[삽입위치:④]] Fifth sentence. [[삽입위치:⑤]] A rule [[밑줄:apply]] here.'
    const raw = JSON.stringify({ title: 'Generated school', materialTitle: '', material, materialSpec: null, questions: [questionJson(insertion), questionJson(content), questionJson(grammar)] })
    const imported = parseEnglishSetJson(raw, set)

    expect(imported.questions.map((question) => question.type)).toEqual(['내용 이해', '어법', '문장 삽입'])
    expect(imported.questions.map((question) => question.stem)).toEqual([content.stem, grammar.stem, insertion.stem])
    expect(imported.material).toBe(material)
    expect(imported.aiRevision).toBe(1)
  })

  it('새 자료 내신형 JSON의 삽입 위치가 누락되면 전체 가져오기를 거부한다', () => {
    const set = createEnglishSet('school')
    const insertion = createQuestion('문장 삽입')
    set.questions = [insertion]
    const raw = JSON.stringify({
      title: 'Broken insertion', materialTitle: '', material: 'First. [[삽입문장:Given.]] [[삽입위치:①]] Second.', materialSpec: null,
      questions: [{ type: insertion.type, stem: insertion.stem, choices: ['①', '②', '③', '④', '⑤'], answerIndex: 1, explanation: '해설', intention: '의도', evidenceRefs: ['First.'], distractorReasons: ['2', '3', '4', '5'], score: 2 }],
    })
    expect(() => parseEnglishSetJson(raw, set)).toThrow(/삽입 위치/)
    expect(set.aiRevision).toBe(0)
  })

  it('새 자료 내신형 요약문을 문항별 (A)·(B) 구조로 가져온다', () => {
    const set = createEnglishSet('school')
    const summary = createQuestion('요약문 완성', 5, 'school')
    set.questions = [summary]
    const summaryText = 'Comparing accounts [[요약빈칸:A]] learners to [[요약빈칸:B]] their judgments.'
    const raw = JSON.stringify({
      title: 'Summary set', materialTitle: '', material: 'Learners compare accounts, inspect evidence, and revise their judgments.', materialSpec: null,
      questions: [{ type: summary.type, stem: summary.stem, summaryText, choices: ['enables|revise', 'prevents|repeat', 'forces|ignore', 'allows|copy', 'stops|preserve'], answerIndex: 1, score: 2 }],
    })
    const imported = parseEnglishSetJson(raw, set)

    expect(imported.questions[0].schoolSummaryText).toBe(summaryText)
    expect(imported.questions[0].schoolChoiceLayout).toBe('matrix')
    expect(generateEnglishPrompt(set)).toContain('summaryText')
  })

  it('요약문 (A)·(B) 표식이나 단어쌍이 빠지면 가져오기를 거부한다', () => {
    const set = createEnglishSet('school')
    const summary = createQuestion('요약문 완성', 5, 'school')
    set.questions = [summary]
    const base = { title: 'Summary set', materialTitle: '', material: 'A source passage.', materialSpec: null }
    const question = { type: summary.type, stem: summary.stem, summaryText: 'A claim [[요약빈칸:A]] evidence.', choices: ['supports|carefully', 'rejects|quickly', 'copies|fully', 'hides|often', 'shows|clearly'], answerIndex: 1, score: 2 }
    expect(() => parseEnglishSetJson(JSON.stringify({ ...base, questions: [question] }), set)).toThrow(/요약빈칸:B/)
    expect(() => parseEnglishSetJson(JSON.stringify({ ...base, questions: [{ ...question, summaryText: 'A claim [[요약빈칸:A]] evidence and [[요약빈칸:B]] limits.', choices: ['supports', 'rejects|quickly', 'copies|fully', 'hides|often', 'shows|clearly'] }] }), set)).toThrow(/A단어\|B단어/)
  })

  it('수능형 세트가 있으면 새 시험지의 권장 기본 양식을 수능형으로 정한다', () => {
    expect(createExamLayout().preset).toBe('school-exam')
    expect(preferredExamPresetForSets([createEnglishSet('school')])).toBe('school-exam')
    expect(preferredExamPresetForSets([createEnglishSet('school'), createEnglishSet('csat')])).toBe('csat')
  })

  it('빈 학교형 시험지에 첫 수능형 세트를 넣을 때만 수능형 양식을 적용한다', () => {
    const schoolLayout = { ...createExamLayout('school-exam'), institution: '테스트 학원' }
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
