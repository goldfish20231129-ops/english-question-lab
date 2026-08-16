import { describe, expect, it } from 'vitest'
import { createEnglishSet, parseEnglishSetJson } from './english'
import { EXPLANATION_SCHEMA_ID, explanationSourceFingerprint, explanationStatus, generateExplanationPrompt, parseExplanationJson } from './explanation'

function completedQuestionSet() {
  const set = createEnglishSet('school')
  const question = set.questions[0]
  return parseEnglishSetJson(JSON.stringify({
    title: '문제·정답 세트', materialTitle: '', material: 'A clear passage supports one answer.', materialSpec: null,
    questions: [{ type: question.type, stem: question.stem, choices: ['a', 'b', 'c', 'd', 'e'], answerIndex: 2, score: 2 }],
  }), set)
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
})
