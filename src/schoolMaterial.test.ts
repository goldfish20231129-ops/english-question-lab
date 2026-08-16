import { describe, expect, it } from 'vitest'
import { createEnglishSet, createQuestion } from './english'
import { cleanInsertionMarkupForOtherQuestion, deriveGeneratedSchoolInsertionSpec, generatedSchoolInsertionMarkupIssues, generatedSchoolSharedMaterialPresentation, orderedGeneratedSchoolQuestions, schoolQuestionMaterialPresentation, usesInlineGeneratedSchoolChoices, usesQuestionScopedSchoolMaterial } from './schoolMaterial'

const MARKED = 'The class reviewed the claim. [[삽입위치:①]] [[삽입문장:This evidence changed their view.]] They compared two explanations. [[삽입위치:②]] The students checked the source. [[삽입위치:③]] They revised the conclusion. [[삽입위치:④]] The teacher summarized the lesson. [[삽입위치:⑤]]'

describe('새 자료 내신형 문항별 지문 표시', () => {
  it('일반 문항은 삽입 표식을 제거한 하나의 공통 지문을 공유한다', () => {
    const set = createEnglishSet('school')
    const content = createQuestion('내용 이해')
    const insertion = createQuestion('문장 삽입')
    set.questions = [content, insertion]
    set.material = MARKED
    const before = set.material

    expect(usesQuestionScopedSchoolMaterial(set)).toBe(true)
    expect(generatedSchoolSharedMaterialPresentation(set)?.text).not.toContain('[[삽입위치:')
    expect(generatedSchoolSharedMaterialPresentation(set)?.text).not.toContain('[[삽입문장:')
    expect(schoolQuestionMaterialPresentation(set, content).text).toBe('')
    expect(set.material).toBe(before)
  })

  it('삽입 문장을 상단 상자용 구조로 추출하고 위치 표식은 본문에 남긴다', () => {
    const set = createEnglishSet('school')
    const insertion = createQuestion('문장 삽입')
    set.questions = [insertion]
    set.material = MARKED

    const spec = deriveGeneratedSchoolInsertionSpec(set)
    expect(spec).toMatchObject({ kind: 'insertion', givenSentence: 'This evidence changed their view.' })
    expect(spec?.body).not.toContain('[[삽입문장:')
    expect(spec?.body).toContain('[[삽입위치:①]]')
    expect(schoolQuestionMaterialPresentation(set, insertion).spec).toEqual(spec)
    expect(usesInlineGeneratedSchoolChoices(set, insertion)).toBe(true)
    expect(generatedSchoolSharedMaterialPresentation(set)).toBeUndefined()
  })

  it('구조화된 insertion material도 공통 지문과 삽입 자료를 분리한다', () => {
    const set = createEnglishSet('school')
    const content = createQuestion('내용 일치 및 불일치')
    const insertion = createQuestion('문장 삽입')
    set.questions = [content, insertion]
    set.material = 'Clean source.'
    set.materialSpec = { kind: 'insertion', givenSentence: 'Given sentence.', body: 'First. [[삽입위치:①]] Second.' }

    expect(schoolQuestionMaterialPresentation(set, insertion).spec?.kind).toBe('insertion')
    expect(schoolQuestionMaterialPresentation(set, content)).toEqual({ text: '' })
    expect(generatedSchoolSharedMaterialPresentation(set)).toEqual({ text: 'First. Second.' })
  })

  it('삽입 표식 제거는 표시용 변환이며 입력 문자열을 바꾸지 않는다', () => {
    expect(cleanInsertionMarkupForOtherQuestion(MARKED)).not.toContain('[[삽입')
    expect(MARKED).toContain('[[삽입문장:This evidence changed their view.]]')
  })

  it('일반 문항의 상대 순서를 유지하고 문장 삽입만 마지막에 배치한다', () => {
    const set = createEnglishSet('school')
    const insertion = createQuestion('문장 삽입')
    const grammar = createQuestion('어법')
    const content = createQuestion('내용 이해')
    set.questions = [insertion, grammar, content]

    expect(orderedGeneratedSchoolQuestions(set).map((question) => question.type)).toEqual(['어법', '내용 이해', '문장 삽입'])
    expect(set.questions.map((question) => question.type)).toEqual(['문장 삽입', '어법', '내용 이해'])
  })

  it('삽입 문장 1개와 위치 ①~⑤를 엄격히 검사한다', () => {
    const set = createEnglishSet('school')
    set.questions = [createQuestion('문장 삽입')]
    set.material = MARKED
    expect(generatedSchoolInsertionMarkupIssues(set)).toEqual([])

    set.material = set.material.replace('[[삽입위치:⑤]]', '[[삽입위치:④]]')
    expect(generatedSchoolInsertionMarkupIssues(set)[0]).toContain('①')
  })
})
