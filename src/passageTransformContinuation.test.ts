import { describe, expect, it } from 'vitest'
import { createEnglishSet } from './english'
import { createProvidedPassageV02Plan, syncProvidedPassageV02Questions, transitionSchoolProvidedPassageV02, updateProvidedPassageV02Material } from './providedPassageV02'

const SOURCE = 'The student who leads the club arrives early. She checks the room before every meeting. The members bring their own notebooks.'

describe('변형 지문 연속 작업', () => {
  it('변형 지문을 새 기준으로 삼으면서 기존 문항 계획과 세부 설정을 유지한다', () => {
    const seed = createEnglishSet('school')
    seed.material = SOURCE
    let set = transitionSchoolProvidedPassageV02(seed, 'provided')
    const plans = [
      { ...createProvidedPassageV02Plan('content-kept', 'content_match'), stemLanguage: 'en' as const, choiceLanguage: 'en' as const },
      { ...createProvidedPassageV02Plan('grammar-kept', 'grammar'), grammarTarget: 'subject_verb_agreement' as const, grammarMode: 'controlled_error_variant' as const },
    ]
    set = { ...set, providedPassageV02: { ...set.providedPassageV02!, itemPlans: plans }, questions: syncProvidedPassageV02Questions(set, plans) }
    const previousFingerprint = set.providedPassageV02!.sourceFingerprint
    const transformed = updateProvidedPassageV02Material(set.providedPassageV02!, SOURCE.replace('arrives early', 'comes early'))

    expect(transformed.originalText).toContain('comes early')
    expect(transformed.sourceFingerprint).not.toBe(previousFingerprint)
    expect(transformed.itemPlans).toEqual(plans)
    expect(transformed.itemPlans.map((plan) => plan.itemId)).toEqual(['content-kept', 'grammar-kept'])
    expect(transformed.itemPlans[1]).toMatchObject({ grammarTarget: 'subject_verb_agreement', grammarMode: 'controlled_error_variant' })
  })
})
