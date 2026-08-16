import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { SetLivePreview } from './ExamPaper'
import { createEnglishSet, createQuestion } from './english'
import { createProvidedPassageV02Plan, syncProvidedPassageV02Questions, transitionSchoolProvidedPassageV02 } from './providedPassageV02'

describe('내신형 새 지문 혼합 세트 출력', () => {
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
  })
})
