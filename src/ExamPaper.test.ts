import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { SetLivePreview } from './ExamPaper'
import { createEnglishSet, createQuestion } from './english'

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
})
