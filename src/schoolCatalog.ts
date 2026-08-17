import type { EnglishQuestion, EnglishQuestionSet, SchoolChoiceLayout, SchoolQuestionTemplateId } from './types'

export const MAX_SCHOOL_SET_QUESTIONS = 5

export interface SchoolQuestionTemplateDefinition {
  id: SchoolQuestionTemplateId
  label: string
  questionType: string
  defaultStem: string
  choiceLayout: SchoolChoiceLayout
  promptRule: string
}

export const SCHOOL_QUESTION_TEMPLATES: readonly SchoolQuestionTemplateDefinition[] = [
  { id: 'content-match', label: '내용 일치·불일치', questionType: '내용 일치 및 불일치', defaultStem: '다음 글의 내용과 일치하지 않는 것은?', choiceLayout: 'auto', promptRule: '다섯 선지 중 하나만 발문의 일치·불일치 극성에 맞게 하고, 원문의 서로 다른 사실을 근거로 판단하게 한다.' },
  { id: 'content-inference', label: '내용 이해·추론', questionType: '내용 이해', defaultStem: '다음 글의 내용으로부터 추론할 수 있는 것은?', choiceLayout: 'auto', promptRule: '직접 진술을 복사하지 말고 둘 이상의 단서 또는 충분한 함의를 종합해 하나만 추론되게 한다.' },
  { id: 'topic', label: '주제', questionType: '주제', defaultStem: '다음 글의 주제로 가장 적절한 것은?', choiceLayout: 'auto', promptRule: '글 전체의 범위와 관점을 포괄하는 정답 하나와 범위가 좁거나 넓은 오답을 만든다.' },
  { id: 'gist', label: '요지', questionType: '요지', defaultStem: '다음 글의 요지로 가장 적절한 것은?', choiceLayout: 'auto', promptRule: '핵심 주장과 근거 관계를 완결된 문장으로 재진술하고 부분 일치 오답을 만든다.' },
  { id: 'implication', label: '함축 의미', questionType: '함축 의미', defaultStem: '밑줄 친 부분이 다음 글에서 의미하는 바로 가장 적절한 것은?', choiceLayout: 'auto', promptRule: '지문에 [[밑줄:표현]]을 하나 이상 두고 문맥 의미를 명시적으로 풀어 쓴 선지를 만든다.' },
  { id: 'blank', label: '빈칸 추론', questionType: '빈칸 추론', defaultStem: '다음 빈칸에 들어갈 말로 가장 적절한 것은?', choiceLayout: 'auto', promptRule: '지문에 [[빈칸]]을 두고 글 전체의 논리로 정답을 결정하게 한다.' },
  { id: 'grammar-error', label: '어법 오류 1개 찾기', questionType: '어법', defaultStem: '다음 글의 밑줄 친 부분 중, 어법상 틀린 것은?', choiceLayout: 'inline', promptRule: '지문에 [[밑줄:표현]]을 정확히 다섯 개 두고 하나만 명백한 어법 오류가 되게 한다.' },
  { id: 'grammar-combination', label: '어법상 옳은 표현 조합', questionType: '어법상 옳은 표현 조합', defaultStem: '다음 글의 밑줄 친 부분 중, 어법상 옳은 것만을 고른 것은?', choiceLayout: 'matrix', promptRule: '지문에 서로 다른 어법 표적을 다섯 개 이상 두고, 선지는 옳은 표적의 조합을 비교하는 형식으로 만든다.' },
  { id: 'vocabulary-context', label: '문맥상 부적절한 어휘', questionType: '어휘', defaultStem: '다음 글의 밑줄 친 부분 중, 문맥상 낱말의 쓰임이 적절하지 않은 것은?', choiceLayout: 'inline', promptRule: '지문에 [[밑줄:표현]]을 정확히 다섯 개 두고 하나만 문맥의 대립축과 어긋나게 한다.' },
  { id: 'irrelevant', label: '무관한 문장', questionType: '무관한 문장', defaultStem: '다음 글에서 전체 흐름과 관계 없는 문장은?', choiceLayout: 'inline', promptRule: '지문에 ①~⑤ 문장 위치를 표시하고 하나의 문장만 소재 또는 논리 흐름에서 벗어나게 한다.' },
  { id: 'order', label: '글의 순서', questionType: '순서 배열', defaultStem: '주어진 글 다음에 이어질 글의 순서로 가장 적절한 것은?', choiceLayout: 'matrix', promptRule: '도입문과 (A)·(B)·(C)를 구분하고 지시·인과·개념 관계로 유일한 순서를 만든다.' },
  { id: 'insertion', label: '문장 삽입', questionType: '문장 삽입', defaultStem: '글의 흐름으로 보아, 주어진 문장이 들어가기에 가장 적절한 곳은?', choiceLayout: 'inline', promptRule: '[[삽입문장:문장]] 하나와 [[삽입위치:①]]~[[삽입위치:⑤]]를 순서대로 정확히 한 번씩 둔다.' },
  { id: 'summary', label: '요약문 완성', questionType: '요약문 완성', defaultStem: '다음 글의 내용을 한 문장으로 요약하고자 한다. 빈칸 (A)와 (B)에 들어갈 말로 가장 적절한 것은?', choiceLayout: 'matrix', promptRule: 'questions[].summaryText에 원문을 재진술한 영어 한 문장을 만들고 [[요약빈칸:A]]와 [[요약빈칸:B]]를 각각 정확히 한 번 둔다. 다섯 choices는 각 (A)와 (B)의 단어를 A|B 형식으로 구분한다.' },
  { id: 'multi-blank', label: '(A)·(B)·(C) 복수 빈칸', questionType: '복수 빈칸 조합', defaultStem: '다음 빈칸 (A), (B), (C)에 들어갈 말로 가장 적절한 것은?', choiceLayout: 'matrix', promptRule: '지문에 [[빈칸:A]], [[빈칸:B]], [[빈칸:C]]를 두고 각 선지는 세 칸의 조합을 | 문자로 구분한다.' },
  { id: 'word-bank', label: '공통 보기 단어 빈칸', questionType: '공통 보기 빈칸', defaultStem: '윗글의 빈칸에 들어갈 말로 가장 적절한 것을 <보기>에서 고른 것은?', choiceLayout: 'inline', promptRule: '지문에 라벨이 있는 [[빈칸:ⓐ]] 형식의 빈칸과 [[보기:a. word|b. word|c. word|d. word|e. word]]를 둔다.' },
] as const

const TEMPLATE_BY_ID = new Map(SCHOOL_QUESTION_TEMPLATES.map((template) => [template.id, template]))
const TEMPLATE_BY_TYPE = new Map(SCHOOL_QUESTION_TEMPLATES.map((template) => [template.questionType, template]))

export function getSchoolQuestionTemplate(id?: SchoolQuestionTemplateId) {
  return id ? TEMPLATE_BY_ID.get(id) : undefined
}

export function inferSchoolQuestionTemplate(question: Pick<EnglishQuestion, 'type' | 'schoolTemplateId'>) {
  return getSchoolQuestionTemplate(question.schoolTemplateId) ?? TEMPLATE_BY_TYPE.get(question.type) ?? SCHOOL_QUESTION_TEMPLATES[0]
}

export function schoolQuestionTypes() {
  return SCHOOL_QUESTION_TEMPLATES.map((template) => template.questionType)
}

const LANGUAGE_AWARE_CHOICE_TEMPLATES = new Set<SchoolQuestionTemplateId>([
  'content-match', 'content-inference', 'topic', 'gist', 'implication', 'blank', 'summary', 'multi-blank', 'word-bank',
])

export function schoolQuestionUsesChoiceLanguage(question: Pick<EnglishQuestion, 'type' | 'schoolTemplateId'>) {
  return LANGUAGE_AWARE_CHOICE_TEMPLATES.has(inferSchoolQuestionTemplate(question).id)
}

export function schoolQuestionChoiceLayout(question: EnglishQuestion): Exclude<SchoolChoiceLayout, 'auto'> {
  const requested = question.schoolChoiceLayout ?? inferSchoolQuestionTemplate(question).choiceLayout
  if (requested !== 'auto') return requested
  const lengths = question.choices.map((choice) => choice.trim().length)
  return lengths.length === 5 && Math.max(0, ...lengths) <= 12 && lengths.reduce((sum, length) => sum + length, 0) <= 48 ? 'inline' : 'vertical'
}

export function schoolCatalogPromptSection(questions: EnglishQuestion[]) {
  return questions.map((question, index) => {
    const template = inferSchoolQuestionTemplate(question)
    const stemLanguage = question.schoolStemLanguage ?? 'ko'
    const choiceLanguage = question.schoolChoiceLanguage ?? (template.id === 'summary' ? 'en' : 'ko')
    const choiceLanguageRule = schoolQuestionUsesChoiceLanguage(question)
      ? `${choiceLanguage === 'en' ? '영어' : '한국어'} (다섯 선지 본문을 이 언어로 통일)`
      : '위치·표식·배열형 (언어 설정 없음)'
    return `- 문항 ${index + 1}: ${template.label} (${template.id})\n  발문 언어: ${stemLanguage === 'en' ? '영어' : '한국어'}\n  발문: ${question.stem}\n  선지 언어: ${choiceLanguageRule}\n  선지 조판: ${question.schoolChoiceLayout ?? template.choiceLayout}\n  고유 규칙: ${template.promptRule}`
  }).join('\n')
}

const occurrences = (text: string, expression: RegExp) => [...text.matchAll(expression)].length

export function validateSchoolTemplateMarkup(set: EnglishQuestionSet) {
  if (set.mode !== 'school' || !set.material.trim()) return []
  const issues: string[] = []
  set.questions.forEach((question, index) => {
    const template = inferSchoolQuestionTemplate(question)
    const prefix = `${index + 1}번 ${template.label}`
    if (question.schoolStemLanguage === 'en' && (/[가-힣]/.test(question.stem) || !/[A-Za-z]/.test(question.stem))) issues.push(`${prefix}: 발문 언어가 영어로 설정되었지만 발문에 한국어가 있거나 영어가 없습니다.`)
    if (question.schoolChoiceLanguage === 'en' && schoolQuestionUsesChoiceLanguage(question) && question.choices.some((choice) => choice.trim() && (/[가-힣]/.test(choice) || !/[A-Za-z]/.test(choice)))) issues.push(`${prefix}: 선지 언어가 영어로 설정되었지만 영어가 아닌 선지가 있습니다.`)
    const underlines = occurrences(set.material, /\[\[밑줄:[^\]]+\]\]/g)
    if ((template.id === 'grammar-error' || template.id === 'vocabulary-context') && underlines !== 5) issues.push(`${prefix}: 밑줄 표식이 ${underlines}개입니다. 정확히 5개가 필요합니다.`)
    if (template.id === 'grammar-combination' && underlines < 5) issues.push(`${prefix}: 어법 조합형은 밑줄 표식이 5개 이상 필요합니다.`)
    if (template.id === 'implication' && underlines < 1) issues.push(`${prefix}: 함축 의미를 물을 밑줄 표식이 필요합니다.`)
    if (template.id === 'blank' && occurrences(set.material, /\[\[빈칸(?::[^\]]+)?\]\]/g) < 1) issues.push(`${prefix}: [[빈칸]] 표식이 필요합니다.`)
    if (template.id === 'multi-blank' && ['A', 'B', 'C'].some((label) => !set.material.includes(`[[빈칸:${label}]]`))) issues.push(`${prefix}: [[빈칸:A]], [[빈칸:B]], [[빈칸:C]]가 모두 필요합니다.`)
    if (template.id === 'word-bank' && (!/\[\[보기:[^\]]+\]\]/.test(set.material) || occurrences(set.material, /\[\[빈칸:[^\]]+\]\]/g) < 1)) issues.push(`${prefix}: 라벨 빈칸과 [[보기:...]] 표식이 필요합니다.`)
    if (template.id === 'summary') {
      const summary = question.schoolSummaryText ?? (set.materialSpec?.kind === 'summary' ? set.materialSpec.summary : '')
      const markerA = occurrences(summary, /\[\[요약빈칸:A\]\]/g)
      const markerB = occurrences(summary, /\[\[요약빈칸:B\]\]/g)
      if (markerA !== 1 || markerB !== 1) issues.push(`${prefix}: 별도 요약문에 [[요약빈칸:A]]와 [[요약빈칸:B]]가 각각 정확히 1개 필요합니다.`)
      if (question.choices.some((choice) => choice.split('|').map((cell) => cell.trim()).filter(Boolean).length !== 2)) issues.push(`${prefix}: 각 선지는 (A)와 (B)를 A|B 형식으로 구분해야 합니다.`)
    }
    if (template.id === 'order' && set.materialSpec?.kind !== 'ordered' && !['(A)', '(B)', '(C)'].every((label) => set.material.includes(label))) issues.push(`${prefix}: 도입문과 (A)·(B)·(C) 구획이 필요합니다.`)
    if (template.id === 'irrelevant' && !['①', '②', '③', '④', '⑤'].every((label) => set.material.includes(label))) issues.push(`${prefix}: 지문 안 ①~⑤ 문장 표시가 필요합니다.`)
  })
  return issues
}
