import { describe, expect, it } from 'vitest'
import { createEnglishSet } from './english'
import { normalizeQuestionSet } from './studioStorage'

describe('내신형 선택 필드 저장 정규화', () => {
  it('기존 저장 데이터에는 템플릿과 삽입 표시 기본값을 추론한다', () => {
    const legacy = createEnglishSet('school')
    legacy.schoolInsertionPresentation = undefined
    legacy.questions[0] = { ...legacy.questions[0], type: '내용 이해', schoolTemplateId: undefined, schoolChoiceLayout: undefined }

    const normalized = normalizeQuestionSet(legacy)
    expect(normalized.schoolInsertionPresentation).toBe('isolated')
    expect(normalized.questions[0]).toMatchObject({ schoolTemplateId: 'content-inference', schoolChoiceLayout: 'auto' })
  })

  it('예전 공통 지문 공유 설정은 독립 지문 출력 방식으로 정규화한다', () => {
    const legacy = createEnglishSet('school')
    legacy.schoolInsertionPresentation = 'shared'

    expect(normalizeQuestionSet(legacy).schoolInsertionPresentation).toBe('isolated')
  })
})
