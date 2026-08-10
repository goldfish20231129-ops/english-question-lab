import { describe, expect, it } from 'vitest'
import { makeExamPdfFilename } from './pdfExport'

describe('영어 PDF 파일명', () => {
  it('문제지와 해설지를 구분한다', () => {
    expect(makeExamPdfFilename('고2 영어', 'questions')).toBe('고2 영어-문제지.pdf')
    expect(makeExamPdfFilename('고2 영어', 'answers')).toBe('고2 영어-정답-해설지.pdf')
  })

  it('빈 제목에는 영어 시험지를 사용한다', () => {
    expect(makeExamPdfFilename('', 'questions')).toBe('영어 시험지-문제지.pdf')
  })
})
