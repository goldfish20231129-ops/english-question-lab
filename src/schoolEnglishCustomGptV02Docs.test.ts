import { describe, expect, it } from 'vitest'
import requestSchema from '../docs/english-gpt/provided-passage-request-schema-v0.2.json'
import responseSchema from '../docs/english-gpt/provided-passage-response-schema-v0.2.json'
import instructions from '../docs/english-gpt/SCHOOL_ENGLISH_PROVIDED_PASSAGE_CUSTOM_GPT_INSTRUCTIONS_V0.2.md?raw'
import contract from '../docs/english-gpt/PROVIDED_PASSAGE_CONTRACT_V0.2.md?raw'
import detailedRules from '../docs/english-gpt/SCHOOL_ENGLISH_CUSTOM_GPT_DETAILED_RULES_V0.2.md?raw'
import grammarEvidence from '../docs/english-gpt/SCHOOL_ENGLISH_CUSTOM_GPT_SCHOOL_GRAMMAR_EVIDENCE_V0.2.md?raw'
import grammarProfiles from '../docs/english-gpt/SCHOOL_ENGLISH_CUSTOM_GPT_GRAMMAR_DESIGN_PROFILES_V0.2.md?raw'
import setupGuide from '../docs/english-gpt/SCHOOL_ENGLISH_CUSTOM_GPT_V0.2_SETUP.md?raw'

function summaryRule(schema: typeof requestSchema | typeof responseSchema) {
  return schema.$defs.item.allOf.find((rule) => rule.if.properties.questionType.const === 'summary')
}

describe('School English Custom GPT V0.2 synchronized documentation', () => {
  it('uses the full 8,000-character Instructions budget without conflicting summary-language guidance', () => {
    expect(instructions).toHaveLength(8000)
    expect(instructions).toContain('summary의 단어쌍은 항상 영어다')
    expect(instructions).not.toContain('choices는 `A값|B값` 형식의 서로 다른 단어쌍 다섯 개로 작성하되 발문과 같은 언어를 사용한다')
  })

  it('fixes summary choices to English in both V0.2 schemas while preserving requiredStem', () => {
    expect(summaryRule(requestSchema)?.then.properties.choiceLanguage).toEqual({ const: 'en' })
    expect(summaryRule(responseSchema)?.then.properties.choiceLanguage).toEqual({ const: 'en' })
    expect(requestSchema.$defs.item.required).toContain('requiredStem')
    expect(requestSchema.$defs.item.properties.requiredStem).toEqual({ type: 'string', minLength: 1 })
  })

  it('documents independent special blocks, actual school grammar evidence, and upload synchronization', () => {
    expect(contract).toContain('요약문 완성과 문장 삽입은 각각 같은 원문을 다시 출력하는 독립 문항 블록')
    expect(detailedRules).toContain('제작 프롬프트가 해당 itemId에 배정한 기호 배열')
    expect(grammarEvidence).toContain('객관식 어법 13문항')
    expect(grammarEvidence).toContain('observed_surface')
    expect(grammarEvidence).toContain('observed_reference')
    expect(grammarEvidence).toContain('unsupported')
    expect(setupGuide).toContain('08-KNOWLEDGE-SCHOOL-GRAMMAR-EVIDENCE.md')
    expect(setupGuide).toContain('09-KNOWLEDGE-GRAMMAR-DESIGN-PROFILES.md')
    expect(grammarProfiles).toContain('school_exam_balanced')
    expect(grammarProfiles).toContain('객관식 13문항')
    expect(grammarProfiles).toContain('원문에 없는 구조')
  })

  it('keeps the grammar profile optional and source-grounded in the request contract', () => {
    expect(requestSchema.$defs.item.required).not.toContain('grammarDesignProfile')
    expect(requestSchema.$defs.item.properties.grammarDesignProfile.enum).toEqual([
      'school_exam_balanced', 'clause_relations', 'verb_and_nonfinite', 'agreement_voice_reference', 'source_best_fit', null,
    ])
    expect(contract).toContain('선택 필드 `grammarDesignProfile`')
    expect(detailedRules).toContain('필드가 없는 기존 Request는 `school_exam_balanced`')
  })
})
