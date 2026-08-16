import { describe, expect, it } from 'vitest'
import { createEnglishSet, generateEnglishPrompt } from './english'
import { transitionSchoolProvidedPassageMode } from './providedPassage'
import {
  adaptProvidedPassageV02Response, buildProvidedPassageV02Request, createProvidedPassageV02Plan,
  generateProvidedPassageV02Prompt, orderedProvidedPassageV02Plans, providedPassageV02BlockingReason, providedPassageV02DefaultStem, providedPassageV02GrammarPresentation,
  providedPassageV02PresentationSpec, providedPassageV02QuestionMaterialText, providedPassageV02TransitionBlockingReason,
  providedPassageV02SharedMaterialText, syncProvidedPassageV02Questions, transitionSchoolProvidedPassageV02,
} from './providedPassageV02'
import type { EnglishQuestionSet, ProvidedPassageV02ItemPlan } from './types'

const PASSAGE = 'The student who leads the club arrives early. She checks the room before every meeting. The members bring their own notebooks. They discuss one local problem each week. The group records its ideas carefully. Their teacher reads the final notes.'

function configured(plans?: ProvidedPassageV02ItemPlan[]) {
  const seed = createEnglishSet('school')
  seed.material = PASSAGE
  let set = transitionSchoolProvidedPassageV02(seed, 'provided')
  if (plans) set = { ...set, providedPassageV02: { ...set.providedPassageV02!, itemPlans: plans }, questions: syncProvidedPassageV02Questions(set, plans) }
  return set
}

function quality(answerIndex: number) {
  return { passage: { naturalness: 9, logicStructure: 9, vocabularyLevel: 8, templateFidelity: 9 }, questions: [{ slot: 'provided', answerInference: 8, distractorPlausibility: 8, choiceBalance: 8, directAnswerOverlap: false, strongestDistractorIndex: answerIndex === 2 ? 3 : 2, decisiveReason: '원문과 선지를 독립적으로 확인했다.', expectedDifficulty: 3 }] }
}

function responseIdentity(item: ReturnType<typeof buildProvidedPassageV02Request>['items'][number]) {
  return { itemId: item.itemId, templateId: item.templateId, variantId: item.variantId, questionType: item.questionType, choiceLanguage: item.choiceLanguage, vocabularyLevel: item.vocabularyLevel, contentMatchPolarity: item.contentMatchPolarity, grammarTarget: item.grammarTarget, grammarMode: item.grammarMode }
}

function response(set: EnglishQuestionSet) {
  const request = buildProvidedPassageV02Request(set)
  const content = request.items[0]
  const grammar = request.items[1]
  const sentence = request.source.sentences[0]
  const start = PASSAGE.indexOf('who')
  const testedSpan = { sentenceId: sentence.id, start, end: start + 3, text: 'who' }
  return {
    schemaId: 'english-question-lab-provided-passage-generation-v0.2', mode: request.mode, subject: request.subject,
    sourcePassageId: request.source.sourcePassageId, sourceFingerprint: request.source.sourceFingerprint, title: 'V0.2 test',
    items: [
      {
        ...responseIdentity(content),
        question: { type: '내용 일치 및 불일치', stem: '다음 글의 내용과 일치하지 않는 것은?', choices: ['학생은 동아리를 이끈다.', '학생은 일찍 도착한다.', '구성원들은 공책을 가져온다.', '교사는 매주 회의를 진행한다.', '교사는 마지막 기록을 읽는다.'], answerIndex: 4, explanation: '교사가 매주 회의를 진행한다는 내용은 없다.', intention: '세부 내용 확인', evidenceSpans: [{ sentenceId: sentence.id, start: sentence.start, end: sentence.end, text: sentence.text }], distractorReasons: ['일치', '일치', '일치', '주체 변경', '일치'], score: 2 }, materialOperation: null, qualityReview: quality(4),
      },
      {
        ...responseIdentity(grammar),
        question: { type: '어법', stem: providedPassageV02DefaultStem('grammar'), choices: ['주격 관계대명사', '목적격 관계대명사', '관계부사', '동격 접속사', '의문대명사'], answerIndex: 1, explanation: 'who는 student를 선행사로 하고 관계절의 주어 역할을 한다.', intention: '관계대명사의 문장 성분 확인', evidenceSpans: [testedSpan], distractorReasons: ['정답', '목적어가 아님', '부사 역할이 아님', '완전한 절이 아님', '의문문이 아님'], score: 2 },
        materialOperation: { kind: 'grammar_check', grammarTarget: 'relative_clause', grammarMode: 'source_form_check', testedSpan, sourceForm: 'who', presentedForm: 'who', ruleCheck: { classification: 'relative_clause', decisionRule: '선행사 student 뒤 불완전한 절에서 주어 역할을 한다.', contrastWith: 'appositive_that', isUniquelyDetermined: true }, sourceTextModified: false }, qualityReview: quality(1),
      },
    ],
  }
}

function insertionResponse(set: EnglishQuestionSet) {
  const request = buildProvidedPassageV02Request(set)
  const item = request.items[0]
  const state = set.providedPassageV02!
  const candidates = state.boundaries.slice(0, 5).map((boundary) => boundary.id)
  const first = state.sentences[0]
  const second = state.sentences[1]
  return {
    schemaId: 'english-question-lab-provided-passage-generation-v0.2', mode: request.mode, subject: request.subject,
    sourcePassageId: state.sourcePassageId, sourceFingerprint: state.sourceFingerprint, title: 'Insertion test',
    items: [{
      ...responseIdentity(item),
      question: { type: '문장 삽입', stem: providedPassageV02DefaultStem('sentence_insertion'), choices: ['①', '②', '③', '④', '⑤'], answerIndex: 2, explanation: '앞뒤 연결이 일치한다.', intention: '문장 연결 관계 확인', evidenceSpans: [{ sentenceId: first.id, start: first.start, end: first.end, text: first.text }], distractorReasons: ['연결 불일치', '정답', '지시어 불일치', '인과 불일치', '주제 전환'], score: 2 },
      materialOperation: { kind: 'insert_sentence', generatedSentence: 'This pattern also appears in their weekly discussion.', candidateBoundaryIds: candidates, answerBoundaryId: candidates[1], positionReasons: candidates.map((boundaryId) => ({ boundaryId, reason: `${boundaryId}의 앞뒤 결속을 확인한다.` })), beforeEvidence: { sentenceId: first.id, start: first.start, end: first.end, text: first.text }, afterEvidence: { sentenceId: second.id, start: second.start, end: second.end, text: second.text }, lexicalLevel: item.vocabularyLevel },
      qualityReview: quality(2),
    }],
  }
}

function mixedResponse() {
  const contentPlan = createProvidedPassageV02Plan('content-1', 'content_match')
  const grammarPlan = createProvidedPassageV02Plan('grammar-1', 'grammar')
  const insertionPlan = createProvidedPassageV02Plan('insert-1', 'sentence_insertion')
  const contentAndGrammar = response(configured([contentPlan, grammarPlan]))
  const insertion = insertionResponse(configured([insertionPlan]))
  return {
    ...contentAndGrammar,
    title: 'Mixed V0.2 test',
    items: [contentAndGrammar.items[0], insertion.items[0], contentAndGrammar.items[1]],
  }
}

describe('Provided Passage V0.2', () => {
  it('builds a strict multi-item request with a grammar target', () => {
    const first = createProvidedPassageV02Plan('content-1', 'content_match')
    const second = { ...createProvidedPassageV02Plan('grammar-1', 'grammar'), grammarTarget: 'relative_clause' as const }
    const request = buildProvidedPassageV02Request(configured([first, second]))
    expect(request.items).toHaveLength(2)
    expect(request.items[1]).toMatchObject({ templateId: 'school-grammar', grammarTarget: 'relative_clause', grammarMode: 'source_form_check' })
    expect(request.source.passage).toBe(PASSAGE)
  })

  it('builds and imports a distinct content inference item from the shared passage', () => {
    const plan = createProvidedPassageV02Plan('inference-1', 'content_inference')
    const set = configured([plan])
    const request = buildProvidedPassageV02Request(set)
    const item = request.items[0]
    const first = request.source.sentences[0]
    const second = request.source.sentences[1]
    expect(item).toMatchObject({ templateId: 'school-content-inference', questionType: 'content_inference', choiceLanguage: 'ko', contentMatchPolarity: null })
    expect(generateProvidedPassageV02Prompt(set)).toContain('단순 사실 재진술이 아니라')

    const next = adaptProvidedPassageV02Response({
      schemaId: 'english-question-lab-provided-passage-generation-v0.2', mode: request.mode, subject: request.subject,
      sourcePassageId: request.source.sourcePassageId, sourceFingerprint: request.source.sourceFingerprint, title: 'Inference test',
      items: [{
        ...responseIdentity(item),
        question: {
          type: '내용 이해', stem: providedPassageV02DefaultStem('content_inference'),
          choices: ['학생은 모임 준비를 맡고 있다고 추론할 수 있다.', '교사가 모든 토론을 주도한다고 추론할 수 있다.', '구성원은 필기구를 받는다고 추론할 수 있다.', '모임은 매일 열린다고 추론할 수 있다.', '지역 문제는 교사가 정한다고 추론할 수 있다.'],
          answerIndex: 1, explanation: '학생이 동아리를 이끌고 매번 일찍 와서 방을 확인하므로 모임 준비 역할을 맡는다고 추론할 수 있다.', intention: '서로 다른 단서를 종합한 내용 추론',
          evidenceSpans: [{ sentenceId: first.id, start: first.start, end: first.end, text: first.text }, { sentenceId: second.id, start: second.start, end: second.end, text: second.text }],
          distractorReasons: ['정답', '교사가 주도한다는 근거 없음', '공책은 각자 가져옴', '매주 열림', '구성원이 문제를 논의함'], score: 2,
        },
        materialOperation: null, qualityReview: quality(1),
      }],
    }, set)

    expect(next.questions[0]).toMatchObject({ type: '내용 이해', stem: '다음 글의 내용으로부터 추론할 수 있는 것은?' })
    expect(next.questions[0].evidenceRefs).toEqual([first.text, second.text])
    expect(next.material).toBe(PASSAGE)
  })

  it('imports content and grammar items without changing the source passage', () => {
    const plans = [createProvidedPassageV02Plan('content-1', 'content_match'), createProvidedPassageV02Plan('grammar-1', 'grammar')]
    const set = configured(plans)
    const next = adaptProvidedPassageV02Response(response(set), set)
    expect(next.questions.map((question) => question.type)).toEqual(['내용 일치 및 불일치', '어법'])
    expect(next.material).toBe(PASSAGE)
    expect(next.providedPassageV02?.originalText).toBe(PASSAGE)
    expect(next.providedPassageV02?.results?.[1].materialOperation?.kind).toBe('grammar_check')
    expect(providedPassageV02GrammarPresentation(next, 'content-1')).toBeUndefined()
    expect(providedPassageV02GrammarPresentation(next, 'grammar-1')).toMatchObject({ sentenceId: 's1', displayForm: 'who', sourceForm: 'who' })
  })

  it('rejects a grammar operation whose source form is not the exact original span', () => {
    const set = configured([createProvidedPassageV02Plan('content-1', 'content_match'), createProvidedPassageV02Plan('grammar-1', 'grammar')])
    const invalid = response(set)
    ;(invalid.items[1].materialOperation as { sourceForm: string }).sourceForm = 'which'
    expect(() => adaptProvidedPassageV02Response(invalid, set)).toThrow(/sourceForm/)
  })

  it('allows sentence insertion to be mixed while keeping every operation item-specific', () => {
    const plans = [createProvidedPassageV02Plan('content-1', 'content_match'), createProvidedPassageV02Plan('insert-1', 'sentence_insertion'), createProvidedPassageV02Plan('grammar-1', 'grammar')]
    const set = configured(plans)
    expect(providedPassageV02BlockingReason(set)).toBeUndefined()
    const next = adaptProvidedPassageV02Response(mixedResponse(), set)
    expect(next.questions.map((question) => question.type)).toEqual(['내용 일치 및 불일치', '어법', '문장 삽입'])
    expect(next.providedPassageV02?.results?.map((result) => result.itemId)).toEqual(['content-1', 'grammar-1', 'insert-1'])
  })

  it('includes all eight grammar distinctions and the approval gate in the prompt', () => {
    const set = configured([createProvidedPassageV02Plan('grammar-1', 'grammar')])
    const prompt = generateProvidedPassageV02Prompt(set)
    expect(prompt).toContain('관계대명사')
    expect(prompt).toContain('동격 that')
    expect(prompt).toContain('가주어')
    expect(prompt).toContain('강조 it-that')
    expect(prompt).toContain('[내신 영어 기존 지문 다문항 설계안]')
    expect(prompt).toContain('동일한 source.passage 한 지문을 공유')
  })

  it('starts with the V0.2 marker and carries source identity without a legacy material output contract', () => {
    const set = configured()
    const prompt = generateEnglishPrompt(set)
    expect(prompt.startsWith('[PROVIDED_PASSAGE_GENERATION_V0.2]')).toBe(true)
    expect(prompt).toContain(set.providedPassageV02!.sourcePassageId)
    expect(prompt).toContain(set.providedPassageV02!.sourceFingerprint)
    expect(prompt).not.toContain('"material": "전체 영어 지문"')
    expect(prompt).not.toContain('[제작 유형]')
  })

  it('keeps sentence and boundary IDs at the exact authoritative offsets', () => {
    const request = buildProvidedPassageV02Request(configured())
    request.source.sentences.forEach((sentence) => expect(PASSAGE.slice(sentence.start, sentence.end)).toBe(sentence.text))
    request.source.boundaries.forEach((boundary) => expect(boundary.offset).toBeGreaterThanOrEqual(0))
  })

  it('fails closed instead of falling back to the generic school prompt when provided state is missing', () => {
    expect(createEnglishSet('school').materialMode).toBe('generated')
    const legacy = { ...createEnglishSet('school'), materialMode: 'provided' as const, material: PASSAGE, providedPassage: undefined, providedPassageV02: undefined }
    expect(() => generateEnglishPrompt(legacy)).toThrow(/범용 프롬프트/)
  })

  it('synchronizes polarity and question type with contract-managed default stems', () => {
    const set = configured()
    const content = { ...createProvidedPassageV02Plan('content', 'content_match'), contentMatchPolarity: 'match' as const }
    const grammar = createProvidedPassageV02Plan('grammar', 'grammar')
    const questions = syncProvidedPassageV02Questions(set, [content, grammar])
    expect(questions[0].stem).toBe('다음 글의 내용과 일치하는 것은?')
    expect(questions[1].stem).toBe('다음 글의 밑줄 친 부분 중, 어법상 틀린 것은?')
    expect(questions.map((question) => question.stem).join(' ')).not.toContain('문맥상 낱말')
  })

  it('blocks unsupported legacy ordering items without deleting them', () => {
    const set = createEnglishSet('school')
    set.questions[0] = { ...set.questions[0], type: '순서 배열', stem: '직접 작성 발문', choices: ['A', 'B', 'C', 'D', 'E'] }
    const before = JSON.stringify(set.questions)
    expect(providedPassageV02TransitionBlockingReason(set)).toMatch(/지원하지 않는/)
    expect(() => transitionSchoolProvidedPassageV02(set, 'provided')).toThrow(/지원하지 않는/)
    expect(JSON.stringify(set.questions)).toBe(before)
  })

  it('allows content, insertion, and grammar in the same request', () => {
    const allowed = configured([createProvidedPassageV02Plan('content', 'content_match'), createProvidedPassageV02Plan('grammar', 'grammar')])
    expect(() => buildProvidedPassageV02Request(allowed)).not.toThrow()
    const mixed = configured([createProvidedPassageV02Plan('content', 'content_match'), createProvidedPassageV02Plan('insert', 'sentence_insertion')])
    expect(() => buildProvidedPassageV02Request(mixed)).not.toThrow()
  })

  it('keeps insertion markers and grammar presentation scoped to their own item', () => {
    const plans = [createProvidedPassageV02Plan('content-1', 'content_match'), createProvidedPassageV02Plan('insert-1', 'sentence_insertion'), createProvidedPassageV02Plan('grammar-1', 'grammar')]
    const set = configured(plans)
    const next = adaptProvidedPassageV02Response(mixedResponse(), set)
    const insertion = providedPassageV02PresentationSpec(next, 'insert-1')
    expect(insertion?.kind).toBe('insertion')
    expect(insertion && 'body' in insertion ? insertion.body : '').toContain('[[삽입위치:①]]')
    expect(providedPassageV02PresentationSpec(next, 'content-1')).toBeUndefined()
    expect(providedPassageV02PresentationSpec(next, 'grammar-1')).toBeUndefined()
    expect(providedPassageV02QuestionMaterialText(next, 'content-1')).toBe(PASSAGE)
    expect(providedPassageV02QuestionMaterialText(next, 'grammar-1')).toContain('[[밑줄:who]]')
    expect(providedPassageV02QuestionMaterialText(next, 'grammar-1')).not.toContain('[[삽입위치:')
    expect(next.providedPassageV02?.originalText).toBe(PASSAGE)
    expect(providedPassageV02SharedMaterialText(next)).toContain('[[밑줄:who]]')
    expect(providedPassageV02SharedMaterialText(next)).not.toContain('[[삽입위치:')
  })

  it('rejects a response that repeats the authoritative passage', () => {
    const set = configured([createProvidedPassageV02Plan('content-1', 'content_match'), createProvidedPassageV02Plan('grammar-1', 'grammar')])
    const invalid = response(set)
    invalid.title = PASSAGE
    expect(() => adaptProvidedPassageV02Response(invalid, set)).toThrow(/권위 원문 전체/)
  })

  it('rejects legacy material fields and stale vocabulary stems in a V0.2 response', () => {
    const set = configured([createProvidedPassageV02Plan('content-1', 'content_match'), createProvidedPassageV02Plan('grammar-1', 'grammar')])
    const withMaterial = { ...response(set), material: PASSAGE }
    expect(() => adaptProvidedPassageV02Response(withMaterial, set)).toThrow(/지원되지 않는 필드/)
    const staleStem = response(set)
    staleStem.items[1].question.stem = '다음 글의 밑줄 친 부분 중, 문맥상 낱말의 쓰임이 적절하지 않은 것은?'
    expect(() => adaptProvidedPassageV02Response(staleStem, set)).toThrow(/기본 발문/)
  })

  it('rejects fingerprint and sentence identity mismatches', () => {
    const set = configured([createProvidedPassageV02Plan('content-1', 'content_match'), createProvidedPassageV02Plan('grammar-1', 'grammar')])
    const fingerprintMismatch = response(set)
    fingerprintMismatch.sourceFingerprint = `sha256:${'0'.repeat(64)}`
    expect(() => adaptProvidedPassageV02Response(fingerprintMismatch, set)).toThrow(/fingerprint/)
    const sentenceMismatch = response(set)
    sentenceMismatch.items[0].question.evidenceSpans[0].sentenceId = 's99'
    expect(() => adaptProvidedPassageV02Response(sentenceMismatch, set)).toThrow(/sentenceId/)
  })

  it('rejects unknown insertion boundaries and preserves the original set atomically', () => {
    const set = configured([createProvidedPassageV02Plan('insert-1', 'sentence_insertion')])
    const before = JSON.stringify(set)
    const invalid = insertionResponse(set)
    invalid.items[0].materialOperation.candidateBoundaryIds[0] = 'b999'
    expect(() => adaptProvidedPassageV02Response(invalid, set)).toThrow(/삽입 경계/)
    expect(JSON.stringify(set)).toBe(before)
  })

  it('rejects insertion evidence that is not adjacent to the answer boundary', () => {
    const set = configured([createProvidedPassageV02Plan('insert-1', 'sentence_insertion')])
    const invalid = insertionResponse(set)
    invalid.items[0].materialOperation.answerBoundaryId = invalid.items[0].materialOperation.candidateBoundaryIds[2]
    expect(() => adaptProvidedPassageV02Response(invalid, set)).toThrow(/바로 앞·뒤/)
  })

  it('rejects insertion candidate boundaries that are not in source order', () => {
    const set = configured([createProvidedPassageV02Plan('insert-1', 'sentence_insertion')])
    const invalid = insertionResponse(set)
    const first = invalid.items[0].materialOperation.candidateBoundaryIds[0]
    invalid.items[0].materialOperation.candidateBoundaryIds[0] = invalid.items[0].materialOperation.candidateBoundaryIds[1]
    invalid.items[0].materialOperation.candidateBoundaryIds[1] = first
    expect(() => adaptProvidedPassageV02Response(invalid, set)).toThrow(/원문 순서/)
  })

  it('blocks corrupted stored sentence and boundary offsets before request generation', () => {
    const sentenceBroken = configured()
    sentenceBroken.providedPassageV02!.sentences[0].start += 1
    expect(providedPassageV02BlockingReason(sentenceBroken)).toMatch(/sentence ID·offset/)
    const boundaryBroken = configured()
    boundaryBroken.providedPassageV02!.boundaries[0].offset += 1
    expect(providedPassageV02BlockingReason(boundaryBroken)).toMatch(/boundary ID·offset/)
  })

  it('retains V0.1 read compatibility and leaves CSAT on its own prompt path', () => {
    const oldSeed = createEnglishSet('school')
    oldSeed.material = PASSAGE
    const v01 = transitionSchoolProvidedPassageMode(oldSeed, 'provided')
    expect(generateEnglishPrompt(v01)).toContain('[PROVIDED_PASSAGE_GENERATION_V0.1]')
    const csat = createEnglishSet('csat')
    expect(() => generateEnglishPrompt(csat)).toThrow(/번호 템플릿/)
  })

  it('preserves every supported existing question when explicitly moving to V0.2', () => {
    const seed = createEnglishSet('school')
    seed.material = PASSAGE
    seed.questions = [
      { ...seed.questions[0], id: 'content', type: '내용 일치 및 불일치', stem: '다음 글의 내용과 일치하지 않는 것은?' },
      { ...seed.questions[0], id: 'grammar', type: '어법', stem: '다음 글의 밑줄 친 부분 중, 어법상 틀린 것은?' },
    ]
    const next = transitionSchoolProvidedPassageV02(seed, 'provided')
    expect(next.questions.map((question) => question.id)).toEqual(['content', 'grammar'])
    expect(next.providedPassageV02?.itemPlans.map((plan) => plan.questionType)).toEqual(['content_match', 'grammar'])
  })

  it('preserves an existing content understanding question as an inference plan', () => {
    const seed = createEnglishSet('school')
    seed.material = PASSAGE
    seed.questions = [{ ...seed.questions[0], id: 'inference', type: '내용 이해', stem: '다음 글의 내용으로부터 추론할 수 있는 것은?' }]
    const next = transitionSchoolProvidedPassageV02(seed, 'provided')
    expect(next.questions[0]).toMatchObject({ id: 'inference', type: '내용 이해', stem: '다음 글의 내용으로부터 추론할 수 있는 것은?' })
    expect(next.providedPassageV02?.itemPlans[0].questionType).toBe('content_inference')
  })

  it('preserves an existing mixed insertion set when explicitly moving to V0.2', () => {
    const seed = createEnglishSet('school')
    seed.material = PASSAGE
    seed.questions = [
      { ...seed.questions[0], id: 'content', type: '내용 일치 및 불일치', stem: '다음 글의 내용과 일치하지 않는 것은?' },
      { ...seed.questions[0], id: 'insert', type: '문장 삽입', stem: providedPassageV02DefaultStem('sentence_insertion') },
      { ...seed.questions[0], id: 'grammar', type: '어법', stem: providedPassageV02DefaultStem('grammar') },
    ]
    const next = transitionSchoolProvidedPassageV02(seed, 'provided')
    expect(next.questions.map((question) => question.id)).toEqual(['content', 'grammar', 'insert'])
    expect(next.providedPassageV02?.itemPlans.map((plan) => plan.questionType)).toEqual(['content_match', 'grammar', 'sentence_insertion'])
  })

  it('keeps regular plan order and always places the single insertion plan last', () => {
    const content = createProvidedPassageV02Plan('content', 'content_match')
    const insertion = createProvidedPassageV02Plan('insert', 'sentence_insertion')
    const grammar = createProvidedPassageV02Plan('grammar', 'grammar')
    expect(orderedProvidedPassageV02Plans([insertion, content, grammar]).map((plan) => plan.itemId)).toEqual(['content', 'grammar', 'insert'])
  })
})
