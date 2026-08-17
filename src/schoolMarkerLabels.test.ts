import { describe, expect, it } from 'vitest'
import { allocateSchoolMarkerLabels } from './schoolMarkerLabels'

describe('내신형 공통 지문 표식 기호 배정', () => {
  it('표식형 문항이 하나면 기존 ①~⑤를 유지한다', () => {
    expect(allocateSchoolMarkerLabels(['insertion'], 'insertion')).toEqual(['①', '②', '③', '④', '⑤'])
  })

  it('둘 이상이면 문항별로 겹치지 않는 기호군을 배정한다', () => {
    const ids = ['grammar', 'insertion']
    expect(allocateSchoolMarkerLabels(ids, 'grammar')).toEqual(['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ'])
    expect(allocateSchoolMarkerLabels(ids, 'insertion')).toEqual(['a', 'b', 'c', 'd', 'e'])
  })
})
