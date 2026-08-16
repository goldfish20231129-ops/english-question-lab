import { describe, expect, it } from 'vitest'
import { applyCsatItemTemplate, createCsatItem } from './csat'
import { createEnglishSet, generateEnglishPrompt, parseEnglishSetJson, validateEnglishSet } from './english'
import {
  PROVIDED_PASSAGE_REQUEST_SCHEMA_ID, PROVIDED_PASSAGE_RESPONSE_SCHEMA_ID, adaptProvidedPassageResponse,
  buildProvidedPassageRequest, createProvidedPassageState, fingerprintProvidedPassage,
  generateProvidedPassagePrompt, isProvidedPassageSet, normalizeProvidedPassageForFingerprint, providedPassagePresentationSpec,
  providedPassageBlockingReason, SCHOOL_ENGLISH_PROVIDED_PASSAGE_MODE, SCHOOL_ENGLISH_SUBJECT,
  segmentProvidedPassage, sha256Hex, transitionSchoolProvidedPassageMode,
} from './providedPassage'
import type { EnglishQuestion, EnglishQuestionSet, ProvidedPassageQuestionType, ProvidedPassageVocabularyLevel } from './types'

const PASSAGE = 'Mina planted herbs beside her window. The plants received morning light. She recorded their growth each week. Her notes showed that basil grew fastest. She shared the results with her class. The class planned a second experiment.'

function configuredSet(questionType: ProvidedPassageQuestionType = 'content_match', vocabularyLevel: ProvidedPassageVocabularyLevel = 'source_matched') {
  const seed = createEnglishSet('school')
  seed.material = PASSAGE
  seed.materialTitle = 'Window Herbs'
  seed.questions[0].type = questionType === 'content_match' ? '내용 일치 및 불일치' : '문장 삽입'
  const set = transitionSchoolProvidedPassageMode(seed, 'provided')
  set.providedPassage = createProvidedPassageState(PASSAGE, {
    questionType,
    vocabularyLevel,
    choiceLanguage: 'ko',
    contentMatchPolarity: 'mismatch',
  })
  return set
}

function quality(question: EnglishQuestion) {
  return {
    passage: { naturalness: 9, logicStructure: 9, vocabularyLevel: 9, templateFidelity: 9 },
    questions: [{
      slot: question.type,
      answerInference: 9, distractorPlausibility: 9, choiceBalance: 9, directAnswerOverlap: false,
      strongestDistractorIndex: 2, decisiveReason: 'Only one option conflicts with the cited source span.', expectedDifficulty: 3,
    }],
  }
}

function span(set: EnglishQuestionSet, sentenceIndex = 0) {
  const state = set.providedPassage!
  const sentence = state.sentences[sentenceIndex]
  return { sentenceId: sentence.id, start: sentence.start, end: sentence.end, text: sentence.text }
}

function contentResponse(set: EnglishQuestionSet, language: 'ko' | 'en' = 'ko') {
  const item = set.questions[0]
  const source = set.providedPassage!
  return {
    schemaId: PROVIDED_PASSAGE_RESPONSE_SCHEMA_ID,
    mode: SCHOOL_ENGLISH_PROVIDED_PASSAGE_MODE,
    subject: SCHOOL_ENGLISH_SUBJECT,
    sourcePassageId: source.sourcePassageId,
    sourceFingerprint: source.sourceFingerprint,
    title: 'Provided passage fixture',
    items: [{
      itemId: item.id, templateId: 'school-content-match', variantId: 'standard', questionType: 'content_match',
      choiceLanguage: language, vocabularyLevel: source.vocabularyLevel, contentMatchPolarity: source.contentMatchPolarity,
      question: {
        type: '내용 일치 및 불일치', stem: '다음 글의 내용과 일치하지 않는 것은?',
        choices: language === 'ko'
          ? ['미나는 창가에 허브를 심었다.', '식물은 아침 햇빛을 받았다.', '그녀는 매주 성장을 기록했다.', '바질은 가장 느리게 자랐다.', '반은 두 번째 실험을 계획했다.']
          : ['Mina planted herbs by a window.', 'The plants received morning light.', 'She recorded growth every week.', 'Basil grew more slowly than every other herb.', 'The class planned another experiment.'],
        answerIndex: 4, explanation: '넷째 선지만 원문의 성장 기록과 반대이다.', intention: '세부 정보의 일치 여부를 판단한다.',
        evidenceSpans: [span(set, 3)], distractorReasons: ['원문 일치', '원문 일치', '원문 일치', '원문 일치'], score: 2,
      },
      materialOperation: null,
      qualityReview: quality(item),
    }],
  }
}

function insertionResponse(set: EnglishQuestionSet) {
  const item = set.questions[0]
  const source = set.providedPassage!
  return {
    schemaId: PROVIDED_PASSAGE_RESPONSE_SCHEMA_ID,
    mode: SCHOOL_ENGLISH_PROVIDED_PASSAGE_MODE,
    subject: SCHOOL_ENGLISH_SUBJECT,
    sourcePassageId: source.sourcePassageId,
    sourceFingerprint: source.sourceFingerprint,
    title: 'Insertion fixture',
    items: [{
      itemId: item.id, templateId: 'school-sentence-insertion', variantId: 'standard', questionType: 'sentence_insertion',
      choiceLanguage: null, vocabularyLevel: source.vocabularyLevel, contentMatchPolarity: null,
      question: {
        type: '문장 삽입', stem: '글의 흐름으로 보아, 주어진 문장이 들어가기에 가장 적절한 곳은?',
        choices: ['①', '②', '③', '④', '⑤'], answerIndex: 3,
        explanation: '기록 방식과 그 결과 사이가 유일하게 자연스럽다.', intention: '문장 간 결속 관계를 판단한다.',
        evidenceSpans: [span(set, 1), span(set, 2)], distractorReasons: ['주제 도입 전', '기록 전', '결과 뒤', '공유 뒤'], score: 2,
      },
      materialOperation: {
        kind: 'insert_sentence', generatedSentence: 'This routine made the later comparison possible.',
        candidateBoundaryIds: ['b0', 'b1', 'b2', 'b3', 'b4'], answerBoundaryId: 'b2',
        positionReasons: ['b0', 'b1', 'b2', 'b3', 'b4'].map((boundaryId) => ({ boundaryId, reason: boundaryId === 'b2' ? '기록과 결과를 잇는다.' : '인접 개념이 맞지 않는다.' })),
        beforeEvidence: span(set, 1), afterEvidence: span(set, 2), lexicalLevel: source.vocabularyLevel,
      },
      qualityReview: quality(item),
    }],
  }
}

describe('Provided Passage V0.1 source model', () => {
  it('uses a correct deterministic SHA-256 implementation', () => {
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })

  it('normalizes line-ending encodings but preserves case, spaces, and punctuation', () => {
    expect(fingerprintProvidedPassage('A.\r\nB.')).toBe(fingerprintProvidedPassage('A.\nB.'))
    expect(fingerprintProvidedPassage('A. B.')).not.toBe(fingerprintProvidedPassage('a. B.'))
    expect(normalizeProvidedPassageForFingerprint(' A. ')).toBe(' A. ')
  })

  it('creates stable sentence and boundary IDs with exact offsets', () => {
    const first = segmentProvidedPassage(PASSAGE)
    const second = segmentProvidedPassage(PASSAGE)
    expect(first).toEqual(second)
    expect(first.sentences.map((sentence) => sentence.id)).toEqual(['s1', 's2', 's3', 's4', 's5', 's6'])
    expect(first.boundaries.map((boundary) => boundary.id)).toEqual(['b0', 'b1', 'b2', 'b3', 'b4', 'b5', 'b6'])
    first.sentences.forEach((sentence) => expect(PASSAGE.slice(sentence.start, sentence.end)).toBe(sentence.text))
  })

  it('does not split common abbreviations or decimal numbers', () => {
    const text = 'Dr. Lee measured 2.5 liters. The result surprised her! Did she repeat it? Yes.'
    expect(segmentProvidedPassage(text).sentences.map((sentence) => sentence.text)).toEqual([
      'Dr. Lee measured 2.5 liters.', 'The result surprised her!', 'Did she repeat it?', 'Yes.',
    ])
  })
})

describe('Provided Passage V0.1 request and adapter', () => {
  it('switches the UI model to provided mode and back without changing the source passage', () => {
    const original = createEnglishSet('school')
    original.material = PASSAGE
    const provided = transitionSchoolProvidedPassageMode(original, 'provided')
    expect(provided.materialMode).toBe('provided')
    expect(provided.mode).toBe('school')
    expect(provided.questions[0].type).toBe('내용 일치 및 불일치')
    expect(provided.material).toBe(PASSAGE)
    expect(provided.providedPassage?.originalText).toBe(PASSAGE)

    const generated = transitionSchoolProvidedPassageMode(provided, 'generated')
    expect(generated.materialMode).toBe('generated')
    expect(generated.providedPassage).toBeUndefined()
    expect(generated.material).toBe(PASSAGE)
  })

  it('activates the V0.1 route only in the school-design workflow', () => {
    const school = configuredSet('content_match')
    expect(isProvidedPassageSet(school)).toBe(true)
    const csat = createEnglishSet('csat')
    expect(isProvidedPassageSet(csat)).toBe(false)
  })

  it('preserves the existing generated_passage prompt path', () => {
    const set = createEnglishSet('csat')
    set.csatItems = [applyCsatItemTemplate(createCsatItem(), '33')]
    const prompt = generateEnglishPrompt(set)
    expect(prompt).toContain('[수능형 다중 문항 일괄 제작]')
    expect(prompt).not.toContain(PROVIDED_PASSAGE_REQUEST_SCHEMA_ID)
  })

  it('includes the provided source passage exactly once in the request prompt', () => {
    const set = configuredSet('content_match')
    const prompt = generateProvidedPassagePrompt(set)
    expect(prompt.split(PASSAGE)).toHaveLength(2)
    const request = buildProvidedPassageRequest(set)
    expect(request.schemaId).toBe(PROVIDED_PASSAGE_REQUEST_SCHEMA_ID)
    expect(request.mode).toBe(SCHOOL_ENGLISH_PROVIDED_PASSAGE_MODE)
    expect(request.subject).toBe(SCHOOL_ENGLISH_SUBJECT)
    expect(request.item.templateId).toBe('school-content-match')
    expect(request.item.questionCount).toBe(1)
    expect(request.item.requiredCandidateBoundaryCount).toBeNull()
    expect(request.sourcePreservation).toEqual({ authority: 'app_stored_source', responsePassage: 'forbidden', exactFingerprintRequired: true })
    expect(prompt).toContain('[내신 영어 기존 지문 문항 설계안]')
  })

  it('marks choice language as not applicable and requires exactly five insertion candidates', () => {
    const set = configuredSet('sentence_insertion')
    const request = buildProvidedPassageRequest(set)
    expect(request.item.choiceLanguage).toBeNull()
    expect(request.item.requiredCandidateBoundaryCount).toBe(5)
    expect(providedPassageBlockingReason(set)).toBeUndefined()
    const tooShort = 'First sentence. Second sentence. Third sentence.'
    set.material = tooShort
    set.providedPassage = createProvidedPassageState(tooShort, { questionType: 'sentence_insertion' })
    expect(providedPassageBlockingReason(set)).toMatch(/5개 미만/)
  })

  it('imports content-match Korean choices without replacing the original passage', () => {
    const set = configuredSet('content_match')
    const original = set.material
    const next = parseEnglishSetJson(JSON.stringify(contentResponse(set)), set)
    expect(next.material).toBe(original)
    expect(next.providedPassage!.originalText).toBe(original)
    expect(next.questions[0].choices.every((choice) => /[가-힣]/.test(choice))).toBe(true)
  })

  it('imports content-match English choices when requested', () => {
    const set = configuredSet('content_match')
    set.providedPassage!.choiceLanguage = 'en'
    const next = adaptProvidedPassageResponse(contentResponse(set, 'en'), set)
    expect(next.questions[0].choices.every((choice) => !/[가-힣]/.test(choice))).toBe(true)
  })

  it.each(['source_matched', 'grade_1', 'grade_2', 'grade_3_csat'] as const)('imports sentence insertion with %s vocabulary policy', (level) => {
    const set = configuredSet('sentence_insertion', level)
    const next = adaptProvidedPassageResponse(insertionResponse(set), set)
    expect(next.providedPassage!.result!.materialOperation!.lexicalLevel).toBe(level)
    expect(next.material).toBe(PASSAGE)
  })

  it('blocks insertion when fewer than five boundaries exist', () => {
    const set = configuredSet('sentence_insertion')
    const short = 'One sentence ends. Another follows. A third finishes.'
    set.material = short
    set.providedPassage = createProvidedPassageState(short, { questionType: 'sentence_insertion' })
    expect(() => buildProvidedPassageRequest(set)).toThrow(/경계가 5개 미만/)
  })

  it('rejects a source fingerprint mismatch atomically', () => {
    const set = configuredSet('content_match')
    const response = contentResponse(set); response.sourceFingerprint = `sha256:${'0'.repeat(64)}`
    expect(() => adaptProvidedPassageResponse(response, set)).toThrow(/sourceFingerprint/)
    expect(set.aiRevision).toBe(0)
    expect(set.material).toBe(PASSAGE)
  })

  it('rejects the wrong mode, subject, or item identity', () => {
    const set = configuredSet('content_match')
    const wrongMode = contentResponse(set); wrongMode.mode = 'provided_passage' as typeof wrongMode.mode
    expect(() => adaptProvidedPassageResponse(wrongMode, set)).toThrow(/mode|Schema/)
    const wrongSubject = contentResponse(set); wrongSubject.subject = 'Korean' as typeof wrongSubject.subject
    expect(() => adaptProvidedPassageResponse(wrongSubject, set)).toThrow(/subject|Schema/)
    const wrongItem = contentResponse(set); wrongItem.items[0].itemId = 'unknown-item'
    expect(() => adaptProvidedPassageResponse(wrongItem, set)).toThrow(/itemId/)
  })

  it('rejects nonexistent sentence IDs and invalid evidence text', () => {
    const set = configuredSet('content_match')
    const missing = contentResponse(set); missing.items[0].question.evidenceSpans[0].sentenceId = 's99'
    expect(() => adaptProvidedPassageResponse(missing, set)).toThrow(/sentenceId/)
    const altered = contentResponse(set); altered.items[0].question.evidenceSpans[0].text = 'invented evidence'
    expect(() => adaptProvidedPassageResponse(altered, set)).toThrow(/evidence text/)
  })

  it('rejects nonexistent boundaries and unordered candidates', () => {
    const set = configuredSet('sentence_insertion')
    const missing = insertionResponse(set); missing.items[0].materialOperation.candidateBoundaryIds[4] = 'b99'
    missing.items[0].materialOperation.positionReasons[4].boundaryId = 'b99'
    expect(() => adaptProvidedPassageResponse(missing, set)).toThrow(/boundaryId/)
    const unordered = insertionResponse(set); unordered.items[0].materialOperation.candidateBoundaryIds = ['b0', 'b2', 'b1', 'b3', 'b4']
    expect(() => adaptProvidedPassageResponse(unordered, set)).toThrow(/원문 경계 순서/)
    const onlyFour = insertionResponse(set); onlyFour.items[0].materialOperation.candidateBoundaryIds = ['b0', 'b1', 'b2', 'b3']
    expect(() => adaptProvidedPassageResponse(onlyFour, set)).toThrow(/Schema|5/)
  })

  it('rejects a response that tries to return replacement material', () => {
    const set = configuredSet('content_match')
    const response = contentResponse(set) as ReturnType<typeof contentResponse> & { material?: string }
    response.material = 'replacement'
    expect(() => adaptProvidedPassageResponse(response, set)).toThrow(/지원되지 않는 필드/)
  })

  it('derives insertion markers only for presentation and leaves source text unchanged', () => {
    const set = configuredSet('sentence_insertion')
    const next = adaptProvidedPassageResponse(insertionResponse(set), set)
    const presentation = providedPassagePresentationSpec(next)
    expect(presentation?.kind).toBe('insertion')
    expect(presentation && 'body' in presentation ? (presentation.body.match(/\[\[삽입위치:/g) ?? []).length : 0).toBe(5)
    expect(next.material).toBe(PASSAGE)
    expect(next.material).not.toContain('[[삽입위치:')
    expect(validateEnglishSet(next).some((issue) => issue.label === '삽입 표식 확인')).toBe(false)
  })

  it('rejects mixed-language content choices', () => {
    const set = configuredSet('content_match')
    const response = contentResponse(set); response.items[0].question.choices[0] = 'English only sentence.'
    expect(() => adaptProvidedPassageResponse(response, set)).toThrow(/모두 한국어/)
  })

  it('rejects duplicate choices and a strongest distractor that equals the answer', () => {
    const set = configuredSet('content_match')
    const duplicate = contentResponse(set)
    duplicate.items[0].question.choices[4] = `  ${duplicate.items[0].question.choices[0]}  `
    expect(() => adaptProvidedPassageResponse(duplicate, set)).toThrow(/서로 달라야/)

    const answerAsDistractor = contentResponse(set)
    answerAsDistractor.items[0].qualityReview.questions[0].strongestDistractorIndex = answerAsDistractor.items[0].question.answerIndex
    expect(() => adaptProvidedPassageResponse(answerAsDistractor, set)).toThrow(/정답과 같을 수 없습니다/)
  })
})
