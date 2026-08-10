import { describe, expect, it } from 'vitest'
import { includesValue, toggleUniqueValue } from './utils'

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
})
