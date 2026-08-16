import Ajv2020, { type ErrorObject } from 'ajv/dist/2020'
import requestSchema from '../docs/english-gpt/provided-passage-request-schema-v0.2.json'
import responseSchema from '../docs/english-gpt/provided-passage-response-schema-v0.2.json'
import { CSAT_INLINE_POSITION_CHOICES } from './csat'
import { fingerprintProvidedPassage, normalizeProvidedPassageForFingerprint, segmentProvidedPassage } from './providedPassage'
import type {
  CsatQualityReview, EnglishQuestion, EnglishQuestionSet, ProvidedPassageEvidenceSpan, ProvidedPassageGrammarMode,
  ProvidedPassageGrammarOperation, ProvidedPassageGrammarTarget, ProvidedPassageV02ItemPlan,
  ProvidedPassageV02ItemResult, ProvidedPassageV02QuestionType, ProvidedPassageV02State,
} from './types'

export const PROVIDED_PASSAGE_V02_REQUEST_SCHEMA_ID = 'english-question-lab-provided-passage-request-v0.2' as const
export const PROVIDED_PASSAGE_V02_RESPONSE_SCHEMA_ID = 'english-question-lab-provided-passage-generation-v0.2' as const
export const PROVIDED_PASSAGE_V02_MAX_ITEMS = 8

export const PROVIDED_PASSAGE_V02_TYPE_LABELS: Record<ProvidedPassageV02QuestionType, string> = {
  content_match: '내용 일치·불일치', content_inference: '내용 이해·추론', sentence_insertion: '문장 삽입', grammar: '어법',
}
export const PROVIDED_PASSAGE_GRAMMAR_LABELS: Record<ProvidedPassageGrammarTarget, string> = {
  relative_clause: '관계대명사', appositive_that: '동격 that', subject_verb_agreement: '수 일치',
  participle_clause: '분사구문', nonrestrictive_relative: '계속적 관계대명사', pronoun_agreement: '지시·대명사 일치',
  dummy_it: '가주어·진주어', cleft_it_that: '강조 it-that',
}
export const PROVIDED_PASSAGE_GRAMMAR_MODE_LABELS: Record<ProvidedPassageGrammarMode, string> = {
  source_form_check: '원문 형태 확인', controlled_error_variant: '별도 오류 변형',
}
export const PROVIDED_PASSAGE_GRAMMAR_MODE_HELP: Record<ProvidedPassageGrammarMode, string> = {
  source_form_check: '원문에 실제로 쓰인 형태가 문법상 적절한지 판정합니다. 원문 표현을 바꾸지 않습니다.',
  controlled_error_variant: '원문은 그대로 보존하고, 시험에 제시할 최소 오류형만 presentedForm에 별도로 만듭니다.',
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
) {
  if (type === 'sentence_insertion') return '글의 흐름으로 보아, 주어진 문장이 들어가기에 가장 적절한 곳은?'
  if (type === 'grammar') {
    const label = PROVIDED_PASSAGE_GRAMMAR_STEM_LABELS[grammarTarget ?? 'relative_clause']
    return grammarMode === 'controlled_error_variant'
      ? `밑줄 친 ${label}의 어법상 오류에 대한 설명으로 가장 적절한 것은?`
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
): Pick<EnglishQuestion, 'type' | 'stem' | 'choices' | 'answerIndex'> {
  if (type === 'sentence_insertion') return { type: '문장 삽입', stem: providedPassageV02DefaultStem(type), choices: [...CSAT_INLINE_POSITION_CHOICES], answerIndex: 1 }
  if (type === 'grammar') return { type: '어법', stem: providedPassageV02DefaultStem(type, polarity, grammarTarget, grammarMode), choices: Array.from({ length: 5 }, () => ''), answerIndex: 1 }
  if (type === 'content_inference') return { type: '내용 이해', stem: providedPassageV02DefaultStem(type), choices: Array.from({ length: 5 }, () => ''), answerIndex: 1 }
  return { type: '내용 일치 및 불일치', stem: providedPassageV02DefaultStem(type, polarity), choices: Array.from({ length: 5 }, () => ''), answerIndex: 1 }
}

function questionShapeForPlan(plan: ProvidedPassageV02ItemPlan) {
  return questionShape(plan.questionType, plan.contentMatchPolarity, plan.grammarTarget, plan.grammarMode)
}

function usesChoiceLanguage(type: ProvidedPassageV02QuestionType) {
  return type === 'content_match' || type === 'content_inference'
}

export function createProvidedPassageV02Plan(itemId: string = crypto.randomUUID(), questionType: ProvidedPassageV02QuestionType = 'content_match'): ProvidedPassageV02ItemPlan {
  return {
    itemId, questionType, choiceLanguage: usesChoiceLanguage(questionType) ? 'ko' : null,
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

export function createProvidedPassageV02State(text: string, plans: ProvidedPassageV02ItemPlan[] = [createProvidedPassageV02Plan()]): ProvidedPassageV02State {
  const sourceFingerprint = fingerprintProvidedPassage(text)
  const { sentences, boundaries } = segmentProvidedPassage(text)
  return { version: '0.2', sourcePassageId: `source-${sourceFingerprint.slice(7, 23)}`, sourceFingerprint, originalText: text, normalizedForFingerprint: normalizeProvidedPassageForFingerprint(text), sentences, boundaries, itemPlans: orderedProvidedPassageV02Plans(plans) }
}

export function transitionSchoolProvidedPassageV02(set: EnglishQuestionSet, mode: 'provided' | 'generated'): EnglishQuestionSet {
  if (mode === 'generated') return { ...set, materialMode: 'generated', sourceKind: set.sourceKind === 'generated' ? 'textbook' : set.sourceKind, providedPassage: undefined, providedPassageV02: undefined, providedPassageQualityReview: undefined }
  const blocked = providedPassageV02TransitionBlockingReason(set)
  if (blocked) throw new Error(blocked)
  const currentQuestions = set.questions.length ? set.questions : [{ id: crypto.randomUUID(), ...questionShape('content_match'), explanation: '', intention: '', evidenceRefs: [], distractorReasons: [], score: 2 }]
  const replacePristineDefault = currentQuestions.length === 1 && questionTypeFromExisting(currentQuestions[0]) === undefined && isPristineQuestion(currentQuestions[0])
  const plans = orderedProvidedPassageV02Plans(currentQuestions.map((question) => createProvidedPassageV02Plan(question.id, replacePristineDefault ? 'content_match' : questionTypeFromExisting(question)!)))
  const questionById = new Map(currentQuestions.map((question) => [question.id, question]))
  const questions = plans.map((plan) => ({ ...questionById.get(plan.itemId)!, ...questionShapeForPlan(plan), id: plan.itemId }))
  return { ...set, materialMode: 'provided', sourceKind: set.sourceKind === 'generated' ? 'external' : set.sourceKind, choiceCount: 5, providedPassage: undefined, providedPassageV02: createProvidedPassageV02State(set.material, plans), questions }
}

function questionTypeFromExisting(question: EnglishQuestion): ProvidedPassageV02QuestionType | undefined {
  if (question.type === '내용 일치 및 불일치') return 'content_match'
  if (question.type === '내용 이해') return 'content_inference'
  if (question.type === '문장 삽입') return 'sentence_insertion'
  if (question.type === '어법') return 'grammar'
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
  return orderedProvidedPassageV02Plans(plans).map((plan) => {
    const previous = existing.get(plan.itemId)
    const shape = questionShapeForPlan(plan)
    return { id: plan.itemId, ...shape, explanation: previous?.explanation ?? '', intention: previous?.intention ?? '', evidenceRefs: previous?.evidenceRefs ?? [], distractorReasons: previous?.distractorReasons ?? [], score: previous?.score ?? 2 }
  })
}

export function repairProvidedPassageV02QuestionStems(set: EnglishQuestionSet): EnglishQuestion[] {
  const plans = set.providedPassageV02?.itemPlans ?? []
  const planById = new Map(plans.map((plan) => [plan.itemId, plan]))
  return set.questions.map((question) => {
    const plan = planById.get(question.id)
    if (!plan) return question
    const shape = questionShapeForPlan(plan)
    return { ...question, type: shape.type, stem: shape.stem }
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
  return type === 'content_match' ? 'school-content-match' : type === 'content_inference' ? 'school-content-inference' : type === 'sentence_insertion' ? 'school-sentence-insertion' : 'school-grammar'
}

const SUPPORTED_TYPES = new Set<ProvidedPassageV02QuestionType>(['content_match', 'content_inference', 'sentence_insertion', 'grammar'])

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
    approval: { firstResponse: 'design_only', approvalSentence: '이 설계로 JSON을 생성할까요? 수정할 카드가 있으면 카드 번호와 변경 사항을 알려주세요.', afterApproval: 'single_json_object' },
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
  const grammar = request.items.filter((item) => item.questionType === 'grammar').map((item) => `- ${item.itemId}: ${item.grammarTarget ? PROVIDED_PASSAGE_GRAMMAR_RULES[item.grammarTarget] : ''} 모드는 ${item.grammarMode}. question.stem은 requiredStem과 글자 단위로 같아야 한다. testedSpan은 실제로 밑줄 칠 최소 어법 표현만 가리키며 문장 전체를 범위로 삼지 않는다. sourceForm은 testedSpan.text와 같고 오류 변형은 presentedForm에만 둔다.`).join('\n')
  return `[PROVIDED_PASSAGE_GENERATION_V0.2]\n당신은 사용자가 제공한 영어 원문을 수정하지 않고 여러 내신형 문항을 설계·생성하는 영어 출제자다.\n\n[절대 원칙]\n- source.passage는 유일한 권위 원문이며 응답에 전체를 반환하지 않는다.\n- 문장 삽입이 아닌 모든 items는 동일한 source.passage 한 지문을 공유한다. 같은 지문을 문항별로 새로 만들거나 반복 반환하지 않는다.\n- 내용 일치·불일치 문항이 여러 개면 같은 원문에서 서로 다른 근거와 오답 원리로 각각 독립된 문항을 만든다.\n- content_inference 내용 이해 문항은 단순 사실 재진술이 아니라 지문의 둘 이상의 단서 또는 하나의 충분한 함의로 도출되는 추론을 묻는다. 정답은 외부 배경지식 없이 원문만으로 유일하게 도출하고, 과도한 일반화·인과 비약·범위 왜곡·주체 변경을 오답으로 사용한다.\n- 내용 이해의 evidenceSpans에는 실제 추론에 사용한 원문 단서를 넣고, 해설에는 단서에서 정답으로 이어지는 추론 과정을 명시한다.\n- 문장 삽입 item은 최대 하나이며 항상 items 배열의 마지막에 둔다.\n- sourcePassageId, sourceFingerprint와 모든 itemId를 그대로 반환한다.\n- sentence ID·offset과 boundary ID·offset은 Request에 있는 값만 사용하며 새로 만들거나 바꾸지 않는다.\n- 각 item의 question.stem은 해당 item의 requiredStem과 공백·문장부호까지 정확히 같아야 한다.\n- items마다 요청된 유형·언어·어휘 수준·문법 태그를 독립적으로 지킨다.\n- 문장 삽입의 generatedSentence, 후보 경계와 표식은 해당 itemId의 materialOperation에만 둔다. 다른 문항이나 공통 원문에 전파하지 않는다.\n- 정답은 문항마다 정확히 하나이며 외부 사실로 판정하지 않는다.\n- 어법 문항은 원문 근거가 하나로 결정될 때만 만든다. source_form_check는 sourceForm과 presentedForm이 같고, controlled_error_variant는 원문을 고치지 않은 채 presentedForm에만 최소 변형을 둔다.\n- 어법 testedSpan은 실제로 밑줄 칠 낱말·구·절의 최소 정확 범위여야 한다. 근거 문장 전체는 evidenceSpans에 둘 수 있지만 testedSpan이나 sourceForm에 문장 전체를 넣지 않는다.\n- 관계대명사는 선행사와 관계절 성분, 동격 that은 완전한 절과 명사 내용 관계, 수 일치는 실제 주어, 분사구문은 의미상 주어와 태, 계속적 관계대명사는 쉼표·that 금지, 대명사 일치는 선행사, 가주어는 진주어, 강조 it-that은 강조 대상과 잔여 절을 반드시 확인한다.\n${grammar || '- 어법 문항 없음'}\n\n[유효성 실패 처리]\nRequest의 Schema·원문 identity·item 계약·지원 조합 중 하나라도 유효하지 않으면 오류 목록만 출력한다. 이 경우 설계안, 임시 JSON, 승인 문장, 지원 유형으로의 임의 변경을 출력하지 않는다.\n\n[승인 절차]\n유효한 Request의 첫 응답은 한국어 [내신 영어 기존 지문 다문항 설계안]만 출력한다. 카드별 유형, 정답 근거 sentenceId, 오답 원리, 어법 태그·판정 규칙·변형 여부를 쓰되 완성 선지나 JSON은 공개하지 않는다. 마지막 문장은 Request의 approvalSentence와 정확히 같아야 한다. 승인 후에는 ${PROVIDED_PASSAGE_V02_RESPONSE_SCHEMA_ID} JSON 객체 하나만 출력한다.\n\n[Request JSON]\n${JSON.stringify(request, null, 2)}`
}

function validateSpan(span: ProvidedPassageEvidenceSpan, state: ProvidedPassageV02State, label: string) {
  const sentence = state.sentences.find((candidate) => candidate.id === span.sentenceId)
  if (!sentence) throw new Error(`${label}: 존재하지 않는 sentenceId ${span.sentenceId}`)
  if (span.start < sentence.start || span.end > sentence.end || span.start >= span.end || state.originalText.slice(span.start, span.end) !== span.text) throw new Error(`${label}: 원문 offset과 text가 일치하지 않습니다.`)
}

function containsAuthoritativePassage(value: unknown, authoritativeText: string): boolean {
  if (typeof value === 'string') return value === authoritativeText || normalizeProvidedPassageForFingerprint(value) === normalizeProvidedPassageForFingerprint(authoritativeText)
  if (Array.isArray(value)) return value.some((item) => containsAuthoritativePassage(item, authoritativeText))
  if (value && typeof value === 'object') return Object.values(value).some((item) => containsAuthoritativePassage(item, authoritativeText))
  return false
}

export function adaptProvidedPassageV02Response(value: unknown, base: EnglishQuestionSet): EnglishQuestionSet {
  if (!responseValidator(value)) throw new Error(`Provided Passage V0.2 Response Schema 오류: ${(responseValidator.errors ?? []).map(schemaError).join(' / ')}`)
  const root = value as Record<string, unknown>
  const state = base.providedPassageV02
  if (!state) throw new Error('Provided Passage V0.2 상태가 없습니다.')
  const blocked = providedPassageV02BlockingReason(base)
  if (blocked) throw new Error(blocked)
  if (containsAuthoritativePassage(value, state.originalText)) throw new Error('AI Response에 권위 원문 전체가 포함되어 있어 가져오기를 거부했습니다.')
  if (root.sourcePassageId !== state.sourcePassageId || root.sourceFingerprint !== state.sourceFingerprint) throw new Error('원문 ID 또는 fingerprint가 일치하지 않습니다.')
  const records = root.items as Array<Record<string, unknown>>
  if (records.length !== state.itemPlans.length) throw new Error('응답 문항 수가 요청 문항 수와 일치하지 않습니다.')
  const recordById = new Map(records.map((record) => [String(record.itemId), record]))
  if (recordById.size !== records.length) throw new Error('응답 itemId가 중복되었습니다.')
  const questions: EnglishQuestion[] = []
  const results: ProvidedPassageV02ItemResult[] = []
  const reviews: CsatQualityReview[] = []
  const orderedPlans = orderedProvidedPassageV02Plans(state.itemPlans)
  for (const plan of orderedPlans) {
    const record = recordById.get(plan.itemId)
    if (!record) throw new Error(`요청한 itemId가 응답에 없습니다: ${plan.itemId}`)
    if (record.templateId !== templateId(plan.questionType) || record.questionType !== plan.questionType || record.vocabularyLevel !== plan.vocabularyLevel) throw new Error(`${plan.itemId}: 문항 계약이 요청과 일치하지 않습니다.`)
    if (record.choiceLanguage !== (usesChoiceLanguage(plan.questionType) ? plan.choiceLanguage : null) || record.contentMatchPolarity !== (plan.questionType === 'content_match' ? plan.contentMatchPolarity : null)) throw new Error(`${plan.itemId}: 선지 언어 또는 발문 극성이 다릅니다.`)
    if (record.grammarTarget !== (plan.questionType === 'grammar' ? plan.grammarTarget : null) || record.grammarMode !== (plan.questionType === 'grammar' ? plan.grammarMode : null)) throw new Error(`${plan.itemId}: 문법 태그 또는 모드가 다릅니다.`)
    const question = record.question as Record<string, unknown>
    const expectedShape = questionShapeForPlan(plan)
    if (question.type !== expectedShape.type || String(question.stem).trim() !== expectedShape.stem) throw new Error(`${plan.itemId}: 문항 유형 또는 기본 발문이 다릅니다. 요청 발문: “${expectedShape.stem}” / 응답 발문: “${String(question.stem).trim()}”`)
    const evidenceSpans = question.evidenceSpans as ProvidedPassageEvidenceSpan[]
    evidenceSpans.forEach((span, index) => validateSpan(span, state, `${plan.itemId}.evidenceSpans[${index}]`))
    const choices = (question.choices as string[]).map((choice) => choice.trim())
    if (new Set(choices.map((choice) => choice.normalize('NFC').replace(/\s+/g, ' ').toLowerCase())).size !== 5) throw new Error(`${plan.itemId}: 선택지는 서로 달라야 합니다.`)
    const operation = record.materialOperation as ProvidedPassageV02ItemResult['materialOperation']
    if (plan.questionType === 'content_match' || plan.questionType === 'content_inference') {
      if (operation !== null) throw new Error(`${plan.itemId}: 내용 문항의 materialOperation은 null이어야 합니다.`)
      if (plan.choiceLanguage === 'ko' && choices.some((choice) => !/[가-힣]/.test(choice))) throw new Error(`${plan.itemId}: 한국어 선지로 통일해야 합니다.`)
      if (plan.choiceLanguage === 'en' && choices.some((choice) => /[가-힣]/.test(choice) || !/[A-Za-z]/.test(choice))) throw new Error(`${plan.itemId}: 영어 선지로 통일해야 합니다.`)
    } else if (plan.questionType === 'sentence_insertion') {
      if (!operation || operation.kind !== 'insert_sentence') throw new Error(`${plan.itemId}: 삽입 operation이 필요합니다.`)
      const boundaryById = new Map(state.boundaries.map((boundary) => [boundary.id, boundary]))
      const validBoundaries = new Set(boundaryById.keys())
      if (operation.candidateBoundaryIds.some((id) => !validBoundaries.has(id)) || !operation.candidateBoundaryIds.includes(operation.answerBoundaryId)) throw new Error(`${plan.itemId}: 삽입 경계가 유효하지 않습니다.`)
      const candidateOffsets = operation.candidateBoundaryIds.map((id) => boundaryById.get(id)!.offset)
      if (candidateOffsets.some((offset, index) => index > 0 && offset <= candidateOffsets[index - 1])) throw new Error(`${plan.itemId}: 삽입 후보 경계는 원문 순서대로 겹치지 않게 제시해야 합니다.`)
      const reasonIds = operation.positionReasons.map((reason) => reason.boundaryId)
      if (new Set(reasonIds).size !== 5 || reasonIds.some((id) => !operation.candidateBoundaryIds.includes(id))) throw new Error(`${plan.itemId}: 위치별 이유는 다섯 후보 boundaryId와 정확히 대응해야 합니다.`)
      validateSpan(operation.beforeEvidence, state, `${plan.itemId}.beforeEvidence`); validateSpan(operation.afterEvidence, state, `${plan.itemId}.afterEvidence`)
      const answerBoundary = boundaryById.get(operation.answerBoundaryId)!
      if (operation.beforeEvidence.sentenceId !== answerBoundary.beforeSentenceId || operation.afterEvidence.sentenceId !== answerBoundary.afterSentenceId) throw new Error(`${plan.itemId}: 정답 경계의 바로 앞·뒤 문장이 evidence와 일치하지 않습니다.`)
    } else {
      if (!operation || operation.kind !== 'grammar_check') throw new Error(`${plan.itemId}: grammar_check operation이 필요합니다.`)
      const grammarOperation = operation as ProvidedPassageGrammarOperation
      validateSpan(grammarOperation.testedSpan, state, `${plan.itemId}.testedSpan`)
      const testedSentence = state.sentences.find((sentence) => sentence.id === grammarOperation.testedSpan.sentenceId)
      if (testedSentence && grammarOperation.testedSpan.start === testedSentence.start && grammarOperation.testedSpan.end === testedSentence.end) throw new Error(`${plan.itemId}: 어법 testedSpan이 문장 전체를 가리킵니다. evidenceSpans에는 근거 문장을 둘 수 있지만 testedSpan·sourceForm에는 실제로 밑줄 칠 최소 어법 표현만 넣어 주세요.`)
      if (grammarOperation.grammarTarget !== plan.grammarTarget || grammarOperation.grammarMode !== plan.grammarMode || grammarOperation.ruleCheck.classification !== plan.grammarTarget) throw new Error(`${plan.itemId}: 문법 판정 정보가 요청과 다릅니다.`)
      if (!grammarOperation.ruleCheck.isUniquelyDetermined || grammarOperation.sourceTextModified !== false) throw new Error(`${plan.itemId}: 문법 판정이 유일하지 않거나 원문 변경 플래그가 잘못되었습니다.`)
      if (grammarOperation.sourceForm !== grammarOperation.testedSpan.text) throw new Error(`${plan.itemId}: sourceForm이 원문 testedSpan과 다릅니다.`)
      if (plan.grammarMode === 'source_form_check' && grammarOperation.presentedForm !== grammarOperation.sourceForm) throw new Error(`${plan.itemId}: 원문 확인 모드는 별도 변형을 허용하지 않습니다.`)
      if (plan.grammarMode === 'controlled_error_variant' && grammarOperation.presentedForm === grammarOperation.sourceForm) throw new Error(`${plan.itemId}: 오류 변형 모드는 presentedForm에 명시적 변형이 필요합니다.`)
    }
    questions.push({ id: plan.itemId, type: expectedShape.type, stem: expectedShape.stem, choices, answerIndex: question.answerIndex as number, explanation: String(question.explanation).trim(), intention: String(question.intention).trim(), evidenceRefs: evidenceSpans.map((span) => span.text), distractorReasons: (question.distractorReasons as string[]).map(String), score: question.score as number })
    results.push({ itemId: plan.itemId, evidenceSpans, materialOperation: operation })
    reviews.push(record.qualityReview as CsatQualityReview)
  }
  return { ...base, title: String(root.title || base.title), material: state.originalText, questions, providedPassageV02: { ...state, itemPlans: orderedPlans, results }, providedPassageQualityReview: { passage: reviews[0]?.passage ?? {}, questions: reviews.flatMap((review) => review.questions ?? []) }, aiRevision: base.aiRevision + 1, validatedRevision: 0, lastImportedJson: JSON.stringify(value, null, 2), updatedAt: new Date().toISOString() }
}

export function parseProvidedPassageV02Json(raw: string, base: EnglishQuestionSet) {
  let value: unknown
  try { value = JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')) } catch (error) { throw new Error(`Provided Passage V0.2 JSON 문법 오류입니다. (${error instanceof Error ? error.message : 'JSON 확인 필요'})`, { cause: error }) }
  return adaptProvidedPassageV02Response(value, base)
}

export function providedPassageV02ValidationMessages(set: EnglishQuestionSet) {
  const state = set.providedPassageV02
  if (!state) return []
  const messages: Array<{ level: 'error' | 'warning'; label: string; detail: string }> = []
  const blocked = providedPassageV02BlockingReason(set)
  if (blocked) messages.push({ level: 'error', label: 'Provided Passage V0.2', detail: blocked })
  if (!state.results) messages.push({ level: 'warning', label: 'AI 결과 전', detail: `${state.itemPlans.length}개 문항 계획과 원문 근거가 준비되었습니다.` })
  return messages
}

export function providedPassageV02PresentationSpec(set: EnglishQuestionSet, questionId?: string) {
  const state = set.providedPassageV02
  const matchingResults = state?.results?.filter((result) => result.materialOperation?.kind === 'insert_sentence') ?? []
  const result = questionId
    ? matchingResults.find((candidate) => candidate.itemId === questionId)
    : state?.itemPlans.length === 1 && matchingResults.length === 1 ? matchingResults[0] : undefined
  const operation = result?.materialOperation
  if (!state || !operation || operation.kind !== 'insert_sentence') return set.materialSpec
  const markers = new Map(operation.candidateBoundaryIds.map((id, index) => [id, CSAT_INLINE_POSITION_CHOICES[index]]))
  const boundaries = state.boundaries.filter((boundary) => markers.has(boundary.id)).sort((left, right) => right.offset - left.offset)
  let body = state.originalText
  boundaries.forEach((boundary) => { body = `${body.slice(0, boundary.offset)} [[삽입위치:${markers.get(boundary.id)}]] ${body.slice(boundary.offset)}` })
  return { kind: 'insertion' as const, givenSentence: operation.generatedSentence, body }
}

export function providedPassageV02QuestionMaterialText(set: EnglishQuestionSet, questionId: string) {
  const state = set.providedPassageV02
  if (!state) return set.material
  const result = state.results?.find((item) => item.itemId === questionId)
  const operation = result?.materialOperation
  if (!operation || operation.kind !== 'grammar_check') return state.originalText
  const { start, end, text } = operation.testedSpan
  if (state.originalText.slice(start, end) !== text || operation.sourceForm !== text) return state.originalText
  return `${state.originalText.slice(0, start)}[[밑줄:${operation.presentedForm}]]${state.originalText.slice(end)}`
}

export function providedPassageV02SharedMaterialText(set: EnglishQuestionSet) {
  const state = set.providedPassageV02
  if (!state || !orderedProvidedPassageV02Questions(set).some((question) => question.type !== '문장 삽입')) return undefined
  const operations = (state.results ?? []).flatMap((result) => {
    const operation = result.materialOperation
    if (!operation || operation.kind !== 'grammar_check') return []
    const { start, end, text } = operation.testedSpan
    if (state.originalText.slice(start, end) !== text || operation.sourceForm !== text) return []
    return [{ start, end, presentedForm: operation.presentedForm }]
  }).sort((left, right) => right.start - left.start)
  let material = state.originalText
  let nextStart = state.originalText.length
  operations.forEach((operation) => {
    if (operation.end > nextStart) return
    material = `${material.slice(0, operation.start)}[[밑줄:${operation.presentedForm}]]${material.slice(operation.end)}`
    nextStart = operation.start
  })
  return material
}

export function providedPassageV02SharedPresentationSpec(set: EnglishQuestionSet) {
  const state = set.providedPassageV02
  if (!state || set.schoolInsertionPresentation !== 'shared') return undefined
  const insertion = state.results?.find((result) => result.materialOperation?.kind === 'insert_sentence')?.materialOperation
  if (!insertion || insertion.kind !== 'insert_sentence') return undefined
  const boundaryById = new Map(state.boundaries.map((boundary) => [boundary.id, boundary]))
  const events: Array<{ start: number; end: number; replacement: string }> = insertion.candidateBoundaryIds.flatMap((id, index) => {
    const boundary = boundaryById.get(id)
    return boundary ? [{ start: boundary.offset, end: boundary.offset, replacement: ` [[삽입위치:${CSAT_INLINE_POSITION_CHOICES[index]}]] ` }] : []
  })
  ;(state.results ?? []).forEach((result) => {
    const operation = result.materialOperation
    if (!operation || operation.kind !== 'grammar_check') return
    const { start, end, text } = operation.testedSpan
    if (state.originalText.slice(start, end) !== text || operation.sourceForm !== text) return
    events.push({ start, end, replacement: `[[밑줄:${operation.presentedForm}]]` })
  })
  let body = state.originalText
  let nextStart = state.originalText.length
  events.sort((left, right) => right.start - left.start || right.end - left.end).forEach((event) => {
    if (event.end > nextStart) return
    body = `${body.slice(0, event.start)}${event.replacement}${body.slice(event.end)}`
    nextStart = event.start
  })
  return { kind: 'insertion' as const, givenSentence: insertion.generatedSentence, body }
}
