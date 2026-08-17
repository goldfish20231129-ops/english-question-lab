import { describe, expect, it } from 'vitest'
import { fingerprintProvidedPassage } from './providedPassage'
import { generatePassageTransformationPrompt, parsePassageTransformationJson } from './passageTransform'

const SOURCE = 'The measurements were accurate. The final report was easy to understand.'

describe('내신형 지문 변형', () => {
  it('표현만 바꾸기 프롬프트에 의미 보존과 한 문단 규칙을 포함한다', () => {
    const prompt = generatePassageTransformationPrompt(SOURCE, 'lexical', '고2 중상위권')
    expect(prompt).toContain('문장 수, 문장 순서, 문장 경계')
    expect(prompt).toContain('precise 또는 exact')
    expect(prompt).toContain('줄바꿈·빈 줄 없는 하나의 연속 문단')
    expect(prompt).toContain(fingerprintProvidedPassage(SOURCE))
  })

  it('설명된 표현 교체만 적용된 결과를 가져온다', () => {
    const result = parsePassageTransformationJson(JSON.stringify({
      schemaId: 'english-question-lab-passage-transformation-v1', mode: 'lexical',
      sourceFingerprint: fingerprintProvidedPassage(SOURCE),
      transformedPassage: 'The measurements were precise. The final report was easy to comprehend.',
      changes: [
        { before: 'accurate', after: 'precise', reason: '측정의 정확성을 유지한다.' },
        { before: 'understand', after: 'comprehend', reason: '이해한다는 의미를 유지한다.' },
      ],
      meaningPreserved: true, singleParagraph: true,
    }), SOURCE, 'lexical')
    expect(result.transformedPassage).toContain('precise')
    expect(result.transformedPassage).not.toContain('\n')
  })

  it('표현 교체 목록에 없는 재작성을 거부한다', () => {
    expect(() => parsePassageTransformationJson(JSON.stringify({
      schemaId: 'english-question-lab-passage-transformation-v1', mode: 'lexical',
      sourceFingerprint: fingerprintProvidedPassage(SOURCE),
      transformedPassage: 'Precise measurements produced a clear final report.',
      changes: [{ before: 'accurate', after: 'precise', reason: '동의 표현이다.' }],
      meaningPreserved: true, singleParagraph: true,
    }), SOURCE, 'lexical')).toThrow('changes로 설명되지 않은')
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
