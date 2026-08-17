import { describe, expect, it } from 'vitest'
import csatGptInstructions from '../docs/english-gpt/releases/generator-v0-custom-gpt/instructions/GENERATOR_V0_CUSTOM_GPT_INSTRUCTIONS.md?raw'
import explanationSchemaSource from '../docs/english-gpt/explanation-output-schema-v1.json?raw'
import schoolBundledInstructions from '../docs/english-gpt/school-english-custom-gpt-v0.2-bundle/01-INSTRUCTIONS.md?raw'
import schoolBundledExplanationSchema from '../docs/english-gpt/school-english-custom-gpt-v0.2-bundle/06-KNOWLEDGE-EXPLANATION-SCHEMA.json?raw'
import schoolGptInstructions from '../docs/english-gpt/SCHOOL_ENGLISH_PROVIDED_PASSAGE_CUSTOM_GPT_INSTRUCTIONS_V0.2.md?raw'
import { createEnglishSet, parseEnglishSetJson } from './english'
import { EXPLANATION_SCHEMA_ID, explanationSourceFingerprint, explanationStatus, generateExplanationPrompt, parseExplanationJson } from './explanation'
import { createProvidedPassageV02Plan, syncProvidedPassageV02Questions, transitionSchoolProvidedPassageV02 } from './providedPassageV02'

function completedQuestionSet() {
  const set = createEnglishSet('school')
  const question = set.questions[0]
  return parseEnglishSetJson(JSON.stringify({
    title: '문제·정답 세트', materialTitle: '', material: 'A clear passage supports one answer.', materialSpec: null,
    questions: [{ type: question.type, stem: question.stem, choices: ['a', 'b', 'c', 'd', 'e'], answerIndex: 2, score: 2 }],
  }), set)
}

function completedInsertionSet() {
  const seed = createEnglishSet('school')
  seed.material = 'First sentence introduces the topic. Second sentence gives one response. Third sentence gives another response. Fourth sentence explains the result. Fifth sentence adds a limitation. Sixth sentence concludes the discussion.'
  let set = transitionSchoolProvidedPassageV02(seed, 'provided')
  const plan = createProvidedPassageV02Plan('insertion-explanation', 'sentence_insertion')
  set = { ...set, providedPassageV02: { ...set.providedPassageV02!, itemPlans: [plan] }, questions: syncProvidedPassageV02Questions(set, [plan]) }
  const state = set.providedPassageV02!
  const candidateBoundaryIds = state.boundaries.slice(1, 6).map((boundary) => boundary.id)
  state.results = [{
    itemId: plan.itemId,
    evidenceSpans: [],
    materialOperation: {
      kind: 'insert_sentence', generatedSentence: 'This contrast helps explain the result.', candidateBoundaryIds,
      answerBoundaryId: candidateBoundaryIds[2],
      positionReasons: candidateBoundaryIds.map((boundaryId, index) => ({ boundaryId, reason: `${['①', '②', '③', '④', '⑤'][index]}의 연결을 확인한다.` })),
      beforeEvidence: { sentenceId: state.sentences[2].id, start: state.sentences[2].start, end: state.sentences[2].end, text: state.sentences[2].text },
      afterEvidence: { sentenceId: state.sentences[3].id, start: state.sentences[3].start, end: state.sentences[3].end, text: state.sentences[3].text },
      lexicalLevel: 'source_matched',
    },
  }]
  set.questions[0].answerIndex = 3
  set.aiRevision = 1
  return set
}

describe('2단계 해설 생성', () => {
  it('문제·정답만 가져온 세트에서 해설 프롬프트를 만든다', () => {
    const set = completedQuestionSet()
    expect(explanationStatus(set)).toBe('not-generated')
    const prompt = generateExplanationPrompt(set)
    expect(prompt).toContain('[EXPLANATION_GENERATION_V1]')
    expect(prompt).toContain(set.questions[0].id)
    expect(prompt).toContain(explanationSourceFingerprint(set))
    expect(prompt).not.toContain('"explanation":"정답 근거를 포함한 해설"')
  })

  it('해설 JSON만 적용하고 문제·선지·정답은 보존한다', () => {
    const set = completedQuestionSet()
    const before = set.questions[0]
    const next = parseExplanationJson(JSON.stringify({
      schemaId: EXPLANATION_SCHEMA_ID, setId: set.id, sourceRevision: set.aiRevision,
      sourceFingerprint: explanationSourceFingerprint(set),
      explanations: [{ questionId: before.id, explanation: '둘째 선지만 지문의 근거와 일치한다.', intention: '세부 내용 판별', evidenceRefs: ['A clear passage supports one answer.'], distractorReasons: ['① 근거 없음', '③ 범위 왜곡', '④ 인과 역전', '⑤ 무관 정보'] }],
    }), set)
    expect(next.questions[0]).toMatchObject({ stem: before.stem, choices: before.choices, answerIndex: 2, explanation: '둘째 선지만 지문의 근거와 일치한다.' })
    expect(explanationStatus(next)).toBe('complete')
  })

  it('현재 문제와 fingerprint가 다른 해설은 거부한다', () => {
    const set = completedQuestionSet()
    expect(() => parseExplanationJson(JSON.stringify({
      schemaId: EXPLANATION_SCHEMA_ID, setId: set.id, sourceRevision: set.aiRevision, sourceFingerprint: 'fnv1a32:00000000', explanations: [],
    }), set)).toThrow(/fingerprint/)
  })

  it('1차 문항·정답 JSON을 해설 입력칸에 넣으면 올바른 단계로 안내한다', () => {
    const set = completedQuestionSet()
    const malformedGeneration = '{"schemaId":"english-question-lab-provided-passage-generation-v0.2","reason":"The subject "these neurons" is plural."}'
    expect(() => parseExplanationJson(malformedGeneration, set)).toThrow(/1차 문항·정답 JSON.*4번.*5번.*EXPLANATION_GENERATION_V1/)
  })

  it('문장 삽입 해설 프롬프트가 후보 순서 기반 ①~⑤ 규칙을 명시한다', () => {
    const prompt = generateExplanationPrompt(completedInsertionSet())
    expect(prompt).toContain('answerBoundaryId가 후보 배열에서 몇 번째인지 계산')
    expect(prompt).toContain('["b3","b4","b5","b6","b7"]이고 정답이 "b5"이면 사용자용 정답은 ③')
    expect(prompt).toContain('answerIndex와 answerBoundaryId가 같은 위치')
    expect(prompt).toContain('사용자용 문자열에 b숫자가 남지 않았는지')
  })

  it('후보 순서 기호를 사용한 문장 삽입 해설을 받아들인다', () => {
    const set = completedInsertionSet()
    const next = parseExplanationJson(JSON.stringify({
      schemaId: EXPLANATION_SCHEMA_ID, setId: set.id, sourceRevision: set.aiRevision,
      sourceFingerprint: explanationSourceFingerprint(set),
      explanations: [{
        questionId: set.questions[0].id,
        explanation: '주어진 문장은 ③에 들어갈 때 두 반응과 결과 설명을 자연스럽게 연결한다.',
        intention: '문장 간 논리 연결 판단', evidenceRefs: ['Third sentence gives another response.', 'Fourth sentence explains the result.'],
        distractorReasons: ['①은 핵심 반응이 제시되기 전이다.', '②는 두 번째 반응이 아직 나오지 않았다.', '④는 결과 설명이 이미 시작된 뒤다.', '⑤는 결론에 가까워 연결이 늦다.'],
      }],
    }), set)
    expect(next.questions[0].explanation).toContain('③')
  })

  it('사용자용 문장에 내부 boundary ID가 남은 문장 삽입 해설을 거부한다', () => {
    const set = completedInsertionSet()
    const operation = set.providedPassageV02!.results![0].materialOperation
    if (!operation || operation.kind !== 'insert_sentence') throw new Error('fixture operation missing')
    expect(() => parseExplanationJson(JSON.stringify({
      schemaId: EXPLANATION_SCHEMA_ID, setId: set.id, sourceRevision: set.aiRevision,
      sourceFingerprint: explanationSourceFingerprint(set),
      explanations: [{
        questionId: set.questions[0].id,
        explanation: `주어진 문장은 ${operation.answerBoundaryId}에 들어가는 것이 적절하다.`,
        intention: '문장 간 논리 연결 판단', evidenceRefs: ['Third sentence gives another response.'],
        distractorReasons: ['①은 이르다.', '②는 연결이 부족하다.', '④는 늦다.', '⑤는 결론 뒤다.'],
      }],
    }), set)).toThrow(/내부 boundary ID/)
  })

  it('수능형과 내신형 GPT 지침이 해설 모드와 불변성 계약을 함께 보존한다', () => {
    for (const instructions of [csatGptInstructions, schoolGptInstructions, schoolBundledInstructions]) {
      expect(instructions).toContain('[EXPLANATION_GENERATION_V1]')
      expect(instructions).toContain('[정답 충돌 확인 필요]')
      expect(instructions).toContain('sourceFingerprint')
      expect(instructions).toContain('questionId')
    }
    for (const instructions of [schoolGptInstructions, schoolBundledInstructions]) {
      expect(instructions).toContain('ID 숫자를 위치 번호로 바꾸지 않는다')
      expect(instructions).toContain('후보 배열에서 몇 번째인지 계산')
      expect(instructions).toContain('사용자용 문자열에는 `b3`, `b5` 같은 내부 ID를 남기지 않는다')
    }
    expect(schoolGptInstructions).toBe(schoolBundledInstructions)
    expect(explanationSchemaSource).toBe(schoolBundledExplanationSchema)
  })
})
