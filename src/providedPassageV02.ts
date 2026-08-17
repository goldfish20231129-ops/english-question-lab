import Ajv2020, { type ErrorObject } from 'ajv/dist/2020'
import requestSchema from '../docs/english-gpt/provided-passage-request-schema-v0.2.json'
import responseSchema from '../docs/english-gpt/provided-passage-response-schema-v0.2.json'
import { CSAT_INLINE_POSITION_CHOICES, normalizeEnglishPassage } from './csat'
import { fingerprintProvidedPassage, normalizeProvidedPassageForFingerprint, segmentProvidedPassage } from './providedPassage'
import { MAX_SCHOOL_SET_QUESTIONS } from './schoolCatalog'
import { allocateSchoolMarkerLabels, SCHOOL_NUMERIC_MARKER_LABELS } from './schoolMarkerLabels'
import { stripLeadingChoiceMarker } from './utils'
import type {
  CsatQualityReview, EnglishQuestion, EnglishQuestionSet, ProvidedPassageEvidenceSpan, ProvidedPassageGrammarMode,
  ProvidedPassageChoiceLanguage, ProvidedPassageGrammarOperation, ProvidedPassageGrammarTarget, ProvidedPassageV02ItemPlan,
  ProvidedPassageV02ItemResult, ProvidedPassageV02QuestionType, ProvidedPassageV02State,
} from './types'

export const PROVIDED_PASSAGE_V02_REQUEST_SCHEMA_ID = 'english-question-lab-provided-passage-request-v0.2' as const
export const PROVIDED_PASSAGE_V02_RESPONSE_SCHEMA_ID = 'english-question-lab-provided-passage-generation-v0.2' as const
export const PROVIDED_PASSAGE_V02_MAX_ITEMS = MAX_SCHOOL_SET_QUESTIONS

export const PROVIDED_PASSAGE_V02_TYPE_LABELS: Record<ProvidedPassageV02QuestionType, string> = {
  content_match: '내용 일치·불일치', content_inference: '내용 이해·추론', sentence_insertion: '문장 삽입', grammar: '어법', summary: '요약문 완성',
}
export const PROVIDED_PASSAGE_GRAMMAR_LABELS: Record<ProvidedPassageGrammarTarget, string> = {
  relative_clause: '관계대명사', appositive_that: '동격 that', subject_verb_agreement: '수 일치',
  participle_clause: '분사구문', nonrestrictive_relative: '계속적 관계대명사', pronoun_agreement: '지시·대명사 일치',
  dummy_it: '가주어·진주어', cleft_it_that: '강조 it-that',
}
export const PROVIDED_PASSAGE_GRAMMAR_AUTO_LABEL = '원문에서 자동 선택 (권장)'
export const PROVIDED_PASSAGE_GRAMMAR_AUTO_RULE = 'AI가 원문에 실제로 존재하고 판정이 유일한 문법 구조를 지원 목록에서 하나 선택한다. 응답에는 선택한 구체적 grammarTarget을 기록한다.'
export const PROVIDED_PASSAGE_GRAMMAR_PREFERENCE_RULE = '평가원형 5개 표식 어법 오류 찾기에서는 선택한 핵심 문법을 우선하되, 원문에 그 구조가 없으면 원문에서 판정 가능한 다른 지원 문법을 자동 선택한다.'
export const PROVIDED_PASSAGE_GRAMMAR_MODE_LABELS: Record<ProvidedPassageGrammarMode, string> = {
  source_form_check: '한 표적 구조 설명형 (구형 JSON 호환)', controlled_error_variant: '평가원형 5개 표식 어법 오류 찾기 (권장)',
}
export const PROVIDED_PASSAGE_GRAMMAR_MODE_HELP: Record<ProvidedPassageGrammarMode, string> = {
  source_form_check: '원문의 한 표현에 밑줄을 긋고 문법적 구조를 설명하는 기존 JSON과 호환됩니다.',
  controlled_error_variant: '원문 속 다섯 표현에 서로 구분되는 기호와 밑줄을 표시하고, 그중 하나만 별도 오류형으로 제시합니다.',
}

export const PROVIDED_PASSAGE_GRAMMAR_RULES: Record<ProvidedPassageGrammarTarget, string> = {
  relative_clause: '선행사와 관계절 내부의 문장 성분을 확인하고 관계대명사·관계부사의 선택을 판정한다.',
  appositive_that: 'that절이 앞 명사의 내용을 완전한 절로 설명하는지 확인하고 관계대명사 that과 구별한다.',
  subject_verb_agreement: '전치사구·삽입구를 제외한 실제 주어의 수와 동사의 수를 일치시킨다.',
  participle_clause: '분사구문의 의미상 주어와 주절 주어, 능동·수동 관계를 함께 확인한다.',
  nonrestrictive_relative: '쉼표와 선행사 범위, that 사용 불가, 문장 전체 수식 가능성을 확인한다.',
  pronoun_agreement: '대명사·지시어의 선행사, 수, 의미 범위가 하나로 결정되는지 확인한다.',
  dummy_it: 'it이 의미 없는 가주어이고 뒤의 부정사·that절이 진주어인지 확인한다.',
  cleft_it_that: 'it-that 강조구문의 강조 대상과 남은 절의 완전성을 확인하고 가주어 구문과 구별한다.',
}

const PROVIDED_PASSAGE_GRAMMAR_STEM_LABELS: Record<ProvidedPassageGrammarTarget, string> = {
  relative_clause: '관계절', appositive_that: '동격 that절', subject_verb_agreement: '주어와 동사의 수 일치',
  participle_clause: '분사구문', nonrestrictive_relative: '계속적 용법의 관계절', pronoun_agreement: '대명사의 선행사·수 일치',
  dummy_it: '가주어 it 구문', cleft_it_that: 'it-that 강조구문',
}

const LEGACY_PROVIDED_PASSAGE_GRAMMAR_STEM = '다음 글의 밑줄 친 부분 중, 어법상 틀린 것은?'

export function providedPassageV02DefaultStem(
  type: ProvidedPassageV02QuestionType,
  polarity: ProvidedPassageV02ItemPlan['contentMatchPolarity'] = 'mismatch',
  grammarTarget: ProvidedPassageV02ItemPlan['grammarTarget'] = 'relative_clause',
  grammarMode: ProvidedPassageV02ItemPlan['grammarMode'] = 'source_form_check',
  language: ProvidedPassageChoiceLanguage = 'ko',
) {
  if (language === 'en') {
    if (type === 'sentence_insertion') return 'Where is the most appropriate place for the given sentence?'
    if (type === 'summary') return 'Which pair of words best completes blanks (A) and (B) in the summary?'
    if (type === 'grammar') {
      return grammarMode === 'controlled_error_variant'
        ? 'Which of the underlined parts is grammatically incorrect?'
        : 'Which of the following best explains the grammatical structure of the underlined expression?'
    }
    if (type === 'content_inference') return 'Which of the following can be inferred from the passage?'
    return polarity === 'match'
      ? 'Which of the following is consistent with the passage?'
      : 'Which of the following is NOT consistent with the passage?'
  }
  if (type === 'sentence_insertion') return '글의 흐름으로 보아, 주어진 문장이 들어가기에 가장 적절한 곳은?'
  if (type === 'summary') return '다음 글의 내용을 한 문장으로 요약하고자 한다. 빈칸 (A)와 (B)에 들어갈 말로 가장 적절한 것은?'
  if (type === 'grammar') {
    const label = grammarTarget ? PROVIDED_PASSAGE_GRAMMAR_STEM_LABELS[grammarTarget] : '표현'
    return grammarMode === 'controlled_error_variant'
      ? '다음 글의 밑줄 친 부분 중, 어법상 틀린 것은?'
      : `밑줄 친 ${label}의 문법적 구조에 대한 설명으로 가장 적절한 것은?`
  }
  if (type === 'content_inference') return '다음 글의 내용으로부터 추론할 수 있는 것은?'
  return `다음 글의 내용과 ${polarity === 'match' ? '일치하는' : '일치하지 않는'} 것은?`
}

function questionShape(
  type: ProvidedPassageV02QuestionType,
  polarity: ProvidedPassageV02ItemPlan['contentMatchPolarity'] = 'mismatch',
  grammarTarget: ProvidedPassageV02ItemPlan['grammarTarget'] = 'relative_clause',
  grammarMode: ProvidedPassageV02ItemPlan['grammarMode'] = 'source_form_check',
  language: ProvidedPassageChoiceLanguage = 'ko',
): Pick<EnglishQuestion, 'type' | 'stem' | 'choices' | 'answerIndex' | 'schoolStemLanguage' | 'schoolChoiceLanguage'> {
  const languageFields = { schoolStemLanguage: language, schoolChoiceLanguage: usesChoiceLanguage(type) ? defaultChoiceLanguage(type) ?? undefined : undefined }
  if (type === 'sentence_insertion') return { type: '문장 삽입', stem: providedPassageV02DefaultStem(type, polarity, grammarTarget, grammarMode, language), choices: [...CSAT_INLINE_POSITION_CHOICES], answerIndex: 1, ...languageFields }
  if (type === 'grammar') return { type: '어법', stem: providedPassageV02DefaultStem(type, polarity, grammarTarget, grammarMode, language), choices: grammarMode === 'controlled_error_variant' ? [...CSAT_INLINE_POSITION_CHOICES] : Array.from({ length: 5 }, () => ''), answerIndex: 1, ...languageFields }
  if (type === 'summary') return { type: '요약문 완성', stem: providedPassageV02DefaultStem(type, polarity, grammarTarget, grammarMode, language), choices: Array.from({ length: 5 }, () => ''), answerIndex: 1, ...languageFields }
  if (type === 'content_inference') return { type: '내용 이해', stem: providedPassageV02DefaultStem(type, polarity, grammarTarget, grammarMode, language), choices: Array.from({ length: 5 }, () => ''), answerIndex: 1, ...languageFields }
  return { type: '내용 일치 및 불일치', stem: providedPassageV02DefaultStem(type, polarity, grammarTarget, grammarMode, language), choices: Array.from({ length: 5 }, () => ''), answerIndex: 1, ...languageFields }
}

function questionShapeForPlan(plan: ProvidedPassageV02ItemPlan) {
  const shape = questionShape(plan.questionType, plan.contentMatchPolarity, plan.grammarTarget, plan.grammarMode, plan.stemLanguage ?? 'ko')
  return { ...shape, schoolChoiceLanguage: usesChoiceLanguage(plan.questionType) ? plan.choiceLanguage ?? 'ko' : undefined }
}

function usesChoiceLanguage(type: ProvidedPassageV02QuestionType) {
  return type === 'content_match' || type === 'content_inference' || type === 'summary'
}

function defaultChoiceLanguage(type: ProvidedPassageV02QuestionType): ProvidedPassageChoiceLanguage | null {
  if (type === 'summary') return 'en'
  return type === 'content_match' || type === 'content_inference' ? 'ko' : null
}

export function createProvidedPassageV02Plan(itemId: string = crypto.randomUUID(), questionType: ProvidedPassageV02QuestionType = 'content_match'): ProvidedPassageV02ItemPlan {
  return {
    itemId, questionType, stemLanguage: 'ko', choiceLanguage: defaultChoiceLanguage(questionType),
    vocabularyLevel: 'source_matched', contentMatchPolarity: questionType === 'content_match' ? 'mismatch' : null,
    grammarTarget: questionType === 'grammar' ? 'relative_clause' : null,
    grammarMode: questionType === 'grammar' ? 'source_form_check' : null,
  }
}

export function orderedProvidedPassageV02Plans(plans: ProvidedPassageV02ItemPlan[]) {
  const regular = plans.filter((plan) => plan.questionType !== 'sentence_insertion')
  const insertion = plans.filter((plan) => plan.questionType === 'sentence_insertion')
  return [...regular, ...insertion]
}

function isProvidedPassageInlineMarkerPlan(plan: ProvidedPassageV02ItemPlan) {
  return plan.questionType === 'sentence_insertion'
    || (plan.questionType === 'grammar' && plan.grammarMode === 'controlled_error_variant')
}

export function providedPassageV02MarkerLabels(state: ProvidedPassageV02State, itemId: string) {
  const markerIds = orderedProvidedPassageV02Plans(state.itemPlans).filter(isProvidedPassageInlineMarkerPlan).map((plan) => plan.itemId)
  return allocateSchoolMarkerLabels(markerIds, itemId)
}

export function createProvidedPassageV02State(text: string, plans: ProvidedPassageV02ItemPlan[] = [createProvidedPassageV02Plan()]): ProvidedPassageV02State {
  const originalText = normalizeEnglishPassage(text)
  const sourceFingerprint = fingerprintProvidedPassage(originalText)
  const { sentences, boundaries } = segmentProvidedPassage(originalText)
  return { version: '0.2', sourcePassageId: `source-${sourceFingerprint.slice(7, 23)}`, sourceFingerprint, originalText, normalizedForFingerprint: normalizeProvidedPassageForFingerprint(originalText), sentences, boundaries, itemPlans: orderedProvidedPassageV02Plans(plans) }
}

export function transitionSchoolProvidedPassageV02(set: EnglishQuestionSet, mode: 'provided' | 'generated'): EnglishQuestionSet {
  if (mode === 'generated') return { ...set, materialMode: 'generated', sourceKind: set.sourceKind === 'generated' ? 'textbook' : set.sourceKind, providedPassage: undefined, providedPassageV02: undefined, providedPassageQualityReview: undefined }
  const blocked = providedPassageV02TransitionBlockingReason(set)
  if (blocked) throw new Error(blocked)
  const currentQuestions = set.questions.length ? set.questions : [{ id: crypto.randomUUID(), ...questionShape('content_match'), explanation: '', intention: '', evidenceRefs: [], distractorReasons: [], score: 2 }]
  const replacePristineDefault = currentQuestions.length === 1 && questionTypeFromExisting(currentQuestions[0]) === undefined && isPristineQuestion(currentQuestions[0])
  const plans = orderedProvidedPassageV02Plans(currentQuestions.map((question) => {
    const plan = createProvidedPassageV02Plan(question.id, replacePristineDefault ? 'content_match' : questionTypeFromExisting(question)!)
    plan.stemLanguage = question.schoolStemLanguage ?? (/[A-Za-z]/.test(question.stem) && !/[가-힣]/.test(question.stem) ? 'en' : 'ko')
    if (usesChoiceLanguage(plan.questionType)) plan.choiceLanguage = question.schoolChoiceLanguage ?? 'ko'
    return plan
  }))
  const providedPassageV02 = createProvidedPassageV02State(set.material, plans)
  const questionById = new Map(currentQuestions.map((question) => [question.id, question]))
  const questions = plans.map((plan) => {
    const shape = questionShapeForPlan(plan)
    const choices = isProvidedPassageInlineMarkerPlan(plan) ? providedPassageV02MarkerLabels(providedPassageV02, plan.itemId) : shape.choices
    return { ...questionById.get(plan.itemId)!, ...shape, choices, id: plan.itemId }
  })
  return { ...set, material: providedPassageV02.originalText, materialMode: 'provided', sourceKind: set.sourceKind === 'generated' ? 'external' : set.sourceKind, choiceCount: 5, providedPassage: undefined, providedPassageV02, questions }
}

function questionTypeFromExisting(question: EnglishQuestion): ProvidedPassageV02QuestionType | undefined {
  if (question.type === '내용 일치 및 불일치') return 'content_match'
  if (question.type === '내용 이해') return 'content_inference'
  if (question.type === '문장 삽입') return 'sentence_insertion'
  if (question.type === '어법') return 'grammar'
  if (question.type === '요약문 완성') return 'summary'
  return undefined
}

function isPristineQuestion(question: EnglishQuestion) {
  return question.type === '어휘' && question.stem === '다음 글의 밑줄 친 부분 중, 문맥상 낱말의 쓰임이 적절하지 않은 것은?'
    && question.choices.every((choice) => !choice.trim()) && !question.explanation.trim() && !question.intention.trim()
    && question.evidenceRefs.every((value) => !value.trim()) && question.distractorReasons.every((value) => !value.trim())
}

export function providedPassageV02TransitionBlockingReason(set: EnglishQuestionSet) {
  if (set.mode !== 'school') return '내신형 영어 세트만 기존 지문 V0.2로 전환할 수 있습니다.'
  if (set.questions.length > PROVIDED_PASSAGE_V02_MAX_ITEMS) return `기존 문항이 ${PROVIDED_PASSAGE_V02_MAX_ITEMS}개를 초과합니다. 문항을 삭제하지 않고 유지하기 위해 전환을 중단했습니다.`
  if (set.questions.length === 1 && isPristineQuestion(set.questions[0])) return undefined
  const unsupported = set.questions.filter((question) => !questionTypeFromExisting(question))
  if (unsupported.length) return `V0.2에서 지원하지 않는 기존 문항 유형이 있습니다: ${[...new Set(unsupported.map((question) => question.type))].join(', ')}. 기존 문항은 그대로 유지됩니다.`
  return undefined
}

export function updateProvidedPassageV02Material(state: ProvidedPassageV02State, text: string) {
  return createProvidedPassageV02State(text, state.itemPlans)
}

export function syncProvidedPassageV02Questions(set: EnglishQuestionSet, plans: ProvidedPassageV02ItemPlan[]): EnglishQuestion[] {
  const existing = new Map(set.questions.map((question) => [question.id, question]))
  const orderedPlans = orderedProvidedPassageV02Plans(plans)
  const markerIds = orderedPlans.filter(isProvidedPassageInlineMarkerPlan).map((plan) => plan.itemId)
  return orderedPlans.map((plan) => {
    const previous = existing.get(plan.itemId)
    const shape = questionShapeForPlan(plan)
    const choices = isProvidedPassageInlineMarkerPlan(plan) ? allocateSchoolMarkerLabels(markerIds, plan.itemId) : shape.choices
    return { id: plan.itemId, ...shape, choices, explanation: previous?.explanation ?? '', intention: previous?.intention ?? '', evidenceRefs: previous?.evidenceRefs ?? [], distractorReasons: previous?.distractorReasons ?? [], score: previous?.score ?? 2, schoolTemplateId: plan.questionType === 'summary' ? 'summary' : undefined, schoolChoiceLayout: plan.questionType === 'summary' ? 'matrix' : undefined, schoolSummaryText: plan.questionType === 'summary' ? previous?.schoolSummaryText ?? '' : undefined }
  })
}

export function repairProvidedPassageV02QuestionStems(set: EnglishQuestionSet): EnglishQuestion[] {
  const plans = set.providedPassageV02?.itemPlans ?? []
  const planById = new Map(plans.map((plan) => [plan.itemId, plan]))
  return set.questions.map((question) => {
    const plan = planById.get(question.id)
    if (!plan) return question
    const shape = questionShapeForPlan(plan)
    const choices = isProvidedPassageInlineMarkerPlan(plan) && set.providedPassageV02 ? providedPassageV02MarkerLabels(set.providedPassageV02, plan.itemId) : question.choices
    return { ...question, type: shape.type, stem: shape.stem, choices }
  })
}

export function orderedProvidedPassageV02Questions(set: EnglishQuestionSet) {
  const plans = set.providedPassageV02?.itemPlans
  if (!plans) return set.questions
  const questionById = new Map(set.questions.map((question) => [question.id, question]))
  const ordered = orderedProvidedPassageV02Plans(plans).map((plan) => questionById.get(plan.itemId)).filter((question): question is EnglishQuestion => Boolean(question))
  const known = new Set(ordered.map((question) => question.id))
  return [...ordered, ...set.questions.filter((question) => !known.has(question.id))]
}

export function providedPassageV02GrammarPresentation(set: EnglishQuestionSet, questionId: string) {
  const state = set.providedPassageV02
  const result = state?.results?.find((item) => item.itemId === questionId)
  const operation = result?.materialOperation
  if (!state || !operation || operation.kind !== 'grammar_check') return undefined
  const sentence = state.sentences.find((item) => item.id === operation.testedSpan.sentenceId)
  if (!sentence) return undefined
  const localStart = operation.testedSpan.start - sentence.start
  const localEnd = operation.testedSpan.end - sentence.start
  if (localStart < 0 || localEnd < localStart || localEnd > sentence.text.length) return undefined
  if (sentence.text.slice(localStart, localEnd) !== operation.sourceForm) return undefined
  return {
    sentenceId: sentence.id,
    before: sentence.text.slice(0, localStart),
    displayForm: operation.presentedForm,
    after: sentence.text.slice(localEnd),
    sourceForm: operation.sourceForm,
    grammarMode: operation.grammarMode,
  }
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

function templateId(type: ProvidedPassageV02QuestionType) {
  if (type === 'content_match') return 'school-content-match'
  if (type === 'content_inference') return 'school-content-inference'
  if (type === 'sentence_insertion') return 'school-sentence-insertion'
  if (type === 'summary') return 'school-summary'
  return 'school-grammar'
}

const SUPPORTED_TYPES = new Set<ProvidedPassageV02QuestionType>(['content_match', 'content_inference', 'sentence_insertion', 'grammar', 'summary'])

function rawProvidedPassageV02Request(set: EnglishQuestionSet, state: ProvidedPassageV02State) {
  const questionById = new Map(set.questions.map((question) => [question.id, question]))
  const orderedPlans = orderedProvidedPassageV02Plans(state.itemPlans)
  return {
    schemaId: PROVIDED_PASSAGE_V02_REQUEST_SCHEMA_ID, mode: 'school_english_provided_passage', subject: 'English',
    source: { sourcePassageId: state.sourcePassageId, sourceFingerprint: state.sourceFingerprint, title: set.materialTitle, passage: state.originalText, sentences: state.sentences, boundaries: state.boundaries },
    items: orderedPlans.map((plan) => ({
      itemId: plan.itemId, templateId: templateId(plan.questionType), variantId: 'standard', questionType: plan.questionType,
      choiceLanguage: usesChoiceLanguage(plan.questionType) ? plan.choiceLanguage : null, vocabularyLevel: plan.vocabularyLevel,
      contentMatchPolarity: plan.questionType === 'content_match' ? plan.contentMatchPolarity : null,
      grammarTarget: plan.questionType === 'grammar' ? plan.grammarTarget : null, grammarMode: plan.questionType === 'grammar' ? plan.grammarMode : null,
      requiredStem: questionShapeForPlan(plan).stem,
      targetLevel: set.targetLevel, score: questionById.get(plan.itemId)?.score ?? 2,
      requiredCandidateBoundaryCount: plan.questionType === 'sentence_insertion' ? 5 : null,
    })),
    sourcePreservation: { authority: 'app_stored_source', responsePassage: 'forbidden', exactFingerprintRequired: true, grammarVariantStorage: 'separate_material_operation' },
    approval: { firstResponse: 'single_json_object', approvalSentence: '', afterApproval: 'not_applicable' },
    outputContract: PROVIDED_PASSAGE_V02_RESPONSE_SCHEMA_ID,
  }
}

function sameSourceSegments(state: ProvidedPassageV02State) {
  const expected = segmentProvidedPassage(state.originalText)
  return JSON.stringify(expected.sentences) === JSON.stringify(state.sentences) && JSON.stringify(expected.boundaries) === JSON.stringify(state.boundaries)
}

export function providedPassageV02BlockingReason(set: EnglishQuestionSet) {
  const state = set.providedPassageV02
  if (set.mode !== 'school' || set.materialMode !== 'provided') return '내신형 영어의 기존 지문 사용 모드에서만 V0.2를 지원합니다.'
  if (!state) return '기존 지문 V0.2 상태가 없습니다. 원문과 기존 문항은 유지되며 V0.2 연결 준비가 필요합니다.'
  if (state.version !== '0.2') return 'Provided Passage 상태 버전이 V0.2가 아닙니다.'
  if (!set.material.trim()) return '영어 원문을 입력해야 합니다.'
  if (!state.sourcePassageId.trim()) return 'sourcePassageId가 비어 있습니다.'
  if (set.material !== state.originalText) return '화면 원문과 저장된 authoritative text가 일치하지 않습니다.'
  if (normalizeProvidedPassageForFingerprint(state.originalText) !== state.normalizedForFingerprint) return '저장된 fingerprint 정규화 기준이 권위 원문과 일치하지 않습니다.'
  if (fingerprintProvidedPassage(set.material) !== state.sourceFingerprint) return '권위 원문과 sourceFingerprint가 일치하지 않습니다.'
  if (!sameSourceSegments(state)) return '저장된 sentence ID·offset 또는 boundary ID·offset이 권위 원문과 일치하지 않습니다. 원문을 다시 입력해 연결 정보를 갱신해 주세요.'
  if (state.itemPlans.length < 1 || state.itemPlans.length > PROVIDED_PASSAGE_V02_MAX_ITEMS) return `문항은 1~${PROVIDED_PASSAGE_V02_MAX_ITEMS}개만 지원합니다.`
  if (state.itemPlans.some((plan) => !plan.itemId?.trim())) return '모든 문항 계획에 itemId가 필요합니다.'
  if (state.itemPlans.some((plan) => !SUPPORTED_TYPES.has(plan.questionType))) return 'V0.2에서 지원하지 않는 문항 유형이 포함되어 있습니다.'
  if (new Set(state.itemPlans.map((plan) => plan.itemId)).size !== state.itemPlans.length) return '문항 itemId가 중복되었습니다.'
  if (state.itemPlans.filter((plan) => plan.questionType === 'sentence_insertion').length > 1) return '문장 삽입은 한 세트에 최대 한 문항만 추가할 수 있습니다.'
  if (state.itemPlans.some((plan) => plan.questionType === 'sentence_insertion') && state.boundaries.length < 6) return '문장 삽입에는 내부 후보 경계 5개가 필요합니다.'
  if (set.questions.length !== state.itemPlans.length) return '문항 계획과 편집 문항 수가 일치하지 않습니다.'
  const questionById = new Map(set.questions.map((question) => [question.id, question]))
  for (const plan of state.itemPlans) {
    const question = questionById.get(plan.itemId)
    if (!question) return `문항 계획 ${plan.itemId}와 연결된 편집 문항이 없습니다.`
    const expected = questionShapeForPlan(plan)
    const legacyGrammarStem = plan.questionType === 'grammar' && question.stem === LEGACY_PROVIDED_PASSAGE_GRAMMAR_STEM
    if (question.type !== expected.type || (question.stem !== expected.stem && !legacyGrammarStem)) return `${plan.itemId}: 문항 유형과 발문이 일치하지 않습니다. 유형을 다시 선택해 기본 발문을 동기화해 주세요.`
    if (question.choices.length !== 5) return `${plan.itemId}: V0.2 문항은 선택지 5개가 필요합니다.`
  }
  const request = rawProvidedPassageV02Request(set, state)
  if (!requestValidator(request)) return `Provided Passage V0.2 Request Schema 오류: ${(requestValidator.errors ?? []).map(schemaError).join(' / ')}`
  return undefined
}

export function buildProvidedPassageV02Request(set: EnglishQuestionSet) {
  const state = set.providedPassageV02
  const blocked = providedPassageV02BlockingReason(set)
  if (!state || blocked) throw new Error(blocked ?? 'Provided Passage V0.2 설정이 없습니다.')
  return rawProvidedPassageV02Request(set, state)
}

export function generateProvidedPassageV02Prompt(set: EnglishQuestionSet) {
  const request = buildProvidedPassageV02Request(set)
  const state = set.providedPassageV02!
  const markerRules = request.items.filter((item) => item.questionType === 'sentence_insertion' || (item.questionType === 'grammar' && item.grammarMode === 'controlled_error_variant')).map((item) => `- ${item.itemId} (${item.questionType}): ${JSON.stringify(providedPassageV02MarkerLabels(state, item.itemId))}`).join('\n')
  const grammarDetails = request.items.filter((item) => item.questionType === 'grammar').map((item) => {
    const labels = providedPassageV02MarkerLabels(state, item.itemId)
    return `- ${item.itemId}: ${item.grammarTarget ? `${PROVIDED_PASSAGE_GRAMMAR_RULES[item.grammarTarget]} ${item.grammarMode === 'controlled_error_variant' ? `이 태그는 우선 문법이며, 원문에 없으면 오류로 거부하지 말고 다른 지원 태그를 자동 선택한다. ${PROVIDED_PASSAGE_GRAMMAR_PREFERENCE_RULE}` : '한 표적 구조 설명형에서는 이 태그가 원문에 실제로 있어야 하는 강제 조건이다.'}` : `grammarTarget이 null인 자동 선택 요청이다. ${PROVIDED_PASSAGE_GRAMMAR_AUTO_RULE}`} 모드는 ${item.grammarMode}. question.stem은 requiredStem과 글자 단위로 같아야 한다. testedSpan은 실제로 밑줄 칠 최소 어법 표현만 가리키며 문장 전체를 범위로 삼지 않는다. sourceForm은 testedSpan.text와 같고 오류 변형은 presentedForm에만 둔다.${item.grammarMode === 'controlled_error_variant' ? ` question.evidenceSpans에는 원문 순서대로 서로 겹치지 않는 최소 어법 표적을 정확히 5개 넣는다. choices는 ${JSON.stringify(labels)}로 고정하고, testedSpan은 이 다섯 표적 중 유일하게 틀린 presentedForm을 적용할 한 곳이다. answerIndex는 해당 표적의 순번과 같아야 한다. 나머지 네 표적은 원문 형태를 그대로 제시한다. 다섯 표적은 관계대명사·동격 that, 주어·동사 수 일치, 동사·준동사, 능동·수동, 대명사·재귀대명사, 관계사 중 원문에서 판정 가능한 서로 다른 핵심 항목을 가능한 한 분산한다. 같은 문법 항목만 다섯 번 반복하거나 철자·단순 어휘를 어법 표적으로 사용하지 않는다.` : ''}`
  }).join('\n')
  const grammar = `- 한 세트는 요청된 문항을 최대 ${PROVIDED_PASSAGE_V02_MAX_ITEMS}개까지만 생성한다.\n${grammarDetails || '- 어법 문항 없음'}\n- 같은 공통 지문에 표식형 문항이 둘 이상이면 서로 다른 기호군을 사용한다. 이 요청의 학생 표시용 기호는 다음과 같다.\n${markerRules || '- 표식형 문항 없음'}\n- 각 표식형 question.choices는 위에 지정된 배열과 글자 단위로 같아야 한다. answerIndex는 기호의 글자가 아니라 배열의 1~5 순번이다. 표식형 문항이 하나뿐인 기존 방식에서는 후보 배열의 순서대로 ①~⑤를 사용한다.\n- Request Schema V0.2의 items[].requiredStem은 additional property가 아니라 item.required와 item.properties에 모두 정의된 비어 있지 않은 정식 필수 문자열이다. 이를 오류로 판정하거나 Request에서 삭제하지 않는다.\n- question.stem은 대응하는 requiredStem과 공백·문장부호까지 글자 단위로 정확히 같아야 하며 questionType만으로 재구성하지 않는다.\n- sourceFingerprint는 앱이 버전 접두어와 정규화 규칙을 적용해 이미 계산한 불투명 식별값이다. source.passage만 직접 SHA-256 처리하여 재계산·대조하거나 오류로 거부하지 않는다. exactFingerprintRequired는 Request의 sourceFingerprint를 Response에 글자 단위로 그대로 반환하라는 뜻이다.\n- 문장 삽입의 candidateBoundaryIds, answerBoundaryId, positionReasons[].boundaryId에는 Request의 내부 ID를 그대로 유지한다. positionReasons[].reason이나 호환형 해설·검토 등 사용자용 문장에서는 내부 ID를 금지하고 해당 itemId에 배정된 choices 기호를 후보 배열 순서대로 사용한다. boundary ID의 숫자를 위치 번호로 직접 변환하지 않는다.\n- 1차 JSON은 문제지와 정답지 완성이 목적이다. question의 explanation, intention, distractorReasons와 item의 qualityReview는 절대 출력하지 않는다. evidenceSpans와 materialOperation은 구조 검증과 시험지 표시를 위한 필수 정보만 간결하게 반환한다.\n- explanation, intention, distractorReasons, qualityReview는 [EXPLANATION_GENERATION_V1] 요청을 받은 2차 해설 단계에서만 출력한다.\n- JSON 문자열 안에서 표현을 인용할 때는 ‘ ’를 사용한다. 이스케이프하지 않은 ASCII 큰따옴표를 문자열 안에 넣지 않으며, 출력 직전에 전체 결과가 JSON.parse 가능한지 검사한다.`
  return `[PROVIDED_PASSAGE_GENERATION_V0.2]\n당신은 사용자가 제공한 영어 원문을 수정하지 않고 여러 내신형 문항을 설계·생성하는 영어 출제자다.\n\n[절대 원칙]\n- source.passage는 유일한 권위 원문이며 응답에 전체를 반환하지 않는다.\n- 문장 삽입이 아닌 모든 items는 동일한 source.passage 한 지문을 공유한다. 같은 지문을 문항별로 새로 만들거나 반복 반환하지 않는다.\n- 내용 일치·불일치 문항이 여러 개면 같은 원문에서 서로 다른 근거와 오답 원리로 각각 독립된 문항을 만든다.\n- content_inference 내용 이해 문항은 단순 사실 재진술이 아니라 지문의 둘 이상의 단서 또는 하나의 충분한 함의로 도출되는 추론을 묻는다. 정답은 외부 배경지식 없이 원문만으로 유일하게 도출하고, 과도한 일반화·인과 비약·범위 왜곡·주체 변경을 오답으로 사용한다.\n- 내용 이해의 evidenceSpans에는 실제 추론에 사용한 원문 단서를 넣고, 추론 설명은 2차 해설 단계에서 작성한다.\n- summary 요약문 완성은 공통 원문을 반복하지 않고 question.summaryText에 원문 전체의 핵심 관계를 재진술한 영어 한 문장을 작성한다. summaryText에는 [[요약빈칸:A]]와 [[요약빈칸:B]]를 각각 정확히 한 번 넣고 choices는 ["A단어|B단어", ...] 형식의 서로 다른 다섯 영어 단어쌍으로 만든다.\n- 문장 삽입 item은 최대 하나이며 항상 items 배열의 마지막에 둔다.\n- sourcePassageId, sourceFingerprint와 모든 itemId를 그대로 반환한다.\n- sentence ID·offset과 boundary ID·offset은 Request에 있는 값만 사용하며 새로 만들거나 바꾸지 않는다.\n- 각 item의 question.stem은 해당 item의 requiredStem과 공백·문장부호까지 정확히 같아야 한다.\n- items마다 요청된 유형·언어·어휘 수준·문법 태그를 독립적으로 지킨다.\n- 문장 삽입의 generatedSentence, 후보 경계와 표식은 해당 itemId의 materialOperation에만 둔다. 다른 문항이나 공통 원문에 전파하지 않는다.\n- 정답은 문항마다 정확히 하나이며 외부 사실로 판정하지 않는다.\n- 어법 문항은 원문 근거가 하나로 결정될 때만 만든다. source_form_check는 sourceForm과 presentedForm이 같고, controlled_error_variant는 원문을 고치지 않은 채 presentedForm에만 최소 변형을 둔다.\n- 어법 testedSpan은 실제로 밑줄 칠 낱말·구·절의 최소 정확 범위여야 한다. 근거 문장 전체는 evidenceSpans에 둘 수 있지만 testedSpan이나 sourceForm에 문장 전체를 넣지 않는다.\n- 관계대명사는 선행사와 관계절 성분, 동격 that은 완전한 절과 명사 내용 관계, 수 일치는 실제 주어, 분사구문은 의미상 주어와 태, 계속적 관계대명사는 쉼표·that 금지, 대명사 일치는 선행사, 가주어는 진주어, 강조 it-that은 강조 대상과 잔여 절을 반드시 확인한다.\n${grammar || '- 어법 문항 없음'}\n\n[Request 검증 순서]\n1. schemaId와 mode를 확인한다.\n2. 필수 최상위 필드를 확인한다.\n3. items 배열을 확인한다.\n4. 각 item의 필수 필드를 확인한다.\n5. additionalProperties를 검사한다. requiredStem을 포함해 properties에 정의된 필드는 추가 속성이 아니다.\n\n[출력]\nRequest가 유효하면 설계안이나 승인 질문 없이 즉시 ${PROVIDED_PASSAGE_V02_RESPONSE_SCHEMA_ID} 문제·정답 JSON 객체 하나만 출력한다. 유효하지 않으면 오류 목록만 출력하고 임시 JSON, Markdown 설명, 승인 문장, 지원 유형으로의 임의 변경을 출력하지 않는다.\n\n[Request JSON]\n${JSON.stringify(request, null, 2)}`
}

function validateSpan(span: ProvidedPassageEvidenceSpan, state: ProvidedPassageV02State, label: string) {
  const sentence = state.sentences.find((candidate) => candidate.id === span.sentenceId)
  if (!sentence) throw new Error(`${label}: 존재하지 않는 sentenceId ${span.sentenceId}`)
  if (span.start < sentence.start || span.end > sentence.end || span.start >= span.end || state.originalText.slice(span.start, span.end) !== span.text) throw new Error(`${label}: 원문 offset과 text가 일치하지 않습니다.`)
}

function repairUniqueSpanOffset(span: ProvidedPassageEvidenceSpan, state: ProvidedPassageV02State) {
  const sentence = state.sentences.find((candidate) => candidate.id === span.sentenceId)
  if (!sentence || !span.text || state.originalText.slice(span.start, span.end) === span.text) return { span, repaired: false }
  const indexes: number[] = []
  let cursor = 0
  while (cursor <= sentence.text.length - span.text.length) {
    const index = sentence.text.indexOf(span.text, cursor)
    if (index < 0) break
    indexes.push(index)
    cursor = index + Math.max(1, span.text.length)
  }
  if (indexes.length !== 1) return { span, repaired: false }
  const start = sentence.start + indexes[0]
  return { span: { ...span, start, end: start + span.text.length }, repaired: true }
}

function containsAuthoritativePassage(value: unknown, authoritativeText: string): boolean {
  if (typeof value === 'string') return value === authoritativeText || normalizeProvidedPassageForFingerprint(value) === normalizeProvidedPassageForFingerprint(authoritativeText)
  if (Array.isArray(value)) return value.some((item) => containsAuthoritativePassage(item, authoritativeText))
  if (value && typeof value === 'object') return Object.values(value).some((item) => containsAuthoritativePassage(item, authoritativeText))
  return false
}

export function adaptProvidedPassageV02Response(value: unknown, base: EnglishQuestionSet): EnglishQuestionSet {
  if (!responseValidator(value)) throw new Error(`Provided Passage V0.2 Response Schema 오류: ${(responseValidator.errors ?? []).map(schemaError).join(' / ')}`)
  const normalizedValue = structuredClone(value)
  const root = normalizedValue as Record<string, unknown>
  const state = base.providedPassageV02
  if (!state) throw new Error('Provided Passage V0.2 상태가 없습니다.')
  const blocked = providedPassageV02BlockingReason(base)
  if (blocked) throw new Error(blocked)
  if (containsAuthoritativePassage(normalizedValue, state.originalText)) throw new Error('AI Response에 권위 원문 전체가 포함되어 있어 가져오기를 거부했습니다.')
  if (root.sourcePassageId !== state.sourcePassageId || root.sourceFingerprint !== state.sourceFingerprint) throw new Error('원문 ID 또는 fingerprint가 일치하지 않습니다.')
  const records = root.items as Array<Record<string, unknown>>
  if (records.length !== state.itemPlans.length) throw new Error('응답 문항 수가 요청 문항 수와 일치하지 않습니다.')
  const recordById = new Map(records.map((record) => [String(record.itemId), record]))
  if (recordById.size !== records.length) throw new Error('응답 itemId가 중복되었습니다.')
  const questions: EnglishQuestion[] = []
  const results: ProvidedPassageV02ItemResult[] = []
  const reviews: CsatQualityReview[] = []
  const importWarnings: string[] = []
  const orderedPlans = orderedProvidedPassageV02Plans(state.itemPlans)
  for (const plan of orderedPlans) {
    const record = recordById.get(plan.itemId)
    if (!record) throw new Error(`요청한 itemId가 응답에 없습니다: ${plan.itemId}`)
    if (record.templateId !== templateId(plan.questionType) || record.questionType !== plan.questionType || record.vocabularyLevel !== plan.vocabularyLevel) throw new Error(`${plan.itemId}: 문항 계약이 요청과 일치하지 않습니다.`)
    if (record.choiceLanguage !== (usesChoiceLanguage(plan.questionType) ? plan.choiceLanguage : null) || record.contentMatchPolarity !== (plan.questionType === 'content_match' ? plan.contentMatchPolarity : null)) throw new Error(`${plan.itemId}: 선지 언어 또는 발문 극성이 다릅니다.`)
    const responseGrammarTarget = record.grammarTarget as ProvidedPassageGrammarTarget | null
    if (plan.questionType === 'grammar') {
      const requiresExactGrammarTarget = plan.grammarMode === 'source_form_check' && plan.grammarTarget !== null
      if (!responseGrammarTarget || record.grammarMode !== plan.grammarMode || (requiresExactGrammarTarget && responseGrammarTarget !== plan.grammarTarget)) throw new Error(`${plan.itemId}: 문법 태그 또는 모드가 다릅니다.`)
    } else if (responseGrammarTarget !== null || record.grammarMode !== null) throw new Error(`${plan.itemId}: 문법 태그 또는 모드가 다릅니다.`)
    const question = record.question as Record<string, unknown>
    const expectedShape = questionShapeForPlan(plan)
    if (question.type !== expectedShape.type || String(question.stem) !== expectedShape.stem) throw new Error(`${plan.itemId}: 문항 유형 또는 기본 발문이 다릅니다. 요청 발문: “${expectedShape.stem}” / 응답 발문: “${String(question.stem)}”`)
    const evidenceSpans = (question.evidenceSpans as ProvidedPassageEvidenceSpan[]).map((span, index) => {
      const repaired = repairUniqueSpanOffset(span, state)
      if (repaired.repaired) importWarnings.push(`${plan.itemId}.evidenceSpans[${index}] offset을 원문에서 유일하게 확인된 “${span.text}” 위치로 자동 교정했습니다.`)
      return repaired.span
    })
    question.evidenceSpans = evidenceSpans
    evidenceSpans.forEach((span, index) => validateSpan(span, state, `${plan.itemId}.evidenceSpans[${index}]`))
    let choices = (question.choices as string[]).map(stripLeadingChoiceMarker)
    const markerLabels = isProvidedPassageInlineMarkerPlan(plan) ? providedPassageV02MarkerLabels(state, plan.itemId) : undefined
    if (markerLabels) {
      const receivedKey = choices.join('|')
      const currentKey = markerLabels.join('|')
      const legacyKey = SCHOOL_NUMERIC_MARKER_LABELS.join('|')
      if (receivedKey !== currentKey && receivedKey !== legacyKey) throw new Error(`${plan.itemId}: 표식형 choices는 ${markerLabels.join(', ')} 순서여야 합니다.`)
      choices = markerLabels
    }
    if (new Set(choices.map((choice) => choice.normalize('NFC').replace(/\s+/g, ' ').toLowerCase())).size !== 5) throw new Error(`${plan.itemId}: 선택지는 서로 달라야 합니다.`)
    const operation = record.materialOperation as ProvidedPassageV02ItemResult['materialOperation']
    if (plan.questionType === 'content_match' || plan.questionType === 'content_inference' || plan.questionType === 'summary') {
      if (operation !== null) throw new Error(`${plan.itemId}: 내용 문항의 materialOperation은 null이어야 합니다.`)
      if (plan.choiceLanguage === 'ko' && choices.some((choice) => !/[가-힣]/.test(choice))) throw new Error(`${plan.itemId}: 한국어 선지로 통일해야 합니다.`)
      if (plan.choiceLanguage === 'en' && choices.some((choice) => /[가-힣]/.test(choice) || !/[A-Za-z]/.test(choice))) throw new Error(`${plan.itemId}: 영어 선지로 통일해야 합니다.`)
      if (plan.questionType === 'summary') {
        const summaryText = typeof question.summaryText === 'string' ? question.summaryText.trim() : ''
        const markerA = summaryText.match(/\[\[요약빈칸:A\]\]/g)?.length ?? 0
        const markerB = summaryText.match(/\[\[요약빈칸:B\]\]/g)?.length ?? 0
        if (markerA !== 1 || markerB !== 1) throw new Error(`${plan.itemId}: 요약문에는 [[요약빈칸:A]]와 [[요약빈칸:B]]가 각각 정확히 1개 필요합니다.`)
        if (choices.some((choice) => choice.split('|').length !== 2 || choice.split('|').some((part) => !part.trim()))) throw new Error(`${plan.itemId}: 요약문 선지는 A단어|B단어 형식의 단어쌍 다섯 개가 필요합니다.`)
      }
    } else if (plan.questionType === 'sentence_insertion') {
      if (!operation || operation.kind !== 'insert_sentence') throw new Error(`${plan.itemId}: 삽입 operation이 필요합니다.`)
      const boundaryById = new Map(state.boundaries.map((boundary) => [boundary.id, boundary]))
      const validBoundaries = new Set(boundaryById.keys())
      if (operation.candidateBoundaryIds.some((id) => !validBoundaries.has(id)) || !operation.candidateBoundaryIds.includes(operation.answerBoundaryId)) throw new Error(`${plan.itemId}: 삽입 경계가 유효하지 않습니다.`)
      const candidateOffsets = operation.candidateBoundaryIds.map((id) => boundaryById.get(id)!.offset)
      if (candidateOffsets.some((offset, index) => index > 0 && offset <= candidateOffsets[index - 1])) throw new Error(`${plan.itemId}: 삽입 후보 경계는 원문 순서대로 겹치지 않게 제시해야 합니다.`)
      const reasonIds = operation.positionReasons.map((reason) => reason.boundaryId)
      if (new Set(reasonIds).size !== 5 || reasonIds.some((id) => !operation.candidateBoundaryIds.includes(id))) throw new Error(`${plan.itemId}: 위치별 이유는 다섯 후보 boundaryId와 정확히 대응해야 합니다.`)
      const answerPosition = operation.candidateBoundaryIds.indexOf(operation.answerBoundaryId)
      if (question.answerIndex !== answerPosition + 1) throw new Error(`${plan.itemId}: answerIndex와 answerBoundaryId가 같은 후보 위치를 가리켜야 합니다.`)
      const userFacingStrings = [
        ...operation.positionReasons.map((reason) => reason.reason),
        typeof question.explanation === 'string' ? question.explanation : '',
        typeof question.intention === 'string' ? question.intention : '',
        ...((Array.isArray(question.distractorReasons) ? question.distractorReasons : []).map(String)),
        ...((record.qualityReview as CsatQualityReview | undefined)?.questions?.map((review) => review.decisiveReason ?? '') ?? []),
      ]
      if (userFacingStrings.some((text) => /\bb\d+\b/i.test(text))) throw new Error(`${plan.itemId}: 사용자용 문장에는 내부 boundary ID를 출력할 수 없습니다. 후보 배열 순서에 따른 ${markerLabels?.join('·') ?? '표시 기호'}를 사용해 주세요.`)
      validateSpan(operation.beforeEvidence, state, `${plan.itemId}.beforeEvidence`); validateSpan(operation.afterEvidence, state, `${plan.itemId}.afterEvidence`)
      const answerBoundary = boundaryById.get(operation.answerBoundaryId)!
      if (operation.beforeEvidence.sentenceId !== answerBoundary.beforeSentenceId || operation.afterEvidence.sentenceId !== answerBoundary.afterSentenceId) throw new Error(`${plan.itemId}: 정답 경계의 바로 앞·뒤 문장이 evidence와 일치하지 않습니다.`)
    } else {
      if (!operation || operation.kind !== 'grammar_check') throw new Error(`${plan.itemId}: grammar_check operation이 필요합니다.`)
      const grammarOperation = operation as ProvidedPassageGrammarOperation
      const repairedTestedSpan = repairUniqueSpanOffset(grammarOperation.testedSpan, state)
      if (repairedTestedSpan.repaired) importWarnings.push(`${plan.itemId}.testedSpan offset을 원문에서 유일하게 확인된 “${grammarOperation.testedSpan.text}” 위치로 자동 교정했습니다.`)
      grammarOperation.testedSpan = repairedTestedSpan.span
      validateSpan(grammarOperation.testedSpan, state, `${plan.itemId}.testedSpan`)
      const testedSentence = state.sentences.find((sentence) => sentence.id === grammarOperation.testedSpan.sentenceId)
      if (testedSentence && grammarOperation.testedSpan.start === testedSentence.start && grammarOperation.testedSpan.end === testedSentence.end) throw new Error(`${plan.itemId}: 어법 testedSpan이 문장 전체를 가리킵니다. evidenceSpans에는 근거 문장을 둘 수 있지만 testedSpan·sourceForm에는 실제로 밑줄 칠 최소 어법 표현만 넣어 주세요.`)
      const resolvedGrammarTarget = responseGrammarTarget
      if (!resolvedGrammarTarget || grammarOperation.grammarTarget !== resolvedGrammarTarget || grammarOperation.grammarMode !== plan.grammarMode || grammarOperation.ruleCheck.classification !== resolvedGrammarTarget) throw new Error(`${plan.itemId}: 문법 판정 정보가 요청과 다릅니다.`)
      if (!grammarOperation.ruleCheck.isUniquelyDetermined || grammarOperation.sourceTextModified !== false) throw new Error(`${plan.itemId}: 문법 판정이 유일하지 않거나 원문 변경 플래그가 잘못되었습니다.`)
      if (grammarOperation.sourceForm !== grammarOperation.testedSpan.text) throw new Error(`${plan.itemId}: sourceForm이 원문 testedSpan과 다릅니다.`)
      if (plan.grammarMode === 'source_form_check' && grammarOperation.presentedForm !== grammarOperation.sourceForm) throw new Error(`${plan.itemId}: 원문 확인 모드는 별도 변형을 허용하지 않습니다.`)
      if (plan.grammarMode === 'controlled_error_variant') {
        if (grammarOperation.presentedForm === grammarOperation.sourceForm) throw new Error(`${plan.itemId}: 오류 변형 모드는 presentedForm에 명시적 변형이 필요합니다.`)
        if (evidenceSpans.length !== 5) throw new Error(`${plan.itemId}: 5개 표식 어법 오류 찾기는 밑줄 표적 evidenceSpans가 정확히 5개 필요합니다.`)
        const orderedEvidence = [...evidenceSpans].sort((left, right) => left.start - right.start)
        if (orderedEvidence.some((span, index) => span !== evidenceSpans[index] || (index > 0 && span.start < orderedEvidence[index - 1].end))) throw new Error(`${plan.itemId}: 다섯 어법 표적은 원문 순서대로 서로 겹치지 않아야 합니다.`)
        const testedIndex = evidenceSpans.findIndex((span) => span.start === grammarOperation.testedSpan.start && span.end === grammarOperation.testedSpan.end && span.text === grammarOperation.testedSpan.text)
        if (testedIndex < 0) throw new Error(`${plan.itemId}: testedSpan은 다섯 evidenceSpans 중 하나와 정확히 같아야 합니다.`)
        if (choices.some((choice, index) => choice !== markerLabels?.[index])) throw new Error(`${plan.itemId}: 어법 오류 찾기의 choices는 ${markerLabels?.join(', ')}로 고정됩니다.`)
        if (question.answerIndex !== testedIndex + 1) throw new Error(`${plan.itemId}: 정답 번호가 오류 변형을 적용한 밑줄 위치와 일치하지 않습니다.`)
      }
    }
    questions.push({ id: plan.itemId, type: expectedShape.type, stem: expectedShape.stem, choices, answerIndex: question.answerIndex as number, explanation: typeof question.explanation === 'string' ? question.explanation.trim() : '', intention: typeof question.intention === 'string' ? question.intention.trim() : '', evidenceRefs: evidenceSpans.map((span) => span.text), distractorReasons: Array.isArray(question.distractorReasons) ? question.distractorReasons.map(String) : [], score: question.score as number, schoolStemLanguage: plan.stemLanguage ?? 'ko', schoolChoiceLanguage: usesChoiceLanguage(plan.questionType) ? plan.choiceLanguage ?? defaultChoiceLanguage(plan.questionType) ?? undefined : undefined, schoolTemplateId: plan.questionType === 'summary' ? 'summary' : undefined, schoolChoiceLayout: plan.questionType === 'summary' ? 'matrix' : undefined, schoolSummaryText: plan.questionType === 'summary' ? String(question.summaryText).trim() : undefined })
    results.push({ itemId: plan.itemId, evidenceSpans, materialOperation: operation })
    if (record.qualityReview) reviews.push(record.qualityReview as CsatQualityReview)
  }
  return { ...base, title: String(root.title || base.title), material: state.originalText, questions, providedPassageV02: { ...state, itemPlans: orderedPlans, results, importWarnings }, providedPassageQualityReview: reviews.length ? { passage: reviews[0]?.passage ?? {}, questions: reviews.flatMap((review) => review.questions ?? []) } : undefined, aiRevision: base.aiRevision + 1, validatedRevision: 0, lastImportedJson: JSON.stringify(normalizedValue, null, 2), explanationSourceFingerprint: undefined, updatedAt: new Date().toISOString() }
}

export function parseProvidedPassageV02Json(raw: string, base: EnglishQuestionSet) {
  let value: unknown
  try { value = JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')) } catch (error) { throw new Error(`Provided Passage V0.2 JSON 문법 오류입니다. JSON 문자열 안의 인용에는 ‘ ’를 사용하거나 큰따옴표를 \\"처럼 이스케이프해야 합니다. (${error instanceof Error ? error.message : 'JSON 확인 필요'})`, { cause: error }) }
  return adaptProvidedPassageV02Response(value, base)
}

export function providedPassageV02ValidationMessages(set: EnglishQuestionSet) {
  const state = set.providedPassageV02
  if (!state) return []
  const messages: Array<{ level: 'error' | 'warning'; label: string; detail: string }> = []
  const blocked = providedPassageV02BlockingReason(set)
  if (blocked) messages.push({ level: 'error', label: 'Provided Passage V0.2', detail: blocked })
  if (!state.results) messages.push({ level: 'warning', label: 'AI 결과 전', detail: `${state.itemPlans.length}개 문항 계획과 원문 근거가 준비되었습니다.` })
  state.importWarnings?.forEach((detail) => messages.push({ level: 'warning', label: 'AI offset 자동 교정', detail }))
  return messages
}

/**
 * Boundary IDs such as b3 are stable internal coordinates, not student-facing
 * position labels. Translate only the five candidates of the matching
 * insertion question so saved source data can remain unchanged.
 */
export function humanizeProvidedPassageBoundaryReferences(set: EnglishQuestionSet, questionId: string, text: string) {
  const state = set.providedPassageV02
  const operation = state?.results?.find((result) => result.itemId === questionId)?.materialOperation
  if (!operation || operation.kind !== 'insert_sentence' || !text) return text
  const displayLabels = state ? providedPassageV02MarkerLabels(state, questionId) : [...SCHOOL_NUMERIC_MARKER_LABELS]
  const labels = new Map(operation.candidateBoundaryIds.map((id, index) => [id, displayLabels[index] ?? `${index + 1}`]))
  return text.replace(/(^|[^A-Za-z0-9_])(b\d+)(?=$|[^A-Za-z0-9_])/g, (match, prefix: string, boundaryId: string) => {
    const label = labels.get(boundaryId)
    return label ? `${prefix}${label}` : match
  })
}

export function providedPassageV02PresentationSpec(set: EnglishQuestionSet, questionId?: string) {
  const state = set.providedPassageV02
  const question = questionId ? set.questions.find((candidate) => candidate.id === questionId) : undefined
  if (state && question?.type === '요약문 완성' && question.schoolSummaryText?.trim()) return { kind: 'summary' as const, summary: question.schoolSummaryText.trim() }
  const matchingResults = state?.results?.filter((result) => result.materialOperation?.kind === 'insert_sentence') ?? []
  const result = questionId
    ? matchingResults.find((candidate) => candidate.itemId === questionId)
    : state?.itemPlans.length === 1 && matchingResults.length === 1 ? matchingResults[0] : undefined
  const operation = result?.materialOperation
  if (!state || !operation || operation.kind !== 'insert_sentence') return set.materialSpec
  const displayLabels = providedPassageV02MarkerLabels(state, result.itemId)
  const markers = new Map(operation.candidateBoundaryIds.map((id, index) => [id, displayLabels[index]]))
  const boundaries = state.boundaries.filter((boundary) => markers.has(boundary.id)).sort((left, right) => right.offset - left.offset)
  let body = state.originalText
  boundaries.forEach((boundary) => { body = `${body.slice(0, boundary.offset)} [[삽입위치:${markers.get(boundary.id)}]] ${body.slice(boundary.offset)}` })
  return { kind: 'insertion' as const, givenSentence: operation.generatedSentence, body: normalizeEnglishPassage(body) }
}

function grammarMaterialEvents(result: ProvidedPassageV02ItemResult, state: ProvidedPassageV02State, labels: string[] = [...SCHOOL_NUMERIC_MARKER_LABELS]) {
  const operation = result.materialOperation
  if (!operation || operation.kind !== 'grammar_check') return []
  if (operation.grammarMode === 'controlled_error_variant' && result.evidenceSpans.length === 5) {
    return [...result.evidenceSpans].sort((left, right) => left.start - right.start).flatMap((span, index) => {
      if (state.originalText.slice(span.start, span.end) !== span.text) return []
      const isErrorTarget = span.start === operation.testedSpan.start && span.end === operation.testedSpan.end && span.text === operation.testedSpan.text
      const displayForm = isErrorTarget ? operation.presentedForm : span.text
      return [{ start: span.start, end: span.end, replacement: `${labels[index] ?? labels.at(-1)} [[밑줄:${displayForm}]]` }]
    })
  }
  const { start, end, text } = operation.testedSpan
  if (state.originalText.slice(start, end) !== text || operation.sourceForm !== text) return []
  return [{ start, end, replacement: `[[밑줄:${operation.presentedForm}]]` }]
}

function applyMaterialEvents(source: string, events: Array<{ start: number; end: number; replacement: string }>) {
  let material = source
  let nextStart = source.length
  events.sort((left, right) => right.start - left.start || right.end - left.end).forEach((event) => {
    if (event.end > nextStart) return
    material = `${material.slice(0, event.start)}${event.replacement}${material.slice(event.end)}`
    nextStart = event.start
  })
  return material
}

export function providedPassageV02QuestionMaterialText(set: EnglishQuestionSet, questionId: string) {
  const state = set.providedPassageV02
  if (!state) return normalizeEnglishPassage(set.material)
  const result = state.results?.find((item) => item.itemId === questionId)
  if (!result) return normalizeEnglishPassage(state.originalText)
  return normalizeEnglishPassage(applyMaterialEvents(state.originalText, grammarMaterialEvents(result, state, providedPassageV02MarkerLabels(state, questionId))))
}

export function providedPassageV02SharedMaterialText(set: EnglishQuestionSet) {
  const state = set.providedPassageV02
  if (!state || !orderedProvidedPassageV02Questions(set).some((question) => question.type !== '문장 삽입')) return undefined
  const operations = (state.results ?? []).flatMap((result) => grammarMaterialEvents(result, state, providedPassageV02MarkerLabels(state, result.itemId)))
  return normalizeEnglishPassage(applyMaterialEvents(state.originalText, operations))
}

export function providedPassageV02SharedPresentationSpec(set: EnglishQuestionSet) {
  const state = set.providedPassageV02
  if (!state || set.schoolInsertionPresentation !== 'shared') return undefined
  const insertion = state.results?.find((result) => result.materialOperation?.kind === 'insert_sentence')?.materialOperation
  if (!insertion || insertion.kind !== 'insert_sentence') return undefined
  const insertionResult = state.results?.find((result) => result.materialOperation === insertion)
  const insertionLabels = insertionResult ? providedPassageV02MarkerLabels(state, insertionResult.itemId) : [...SCHOOL_NUMERIC_MARKER_LABELS]
  const boundaryById = new Map(state.boundaries.map((boundary) => [boundary.id, boundary]))
  const events: Array<{ start: number; end: number; replacement: string }> = insertion.candidateBoundaryIds.flatMap((id, index) => {
    const boundary = boundaryById.get(id)
    return boundary ? [{ start: boundary.offset, end: boundary.offset, replacement: ` [[삽입위치:${insertionLabels[index]}]] ` }] : []
  })
  ;(state.results ?? []).forEach((result) => events.push(...grammarMaterialEvents(result, state, providedPassageV02MarkerLabels(state, result.itemId))))
  const body = normalizeEnglishPassage(applyMaterialEvents(state.originalText, events))
  return { kind: 'insertion' as const, givenSentence: insertion.generatedSentence, body }
}
