import { describe, expect, it } from 'vitest'
import { includesValue, stripLeadingChoiceMarker, toggleUniqueValue } from './utils'

describe('빠른 선택 입력', () => {
  it('기존 값을 유지하면서 새 선택을 중복 없이 추가한다', () => {
    const value = toggleUniqueValue('교육·학습', '심리·인지', ', ')
    expect(value).toBe('교육·학습, 심리·인지')
    expect(includesValue(value, '심리·인지', ', ')).toBe(true)
  })

  it('선택한 항목을 다시 누르면 그 항목만 취소한다', () => {
    const value = toggleUniqueValue('교육·학습\n핵심 내용을 파악하게 함', '교육·학습', '\n')
    expect(value).toBe('핵심 내용을 파악하게 함')
  })

  it('AI 선지 앞의 중복 번호만 제거하고 위치 번호 자체는 보존한다', () => {
    expect(stripLeadingChoiceMarker('① 첫 번째 선지')).toBe('첫 번째 선지')
    expect(stripLeadingChoiceMarker('②두 번째 선지')).toBe('두 번째 선지')
    expect(stripLeadingChoiceMarker('3. 세 번째 선지')).toBe('세 번째 선지')
    expect(stripLeadingChoiceMarker('①')).toBe('①')
  })
})
