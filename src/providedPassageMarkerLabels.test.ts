import { describe, expect, it } from 'vitest'
import { createProvidedPassageV02Plan, createProvidedPassageV02State, providedPassageV02MarkerLabels } from './providedPassageV02'

describe('기존 지문 V0.2 표식 기호 배정', () => {
  it('평가원형 어법과 문장 삽입이 함께 있으면 서로 다른 기호를 쓴다', () => {
    const grammar = createProvidedPassageV02Plan('grammar', 'grammar')
    grammar.grammarMode = 'controlled_error_variant'
    const insertion = createProvidedPassageV02Plan('insertion', 'sentence_insertion')
    const state = createProvidedPassageV02State('Students compare evidence before they revise a conclusion.', [grammar, insertion])

    expect(providedPassageV02MarkerLabels(state, grammar.itemId)).toEqual(['㉠', '㉡', '㉢', '㉣', '㉤'])
    expect(providedPassageV02MarkerLabels(state, insertion.itemId)).toEqual(['ⓐ', 'ⓑ', 'ⓒ', 'ⓓ', 'ⓔ'])
  })
})
