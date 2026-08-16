import Ajv2020, { type ErrorObject } from 'ajv/dist/2020'
import requestSchema from '../docs/english-gpt/provided-passage-request-schema-v0.1.json'
import responseSchema from '../docs/english-gpt/provided-passage-response-schema-v0.1.json'
import { CSAT_INLINE_POSITION_CHOICES } from './csat'
import type {
  CsatQualityReview, EnglishQuestion, EnglishQuestionSet, ProvidedPassageBoundary,
  ProvidedPassageChoiceLanguage, ProvidedPassageContentPolarity, ProvidedPassageEvidenceSpan,
  ProvidedPassageGenerationResult, ProvidedPassageQuestionType, ProvidedPassageSentence,
  ProvidedPassageState, ProvidedPassageVocabularyLevel,
} from './types'
import { englishDifficultyPrompt } from './difficulty'

export const PROVIDED_PASSAGE_REQUEST_SCHEMA_ID = 'english-question-lab-provided-passage-request-v0.1' as const
export const PROVIDED_PASSAGE_RESPONSE_SCHEMA_ID = 'english-question-lab-provided-passage-generation-v0.1' as const
export const SCHOOL_ENGLISH_PROVIDED_PASSAGE_MODE = 'school_english_provided_passage' as const
export const SCHOOL_ENGLISH_SUBJECT = 'English' as const
export const PROVIDED_PASSAGE_QUESTION_COUNT = 1 as const
export const PROVIDED_PASSAGE_INSERTION_BOUNDARY_COUNT = 5 as const
export const PROVIDED_PASSAGE_SUPPORTED_TEMPLATES = ['school-content-match', 'school-sentence-insertion'] as const

export const PROVIDED_PASSAGE_CHOICE_LANGUAGE_LABELS: Record<ProvidedPassageChoiceLanguage, string> = {
  ko: '한국어',
  en: '영어',
}

export const PROVIDED_PASSAGE_VOCABULARY_LABELS: Record<ProvidedPassageVocabularyLevel, string> = {
  source_matched: '원문 수준에 맞춤',
  grade_1: '고1 수준',
  grade_2: '고2 수준',
  grade_3_csat: '고3·수능 수준',
}

export const PROVIDED_PASSAGE_POLARITY_LABELS: Record<ProvidedPassageContentPolarity, string> = {
  match: '내용과 일치하는 것은?',
  mismatch: '내용과 일치하지 않는 것은?',
}

const TERMINAL = new Set(['.', '?', '!'])
const CLOSERS = new Set(['"', "'", '”', '’', ')', ']', '}'])
const ABBREVIATIONS = new Set(['mr.', 'mrs.', 'ms.', 'dr.', 'prof.', 'sr.', 'jr.', 'st.', 'vs.', 'etc.', 'e.g.', 'i.e.', 'a.m.', 'p.m.'])

function rotateRight(value: number, bits: number) {
  return (value >>> bits) | (value << (32 - bits))
}

/** Small synchronous SHA-256 implementation so browser and test imports use the same deterministic path. */
export function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value)
  const bitLength = bytes.length * 8
  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64
  const padded = new Uint8Array(paddedLength)
  padded.set(bytes)
  padded[bytes.length] = 0x80
  const view = new DataView(padded.buffer)
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000), false)
  view.setUint32(paddedLength - 4, bitLength >>> 0, false)
  const constants = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]
  let state = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]
  const words = new Uint32Array(64)
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) words[index] = view.getUint32(offset + index * 4, false)
    for (let index = 16; index < 64; index += 1) {
      const s0 = rotateRight(words[index - 15], 7) ^ rotateRight(words[index - 15], 18) ^ (words[index - 15] >>> 3)
      const s1 = rotateRight(words[index - 2], 17) ^ rotateRight(words[index - 2], 19) ^ (words[index - 2] >>> 10)
      words[index] = (words[index - 16] + s0 + words[index - 7] + s1) >>> 0
    }
    let [a, b, c, d, e, f, g, h] = state
    for (let index = 0; index < 64; index += 1) {
      const s1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25)
      const choice = (e & f) ^ (~e & g)
      const temporary1 = (h + s1 + choice + constants[index] + words[index]) >>> 0
      const s0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22)
      const majority = (a & b) ^ (a & c) ^ (b & c)
      const temporary2 = (s0 + majority) >>> 0
      h = g; g = f; f = e; e = (d + temporary1) >>> 0; d = c; c = b; b = a; a = (temporary1 + temporary2) >>> 0
    }
    state = state.map((value, index) => (value + [a, b, c, d, e, f, g, h][index]) >>> 0)
  }
  return state.map((value) => value.toString(16).padStart(8, '0')).join('')
}

export function normalizeProvidedPassageForFingerprint(text: string) {
  return text.replace(/^\uFEFF/, '').replace(/\r\n?|\u2028|\u2029/g, '\n').normalize('NFC')
}

export function fingerprintProvidedPassage(text: string) {
  return `sha256:${sha256Hex(`provided-passage-v0.1\n${normalizeProvidedPassageForFingerprint(text)}`)}`
}

function tokenBefore(text: string, periodIndex: number) {
  const start = Math.max(text.lastIndexOf(' ', periodIndex - 1), text.lastIndexOf('\n', periodIndex - 1)) + 1
  return text.slice(start, periodIndex + 1).toLowerCase()
}

function isNonTerminalPeriod(text: string, index: number) {
  if (/\d/.test(text[index - 1] ?? '') && /\d/.test(text[index + 1] ?? '')) return true
  const token = tokenBefore(text, index)
  if (ABBREVIATIONS.has(token)) return true
  if (/^(?:[a-z]\.){1,4}$/i.test(token) && /[a-z]/i.test(text[index + 2] ?? '')) return true
  return false
}

export function segmentProvidedPassage(text: string): { sentences: ProvidedPassageSentence[]; boundaries: ProvidedPassageBoundary[] } {
  const sentences: ProvidedPassageSentence[] = []
  let sentenceStart = 0
  while (sentenceStart < text.length && /\s/.test(text[sentenceStart])) sentenceStart += 1
  for (let index = sentenceStart; index < text.length; index += 1) {
    const character = text[index]
    if (!TERMINAL.has(character) || character === '.' && isNonTerminalPeriod(text, index)) continue
    let end = index + 1
    while (end < text.length && CLOSERS.has(text[end])) end += 1
    if (end < text.length && !/\s/.test(text[end])) continue
    const sentenceText = text.slice(sentenceStart, end)
    if (sentenceText.trim()) sentences.push({ id: `s${sentences.length + 1}`, start: sentenceStart, end, text: sentenceText })
    sentenceStart = end
    while (sentenceStart < text.length && /\s/.test(text[sentenceStart])) sentenceStart += 1
    index = sentenceStart - 1
  }
  if (sentenceStart < text.length && text.slice(sentenceStart).trim()) {
    let end = text.length
    while (end > sentenceStart && /\s/.test(text[end - 1])) end -= 1
    sentences.push({ id: `s${sentences.length + 1}`, start: sentenceStart, end, text: text.slice(sentenceStart, end) })
  }
  const boundaries: ProvidedPassageBoundary[] = Array.from({ length: sentences.length + 1 }, (_, index) => ({
    id: `b${index}`,
    offset: index === 0 ? sentences[0]?.start ?? 0 : sentences[index - 1]?.end ?? text.length,
    beforeSentenceId: index > 0 ? sentences[index - 1]?.id : undefined,
    afterSentenceId: index < sentences.length ? sentences[index]?.id : undefined,
  }))
  return { sentences, boundaries }
}

export function createProvidedPassageState(text: string, options: Partial<Pick<ProvidedPassageState, 'choiceLanguage' | 'vocabularyLevel' | 'contentMatchPolarity' | 'questionType'>> = {}): ProvidedPassageState {
  const normalizedForFingerprint = normalizeProvidedPassageForFingerprint(text)
  const sourceFingerprint = fingerprintProvidedPassage(text)
  const { sentences, boundaries } = segmentProvidedPassage(text)
  return {
    version: '0.1',
    sourcePassageId: `source-${sourceFingerprint.slice(7, 23)}`,
    sourceFingerprint,
    originalText: text,
    normalizedForFingerprint,
    sentences,
    boundaries,
    questionType: options.questionType ?? 'content_match',
    choiceLanguage: options.choiceLanguage ?? 'ko',
    vocabularyLevel: options.vocabularyLevel ?? 'source_matched',
    contentMatchPolarity: options.contentMatchPolarity ?? 'mismatch',
  }
}

export function updateProvidedPassageState(state: ProvidedPassageState | undefined, text: string, options: Partial<Pick<ProvidedPassageState, 'choiceLanguage' | 'vocabularyLevel' | 'contentMatchPolarity' | 'questionType'>> = {}) {
  return createProvidedPassageState(text, {
    questionType: options.questionType ?? state?.questionType,
    choiceLanguage: options.choiceLanguage ?? state?.choiceLanguage,
    vocabularyLevel: options.vocabularyLevel ?? state?.vocabularyLevel,
    contentMatchPolarity: options.contentMatchPolarity ?? state?.contentMatchPolarity,
  })
}

function schemaError(error: ErrorObject) {
  const path = error.instancePath || '$'
  if (error.keyword === 'additionalProperties') return `지원되지 않는 필드: ${path}/${(error.params as { additionalProperty: string }).additionalProperty}`
  if (error.keyword === 'required') return `필수 필드 누락: ${path}/${(error.params as { missingProperty: string }).missingProperty}`
  return `${path} ${error.message ?? '값이 올바르지 않습니다.'}`
}

const ajv = new Ajv2020({ allErrors: true, strict: true })
const requestValidator = ajv.compile(requestSchema)
const responseValidator = ajv.compile(responseSchema)

export function assertProvidedPassageRequestSchema(value: unknown) {
  if (requestValidator(value)) return
  throw new Error(`Provided Passage Request Schema 오류: ${(requestValidator.errors ?? []).map(schemaError).join(' / ')}`)
}

export function assertProvidedPassageResponseSchema(value: unknown): asserts value is Record<string, unknown> {
  if (responseValidator(value)) return
  throw new Error(`Provided Passage Response Schema 오류: ${(responseValidator.errors ?? []).map(schemaError).join(' / ')}`)
}

export function isProvidedPassageSet(set: EnglishQuestionSet) {
  return set.mode === 'school' && Boolean(set.providedPassage)
}

export function transitionSchoolProvidedPassageMode(set: EnglishQuestionSet, mode: 'provided' | 'generated'): EnglishQuestionSet {
  if (mode === 'generated') return { ...set, materialMode: 'generated', sourceKind: 'generated', providedPassage: undefined, providedPassageQualityReview: undefined, questions: set.questions.map((question) => ({ ...question, csatTemplateId: undefined, csatSlot: undefined, csatItemId: undefined })) }
  const current = set.questions[0]
  const questionType: ProvidedPassageQuestionType = current?.type === '문장 삽입' ? 'sentence_insertion' : 'content_match'
  const type = questionType === 'sentence_insertion' ? '문장 삽입' : '내용 일치 및 불일치'
  const stem = questionType === 'sentence_insertion'
    ? '글의 흐름으로 보아, 주어진 문장이 들어가기에 가장 적절한 곳은?'
    : '다음 글의 내용과 일치하지 않는 것은?'
  const question: EnglishQuestion = current
    ? { ...current, type, stem, choices: Array.from({ length: 5 }, (_, index) => current.choices[index] ?? ''), answerIndex: Math.min(current.answerIndex, 5), csatTemplateId: questionType === 'sentence_insertion' ? '38' : undefined, csatSlot: questionType === 'sentence_insertion' ? '문장 삽입' : undefined, csatItemId: undefined }
    : { id: crypto.randomUUID(), type, stem, choices: Array.from({ length: 5 }, () => ''), answerIndex: 1, explanation: '', intention: '', evidenceRefs: [], distractorReasons: [], score: 2 }
  return {
    ...set,
    materialMode: 'provided',
    sourceKind: set.sourceKind === 'generated' ? 'external' : set.sourceKind,
    choiceCount: 5,
    questions: [question],
    providedPassage: createProvidedPassageState(set.material, { questionType }),
    providedPassageQualityReview: undefined,
  }
}

function configuredSchoolProvidedSet(set: EnglishQuestionSet) {
  const state = set.providedPassage
  if (set.mode !== 'school' || !state) throw new Error('내신형 기존 지문 사용 설정을 먼저 완료해 주세요.')
  if (set.questions.length !== PROVIDED_PASSAGE_QUESTION_COUNT) throw new Error('Provided Passage V0.1은 내신형 문항 1개만 지원합니다.')
  const expectedType: ProvidedPassageQuestionType = set.questions[0].type === '문장 삽입' ? 'sentence_insertion' : 'content_match'
  if (state.questionType !== expectedType) throw new Error('내신형 문항 유형과 provided passage questionType이 일치하지 않습니다.')
  if (!set.material.trim()) throw new Error('영어 지문을 입력해 주세요.')
  if (set.material !== state.originalText) throw new Error('보관된 권위 원문과 내신형 세트 원문이 다릅니다.')
  if (state.sourceFingerprint !== fingerprintProvidedPassage(set.material)) throw new Error('원문 fingerprint가 현재 지문과 일치하지 않습니다.')
  if (expectedType === 'sentence_insertion' && state.boundaries.length < PROVIDED_PASSAGE_INSERTION_BOUNDARY_COUNT) throw new Error('문장 삽입에는 후보 위치 5개가 필요합니다. 현재 지문에서는 경계가 5개 미만입니다.')
  return { state, question: set.questions[0], templateId: expectedType === 'content_match' ? 'school-content-match' : 'school-sentence-insertion' }
}

export function providedPassageBlockingReason(set: EnglishQuestionSet) {
  if (set.mode !== 'school' || !set.providedPassage) return '내신형 영어의 기존 지문 사용 모드에서만 지원합니다.'
  if (!set.material.trim()) return '영어 원문을 입력해야 합니다.'
  if (set.material !== set.providedPassage.originalText || set.providedPassage.sourceFingerprint !== fingerprintProvidedPassage(set.material)) return '권위 원문과 fingerprint가 일치하지 않습니다.'
  if (set.questions.length !== PROVIDED_PASSAGE_QUESTION_COUNT) return 'MVP에서는 문항 수가 1개여야 합니다.'
  if (set.providedPassage.questionType === 'sentence_insertion' && set.providedPassage.boundaries.length < PROVIDED_PASSAGE_INSERTION_BOUNDARY_COUNT) return '문장 삽입 후보 경계가 5개 미만이라 생성할 수 없습니다.'
  return undefined
}

export function buildProvidedPassageRequest(set: EnglishQuestionSet) {
  const school = configuredSchoolProvidedSet(set)
  const state = school.state
  const request = {
    schemaId: PROVIDED_PASSAGE_REQUEST_SCHEMA_ID,
    mode: SCHOOL_ENGLISH_PROVIDED_PASSAGE_MODE,
    subject: SCHOOL_ENGLISH_SUBJECT,
    source: {
      sourcePassageId: state.sourcePassageId,
      sourceFingerprint: state.sourceFingerprint,
      title: set.materialTitle,
      passage: state.originalText,
      sentences: state.sentences,
      boundaries: state.boundaries,
    },
    item: {
      itemId: school.question.id,
      templateId: school.templateId,
      variantId: 'standard',
      questionType: state.questionType,
      choiceLanguage: state.questionType === 'sentence_insertion' ? null : state.choiceLanguage,
      vocabularyLevel: state.vocabularyLevel,
      contentMatchPolarity: state.questionType === 'sentence_insertion' ? null : state.contentMatchPolarity,
      targetLevel: set.targetLevel,
      score: school.question.score ?? 2,
      questionCount: PROVIDED_PASSAGE_QUESTION_COUNT,
      requiredCandidateBoundaryCount: state.questionType === 'sentence_insertion' ? PROVIDED_PASSAGE_INSERTION_BOUNDARY_COUNT : null,
    },
    sourcePreservation: {
      authority: 'app_stored_source',
      responsePassage: 'forbidden',
      exactFingerprintRequired: true,
    },
    approval: {
      firstResponse: 'design_only',
      approvalSentence: '이 설계로 JSON을 생성할까요? 수정할 카드가 있으면 카드 번호와 변경 사항을 알려주세요.',
      afterApproval: 'single_json_object',
    },
    outputContract: PROVIDED_PASSAGE_RESPONSE_SCHEMA_ID,
  }
  assertProvidedPassageRequestSchema(request)
  return request
}

const vocabularyRules: Record<ProvidedPassageVocabularyLevel, string> = {
  source_matched: '원문과 비슷한 어휘 추상도와 문장 복잡도를 사용하되 핵심 표현을 그대로 이어 붙이지 말고 관계를 재진술한다.',
  grade_1: '생성 영어에는 일반적인 고1 수준을 사용하고 불필요한 희귀어·추상 학술어를 피한다. 원문의 필수 전문어는 훼손하지 않는다.',
  grade_2: '생성 영어에는 중간 수준 추상어와 학술 표현을 허용하되 의미 차이와 자연스러움을 유지한다.',
  grade_3_csat: '생성 영어에는 수능 독해에 자연스러운 학술 영어와 관계 재진술을 사용하되 희귀어 자체를 난도 수단으로 삼지 않는다.',
}

export function generateProvidedPassagePrompt(set: EnglishQuestionSet) {
  const request = buildProvidedPassageRequest(set)
  const state = configuredSchoolProvidedSet(set).state
  const typeRules = state.questionType === 'content_match'
    ? `[난이도 목표]\n${englishDifficultyPrompt('school', set.difficulty)}\n원문 자체는 바꾸지 말고 발문·선지·오답의 정교함과 근거 연결 방식으로 위 난이도를 구현한다.\n\n- 선택지 5개와 단일 정답을 만든다. 모든 선지는 ${PROVIDED_PASSAGE_CHOICE_LANGUAGE_LABELS[state.choiceLanguage]} 완전 문장으로 통일한다.\n- 발문 극성은 ${state.contentMatchPolarity}이며 부분 일치, 범위·인과·관계 역전, 주체 교체 등 서로 다른 오답 원리를 사용한다.\n- 외부 상식이 아니라 evidenceSpans의 원문 근거만으로 판정한다. materialOperation은 null이다.`
    : `[난이도 목표]\n${englishDifficultyPrompt('school', set.difficulty)}\n원문 자체는 바꾸지 말고 삽입문장과 위치별 오답의 정교함, 앞뒤 근거 연결 방식으로 위 난이도를 구현한다.\n\n- 새로운 삽입 문장 하나만 생성한다. candidateBoundaryIds는 원문 순서대로 정확히 5개이며 answerBoundaryId는 그중 하나다.\n- 앞뒤 근거, 다섯 위치별 이유를 반환한다. 원문에 없는 핵심 사실을 추가하지 않으며 choices는 ["①","②","③","④","⑤"]다.`
  return `[PROVIDED_PASSAGE_GENERATION_V0.1]\n당신은 사용자가 제공한 영어 원문을 수정하지 않고 내신형 문항만 설계·생성하는 영어 읽기 출제자다.\n\n[절대 원칙]\n- 아래 Request의 source.passage가 유일한 권위 원문이다. 수정·요약·번역하거나 응답 JSON에 다시 출력하지 않는다.\n- sourcePassageId, sourceFingerprint, itemId, templateId, variantId를 그대로 반환한다.\n- 선택한 어휘 정책은 영어 선지·삽입 문장 등 새로 생성하는 영어에만 적용하며 원문, 고유명사, 직접 인용 근거에는 적용하지 않는다.\n- ${vocabularyRules[state.vocabularyLevel]}\n- EBS 등재율이나 외부 지식을 난이도·정답 근거로 사용하지 않는다.\n- 선언 정답을 보지 않고 다섯 선택지를 독립적으로 판정해 정답이 정확히 하나인지 확인한다.\n${typeRules}\n\n[승인 절차]\n첫 응답은 한국어 [내신 영어 기존 지문 문항 설계안]만 출력한다. sourcePassageId, fingerprint 축약, 문항 유형, 선지 언어, 어휘 수준, 발문 극성, 추론 방식, 새 표현의 역할, 오답 방식, 원문 보존 방식을 적되 실제 선지나 완성 삽입 문장은 공개하지 않는다. 마지막 문장은 Request의 approvalSentence와 정확히 같아야 한다. 명시적 승인 뒤에는 ${PROVIDED_PASSAGE_RESPONSE_SCHEMA_ID}에 맞는 JSON 객체 하나만 출력한다.\n\n[Request JSON — source passage는 이곳에 한 번만 포함]\n${JSON.stringify(request, null, 2)}`
}

function validateEvidenceSpan(span: ProvidedPassageEvidenceSpan, state: ProvidedPassageState, label: string) {
  const sentence = state.sentences.find((candidate) => candidate.id === span.sentenceId)
  if (!sentence) throw new Error(`${label}에 존재하지 않는 sentenceId가 있습니다: ${span.sentenceId}`)
  if (!Number.isInteger(span.start) || !Number.isInteger(span.end) || span.start < sentence.start || span.end > sentence.end || span.start >= span.end) {
    throw new Error(`${label}의 offset이 ${span.sentenceId} 범위를 벗어났습니다.`)
  }
  if (state.originalText.slice(span.start, span.end) !== span.text) throw new Error(`${label}의 evidence text가 원문 offset과 일치하지 않습니다.`)
}

function assertChoiceLanguage(choices: string[], language: ProvidedPassageChoiceLanguage) {
  if (language === 'ko' && choices.some((choice) => !/[가-힣]/.test(choice))) throw new Error('내용 일치 문항의 다섯 선지는 모두 한국어여야 합니다.')
  if (language === 'en' && choices.some((choice) => /[가-힣]/.test(choice) || !/[A-Za-z]/.test(choice))) throw new Error('내용 일치 문항의 다섯 선지는 모두 영어여야 합니다.')
}

function copyQualityReview(value: unknown) {
  return value as CsatQualityReview
}

export function adaptProvidedPassageResponse(value: unknown, base: EnglishQuestionSet): EnglishQuestionSet {
  assertProvidedPassageResponseSchema(value)
  const school = configuredSchoolProvidedSet(base)
  const state = school.state
  const root = value as Record<string, unknown>
  if (root.mode !== SCHOOL_ENGLISH_PROVIDED_PASSAGE_MODE || root.subject !== SCHOOL_ENGLISH_SUBJECT) throw new Error('내신 영어 기존 지문 전용 mode·subject가 일치하지 않습니다.')
  if (root.sourcePassageId !== state.sourcePassageId) throw new Error('sourcePassageId가 보관된 원문과 일치하지 않습니다.')
  if (root.sourceFingerprint !== state.sourceFingerprint) throw new Error('sourceFingerprint가 보관된 원문과 일치하지 않습니다.')
  const records = root.items as Array<Record<string, unknown>>
  const record = records[0]
  const expectedItemId = school.question.id
  const expectedTemplateId = school.templateId
  const expectedVariantId = 'standard'
  if (record.itemId !== expectedItemId || record.templateId !== expectedTemplateId || record.variantId !== expectedVariantId) throw new Error('itemId·templateId·variantId가 요청과 일치하지 않습니다.')
  const expectedChoiceLanguage = state.questionType === 'sentence_insertion' ? null : state.choiceLanguage
  if (record.questionType !== state.questionType || record.choiceLanguage !== expectedChoiceLanguage || record.vocabularyLevel !== state.vocabularyLevel) throw new Error('문항 유형·선지 언어·어휘 수준이 요청과 일치하지 않습니다.')
  if (state.questionType === 'content_match' && record.contentMatchPolarity !== state.contentMatchPolarity) throw new Error('내용 일치 발문 극성이 요청과 일치하지 않습니다.')
  const question = record.question as Record<string, unknown>
  const evidenceSpans = question.evidenceSpans as ProvidedPassageEvidenceSpan[]
  evidenceSpans.forEach((span, index) => validateEvidenceSpan(span, state, `evidenceSpans[${index}]`))
  const choices = (question.choices as string[]).map((choice) => choice.trim())
  const normalizedChoiceKeys = choices.map((choice) => choice.normalize('NFC').replace(/\s+/g, ' ').toLocaleLowerCase())
  if (new Set(normalizedChoiceKeys).size !== choices.length) throw new Error('선택지는 공백·대소문자 정규화 후에도 서로 달라야 합니다.')
  const qualityReview = record.qualityReview as CsatQualityReview
  const strongestDistractorIndex = qualityReview.questions?.[0]?.strongestDistractorIndex
  if (strongestDistractorIndex === question.answerIndex) throw new Error('가장 강력한 오답은 정답과 같을 수 없습니다.')
  const materialOperation = record.materialOperation as ProvidedPassageGenerationResult['materialOperation']
  if (state.questionType === 'content_match') {
    if (materialOperation !== null) throw new Error('내용 일치 문항은 materialOperation을 반환하지 않아야 합니다.')
    assertChoiceLanguage(choices, state.choiceLanguage)
  } else {
    if (!materialOperation || materialOperation.kind !== 'insert_sentence') throw new Error('문장 삽입 문항에는 insert_sentence materialOperation이 필요합니다.')
    if (choices.some((choice, index) => choice !== CSAT_INLINE_POSITION_CHOICES[index])) throw new Error('문장 삽입 choices는 ①~⑤ 위치 표식이어야 합니다.')
    if (materialOperation.lexicalLevel !== state.vocabularyLevel) throw new Error('삽입 문장의 lexicalLevel이 요청과 일치하지 않습니다.')
    if (/[가-힣]/.test(materialOperation.generatedSentence) || !/[A-Za-z]/.test(materialOperation.generatedSentence)) throw new Error('generatedSentence는 완전한 영어 문장이어야 합니다.')
    const boundaryById = new Map(state.boundaries.map((boundary) => [boundary.id, boundary]))
    materialOperation.candidateBoundaryIds.forEach((id) => { if (!boundaryById.has(id)) throw new Error(`존재하지 않는 boundaryId입니다: ${id}`) })
    const offsets = materialOperation.candidateBoundaryIds.map((id) => boundaryById.get(id)!.offset)
    if (offsets.some((offset, index) => index > 0 && offset <= offsets[index - 1])) throw new Error('candidateBoundaryIds는 원문 경계 순서대로 반환해야 합니다.')
    if (!materialOperation.candidateBoundaryIds.includes(materialOperation.answerBoundaryId)) throw new Error('answerBoundaryId가 후보 경계 안에 없습니다.')
    const reasonIds = materialOperation.positionReasons.map((reason) => reason.boundaryId)
    if (new Set(reasonIds).size !== PROVIDED_PASSAGE_INSERTION_BOUNDARY_COUNT || materialOperation.candidateBoundaryIds.some((id) => !reasonIds.includes(id))) throw new Error('다섯 후보 경계 각각의 positionReason이 필요합니다.')
    validateEvidenceSpan(materialOperation.beforeEvidence, state, 'beforeEvidence')
    validateEvidenceSpan(materialOperation.afterEvidence, state, 'afterEvidence')
  }
  const expected = { type: state.questionType === 'content_match' ? '내용 일치 및 불일치' : '문장 삽입' }
  if (question.type !== expected.type) throw new Error(`question.type은 '${expected.type}'이어야 합니다.`)
  const nextQuestion: EnglishQuestion = {
    id: school.question.id,
    type: expected.type,
    stem: String(question.stem).trim(),
    choices,
    answerIndex: question.answerIndex as number,
    explanation: String(question.explanation).trim(),
    intention: String(question.intention).trim(),
    evidenceRefs: evidenceSpans.map((span) => span.text),
    distractorReasons: (question.distractorReasons as string[]).map((reason) => reason.trim()),
    score: question.score as number,
    ...(state.questionType === 'sentence_insertion' ? { csatTemplateId: '38' as const, csatSlot: '문장 삽입' } : {}),
  }
  const result: ProvidedPassageGenerationResult = { schemaId: PROVIDED_PASSAGE_RESPONSE_SCHEMA_ID, evidenceSpans, materialOperation }
  return {
    ...base,
    title: typeof root.title === 'string' && root.title.trim() ? root.title.trim() : base.title,
    material: state.originalText,
    questions: [nextQuestion],
    providedPassage: { ...state, result },
    providedPassageQualityReview: copyQualityReview(qualityReview),
    aiRevision: base.aiRevision + 1,
    validatedRevision: 0,
    lastImportedJson: JSON.stringify(value, null, 2),
    updatedAt: new Date().toISOString(),
  }
}

export function parseProvidedPassageJson(raw: string, base: EnglishQuestionSet) {
  let value: unknown
  try { value = JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')) } catch (error) {
    throw new Error(`Provided Passage JSON 문법 오류입니다. (${error instanceof Error ? error.message : 'JSON을 확인해 주세요.'})`, { cause: error })
  }
  return adaptProvidedPassageResponse(value, base)
}

export function providedPassagePresentationSpec(source: EnglishQuestionSet) {
  const operation = source.providedPassage?.result?.materialOperation
  if (!operation || operation.kind !== 'insert_sentence') return source.materialSpec
  const markers = new Map(operation.candidateBoundaryIds.map((id, index) => [id, CSAT_INLINE_POSITION_CHOICES[index]]))
  const boundaries = source.providedPassage!.boundaries.filter((boundary) => markers.has(boundary.id)).sort((left, right) => right.offset - left.offset)
  let body = source.providedPassage!.originalText
  boundaries.forEach((boundary) => {
    const marker = ` [[삽입위치:${markers.get(boundary.id)}]] `
    body = `${body.slice(0, boundary.offset)}${marker}${body.slice(boundary.offset)}`
  })
  return { kind: 'insertion' as const, givenSentence: operation.generatedSentence, body }
}

export function providedPassageValidationMessages(source: EnglishQuestionSet) {
  const state = source.providedPassage
  if (!state) return []
  const messages: Array<{ level: 'error' | 'warning'; label: string; detail: string }> = []
  if (source.material !== state.originalText) messages.push({ level: 'error', label: '권위 원문 불일치', detail: '자료 material과 보관된 provided passage 원문이 다릅니다.' })
  if (fingerprintProvidedPassage(source.material) !== state.sourceFingerprint) messages.push({ level: 'error', label: '원문 fingerprint 불일치', detail: '현재 원문과 sourceFingerprint가 일치하지 않습니다.' })
  state.sentences.forEach((sentence) => {
    if (state.originalText.slice(sentence.start, sentence.end) !== sentence.text) messages.push({ level: 'error', label: '문장 offset 불일치', detail: `${sentence.id}의 offset과 원문이 일치하지 않습니다.` })
  })
  if (state.questionType === 'sentence_insertion' && state.boundaries.length < 5) messages.push({ level: 'error', label: '삽입 경계 부족', detail: `문장 삽입에는 경계 5개가 필요하지만 현재 ${state.boundaries.length}개입니다.` })
  if (!state.result) messages.push({ level: 'warning', label: 'AI 결과 전', detail: '권위 원문과 문장 경계는 준비됐으며 아직 문항 결과를 가져오지 않았습니다.' })
  return messages
}
