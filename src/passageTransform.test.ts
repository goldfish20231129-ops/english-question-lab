import { describe, expect, it } from 'vitest'
import { fingerprintProvidedPassage } from './providedPassage'
import { generatePassageTransformationPrompt, MIN_LEXICAL_TRANSFORM_CHANGES, parsePassageTransformationJson } from './passageTransform'

const SOURCE = 'The measurements were accurate. The final report was easy to understand.'
const LEXICAL_SOURCE = 'The accurate and clear report was quick, useful, simple, reliable, detailed, complete, and understandable.'
const LEXICAL_CHANGES = [
  ['accurate', 'precise'], ['clear', 'plain'], ['report', 'account'], ['quick', 'rapid'], ['useful', 'helpful'],
  ['simple', 'straightforward'], ['reliable', 'dependable'], ['detailed', 'thorough'], ['complete', 'comprehensive'], ['understandable', 'comprehensible'],
].map(([before, after]) => ({ before, after, reason: '문맥과 문법 기능을 유지하는 동등 표현이다.' }))

describe('내신형 지문 변형', () => {
  it('표현만 바꾸기 프롬프트에 의미 보존과 한 문단 규칙을 포함한다', () => {
    const prompt = generatePassageTransformationPrompt(SOURCE, 'lexical', '고2 중상위권')
    expect(prompt).toContain('문장 수, 문장 순서, 문장 경계')
    expect(prompt).toContain('precise 또는 exact')
    expect(prompt).toContain('줄바꿈·빈 줄 없는 하나의 연속 문단')
    expect(prompt).toContain(`최소 ${MIN_LEXICAL_TRANSFORM_CHANGES}개`)
    expect(prompt).toContain(fingerprintProvidedPassage(SOURCE))
  })

  it('설명된 표현 교체만 적용된 결과를 가져온다', () => {
    const result = parsePassageTransformationJson(JSON.stringify({
      schemaId: 'english-question-lab-passage-transformation-v1', mode: 'lexical',
      sourceFingerprint: fingerprintProvidedPassage(LEXICAL_SOURCE),
      transformedPassage: 'The precise and plain account was rapid, helpful, straightforward, dependable, thorough, comprehensive, and comprehensible.',
      changes: LEXICAL_CHANGES,
      meaningPreserved: true, singleParagraph: true,
    }), LEXICAL_SOURCE, 'lexical')
    expect(result.transformedPassage).toContain('precise')
    expect(result.transformedPassage).not.toContain('\n')
  })

  it('표현 변경이 10개보다 적으면 결과 적용을 거부한다', () => {
    expect(() => parsePassageTransformationJson(JSON.stringify({
      schemaId: 'english-question-lab-passage-transformation-v1', mode: 'lexical',
      sourceFingerprint: fingerprintProvidedPassage(SOURCE),
      transformedPassage: 'The measurements were precise. The final report was easy to understand.',
      changes: [{ before: 'accurate', after: 'precise', reason: '문맥상 동등하다.' }],
      meaningPreserved: true, singleParagraph: true,
    }), SOURCE, 'lexical')).toThrow('최소 10개')
  })

  it('표현 교체 목록에 없는 재작성을 거부한다', () => {
    expect(() => parsePassageTransformationJson(JSON.stringify({
      schemaId: 'english-question-lab-passage-transformation-v1', mode: 'lexical',
      sourceFingerprint: fingerprintProvidedPassage(LEXICAL_SOURCE),
      transformedPassage: 'The precise and plain account produced a rapid, helpful, straightforward, dependable, thorough, comprehensive, and comprehensible conclusion.',
      changes: LEXICAL_CHANGES,
      meaningPreserved: true, singleParagraph: true,
    }), LEXICAL_SOURCE, 'lexical')).toThrow('changes로 설명되지 않은')
  })

  it('내용 동일 재구성 결과의 줄바꿈을 한 문단으로 정규화한다', () => {
    const result = parsePassageTransformationJson(JSON.stringify({
      schemaId: 'english-question-lab-passage-transformation-v1', mode: 'restructure',
      sourceFingerprint: fingerprintProvidedPassage(SOURCE),
      transformedPassage: 'Accurate measurements were recorded,\n\nand the final report was easy to understand.',
      changes: [{ before: SOURCE, after: 'Accurate measurements were recorded, and the final report was easy to understand.', reason: '두 사실과 병렬 관계를 유지하며 문장 구조를 재배열했다.' }],
      meaningPreserved: true, singleParagraph: true,
    }), SOURCE, 'restructure')
    expect(result.transformedPassage).toBe('Accurate measurements were recorded, and the final report was easy to understand.')
  })
})
