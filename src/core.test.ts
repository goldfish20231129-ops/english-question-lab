import { describe, expect, it } from 'vitest'
import { emptyProject } from './types'
import { generatePrompt } from './prompt'
import { reviewProject } from './review'
import { verifyMath } from './math'

describe('핵심 로직', () => {
  it('수학 아이디어를 포함한 프롬프트를 만든다', () => {
    const project = emptyProject('math'); project.idea = '집합의 관계를 추론한다'; project.unit = '집합'
    expect(generatePrompt(project)).toContain('집합의 관계를 추론한다')
  })
  it('객관식 선택지 누락을 오류로 표시한다', () => {
    const project = emptyProject('math'); project.problem = '문제'; project.choices = ['1', '', '', '', '']
    expect(reviewProject(project).find((item) => item.id === 'choices')?.level).toBe('error')
  })
  it('기본 수식과 이차방정식을 검산한다', () => {
    expect(verifyMath('2 + 3 * 4')).toContain('14')
    expect(verifyMath('x^2 - 5x + 6 = 0')).toContain('2')
  })
})
