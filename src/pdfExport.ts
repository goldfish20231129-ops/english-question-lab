export type ExamPdfSheet = 'questions' | 'answers'

export function makeExamPdfFilename(title: string, sheet: ExamPdfSheet) {
  const safeTitle = title.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim() || '영어 시험지'
  return `${safeTitle}-${sheet === 'questions' ? '문제지' : '정답-해설지'}.pdf`
}

export async function downloadExamPdf(element: HTMLElement, filename: string) {
  const { default: html2pdf } = await import('html2pdf.js')

  await html2pdf()
    .set({
      margin: 0,
      filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        scrollX: 0,
        scrollY: 0,
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    })
    .from(element)
    .save()
}

export async function downloadExamPagesPdf(elements: HTMLElement[], filename: string) {
  if (!elements.length) throw new Error('PDF로 저장할 페이지가 없습니다.')
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')])
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true })

  for (let index = 0; index < elements.length; index += 1) {
    const element = elements[index]
    element.classList.add('pdf-exporting')
    try {
      const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false })
      if (index > 0) pdf.addPage('a4', 'portrait')
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.98), 'JPEG', 0, 0, 210, 297, undefined, 'FAST')
    } finally {
      element.classList.remove('pdf-exporting')
    }
  }
  pdf.save(filename)
}
