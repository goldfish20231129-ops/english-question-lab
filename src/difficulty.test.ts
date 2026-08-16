import { describe, expect, it } from 'vitest'
import { CSAT_TEMPLATES, applyCsatItemTemplate, createCsatItem, normalizeCsatSet } from './csat'
import { ENGLISH_DIFFICULTY_LEVELS, englishDifficultyPrompt } from './difficulty'
import { createEnglishSet, generateEnglishPrompt } from './english'

describe('영어 난이도 8단계', () => {
  it('요청한 여덟 단계 이름을 순서대로 제공한다', () => {
    expect(ENGLISH_DIFFICULTY_LEVELS.map((level) => level.label)).toEqual([
      '매우 쉬움', '쉬움', '약간 쉬움', '보통', '약간 어려움', '어려움', '매우 어려움', '최상',
    ])
  })

  it('수능형과 내신형의 보통 난도를 서로 다른 평가 맥락으로 설명한다', () => {
    const csat = englishDifficultyPrompt('csat', 4)
    const school = englishDifficultyPrompt('school', 4)
    expect(csat).toContain('보통 (4/8)')
    expect(csat).toContain('수능의 평균적인 2점 문항')
    expect(school).toContain('보통 (4/8)')
    expect(school).toContain('일반적인 학교 시험의 평균 난도')
    expect(csat).toContain('최소 두 오답')
  })

  it('프롬프트에 선택 난도의 이름과 구체적인 구현 기준을 함께 넣는다', () => {
    const school = createEnglishSet('school')
    school.difficulty = 6
    const schoolPrompt = generateEnglishPrompt(school)
    expect(schoolPrompt).toContain('어려움 (6/8)')
    expect(schoolPrompt).toContain('2~3단계 추론')

    const csat = createEnglishSet('csat')
    csat.difficulty = 7
    csat.csatItems = [applyCsatItemTemplate(createCsatItem(), '33')]
    csat.csatItems[0].difficulty = 7
    const csatPrompt = generateEnglishPrompt(csat)
    expect(csatPrompt).toContain('매우 어려움 (7/8)')
    expect(csatPrompt).toContain('긴 추론 거리')
  })

  it('기존 수능 번호별 5단계 권장값을 8단계 범위로 변환한다', () => {
    expect(CSAT_TEMPLATES.every((template) => template.defaultDifficulty >= 1 && template.defaultDifficulty <= 8)).toBe(true)
    expect(CSAT_TEMPLATES.find((template) => template.id === '18')?.difficultyRange).toEqual([2, 2])
    expect(CSAT_TEMPLATES.find((template) => template.id === '33')?.defaultDifficulty).toBe(8)
  })

  it('기존 5단계 저장값의 의미를 유지해 한 번만 마이그레이션한다', () => {
    const legacySchool = { ...createEnglishSet('school'), difficulty: 3, difficultyScaleVersion: undefined }
    const migratedSchool = normalizeCsatSet(legacySchool)
    expect(migratedSchool.difficulty).toBe(4)
    expect(normalizeCsatSet(migratedSchool).difficulty).toBe(4)

    const legacyCsat = { ...createEnglishSet('csat'), difficulty: 4, difficultyScaleVersion: undefined }
    legacyCsat.csatItems = [{ ...applyCsatItemTemplate(createCsatItem(), '33'), difficulty: 5 }]
    const migratedCsat = normalizeCsatSet(legacyCsat)
    expect(migratedCsat.difficulty).toBe(6)
    expect(migratedCsat.csatItems?.[0].difficulty).toBe(8)
  })
})
