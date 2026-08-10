import { describe, expect, it } from 'vitest'
import schema from '../docs/english-gpt/csat-output-schema.json'
import { applyCsatItemTemplate, createCsatItem, generateCsatGptInstructions } from './csat'
import { createEnglishSet, generateEnglishPrompt, generateReviewPrompt } from './english'

function configuredSet() {
  const set = createEnglishSet('csat')
  set.csatItems = [applyCsatItemTemplate(createCsatItem(), '33')]
  return set
}

describe('수능형 전용 GPT 자료 패키지', () => {
  it('앱 프롬프트와 GPT Instructions가 같은 설계 승인 절차를 사용한다', () => {
    const set = configuredSet()
    const prompt = generateEnglishPrompt(set)
    const instructions = generateCsatGptInstructions()
    for (const text of [prompt, instructions]) {
      expect(text).toContain('[세트 제작 설계안]')
      expect(text).toContain('첫 응답에서는 지문·문항·선지·JSON을 바로 만들지 않는다')
      expect(text).toContain('이 설계로 JSON을 생성할까요? 수정할 카드가 있으면 카드 번호와 변경 사항을 알려주세요.')
      expect(text).toContain('명시적으로 승인한 뒤에만')
    }
    expect(generateReviewPrompt(set, [])).toContain('별도의 설계 승인 없이')
  })

  it('출력 스키마가 품질 검수와 8개 자료 구조를 정의한다', () => {
    expect(schema.$defs.item.properties).toHaveProperty('qualityReview')
    expect(schema.$defs.qualityReview.properties).toHaveProperty('passage')
    expect(schema.$defs.qualityReview.properties).toHaveProperty('questions')
    for (const name of ['proseSpec', 'chartSpec', 'practicalSpec', 'orderedSpec', 'insertionSpec', 'summarySpec', 'longExpositorySpec', 'longNarrativeSpec']) {
      expect(schema.$defs).toHaveProperty(name)
    }
  })

})
