import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DragPreviewViewport } from './EnglishStudio'

describe('드래그 미리보기 영역', () => {
  it('마우스·터치·키보드로 탐색할 수 있는 스크롤 영역을 제공한다', () => {
    const html = renderToStaticMarkup(createElement(DragPreviewViewport, { label: '세트 미리보기', children: createElement('div', null, 'paper') }))
    expect(html).toContain('class="drag-preview-viewport')
    expect(html).toContain('aria-label="세트 미리보기"')
    expect(html).toContain('tabindex="0"')
    expect(html).toContain('마우스로 드래그 · 터치로 스크롤')
  })
})
