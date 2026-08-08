import { describe, expect, it } from 'vitest'
import { emptyProject } from './types'
import { generatePrompt } from './prompt'
import { reviewProject } from './review'
import { verifyMath } from './math'
import { appendUniqueValue } from './utils'

describe('핵심 로직', () => {
  it('수학 아이디어를 포함한 프롬프트를 만든다', () => {
    const project = emptyProject('math'); project.idea = '집합의 관계를 추론한다'; project.unit = '집합'; project.questionCount = 3; project.questionDistribution = { '추론형': 3 }
    expect(generatePrompt(project)).toContain('집합의 관계를 추론한다')
    expect(generatePrompt(project)).toContain('문항 수: 3문항')
  })
  it('국어 <보기> 설정을 프롬프트에 포함한다', () => {
    const project = emptyProject('korean'); project.koreanReferenceEnabled = true; project.koreanReferenceType = '관점 비교'; project.koreanReferenceStyle = '비교 관점'
    expect(generatePrompt(project)).toContain('<보기> 유형: 관점 비교')
  })
  it('객관식 선택지 누락을 오류로 표시한다', () => {
    const project = emptyProject('math'); project.problem = '문제'; project.choices = ['1', '', '', '', '']
    expect(reviewProject(project).find((item) => item.id === 'choices')?.level).toBe('error')
  })
  it('기본 수식과 이차방정식을 검산한다', () => {
    expect(verifyMath('2 + 3 * 4')).toContain('14')
    expect(verifyMath('x^2 - 5x + 6 = 0')).toContain('2')
  })
  it('빠른 선택은 기존 값을 유지하면서 중복 없이 추가한다', () => {
    const selected = appendUniqueValue('내용 이해', '추론', ', ')
    expect(selected).toBe('내용 이해, 추론')
    expect(appendUniqueValue(selected, '내용 이해', ', ')).toBe('내용 이해, 추론')
  })
})
