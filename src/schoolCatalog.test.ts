import { describe, expect, it } from 'vitest'
import { createEnglishSet, createQuestion, generateEnglishPrompt, questionTypesFor } from './english'
import { SCHOOL_QUESTION_TEMPLATES, inferSchoolQuestionTemplate, schoolQuestionChoiceLayout, validateSchoolTemplateMarkup } from './schoolCatalog'

describe('내신형 객관식 템플릿 카탈로그', () => {
  it('요청된 15개 객관식 구조를 중복 없이 제공한다', () => {
    expect(SCHOOL_QUESTION_TEMPLATES).toHaveLength(15)
    expect(new Set(SCHOOL_QUESTION_TEMPLATES.map((template) => template.id)).size).toBe(15)
    expect(questionTypesFor('school')).toEqual(SCHOOL_QUESTION_TEMPLATES.map((template) => template.questionType))
  })

  it('짧은 선지는 자동 다열, 긴 선지는 세로형으로 결정한다', () => {
    const short = createQuestion('내용 이해')
    short.schoolChoiceLayout = 'auto'
    short.choices = ['alpha', 'beta', 'gamma', 'delta', 'epsilon']
    const long = { ...short, choices: Array.from({ length: 5 }, () => 'This choice contains a substantially longer school-exam statement.') }
    expect(schoolQuestionChoiceLayout(short)).toBe('inline')
    expect(schoolQuestionChoiceLayout(long)).toBe('vertical')
  })

  it('복수 빈칸과 공통 보기 표식을 검사하고 프롬프트에 같은 카탈로그 규칙을 쓴다', () => {
    const set = createEnglishSet('school')
    set.questions = [createQuestion('복수 빈칸 조합'), createQuestion('공통 보기 빈칸')]
    set.material = 'Students compare [[빈칸:A]], [[빈칸:B]], and [[빈칸:C]]. They then choose [[빈칸:ⓐ]]. [[보기:a. compare|b. revise|c. infer|d. test|e. explain]]'
    expect(validateSchoolTemplateMarkup(set)).toEqual([])
    const prompt = generateEnglishPrompt(set)
    expect(prompt).toContain('multi-blank')
    expect(prompt).toContain('word-bank')
    expect(prompt).toContain('하나의 공통 material')
  })

  it('요약문은 별도 (A)·(B) 문장과 단어쌍 선지를 검사한다', () => {
    const set = createEnglishSet('school')
    const summary = createQuestion('요약문 완성')
    summary.schoolStemLanguage = 'en'
    summary.schoolChoiceLanguage = 'en'
    summary.stem = 'Which pair of words best completes blanks (A) and (B) in the summary?'
    summary.schoolSummaryText = 'The evidence [[요약빈칸:A]] the claim while [[요약빈칸:B]] its limits.'
    summary.choices = ['supports|revealing', 'rejects|hiding', 'copies|ignoring', 'weakens|removing', 'repeats|denying']
    set.questions = [summary]
    set.material = 'A source passage presents evidence and explains the limits of the claim.'

    expect(validateSchoolTemplateMarkup(set)).toEqual([])
    expect(inferSchoolQuestionTemplate(summary).choiceLayout).toBe('matrix')

    summary.schoolSummaryText = 'The evidence [[요약빈칸:A]] the claim.'
    expect(validateSchoolTemplateMarkup(set)[0]).toContain('[[요약빈칸:B]]')
  })

  it('명시적으로 선택한 영어 발문과 영어 선지만 언어를 검사한다', () => {
    const set = createEnglishSet('school')
    const question = createQuestion('내용 이해', 5, 'school')
    question.schoolStemLanguage = 'en'
    question.schoolChoiceLanguage = 'en'
    question.stem = 'Which of the following can be inferred from the passage?'
    question.choices = ['A reasonable inference.', 'A second inference.', 'A third inference.', 'A fourth inference.', 'A fifth inference.']
    set.questions = [question]
    set.material = 'The passage provides enough information for a careful inference.'
    expect(validateSchoolTemplateMarkup(set)).toEqual([])

    question.stem = '다음 글에서 추론할 수 있는 것은?'
    question.choices[1] = '한국어 선지'
    expect(validateSchoolTemplateMarkup(set).join(' ')).toContain('발문 언어가 영어')
    expect(validateSchoolTemplateMarkup(set).join(' ')).toContain('선지 언어가 영어')
  })
})
