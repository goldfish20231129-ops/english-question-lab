import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ExamQuestionPages, SetLivePreview } from './ExamPaper'
import { createEnglishSet, createExamLayout, createQuestion } from './english'
import { contentEntriesForSet } from './examLayout'
import { createProvidedPassageV02Plan, syncProvidedPassageV02Questions, transitionSchoolProvidedPassageV02 } from './providedPassageV02'

describe('내신형 새 지문 혼합 세트 출력', () => {
  it('AI가 선지에 붙인 번호를 제거하고 시험지 번호를 한 번만 표시한다', () => {
    const set = createEnglishSet('school')
    const question = createQuestion('내용 이해')
    question.choices = ['① 첫 번째 내용', '② 두 번째 내용', '③ 세 번째 내용', '④ 네 번째 내용', '⑤ 다섯 번째 내용']
    set.questions = [question]
    set.material = 'A short passage supports one answer.'

    const html = renderToStaticMarkup(createElement(SetLivePreview, { set }))

    expect(html.match(/①/g)).toHaveLength(1)
    expect(html.match(/②/g)).toHaveLength(1)
    expect(html).not.toContain('① 첫 번째 내용')
    expect(html).toContain('첫 번째 내용')
  })

  it('공통 지문과 마지막 삽입형 지문을 각각 한 번만 출력하고 별도 위치 선지는 숨긴다', () => {
    const set = createEnglishSet('school')
    const insertion = createQuestion('문장 삽입')
    const grammar = createQuestion('어법')
    const content = createQuestion('내용 이해')
    insertion.choices = ['①', '②', '③', '④', '⑤']
    set.questions = [insertion, grammar, content]
    set.material = 'Shared opening. [[삽입위치:①]] [[삽입문장:Given sentence.]] Second. [[삽입위치:②]] Third. [[삽입위치:③]] Fourth. [[삽입위치:④]] Fifth. [[삽입위치:⑤]] A rule [[밑줄:apply]] here.'

    const html = renderToStaticMarkup(createElement(SetLivePreview, { set }))

    expect(html.match(/Shared opening\./g)).toHaveLength(2)
    expect(html.match(/Given sentence\./g)).toHaveLength(1)
    expect(html).toContain('class="given-block"')
    expect(html.match(/<ol>/g)).toHaveLength(2)
    expect(html.indexOf(grammar.stem)).toBeLessThan(html.indexOf(content.stem))
    expect(html.indexOf(content.stem)).toBeLessThan(html.indexOf(insertion.stem))
  })

  it('사용자 입력 지문 V0.2도 일반 문항은 한 번만 공유하고 삽입형만 독립 블록으로 표시한다', () => {
    const passage = 'First sentence explains the topic. Second sentence adds evidence. Third sentence gives a contrast. Fourth sentence states a result. Fifth sentence adds a limitation. Sixth sentence closes the discussion.'
    const seed = createEnglishSet('school')
    seed.material = passage
    let set = transitionSchoolProvidedPassageV02(seed, 'provided')
    const contentOne = createProvidedPassageV02Plan('content-1', 'content_match')
    const insertion = createProvidedPassageV02Plan('insert-1', 'sentence_insertion')
    const contentTwo = createProvidedPassageV02Plan('content-2', 'content_match')
    const plans = [contentOne, insertion, contentTwo]
    set = { ...set, providedPassageV02: { ...set.providedPassageV02!, itemPlans: plans }, questions: syncProvidedPassageV02Questions(set, plans) }
    const state = set.providedPassageV02!
    const candidateBoundaryIds = state.boundaries.slice(0, 5).map((boundary) => boundary.id)
    const first = state.sentences[0]
    const second = state.sentences[1]
    state.results = [
      { itemId: contentOne.itemId, evidenceSpans: [], materialOperation: null },
      { itemId: contentTwo.itemId, evidenceSpans: [], materialOperation: null },
      { itemId: insertion.itemId, evidenceSpans: [], materialOperation: { kind: 'insert_sentence', generatedSentence: 'This connection becomes clearer in the following example.', candidateBoundaryIds, answerBoundaryId: candidateBoundaryIds[1], positionReasons: candidateBoundaryIds.map((boundaryId) => ({ boundaryId, reason: '앞뒤 결속을 확인한다.' })), beforeEvidence: { sentenceId: first.id, start: first.start, end: first.end, text: first.text }, afterEvidence: { sentenceId: second.id, start: second.start, end: second.end, text: second.text }, lexicalLevel: 'source_matched' } },
    ]

    const html = renderToStaticMarkup(createElement(SetLivePreview, { set }))

    expect(html.match(/First sentence explains the topic\./g)).toHaveLength(2)
    expect(html.match(/This connection becomes clearer/g)).toHaveLength(1)
    expect(html.match(/<ol>/g)).toHaveLength(2)
    expect(html.indexOf(set.questions[0].stem)).toBeLessThan(html.indexOf('글의 흐름으로 보아'))

    set.schoolInsertionPresentation = 'shared'
    const sharedHtml = renderToStaticMarkup(createElement(SetLivePreview, { set }))
    expect(sharedHtml.match(/First sentence explains the topic\./g)).toHaveLength(1)
    expect(sharedHtml.match(/This connection becomes clearer/g)).toHaveLength(1)
    expect(sharedHtml.match(/class="insertion-position"/g)).toHaveLength(5)
  })

  it('기존 지문 어법 오류형은 한 문단 안 ①~⑤ 밑줄로 표시하고 별도 번호 선지를 숨긴다', () => {
    const passage = 'The student who leads the club arrives early. She checks the room before every meeting. The members bring their notebooks while the teacher prepares a short guide.'
    const seed = createEnglishSet('school')
    seed.material = passage
    let set = transitionSchoolProvidedPassageV02(seed, 'provided')
    const plan = { ...createProvidedPassageV02Plan('grammar-five', 'grammar'), grammarTarget: 'subject_verb_agreement' as const, grammarMode: 'controlled_error_variant' as const }
    set = { ...set, providedPassageV02: { ...set.providedPassageV02!, itemPlans: [plan] }, questions: syncProvidedPassageV02Questions(set, [plan]) }
    const state = set.providedPassageV02!
    const texts = ['student', 'who', 'arrives', 'checks', 'bring']
    const spans = texts.map((text) => {
      const start = state.originalText.indexOf(text)
      const sentence = state.sentences.find((candidate) => start >= candidate.start && start < candidate.end)!
      return { sentenceId: sentence.id, start, end: start + text.length, text }
    })
    state.results = [{ itemId: plan.itemId, evidenceSpans: spans, materialOperation: { kind: 'grammar_check', grammarTarget: 'subject_verb_agreement', grammarMode: 'controlled_error_variant', testedSpan: spans[2], sourceForm: 'arrives', presentedForm: 'arrive', ruleCheck: { classification: 'subject_verb_agreement', decisionRule: '단수 주어와 동사의 수 일치', contrastWith: '복수 주어', isUniquelyDetermined: true }, sourceTextModified: false } }]

    const html = renderToStaticMarkup(createElement(SetLivePreview, { set }))

    expect(html).toContain('① <u>student</u>')
    expect(html).toContain('③ <u>arrive</u>')
    expect(html).toContain('⑤ <u>bring</u>')
    expect(html).toContain('school-inline-grammar')
    expect(html).not.toContain('<ol>')
    expect(html).not.toContain('\n')
  })

  it('학교 시험형 공유 삽입은 위치가 표시된 공통 지문을 중복 출력하지 않는다', () => {
    const set = createEnglishSet('school')
    set.schoolInsertionPresentation = 'shared'
    set.questions = [createQuestion('내용 이해'), createQuestion('문장 삽입')]
    set.material = 'Shared opening. [[삽입위치:①]] [[삽입문장:Given sentence.]] Second. [[삽입위치:②]] Third. [[삽입위치:③]] Fourth. [[삽입위치:④]] Fifth. [[삽입위치:⑤]]'

    const html = renderToStaticMarkup(createElement(SetLivePreview, { set }))

    expect(html.match(/Shared opening\./g)).toHaveLength(1)
    expect(html.match(/Given sentence\./g)).toHaveLength(1)
    expect(html.match(/class="insertion-position"/g)).toHaveLength(5)
  })

  it('내신형 요약문을 공통 지문 아래 화살표·상자·단어쌍 선지로 표시한다', () => {
    const set = createEnglishSet('school')
    const content = createQuestion('내용 이해')
    const summary = createQuestion('요약문 완성', 5, 'school')
    summary.schoolSummaryText = 'Careful comparison [[요약빈칸:A]] learners to [[요약빈칸:B]] their conclusions.'
    summary.choices = ['enables|revise', 'prevents|repeat', 'forces|ignore', 'allows|copy', 'stops|preserve']
    set.questions = [content, summary]
    set.material = 'Learners compare explanations and use evidence to revise their conclusions.'

    const html = renderToStaticMarkup(createElement(SetLivePreview, { set }))

    expect(html.match(/Learners compare explanations/g)).toHaveLength(1)
    expect(html).toContain('school-summary-material')
    expect(html).toContain('csat-summary-arrow')
    expect(html).toContain('english-summary-blank')
    expect(html).toContain('school-choice-container-matrix')
    expect(html).toContain('<span>enables</span><span>revise</span>')
  })

  it('학교형-2단 시험 첫 페이지에 편집 헤더와 자동 문항·배점 합계를 표시한다', () => {
    const set = createEnglishSet('school')
    set.material = 'A completely new passage is used only for layout verification.'
    set.questions = [createQuestion('내용 이해'), createQuestion('복수 빈칸 조합')]
    set.questions[0].score = 2.5
    set.questions[1].score = 3
    set.questions[1].choices = ['careful | revision | matters', 'careless | copying | works', 'quick | guessing | succeeds', 'random | reading | fails', 'brief | memory | wins']
    const layout = createExamLayout('school-exam')
    layout.institution = '예시 교육 기관'
    layout.gradeLabel = '1학년'
    layout.schoolExamHeader = { subjectName: '공통영어', subjectCode: 'ENG-1', examSession: '2학기 기말', authorName: '출제자', showApprovalGrid: true }
    const entries = contentEntriesForSet(set)
    const exam = { id: 'school-exam', title: '영어 평가', setIds: [set.id], contentEntries: entries, layout, setOverrides: {}, entryOverrides: {}, createdAt: '', updatedAt: '' }

    const html = renderToStaticMarkup(createElement(ExamQuestionPages, { exam, sets: [set], assets: [] }))
    expect(html).toContain('preset-school-exam')
    expect(html).toContain('school-exam-brand')
    expect(html).toContain('school-exam-footer')
    expect(html).toContain('예시 교육 기관')
    expect(html).toContain('2문항 · 5.5점')
    expect(html).toContain('[1-2] 다음 글을 읽고, 물음에 답하시오.')
    expect(html).toContain('[2.5점]')
    expect(html).toContain('school-choice-container-matrix')
  })
})
