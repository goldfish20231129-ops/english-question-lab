import type {
  CsatChoiceStyle, CsatDesignSpec, CsatItemDesign, CsatNumberTemplateId, CsatQuestionBlueprint,
  CsatPassageLengthPreset, CsatQuestionFamilyId, CsatTemplateDefinition, CsatVariantId, EnglishQuestion,
  EnglishQuestionSet, CsatMaterialSpec,
} from './types'
import { englishDifficultyLabel, englishDifficultyPrompt, legacyCsatDifficultyToEight } from './difficulty'

export const CSAT_FAMILIES: Array<{ id: CsatQuestionFamilyId; label: string; description: string }> = [
  { id: 'purpose', label: '목적', description: '18번 편지·이메일의 의사소통 목적' },
  { id: 'emotion', label: '심경 및 분위기', description: '19번 인물의 감정과 변화' },
  { id: 'claim', label: '주장', description: '20번 필자의 당위적 주장' },
  { id: 'gist', label: '요지', description: '22번 글 전체의 핵심 메시지' },
  { id: 'topic', label: '주제', description: '23번 영어 명사구형 주제' },
  { id: 'title', label: '제목', description: '24번 영어 제목 추론' },
  { id: 'implication', label: '함축 의미', description: '21번 밑줄 표현의 문맥적 의미' },
  { id: 'content-detail', label: '내용 일치 및 불일치', description: '26번 전기·정보문의 사실 확인' },
  { id: 'chart-practical', label: '도표 및 실용문', description: '25·27·28번 구조화 자료' },
  { id: 'grammar', label: '어법', description: '29번 다섯 표적 중 어법 오류' },
  { id: 'vocabulary', label: '어휘', description: '30번 문맥상 어휘 적절성' },
  { id: 'blank', label: '빈칸 추론', description: '31~34번 핵심 개념 추론' },
  { id: 'irrelevant', label: '무관한 문장', description: '35번 전체 흐름과 무관한 문장' },
  { id: 'order', label: '글의 순서', description: '36·37번 A·B·C 배열' },
  { id: 'insertion', label: '문장 삽입', description: '38·39번 결속 관계 추론' },
  { id: 'summary', label: '요약문 완성', description: '40번 A·B 개념쌍' },
  { id: 'long-reading', label: '장문 독해', description: '41~42 설명문·43~45 복합 서사' },
]

export type CsatPrintFlow = 'lead-material-choices' | 'lead-material-inline' | 'lead-material-embedded-choices' | 'material-questions'

export const CSAT_INLINE_POSITION_CHOICES = ['①', '②', '③', '④', '⑤'] as const

export function csatPrintFlow(templateId?: CsatNumberTemplateId): CsatPrintFlow {
  if (templateId === '35' || templateId === '38' || templateId === '39') return 'lead-material-inline'
  if (templateId === '25') return 'lead-material-embedded-choices'
  if (templateId === '41-42' || templateId === '43-45') return 'material-questions'
  return 'lead-material-choices'
}

export const isInlinePositionTemplate = (templateId?: CsatNumberTemplateId) => csatPrintFlow(templateId) === 'lead-material-inline'

export interface CsatPassageLengthStats { min: number; average: number; max: number }
export interface CsatPassageLengthRange { min: number; max: number }

export const CSAT_PASSAGE_LENGTH_STATS: Record<CsatNumberTemplateId, CsatPassageLengthStats> = {
  '18': { min: 100, average: 110.6, max: 122 }, '19': { min: 105, average: 122.5, max: 135 },
  '20': { min: 123, average: 138.9, max: 169 }, '21': { min: 145, average: 160.4, max: 187 },
  '22': { min: 145, average: 160.5, max: 177 }, '23': { min: 143, average: 158.2, max: 180 },
  '24': { min: 140, average: 164.5, max: 186 }, '25': { min: 113, average: 136.3, max: 171 },
  '26': { min: 125, average: 140.4, max: 153 }, '27': { min: 77, average: 96, max: 108 },
  '28': { min: 86, average: 93.4, max: 117 }, '29': { min: 149, average: 157.4, max: 169 },
  '30': { min: 157, average: 177.1, max: 203 }, '31': { min: 145, average: 162.1, max: 172 },
  '32': { min: 131, average: 153.9, max: 171 }, '33': { min: 126, average: 156.1, max: 179 },
  '34': { min: 147, average: 163.3, max: 178 }, '35': { min: 150, average: 164.8, max: 182 },
  '36': { min: 145, average: 163.5, max: 179 }, '37': { min: 139, average: 164.8, max: 179 },
  '38': { min: 131, average: 169.6, max: 185 }, '39': { min: 155, average: 171, max: 193 },
  '40': { min: 150, average: 163.5, max: 175 }, '41-42': { min: 216, average: 237.5, max: 278 },
  '43-45': { min: 321, average: 347.1, max: 381 },
}

export const CSAT_PASSAGE_LENGTH_LABELS: Record<CsatPassageLengthPreset, string> = { short: '짧음', medium: '중간', long: '김' }

export function getCsatPassageLengthRange(templateId: CsatNumberTemplateId, preset: CsatPassageLengthPreset = 'medium'): CsatPassageLengthRange {
  const stats = CSAT_PASSAGE_LENGTH_STATS[templateId]
  const shortMax = Math.floor((stats.min + stats.average) / 2)
  const longMin = Math.ceil((stats.average + stats.max) / 2)
  if (preset === 'short') return { min: stats.min, max: shortMax }
  if (preset === 'long') return { min: longMin, max: stats.max }
  return { min: shortMax + 1, max: longMin - 1 }
}

export function normalizeCsatPassageLength(value?: CsatPassageLengthPreset): CsatPassageLengthPreset {
  return value === 'short' || value === 'long' ? value : 'medium'
}

export function csatQualityRulesForTemplate(templateId: CsatNumberTemplateId) {
  const rules = [
    '자연스러운 학술 영어를 사용하고, 난도를 올리기 위한 불필요한 희귀어는 피한다.',
    '다섯 선지의 길이·문법 구조·추상도를 균형 있게 맞추고 정답만 두드러지게 만들지 않는다.',
    '정답은 지문의 핵심 표현을 그대로 이어 붙이지 말고 동의어·상위 개념·관계 재진술로 만든다.',
  ]
  if (['20', '21', '22', '23', '24', '31', '32', '33', '34', '40'].includes(templateId)) {
    rules.push('핵심 표현의 단순 재현이나 키워드 대응만으로 풀리지 않게 하고 글 전체의 관계를 종합하게 한다.')
  }
  if (['31', '32', '33', '34'].includes(templateId)) {
    rules.push('빈칸은 전체 논리와 후반부 일반화를 종합해야 하며, 부분 일치·인과 왜곡·범위 왜곡·관계 역전·부차 내용 핵심화 오답을 섞는다.')
  }
  if (['18', '19', '26'].includes(templateId)) {
    rules.push('오답에도 실제 단서를 일부 포함하되 목적·감정 변화 방향·사실 하나를 정교하게 어긋나게 한다.')
  }
  if (['25', '27', '28'].includes(templateId)) {
    rules.push('수치·조건·대상·예외 중 하나만 정교하게 왜곡하고 상식만으로 제거되는 오답은 피한다.')
  }
  if (['29', '30'].includes(templateId)) {
    rules.push('다섯 표적의 난도를 균형화하고 정확히 하나만 명백히 틀리게 하며 표적 위치가 정답 단서가 되지 않게 한다.')
  }
  if (['35', '36', '37', '38', '39'].includes(templateId)) {
    rules.push('최소 두 위치·배열이 처음에는 그럴듯하되 양방향 결속과 글 전체 논리로 정답 하나만 남게 한다.')
  }
  if (templateId === '41-42' || templateId === '43-45') {
    rules.push('공유 지문의 하위 문항별 근거가 서로 충돌하지 않도록 각 문항을 독립적으로 다시 검수한다.')
  }
  return rules
}

export const CSAT_QUALITY_REVIEW_INSTRUCTIONS = `qualityReview는 다음 구조로 반환한다.
- passage: naturalness, logicStructure, vocabularyLevel, templateFidelity를 각각 0~10점으로 기록한다.
- questions: 각 고정 문항마다 slot, answerInference, distractorPlausibility, choiceBalance(각 0~10), directAnswerOverlap(boolean), strongestDistractorIndex(1~5), decisiveReason, expectedDifficulty(1~5)를 기록한다.
- 어느 점수든 8점 미만이면 전체 결과를 한 차례 수정한 뒤 다시 평가한다.
- answerInference, distractorPlausibility, templateFidelity는 9점 이상을 목표로 한다.
- strongestDistractorIndex는 정답 번호와 달라야 하며 decisiveReason에는 그 오답과 정답을 가르는 결정적 지문 근거를 적는다.`

export const CSAT_GPT_APPROVAL_PROTOCOL = `[대화 및 승인 절차]
1. 앱의 제작 프롬프트를 처음 받은 첫 응답에서는 지문·문항·선지·JSON을 바로 만들지 않는다.
2. 먼저 한국어로 [세트 제작 설계안]을 제시한다. 세트 공통 요약 뒤에 카드별로 카드 번호, itemId, 번호 템플릿, 주제·소재, 지문 장르, 논리 전개, 목표 단어 수, 난도·배점, 정답 추론 구조, 오답 설계, 필수 표식·구획을 적고 마지막에 전체 정답 번호 분산 계획을 적는다.
3. 필수 정보가 부족하면 누락된 항목만 질문한 뒤 전체 설계안을 제시한다.
4. 사용자가 수정을 요청하면 변경 내용을 반영한 전체 설계안을 다시 제시한다. 이 단계에서도 JSON을 출력하지 않는다.
5. 설계안의 마지막 문장은 반드시 “이 설계로 JSON을 생성할까요? 수정할 카드가 있으면 카드 번호와 변경 사항을 알려주세요.”로 끝낸다.
6. 사용자가 “승인”, “이대로 진행”, “JSON 생성”처럼 전체 설계를 명시적으로 승인한 뒤에만 최종 문항을 만든다.
7. 승인 뒤의 응답은 설명·머리말·마크다운 코드 블록 없이 유효한 최종 JSON 객체 하나만 출력한다.
8. 재검토 프롬프트는 이미 생성된 결과의 수정 요청이므로 별도의 설계 승인 없이 수정된 JSON 하나만 반환한다.`

function materialSpecText(spec?: CsatMaterialSpec) {
  if (!spec || spec.kind === 'chart') return ''
  if (spec.kind === 'prose' || spec.kind === 'longExpository') return spec.paragraphs.join(' ')
  if (spec.kind === 'practical') return [spec.heading, ...Object.entries(spec.fields).flatMap(([key, value]) => [key, value]), ...spec.notes].join(' ')
  if (spec.kind === 'ordered') return [spec.lead, ...spec.sections.map((section) => section.text)].join(' ')
  if (spec.kind === 'insertion') return `${spec.givenSentence} ${spec.body}`
  if (spec.kind === 'summary') return spec.summary
  return spec.sections.map((section) => section.text).join(' ')
}

export function csatPrintableMaterialText(material: string, spec?: CsatMaterialSpec) {
  const source = spec && spec.kind !== 'chart' ? materialSpecText(spec) : material
  return source
    .replace(/\[\[밑줄:([^\]]+)\]\]/g, '$1')
    .replace(/\[\[삽입문장:([^\]]+)\]\]/g, '$1')
    .replace(/\[\[선택:[^|]+\|([^|]+)\|([^\]]+)\]\]/g, '$1 $2')
    .replace(/\[\[(?:빈칸|요약빈칸)(?::[^\]]+)?\]\]/g, '')
    .replace(/\[\[삽입위치:[^\]]+\]\]/g, '')
    .replace(/\s+/g, ' ').trim()
}

export function countCsatPassageWords(material: string, spec?: CsatMaterialSpec, embeddedChoices?: readonly string[]) {
  const printable = csatPrintableMaterialText(material, spec)
  const text = embeddedChoices ? embedCsatChartChoices(printable, embeddedChoices) : printable
  return text.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g)?.length ?? 0
}

const CONTINUOUS_STRUCTURED_PROSE_TEMPLATE_IDS = new Set<CsatNumberTemplateId>([
  '18', '19', '20', '21', '22', '23', '24', '25', '26', '27', '28', '29', '30', '31', '32', '33', '34', '35', '41-42',
])

const PASSAGE_LINE_BREAKS = /\s*(?:\r\n|\r|\n|\u2028|\u2029)+\s*/g

export function normalizeEnglishPassage(text: string) {
  return text.replace(PASSAGE_LINE_BREAKS, ' ').replace(/[ \t]+/g, ' ').trim()
}

/** 25번 도표형의 다섯 진술을 실제 시험지처럼 도표 설명문 안에 이어 붙인다. */
export function embedCsatChartChoices(material: string, choices: readonly string[]) {
  const passage = normalizeEnglishPassage(material)
  if (CSAT_INLINE_POSITION_CHOICES.every((marker) => passage.includes(marker))) return passage
  const statements = choices.slice(0, 5).map((choice, index) => {
    const text = normalizeEnglishPassage(choice).replace(/^\s*(?:[①②③④⑤]|[1-5][.)])\s*/, '')
    return text ? `${CSAT_INLINE_POSITION_CHOICES[index]} ${text}` : ''
  }).filter(Boolean)
  return [passage, ...statements].filter(Boolean).join(' ')
}

export interface CsatSummaryPresentation {
  passage: string
  summary: string
}

const SUMMARY_BLANK_MARKER = /\[\[요약빈칸(?::[^\]]+)?\]\]/

function embeddedSummaryStart(text: string) {
  const paragraphs = text
    .replace(/\r\n|\r|\u2028|\u2029/g, '\n')
    .split(/\n[ \t]*\n+/)
  const summaryParagraphIndex = paragraphs.findIndex((paragraph) => SUMMARY_BLANK_MARKER.test(paragraph))
  if (summaryParagraphIndex > 0) return paragraphs.slice(0, summaryParagraphIndex).join('\n\n').length + 2

  const markerIndex = text.search(SUMMARY_BLANK_MARKER)
  if (markerIndex < 0) return -1
  let sentenceStart = 0
  const sentenceBoundary = /[.!?](?:["'\u2019\u201d)]*)\s+/g
  for (const match of text.slice(0, markerIndex).matchAll(sentenceBoundary)) sentenceStart = (match.index ?? 0) + match[0].length
  return sentenceStart > 0 ? sentenceStart : -1
}

export function splitCsatSummaryMaterial(material: string, spec?: CsatMaterialSpec): CsatSummaryPresentation {
  const source = material.trim()
  const start = embeddedSummaryStart(source)
  const embeddedPassage = start >= 0 ? source.slice(0, start) : source
  const embeddedSummary = start >= 0 ? source.slice(start) : ''
  return {
    passage: normalizeEnglishPassage(embeddedPassage),
    summary: normalizeEnglishPassage(spec?.kind === 'summary' ? spec.summary : embeddedSummary),
  }
}

function restoreSectionBoundaries(text: string, labels: string[]) {
  const labelPattern = labels.map((label) => `\\(${label}\\)`).join('|')
  return normalizeEnglishPassage(text).replace(new RegExp(`\\s*(${labelPattern})\\s*`, 'g'), '\n\n$1 ').trim()
}

export function normalizePassageForPresentation(text: string, templateId?: CsatNumberTemplateId) {
  if (templateId === '36' || templateId === '37') return restoreSectionBoundaries(text, ['A', 'B', 'C'])
  if (templateId === '43-45') return restoreSectionBoundaries(text, ['A', 'B', 'C', 'D'])
  return normalizeEnglishPassage(text)
}

export interface CsatLongNarrativeSection {
  label: 'A' | 'B' | 'C' | 'D'
  text: string
}

export function csatLongExpositoryText(material: string, spec?: CsatMaterialSpec) {
  if (spec?.kind === 'longExpository' || spec?.kind === 'prose') return normalizeEnglishPassage(spec.paragraphs.join(' '))
  return normalizeEnglishPassage(material)
}

export function csatLongNarrativeSections(material: string, spec?: CsatMaterialSpec): CsatLongNarrativeSection[] {
  if (spec?.kind === 'longNarrative') return spec.sections.map((section) => ({ ...section, text: normalizeEnglishPassage(section.text) }))
  const source = normalizeEnglishPassage(material)
  const matches = [...source.matchAll(/(?:^|\s)\(([A-D])\)\s+/g)]
  return matches.map((match, index) => ({
    label: match[1] as CsatLongNarrativeSection['label'],
    text: normalizeEnglishPassage(source.slice((match.index ?? 0) + match[0].length, matches[index + 1]?.index ?? source.length)),
  }))
}

export function hasUnnecessaryPassageBreaks(text: string, templateId?: CsatNumberTemplateId) {
  if (templateId === '40') {
    const start = embeddedSummaryStart(text)
    if (start < 0) return /[\r\n\u2028\u2029]/.test(text)
    const passage = text.slice(0, start).trim()
    const summary = text.slice(start).trim()
    return /[\r\n\u2028\u2029]/.test(passage) || /[\r\n\u2028\u2029]/.test(summary)
  }
  let comparable = text
  if (templateId === '36' || templateId === '37') comparable = comparable.replace(/\s*\([ABC]\)\s*/g, '')
  if (templateId === '43-45') comparable = comparable.replace(/\s*\([ABCD]\)\s*/g, '')
  if (templateId === '38' || templateId === '39') comparable = comparable.replace(/\s*\[\[삽입문장:[^\]]+\]\]\s*/g, '')
  return /[\r\n\u2028\u2029]/.test(comparable)
}

export const usesContinuousCsatProse = (templateId?: CsatNumberTemplateId) => Boolean(templateId && CONTINUOUS_STRUCTURED_PROSE_TEMPLATE_IDS.has(templateId))

export function collapseCsatProseParagraphs(text: string, templateId?: CsatNumberTemplateId) {
  return normalizePassageForPresentation(text, templateId)
}

export function decorateCsatMaterialText(text: string, templateId?: CsatNumberTemplateId, variantId: CsatVariantId = 'standard') {
  if (variantId !== 'standard') return text
  if (templateId === '41-42') {
    let underlineIndex = 0
    return text.replace(/\[\[밑줄:([^\]]+)\]\]/g, (marker, _target, offset: number, source: string) => {
      const label = String.fromCharCode(97 + underlineIndex)
      underlineIndex += 1
      return new RegExp(`\\(${label}\\)\\s*$`).test(source.slice(Math.max(0, offset - 8), offset)) ? marker : `(${label}) ${marker}`
    })
  }
  if (templateId === '43-45') return text.replace(/\(([a-e])\)\s+(?!\[\[밑줄:)([A-Za-z][A-Za-z'-]*)/g, '($1) [[밑줄:$2]]')
  return text
}

const field = (key: string, label: string, placeholder: string, multiline = false) => ({ key, label, placeholder, multiline })
const topicFields = [
  field('centralIdea', '중심 명제', '글 전체가 전달할 한 문장'),
  field('development', '전개 방식', '예: 문제 제기 → 대조 → 결론'),
]
const proseSteps = ['핵심 개념 또는 상황 제시', '설명·대조·예시로 논지 전개', '주제와 연결되는 결론 또는 함의']

const question = (slot: string, type: string, stem: string, score: number, choiceStyle: CsatChoiceStyle): CsatQuestionBlueprint => ({ slot, type, stem, score, choiceStyle })

export const CSAT_TEMPLATES: CsatTemplateDefinition[] = [
  {
    id: '18', familyId: 'purpose', numberLabel: '18번형', label: '글의 목적', difficultyRange: [1, 1], defaultDifficulty: 1,
    choiceStyle: 'korean', passageGenre: '편지·이메일·공지성 메시지', passageBlueprint: '인사와 배경 → 구체적 상황 → 요청·희망·안내 → 맺음말',
    structureSteps: ['발신자와 수신자의 관계 제시', '중후반부에 want·hope·wish·ask·would 등의 목적 단서 배치', '앞뒤 맥락으로 목적을 한 가지로 확정'],
    inputFields: [field('sender', '발신자', '예: 지역 도서관 프로그램 담당자'), field('recipient', '수신자', '예: 참가 신청자'), field('situation', '상황', '글을 쓰게 된 배경', true), field('requestedAction', '원하는 행동', '수신자가 해 주기를 바라는 일')],
    questions: [question('18', '목적', '다음 글의 목적으로 가장 적절한 것은?', 2, 'korean')], requiredMarkers: [],
  },
  {
    id: '19', familyId: 'emotion', numberLabel: '19번형', label: '심경 변화', difficultyRange: [1, 1], defaultDifficulty: 1,
    choiceStyle: 'emotion-pair', passageGenre: '짧은 서사', passageBlueprint: '초기 상황과 감정 → 사건·발견 → 해석의 전환 → 최종 감정',
    structureSteps: ['주인공을 명확히 지정', '전환 전후 감정을 행동·생각으로 각각 뒷받침', '긍정→부정과 부정→긍정을 모두 허용'],
    inputFields: [field('character', '중심 인물', '예: Mina'), field('initialEmotion', '초기 감정', '예: anxious'), field('turningEvent', '전환 사건', '감정을 바꾸는 사건', true), field('finalEmotion', '최종 감정', '예: relieved')],
    questions: [question('19', '심경 및 분위기', '다음 글에 드러난 인물의 심경 변화로 가장 적절한 것은?', 2, 'emotion-pair')], requiredMarkers: [],
  },
  {
    id: '20', familyId: 'claim', numberLabel: '20번형', label: '필자의 주장', difficultyRange: [1, 3], defaultDifficulty: 2,
    choiceStyle: 'korean', passageGenre: '논설·설명문', passageBlueprint: '현상 또는 문제 → 근거·사례 → 필요성·당위성을 담은 주장',
    structureSteps: proseSteps, inputFields: [field('issue', '논쟁 주제', '예: 학교 공간의 공동 활용'), field('stance', '필자 입장', '필자가 지지하거나 반대하는 입장'), field('recommendation', '권고·필요성', 'should·must로 표현할 핵심 행동')],
    questions: [question('20', '주장', '다음 글에서 필자가 주장하는 바로 가장 적절한 것은?', 2, 'korean')], requiredMarkers: [],
  },
  {
    id: '21', familyId: 'implication', numberLabel: '21번형', label: '함축 의미', difficultyRange: [2, 5], defaultDifficulty: 3,
    choiceStyle: 'english', passageGenre: '추상적 설명·논설문', passageBlueprint: '개념 설명 → 비유적 표현 → 문맥상 의미를 풀어 주는 근거',
    structureSteps: ['비유·속담·반어가 가능한 핵심 표현 한 곳을 선정', '표면 의미와 문맥 의미를 구분', '선지는 비유가 아닌 명시적 영어 진술로 작성'],
    inputFields: [field('underlinedExpression', '밑줄 표현', '예: only the visible tip'), field('literalMeaning', '표면 의미', '문자 그대로의 뜻'), field('contextualMeaning', '문맥상 의미', '지문에서 실제로 뜻하는 바', true), field('inferenceDistance', '추론 거리', '예: 앞부분의 사례와 결론을 함께 연결')],
    questions: [question('21', '함축 의미', '밑줄 친 부분이 다음 글에서 의미하는 바로 가장 적절한 것은?', 3, 'english')], requiredMarkers: ['[[밑줄:...]]'],
  },
  {
    id: '22', familyId: 'gist', numberLabel: '22번형', label: '글의 요지', difficultyRange: [1, 3], defaultDifficulty: 2,
    choiceStyle: 'korean', passageGenre: '설명·논설문', passageBlueprint: '핵심 논지 → 보충 설명 → 전체 메시지의 재확인',
    structureSteps: proseSteps, inputFields: topicFields,
    questions: [question('22', '요지', '다음 글의 요지로 가장 적절한 것은?', 2, 'korean')], requiredMarkers: [],
  },
  {
    id: '23', familyId: 'topic', numberLabel: '23번형', label: '글의 주제', difficultyRange: [2, 5], defaultDifficulty: 3,
    choiceStyle: 'english', passageGenre: '설명문', passageBlueprint: '중심 개념의 범위 설정 → 여러 측면 설명 → 관점 통합',
    structureSteps: proseSteps, inputFields: [...topicFields, field('scope', '주제 범위', '너무 넓거나 좁지 않은 대상 범위')],
    questions: [question('23', '주제', '다음 글의 주제로 가장 적절한 것은?', 2, 'english')], requiredMarkers: [],
  },
  {
    id: '24', familyId: 'title', numberLabel: '24번형', label: '글의 제목', difficultyRange: [2, 5], defaultDifficulty: 3,
    choiceStyle: 'english', passageGenre: '설명·논설문', passageBlueprint: '핵심 개념과 긴장 관계 제시 → 논지 확장 → 제목이 포괄할 결론',
    structureSteps: proseSteps, inputFields: [...topicFields, field('titleTone', '제목 문체', '직설형·질문형·비유형·콜론형을 혼합')],
    questions: [question('24', '제목', '다음 글의 제목으로 가장 적절한 것은?', 3, 'english')], requiredMarkers: [],
  },
  {
    id: '25', familyId: 'chart-practical', numberLabel: '25번형', label: '도표 이해', difficultyRange: [1, 2], defaultDifficulty: 1,
    choiceStyle: 'english', passageGenre: '도표와 번호 진술이 결합된 영어 설명문', passageBlueprint: '도표 제목·단위·범주·계열 → 영어 도입부 → ①~⑤ 영어 진술을 한 문단으로 연결',
    structureSteps: ['모든 수치의 단위와 기준 시점 통일', '도표 아래 도입부와 다섯 영어 진술을 하나의 문단으로 구성', '다섯 진술이 서로 다른 비교 관계를 다루며 정확히 하나만 수치와 불일치'],
    inputFields: [field('chartTopic', '도표 주제', '예: 연령대별 주간 독서 시간'), field('unit', '단위', '예: percent, hours'), field('categories', '범주', '쉼표로 구분'), field('values', '수치 자료', '계열별 실제 수치', true)],
    questions: [question('25', '도표 및 실용문', '다음 도표의 내용과 일치하지 않는 것은?', 2, 'english')], requiredMarkers: [],
  },
  {
    id: '26', familyId: 'content-detail', numberLabel: '26번형', label: '내용 불일치', difficultyRange: [1, 1], defaultDifficulty: 1,
    choiceStyle: 'korean', passageGenre: '전기·대상 정보문', passageBlueprint: '대상 소개 → 시기·장소·활동 → 업적·특징',
    structureSteps: ['인물·동물·지역 중 하나를 중심 대상으로 설정', '검증 가능한 사실 5~8개를 시간·장소와 연결', '한 선지만 사실 하나를 분명하게 왜곡'],
    inputFields: [field('subject', '중심 대상', '예: 가상의 생태 연구자'), field('facts', '사실 목록', '연도·장소·활동·업적을 한 줄에 하나', true), field('mismatchTarget', '왜곡할 사실', '오답 선지에서 바꿀 사실')],
    questions: [question('26', '내용 일치 및 불일치', '대상에 관한 다음 글의 내용과 일치하지 않는 것은?', 2, 'korean')], requiredMarkers: [],
  },
  {
    id: '27', familyId: 'chart-practical', numberLabel: '27번형', label: '실용문 불일치', difficultyRange: [1, 1], defaultDifficulty: 1,
    choiceStyle: 'korean', passageGenre: '행사·서비스 안내문', passageBlueprint: '제목 → 일정·장소·대상 → 비용·신청 → 예외·주의사항',
    structureSteps: ['항목 제목과 값을 짧고 탐색 가능하게 배치', '조건과 예외를 명확히 구분', '다섯 선지 중 하나만 불일치'],
    inputFields: [field('eventName', '행사·서비스명', '예: Weekend Science Camp'), field('schedule', '일정·장소', '날짜, 시간, 장소'), field('eligibility', '대상·신청', '참가 대상과 신청 방식'), field('feesAndExceptions', '비용·예외 조건', '비용, 제공 사항, 제한', true)],
    questions: [question('27', '도표 및 실용문', '다음 안내문의 내용과 일치하지 않는 것은?', 2, 'korean')], requiredMarkers: [],
  },
  {
    id: '28', familyId: 'chart-practical', numberLabel: '28번형', label: '실용문 일치', difficultyRange: [1, 1], defaultDifficulty: 1,
    choiceStyle: 'korean', passageGenre: '행사·상품 안내문', passageBlueprint: '제목 → 핵심 일정 → 활동·혜택 → 구매·신청 조건',
    structureSteps: ['발문의 일치 극성을 명시', '네 선지는 안내문과 충돌', '한 선지만 모든 조건과 일치'],
    inputFields: [field('eventName', '행사·상품명', '예: Museum Night Tour'), field('schedule', '일정·장소', '날짜, 시간, 장소'), field('program', '활동·혜택', '제공되는 활동과 혜택'), field('registration', '신청·구매 조건', '비용과 제한 사항', true)],
    questions: [question('28', '도표 및 실용문', '다음 안내문의 내용과 일치하는 것은?', 2, 'korean')], requiredMarkers: [],
  },
  {
    id: '29', familyId: 'grammar', numberLabel: '29번형', label: '어법성 판단', difficultyRange: [1, 5], defaultDifficulty: 3,
    choiceStyle: 'english', passageGenre: '일관된 설명문', passageBlueprint: '자연스러운 논지 속 서로 다른 어법 표적 다섯 개',
    structureSteps: ['수일치·동사/준동사·능수동·대명사·관계사 등을 분산', '표적 다섯 개 중 하나만 명백한 오류', '문장 구조와 문맥을 함께 보아야 오류가 확정되게 설계'],
    inputFields: [field('grammarTargets', '어법 항목 5개', '예: 수일치, 준동사, 능수동, 재귀대명사, 관계사', true), field('errorTarget', '정답 어법 항목', '실제로 틀리게 만들 항목'), field('trapDesign', '함정 설계', '삽입구·긴 수식어 등 판단 방해 요소')],
    questions: [question('29', '어법', '다음 글의 밑줄 친 부분 중, 어법상 틀린 것은?', 3, 'english')], requiredMarkers: ['[[밑줄:...]] × 5'],
  },
  {
    id: '30', familyId: 'vocabulary', numberLabel: '30번형', label: '어휘 적절성', difficultyRange: [2, 5], defaultDifficulty: 3,
    choiceStyle: 'english', passageGenre: '논리적 설명문', passageBlueprint: '주제 흐름과 대조·인과 관계 속 표적 어휘 다섯 개',
    structureSteps: ['표적 어휘의 뜻을 문맥으로 판별 가능하게 구성', '한 단어만 필요한 의미의 반대 또는 논리적 모순', '미세한 뉘앙스만으로 정답을 만들지 않음'],
    inputFields: [field('targetWords', '표적 어휘', '사용할 어휘 후보와 의미 관계', true), field('semanticContrast', '문맥 대립', '예: increase ↔ decrease'), field('reversalPoint', '역접·반전 위치', '정답 판단에 중요한 논리 전환')],
    questions: [question('30', '어휘', '다음 글의 밑줄 친 부분 중, 문맥상 낱말의 쓰임이 적절하지 않은 것은?', 2, 'english')], requiredMarkers: ['[[밑줄:...]] × 5'],
    variants: [{ id: 'vocabulary-box', label: '고급 변형 · (A)(B)(C) 박스형', description: '세 위치에서 두 어휘 중 문맥에 맞는 말을 선택합니다.' }],
  },
  ...(['31', '32', '33', '34'] as const).map((id): CsatTemplateDefinition => {
    const data = {
      '31': { range: [2, 5] as [number, number], difficulty: 3, answer: '한 단어', score: 2, blueprint: '중심 개념을 함축하는 핵심 단어 하나를 빈칸으로 처리' },
      '32': { range: [2, 5] as [number, number], difficulty: 3, answer: '짧은 구·절', score: 2, blueprint: '핵심 관계나 일반화를 완성하는 구·절을 빈칸으로 처리' },
      '33': { range: [3, 5] as [number, number], difficulty: 5, answer: '구·문장', score: 3, blueprint: '추상적 주제에서 멀리 떨어진 근거를 종합해야 하는 고난도 빈칸' },
      '34': { range: [3, 5] as [number, number], difficulty: 5, answer: '절·문장', score: 3, blueprint: '글 전체 논리를 압축하는 긴 절 또는 문장을 빈칸으로 처리' },
    }[id]
    return {
      id, familyId: 'blank', numberLabel: `${id}번형`, label: `빈칸 추론 · ${data.answer}`, difficultyRange: data.range, defaultDifficulty: data.difficulty,
      choiceStyle: 'english', passageGenre: '추상적 설명·논설문', passageBlueprint: data.blueprint,
      structureSteps: ['빈칸 포함 문장을 글의 중심 논지와 연결', '글의 여러 논리 단계 역할을 종합해야 정답이 결정되게 구성', '오답은 논지 일부만 맞거나 범위·방향이 어긋나게 작성'],
      inputFields: [field('blankFunction', '빈칸의 담화 기능', '주제·결론·원인·대조·일반화'), field('answerGranularity', '정답 길이', data.answer), field('reasoningDistance', '추론 거리', '근거가 글의 어느 부분에 분산되는지'), field('abstractness', '추상도', '사용할 개념과 비유', true)],
      questions: [question(id, '빈칸 추론', '다음 빈칸에 들어갈 말로 가장 적절한 것은?', data.score, 'english')], requiredMarkers: ['[[빈칸]] × 1'],
    }
  }),
  {
    id: '35', familyId: 'irrelevant', numberLabel: '35번형', label: '무관한 문장', difficultyRange: [1, 4], defaultDifficulty: 2,
    choiceStyle: 'position', passageGenre: '번호 문장이 포함된 설명문', passageBlueprint: '도입 → ①~⑤ 번호 문장 → 마무리, 한 문장만 전체 흐름에서 이탈',
    structureSteps: ['중심 흐름과 문장별 역할을 먼저 설계', '이탈 문장은 표면 어휘는 비슷하되 논리·소재가 다르게 작성', '제거 후 앞뒤 문장이 자연스럽게 연결'],
    inputFields: [field('mainFlow', '중심 흐름', '글의 주제와 논리 흐름', true), field('sentenceRoles', '문장별 역할', '도입·근거·예시·확장·결론'), field('intrusionType', '이탈 방식', '소재 이탈·논리 역행·관점 불일치')],
    questions: [question('35', '무관한 문장', '다음 글에서 전체 흐름과 관계 없는 문장은?', 2, 'position')], requiredMarkers: ['①~⑤ 번호 문장'],
  },
  ...(['36', '37'] as const).map((id): CsatTemplateDefinition => ({
    id, familyId: 'order', numberLabel: `${id}번형`, label: `글의 순서 ${id === '36' ? '기본' : '고난도'}`, difficultyRange: id === '36' ? [2, 5] : [3, 5], defaultDifficulty: id === '36' ? 3 : 4,
    choiceStyle: 'order', passageGenre: '도입문과 A·B·C 세 단락', passageBlueprint: id === '36' ? '도입문 → 명시적 결속 단서를 지닌 A·B·C' : '도입문 → 개념·인과·지시 관계로 연결되는 A·B·C',
    structureSteps: ['주어진 도입문은 반드시 먼저 읽어야 하는 배경 제공', '각 단락의 첫 문장과 끝 문장 사이에 결속 단서 배치', '모든 여섯 순서를 검토하고 특정 정답 배열을 배제하지 않음'],
    inputFields: [field('leadRole', '도입문의 역할', '핵심 개념 또는 상황 소개'), field('sectionRoles', 'A·B·C의 역할', '각 단락의 기능을 한 줄에 하나', true), field('cohesionClues', '결속 단서', '지시어·반복 개념·인과·예시 관계')],
    questions: [question(id, '글의 순서', '주어진 글 다음에 이어질 글의 순서로 가장 적절한 것은?', id === '36' ? 2 : 3, 'order')], requiredMarkers: ['(A)', '(B)', '(C)'],
  })),
  ...(['38', '39'] as const).map((id): CsatTemplateDefinition => ({
    id, familyId: 'insertion', numberLabel: `${id}번형`, label: `문장 삽입 ${id === '38' ? '기본' : '고난도'}`, difficultyRange: id === '38' ? [2, 5] : [3, 5], defaultDifficulty: id === '38' ? 3 : 4,
    choiceStyle: 'position', passageGenre: '주어진 문장과 다섯 삽입 위치', passageBlueprint: id === '38' ? '명시적 결속 단서가 있는 삽입문과 본문' : '간접 지시·의미 관계를 추적해야 하는 긴 본문',
    structureSteps: ['삽입문의 담화 기능을 먼저 결정', '정답 위치의 앞뒤 문장 모두와 결속', '오답 위치도 한쪽만 보면 그럴듯하지만 양쪽 연결에서 탈락'],
    inputFields: [field('sentenceRole', '삽입문의 역할', '예시·대조·결론·정의·전환'), field('previousClue', '선행 단서', '삽입문 앞에서 이어받는 정보'), field('followingClue', '후행 단서', '삽입문 뒤로 넘겨주는 정보'), field('cohesionDevices', '결속 장치', '지시어·반복어·논리 관계')],
    questions: [question(id, '문장 삽입', '글의 흐름으로 보아, 주어진 문장이 들어가기에 가장 적절한 곳은?', id === '38' ? 2 : 3, 'position')], requiredMarkers: ['[[삽입문장:...]]', '[[삽입위치:①]]~[[삽입위치:⑤]]'],
  })),
  {
    id: '40', familyId: 'summary', numberLabel: '40번형', label: '요약문 완성', difficultyRange: [2, 5], defaultDifficulty: 3,
    choiceStyle: 'word-pair', passageGenre: '설명문과 별도 요약 상자', passageBlueprint: '원문 → 핵심 관계를 재진술한 요약문 → (A)·(B) 단어쌍',
    structureSteps: ['원문의 핵심 관계 두 축을 선정', '요약문은 원문 표현을 그대로 복사하지 않고 동의 표현 사용', 'A·B의 유의·반의 관계로 정답을 하나로 확정'],
    inputFields: [field('sourceRelation', '원문의 핵심 관계', '예: 통제가 자율성을 낮춘다'), field('summaryA', '요약 개념 A', '첫 번째 빈칸의 의미'), field('summaryB', '요약 개념 B', '두 번째 빈칸의 의미')],
    questions: [question('40', '요약문 완성', '다음 글의 내용을 한 문장으로 요약하고자 한다. 빈칸 (A)와 (B)에 들어갈 말로 가장 적절한 것은?', 3, 'word-pair')], requiredMarkers: ['[[요약빈칸:A]]', '[[요약빈칸:B]]'],
  },
  {
    id: '41-42', familyId: 'long-reading', numberLabel: '41~42번형', label: '장문 설명문', difficultyRange: [2, 4], defaultDifficulty: 3,
    choiceStyle: 'english', passageGenre: '긴 학술·교양 설명문', passageBlueprint: '하나의 긴 설명문을 공유하는 제목 문항과 문맥상 어휘 문항',
    structureSteps: ['3~5개 논리 단계로 중심 논지를 점진적으로 전개하되 출력은 한 문단으로 유지', '제목은 전체를 포괄하고 어휘 표적은 다섯 곳에 분산', '두 문항의 정답 근거가 서로 독립적이면서 같은 논지를 공유'],
    inputFields: [field('longTopic', '장문 주제', '학술·교양 분야의 중심 개념'), field('paragraphPlan', '논리 단계별 계획', '각 전개 단계의 역할을 한 줄에 하나', true), field('vocabularyTargets', '표적 어휘 5개', '문맥 판단용 어휘 후보')],
    questions: [question('41', '제목', '윗글의 제목으로 가장 적절한 것은?', 2, 'english'), question('42', '어휘', '밑줄 친 (a)~(e) 중에서 문맥상 낱말의 쓰임이 적절하지 않은 것은?', 2, 'position')], requiredMarkers: ['[[밑줄:...]] × 5'],
    variants: [
      { id: 'long-order-content', label: '고급 변형 · 순서+내용', description: '장문을 순서 배열과 내용 확인 문항으로 구성합니다.' },
      { id: 'long-implication-blank', label: '고급 변형 · 함의+빈칸', description: '장문을 함의 추론과 빈칸 추론 문항으로 구성합니다.' },
    ],
  },
  {
    id: '43-45', familyId: 'long-reading', numberLabel: '43~45번형', label: '복합 장문 서사', difficultyRange: [1, 3], defaultDifficulty: 2,
    choiceStyle: 'order', passageGenre: 'A~D 네 부분의 짧은 서사', passageBlueprint: '교훈적 사건을 A~D로 분할하고 순서·지칭·내용 불일치 세 문항 공유',
    structureSteps: ['등장인물과 사건 인과를 먼저 확정', 'A는 고정 도입부이고 B·C·D가 시간 순서 단서를 가짐', '(a)~(e) 중 하나만 다른 대상을 가리키며 사실 선지는 사건과 일치'],
    inputFields: [field('characters', '인물 관계', '인물 이름과 관계를 한 줄에 하나', true), field('setting', '배경·갈등', '시간, 장소, 중심 갈등'), field('events', '사건 목록', '실제 시간 순서대로 한 줄에 하나', true), field('referentMap', '지칭 대상', '(a)~(e)가 가리킬 인물')],
    questions: [question('43', '글의 순서', '주어진 글 (A)에 이어질 내용을 순서에 맞게 배열한 것으로 가장 적절한 것은?', 2, 'order'), question('44', '지칭 추론', '밑줄 친 (a)~(e) 중에서 가리키는 대상이 나머지 넷과 다른 하나는?', 2, 'position'), question('45', '내용 일치 및 불일치', '윗글에 관한 내용으로 적절하지 않은 것은?', 2, 'korean')], requiredMarkers: ['(A)', '(B)', '(C)', '(D)', '(a) [[밑줄:지칭어]] ... (e) [[밑줄:지칭어]]'],
    variants: [{ id: 'narrative-emotion-implication-blank', label: '고급 변형 · 심경+함의+빈칸', description: '복합 서사의 세 문항을 심경·함의·빈칸 추론으로 구성합니다.' }],
  },
]

// 기존 5단계 기출 난도 카탈로그를 사용자용 8단계 체계로 변환한다.
CSAT_TEMPLATES.forEach((template) => {
  template.difficultyRange = [legacyCsatDifficultyToEight(template.difficultyRange[0]), legacyCsatDifficultyToEight(template.difficultyRange[1])]
  template.defaultDifficulty = legacyCsatDifficultyToEight(template.defaultDifficulty)
})

const TEMPLATE_MAP = new Map(CSAT_TEMPLATES.map((template) => [template.id, template]))

export const getCsatTemplate = (id: CsatNumberTemplateId) => TEMPLATE_MAP.get(id) ?? CSAT_TEMPLATES[0]
export const templatesForCsatFamily = (familyId: CsatQuestionFamilyId) => CSAT_TEMPLATES.filter((template) => template.familyId === familyId)

const LEGACY_TYPE_TEMPLATE: Record<string, CsatNumberTemplateId> = {
  목적: '18', '심경 및 분위기': '19', 주장: '20', '함축 의미': '21', 요지: '22', 주제: '23', 제목: '24',
  '내용 일치 및 불일치': '26', '도표 및 실용문': '25', 어법: '29', 어휘: '30', '빈칸 추론': '31',
  '무관한 문장': '35', '글의 순서': '36', '문장 삽입': '38', '요약문 완성': '40', '장문 독해': '41-42',
}

export function inferCsatTemplateId(set: Pick<EnglishQuestionSet, 'questions' | 'csatDesign'>): CsatNumberTemplateId {
  if (set.csatDesign && TEMPLATE_MAP.has(set.csatDesign.templateId)) return set.csatDesign.templateId
  return LEGACY_TYPE_TEMPLATE[set.questions[0]?.type] ?? '18'
}

function allowedVariant(template: CsatTemplateDefinition, variantId?: CsatVariantId): CsatVariantId {
  if (!variantId || variantId === 'standard') return 'standard'
  return template.variants?.some((variant) => variant.id === variantId) ? variantId : 'standard'
}

export function createCsatDesign(templateId: CsatNumberTemplateId = '18', variantId: CsatVariantId = 'standard'): CsatDesignSpec {
  const template = getCsatTemplate(templateId)
  return {
    familyId: template.familyId,
    templateId,
    variantId: allowedVariant(template, variantId),
    userInputs: Object.fromEntries(template.inputFields.map((item) => [item.key, ''])),
    passagePlan: template.passageBlueprint,
  }
}

export function effectiveCsatDesign(set: Pick<EnglishQuestionSet, 'questions' | 'csatDesign'>): CsatDesignSpec {
  const templateId = inferCsatTemplateId(set)
  const template = getCsatTemplate(templateId)
  const stored = set.csatDesign
  return stored ? {
    ...stored,
    familyId: template.familyId,
    templateId,
    variantId: allowedVariant(template, stored.variantId),
    userInputs: Object.fromEntries(template.inputFields.map((item) => [item.key, stored.userInputs?.[item.key] ?? ''])),
    passagePlan: stored.passagePlan || template.passageBlueprint,
  } : createCsatDesign(templateId)
}

function blueprintsFor(template: CsatTemplateDefinition, variantId: CsatVariantId): CsatQuestionBlueprint[] {
  if (template.id === '30' && variantId === 'vocabulary-box') return [question('30-box', '어휘', '(A), (B), (C)의 각 네모 안에서 문맥에 맞는 낱말로 가장 적절한 것은?', 2, 'word-pair')]
  if (template.id === '41-42' && variantId === 'long-order-content') return [
    question('41-order', '글의 순서', '주어진 글 다음에 이어질 글의 순서로 가장 적절한 것은?', 2, 'order'),
    question('42-content', '내용 일치 및 불일치', '윗글의 내용과 일치하지 않는 것은?', 2, 'korean'),
  ]
  if (template.id === '41-42' && variantId === 'long-implication-blank') return [
    question('41-implication', '함축 의미', '밑줄 친 부분이 윗글에서 의미하는 바로 가장 적절한 것은?', 2, 'english'),
    question('42-blank', '빈칸 추론', '윗글의 빈칸에 들어갈 말로 가장 적절한 것은?', 2, 'english'),
  ]
  if (template.id === '43-45' && variantId === 'narrative-emotion-implication-blank') return [
    question('43-emotion', '심경 및 분위기', '윗글에 나타난 인물의 심경 변화로 가장 적절한 것은?', 2, 'emotion-pair'),
    question('44-implication', '함축 의미', '밑줄 친 부분이 윗글에서 의미하는 바로 가장 적절한 것은?', 2, 'english'),
    question('45-blank', '빈칸 추론', '윗글의 빈칸에 들어갈 말로 가장 적절한 것은?', 2, 'english'),
  ]
  return template.questions
}

export function expectedCsatQuestions(set: Pick<EnglishQuestionSet, 'questions' | 'csatDesign'>) {
  const design = effectiveCsatDesign(set)
  return blueprintsFor(getCsatTemplate(design.templateId), design.variantId)
}

export function createCsatQuestions(templateId: CsatNumberTemplateId, variantId: CsatVariantId = 'standard'): EnglishQuestion[] {
  const template = getCsatTemplate(templateId)
  return blueprintsFor(template, allowedVariant(template, variantId)).map((item) => ({
    id: crypto.randomUUID(), type: item.type, stem: item.stem,
    choices: isInlinePositionTemplate(templateId) ? [...CSAT_INLINE_POSITION_CHOICES] : Array.from({ length: 5 }, () => ''), answerIndex: 1,
    explanation: '', intention: '', evidenceRefs: [], distractorReasons: [], score: item.score,
    csatTemplateId: templateId, csatSlot: item.slot,
  }))
}

export function createCsatItem(templateId?: CsatNumberTemplateId): CsatItemDesign {
  const id = crypto.randomUUID()
  if (!templateId) return {
    id, materialMode: 'generated', sourceKind: 'generated', materialTitle: '', material: '', questions: [], passageLength: 'medium',
  }
  const design = createCsatDesign(templateId)
  return {
    id, familyId: design.familyId, design, materialMode: 'generated', sourceKind: 'generated', materialTitle: '', material: '', passageLength: 'medium',
    questions: createCsatQuestions(templateId).map((question) => ({ ...question, csatItemId: id })),
  }
}

export function getCsatItems(set: EnglishQuestionSet): CsatItemDesign[] {
  if (set.mode !== 'csat') return []
  if (set.csatItems?.length) return set.csatItems
  const design = effectiveCsatDesign(set)
  const id = crypto.randomUUID()
  return [{
    id, familyId: design.familyId, design, targetLevel: undefined, difficulty: undefined, topic: undefined, intention: undefined,
    materialMode: set.materialMode, sourceKind: set.sourceKind, materialTitle: set.materialTitle, material: set.material,
    materialSpec: set.materialSpec, passageLength: 'medium',
    questions: set.questions.map((question) => ({ ...question, csatItemId: id })),
  }]
}

export function normalizeCsatSet(set: EnglishQuestionSet): EnglishQuestionSet {
  if (set.mode === 'custom') return set
  const usesLegacyDifficulty = set.difficultyScaleVersion !== 2
  const difficulty = usesLegacyDifficulty ? legacyCsatDifficultyToEight(set.difficulty) : set.difficulty
  if (set.mode !== 'csat') return { ...set, difficulty, difficultyScaleVersion: 2 }
  const items = getCsatItems(set).map((item) => ({
    ...item,
    difficulty: usesLegacyDifficulty && item.difficulty !== undefined ? legacyCsatDifficultyToEight(item.difficulty) : item.difficulty,
    passageLength: normalizeCsatPassageLength(item.passageLength),
    familyId: item.design?.familyId ?? item.familyId,
    questions: item.questions.map((question) => {
      const templateId = item.design?.templateId ?? question.csatTemplateId
      return {
        ...question,
        csatTemplateId: templateId,
        csatItemId: item.id,
        choices: isInlinePositionTemplate(templateId) ? [...CSAT_INLINE_POSITION_CHOICES] : question.choices,
      }
    }),
  }))
  return { ...set, difficulty, difficultyScaleVersion: 2, csatItems: items.length ? items : [createCsatItem()], choiceCount: 5 }
}

export function applyCsatItemTemplate(item: CsatItemDesign, templateId: CsatNumberTemplateId, variantId: CsatVariantId = 'standard'): CsatItemDesign {
  const template = getCsatTemplate(templateId)
  const nextVariant = allowedVariant(template, variantId)
  const sameTemplate = item.design?.templateId === templateId
  const design = createCsatDesign(templateId, nextVariant)
  if (sameTemplate && item.design) {
    design.userInputs = Object.fromEntries(template.inputFields.map((field) => [field.key, item.design?.userInputs[field.key] ?? '']))
    design.passagePlan = item.design.passagePlan || template.passageBlueprint
  }
  return {
    ...item, familyId: template.familyId, design,
    passageLength: normalizeCsatPassageLength(item.passageLength), qualityReview: undefined,
    difficulty: sameTemplate ? item.difficulty : template.defaultDifficulty,
    materialTitle: '', material: '', materialSpec: undefined,
    questions: createCsatQuestions(templateId, nextVariant).map((question) => ({ ...question, csatItemId: item.id })),
  }
}

export function expectedCsatItemQuestions(item: CsatItemDesign) {
  if (!item.design) return []
  return blueprintsFor(getCsatTemplate(item.design.templateId), item.design.variantId)
}

export const MAX_CSAT_SET_QUESTIONS = 4

export function plannedCsatItemQuestionCount(item: CsatItemDesign) {
  const expected = expectedCsatItemQuestions(item)
  return expected.length || Math.max(1, item.questions.length)
}

export function plannedCsatSetQuestionCount(items: CsatItemDesign[]) {
  return items.reduce((total, item) => total + plannedCsatItemQuestionCount(item), 0)
}

export const resolvedCsatItem = (set: EnglishQuestionSet, item: CsatItemDesign) => ({
  targetLevel: item.targetLevel?.trim() || set.targetLevel,
  difficulty: item.difficulty ?? set.difficulty,
  topic: item.topic?.trim() || set.topic,
  intention: item.intention?.trim() || set.intention,
})

export const allSetQuestions = (set: EnglishQuestionSet) => set.mode === 'csat'
  ? getCsatItems(set).flatMap((item) => item.questions)
  : set.questions

export const csatItemHasResult = (item: CsatItemDesign) => Boolean(item.material.trim() || item.materialSpec || item.questions.some((question) => question.choices.some((choice) => choice.trim()) || question.explanation.trim()))

export function applyCsatTemplate(set: EnglishQuestionSet, templateId: CsatNumberTemplateId, variantId: CsatVariantId = 'standard'): Partial<EnglishQuestionSet> {
  const template = getCsatTemplate(templateId)
  const previous = effectiveCsatDesign(set)
  const nextVariant = allowedVariant(template, variantId)
  const sameTemplate = previous.templateId === templateId
  const designChanged = !sameTemplate || previous.variantId !== nextVariant
  const userInputs = Object.fromEntries(template.inputFields.map((item) => [item.key, sameTemplate ? previous.userInputs[item.key] ?? '' : '']))
  return {
    csatDesign: { familyId: template.familyId, templateId, variantId: nextVariant, userInputs, passagePlan: sameTemplate ? previous.passagePlan : template.passageBlueprint },
    choiceCount: 5,
    difficulty: sameTemplate ? set.difficulty : template.defaultDifficulty,
    questions: createCsatQuestions(templateId, nextVariant),
    materialSpec: undefined,
    material: designChanged && set.materialMode === 'generated' ? '' : set.material,
    materialTitle: designChanged && set.materialMode === 'generated' ? '' : set.materialTitle,
    prompt: designChanged ? '' : set.prompt,
    aiRevision: designChanged ? 0 : set.aiRevision,
    validatedRevision: designChanged ? 0 : set.validatedRevision,
    lastImportedJson: designChanged ? '' : set.lastImportedJson,
  }
}

export const choiceStyleLabel = (style: CsatChoiceStyle) => ({
  korean: '한국어 문장', english: '영어 표현', 'emotion-pair': '영어 감정 형용사쌍', position: '위치 번호', order: 'A·B·C 순서 조합', 'word-pair': '영어 단어쌍',
}[style])

function materialSpecGuidance(templateId: CsatNumberTemplateId) {
  if (templateId === '25') return 'materialSpec은 {"kind":"chart","title":"...","unit":"...","categories":[...],"series":[{"name":"...","values":[...]}]} 형식을 사용한다. material에는 도표를 소개하는 영어 도입부 1~2문장만 쓰고, ①~⑤ 진술은 questions[].choices에 번호 없이 각각 완전한 영어 문장으로 쓴다.'
  if (templateId === '27' || templateId === '28') return 'materialSpec은 {"kind":"practical","heading":"...","fields":{"Date":"..."},"notes":[...]} 형식을 사용한다.'
  if (templateId === '36' || templateId === '37') return 'materialSpec을 사용할 경우 kind ordered, lead, A·B·C sections를 기록한다.'
  if (templateId === '38' || templateId === '39') return 'materialSpec을 사용할 경우 kind insertion, givenSentence, body를 기록하며 material 표식과 내용이 같아야 한다.'
  if (templateId === '40') return 'materialSpec을 사용할 경우 kind summary와 요약문을 기록하고 material에 A·B 빈칸 표식을 둔다.'
  if (templateId === '41-42') return 'materialSpec을 사용할 경우 kind longExpository와 paragraphs를 기록한다.'
  if (templateId === '43-45') return 'materialSpec을 사용할 경우 kind longNarrative와 A·B·C·D sections를 기록한다.'
  return '일반 지문은 materialSpec을 null로 두거나 kind prose와 paragraphs를 기록한다.'
}

function passageFormattingGuidance(templateId: CsatNumberTemplateId) {
  if (templateId === '36' || templateId === '37') return '도입문과 (A)·(B)·(C) 구획만 분리하고, 각 구획 내부는 빈 줄 없이 하나의 연속 문단으로 작성한다.'
  if (templateId === '38' || templateId === '39') return '주어진 삽입문장과 본문만 구분하고, 본문 내부는 빈 줄 없이 하나의 연속 문단으로 작성한다.'
  if (templateId === '40') return '원문과 요약문 영역만 구분하고, 각 영역 내부는 빈 줄 없이 하나의 연속 문단으로 작성한다.'
  if (templateId === '43-45') return '(A)·(B)·(C)·(D) 구획만 분리하고, 각 구획 내부는 빈 줄 없이 하나의 연속 문단으로 작성한다.'
  if (templateId === '25') return 'material의 영어 도입부 뒤에 앱이 choices를 ①~⑤로 이어 붙여 출력한다. 도입부와 다섯 진술을 합친 최종 결과가 빈 줄 없는 하나의 영어 문단이 되게 작성한다.'
  if (templateId === '27' || templateId === '28') return '안내문의 시각적 항목 구조는 유지하되, 함께 제공하는 설명 지문은 빈 줄 없이 하나의 연속 문단으로 작성한다.'
  return 'material의 영어 지문은 마지막 문장을 포함해 빈 줄이나 문단 구분 없이 하나의 연속 문단으로 작성한다.'
}

function buildCsatItemPromptSection(set: EnglishQuestionSet, item: CsatItemDesign, index: number) {
  if (!item.design) return `[문항 설계 카드 ${index + 1}]\n- itemId: ${item.id}\n- 오류: 번호 템플릿을 먼저 선택해야 한다.`
  const design = item.design
  const template = getCsatTemplate(design.templateId)
  const variant = template.variants?.find((item) => item.id === design.variantId)
  const resolved = resolvedCsatItem(set, item)
  const passageLength = normalizeCsatPassageLength(item.passageLength)
  const passageRange = getCsatPassageLengthRange(design.templateId, passageLength)
  const passageStats = CSAT_PASSAGE_LENGTH_STATS[design.templateId]
  const inputs = template.inputFields.map((item) => `- ${item.label}: ${design.userInputs[item.key]?.trim() || '(AI가 주제와 난이도에 맞게 결정)'}`).join('\n')
  const questions = expectedCsatItemQuestions(item).map((blueprint, questionIndex) => `- ${questionIndex + 1}번 역할 ${blueprint.slot}: ${blueprint.type} / ${choiceStyleLabel(blueprint.choiceStyle)} / ${blueprint.score}점`).join('\n')
  const materialInstruction = item.materialMode === 'provided'
    ? `등록 지문을 그대로 중심 근거로 사용한다.\n${item.material || '(등록 지문 미입력)'}`
    : `주제·소재 “${resolved.topic || '교육적이고 중립적인 주제'}”에 맞는 새로운 영어 지문을 작성한다.`
  return `[문항 설계 카드 ${index + 1}]
- itemId: ${item.id}
- templateId: ${design.templateId}
- variantId: ${design.variantId}
- 대상 수준: ${resolved.targetLevel}
- 난이도: ${englishDifficultyPrompt('csat', resolved.difficulty)}
- 지문 길이: ${CSAT_PASSAGE_LENGTH_LABELS[passageLength]} ${passageRange.min}~${passageRange.max}단어 (실제 평가원 조사 최소 ${passageStats.min} / 평균 ${passageStats.average} / 최대 ${passageStats.max})
- 출제 의도: ${resolved.intention || '유형에 맞게 설정'}
- 자료 작성 방식: ${materialInstruction}

[수능 독해 번호 템플릿]
- 템플릿: ${template.numberLabel} ${template.label}
- 대분류: ${CSAT_FAMILIES.find((item) => item.id === template.familyId)?.label}
- 변형: ${variant?.label ?? '최근 평가원 기본형'}
- 권장 난도: ${englishDifficultyLabel(template.difficultyRange[0])}~${englishDifficultyLabel(template.difficultyRange[1])} / 현재 설정 ${englishDifficultyLabel(resolved.difficulty)}
- 지문 장르: ${template.passageGenre}
- 지문 설계: ${design.passagePlan}
- 선지 형식: ${choiceStyleLabel(template.choiceStyle)}

[사용자 추천 입력]
${inputs}

[고유 구조]
${template.structureSteps.map((step, index) => `${index + 1}. ${step}`).join('\n')}

[고정 문항 구성]
${questions}

[선지 출력 규칙]
${isInlinePositionTemplate(template.id)
    ? '- 이 유형의 답은 지문 안 ①~⑤ 위치 번호다. 별도의 내용 선지를 만들지 않는다. questions[].choices는 호환성을 위해 ["①","②","③","④","⑤"]만 반환하고, 시험지에는 이 배열을 다시 출력하지 않는다.'
    : template.id === '25'
      ? '- questions[].choices에는 도표를 판별하는 완전한 영어 문장 5개를 번호 없이 작성한다. material에는 영어 도입부만 쓰며 ①~⑤를 직접 넣지 않는다. 앱이 도입부 뒤에 choices를 ①~⑤로 연결해 하나의 지문으로 출력하므로 별도 선지 목록은 만들지 않는다.'
      : '- questions[].choices에 서로 다른 실제 선지 내용 5개를 반드시 작성한다.'}

[필수 표식]
${template.requiredMarkers.length ? template.requiredMarkers.map((item) => `- ${item}`).join('\n') : '- 별도 표식 없음'}

[구조화 자료 JSON]
${materialSpecGuidance(template.id)}
- 지문 문단 형식: ${passageFormattingGuidance(template.id)}

[지문·선지 품질 규칙]
${csatQualityRulesForTemplate(template.id).map((rule) => `- ${rule}`).join('\n')}
${CSAT_QUALITY_REVIEW_INSTRUCTIONS}

- 실제 기출 지문·선지·인물·수치·고유 사례를 복제하지 않는다.
- 정답 번호 통계나 풀이 요령을 규칙으로 사용하지 말고, 여러 문항을 만들 때 정답 위치를 고르게 분산한다.
- 오답은 범위 축소·확대, 인과 역전, 일부 사실 왜곡, 무관 키워드 추가처럼 설명 가능한 서로 다른 오류를 사용한다.`
}

export function buildCsatPromptSection(set: EnglishQuestionSet) {
  const items = getCsatItems(set)
  return `[수능형 다중 문항 일괄 제작]
- 문항 설계 카드 수: ${items.length}개
- 실제 생성 문항 수: ${plannedCsatSetQuestionCount(items)}개 / 최대 ${MAX_CSAT_SET_QUESTIONS}개
- 모든 카드를 독립 지문으로 만들고 itemId, templateId, variantId를 입력과 동일하게 반환한다.
- 41~42와 43~45는 하나의 공유 지문을 가진 고정 묶음으로 유지한다.
- 전체 실제 문항의 정답 위치를 고르게 분산한다.

${items.map((item, index) => buildCsatItemPromptSection(set, item, index)).join('\n\n')}`
}

export function generateCsatGptInstructions() {
  const catalog = CSAT_TEMPLATES.map((template) => {
    const questionPlan = template.questions.map((item) => `${item.slot} ${item.type}(${choiceStyleLabel(item.choiceStyle)})`).join(', ')
    const stats = CSAT_PASSAGE_LENGTH_STATS[template.id]
    const ranges = (['short', 'medium', 'long'] as CsatPassageLengthPreset[]).map((preset) => {
      const range = getCsatPassageLengthRange(template.id, preset)
      return `${CSAT_PASSAGE_LENGTH_LABELS[preset]} ${range.min}~${range.max}`
    }).join(', ')
    return `- ${template.numberLabel} ${template.label}: 난도 ${englishDifficultyLabel(template.difficultyRange[0])}~${englishDifficultyLabel(template.difficultyRange[1])}, 조사 단어 수 ${stats.min}/${stats.average}/${stats.max} (${ranges}), ${template.passageBlueprint}; ${questionPlan}; 품질: ${csatQualityRulesForTemplate(template.id).join(' / ')}`
  }).join('\n')
  return `# 수능형 영어 문제 제작 GPT Instructions

당신은 대한민국 대학수학능력시험 영어 읽기 영역의 구조를 연구한 창작 문항 출제자이다. 듣기 1~17번은 만들지 않는다. 사용자가 준 번호 템플릿·주제·난도·지문 조건을 먼저 확인하고, 부족한 필수 정보만 간결하게 질문한 뒤 18~45번 읽기 구조에 맞는 새로운 문항을 만든다.

${CSAT_GPT_APPROVAL_PROTOCOL}

## 절대 원칙
- 업로드된 기출 PDF는 유형 구조·길이·난도·선지 설계의 보정 자료일 뿐 복사 원본이 아니다. 이 Instructions와 수능형 제작 매뉴얼을 우선 기준으로 사용한다.
- 실제 평가원·교육청·교재의 지문, 선지, 인물, 수치, 고유 사례를 복제하지 않는다.
- 기출의 특징적인 문구, 고유명사 조합, 수치 배열을 재사용하지 않으며, 연속된 핵심 내용어가 8개 이상 겹치지 않는지 자체 점검한다.
- 공식 로고나 평가원 문구를 사용하지 않는다.
- 모든 문항은 5지선다이며 정답은 하나다.
- 외부 배경지식 없이 제시 자료만으로 정답을 확정할 수 있어야 한다.
- 정답 위치 통계나 풀이 꼼수를 사용하지 않고 정답 번호를 고르게 분산한다.
- 모든 오답은 서로 다른 명백한 오류 근거를 갖는다.
- evidenceRefs에는 지문에 실제로 존재하는 연속된 직접 인용만 넣는다.
- 한 세트의 실제 생성 문항은 최대 4개다. 일반 카드는 1개, 41~42번 묶음은 2개, 43~45번 묶음은 3개로 계산한다.
- 여러 카드 요청은 하나의 items 배열로 반환하며 각 itemId, templateId, variantId를 입력과 정확히 일치시킨다.
- 35·38·39번형은 지문 안 ①~⑤를 고르는 유형이므로 별도의 내용 선지를 만들지 않는다. 호환용 choices는 ["①","②","③","④","⑤"]로 반환한다.
- 25번 도표형은 material에 영어 도입부 1~2문장만 쓰고, 도표와 비교할 완전한 영어 진술 5개를 번호 없이 choices에 반환한다. 앱이 도입부 뒤에 ①~⑤를 붙여 하나의 영어 지문으로 조판하므로 material에 번호 진술을 중복 작성하거나 한국어 선지를 만들지 않는다.
- 41~42번 기본형의 어휘 표적은 지문 안에서 "(a) [[밑줄:단어]]"부터 "(e) [[밑줄:단어]]"까지 순서대로 정확히 5곳 표시한다.
- 43~45번 기본형의 (a)~(e)는 각 표적 대명사·지칭어를 "(a) [[밑줄:She]]" 형식으로 정확히 5곳 표시한다.
- 일반 영어 지문은 마지막 문장까지 빈 줄 없이 하나의 연속 문단으로 작성한다. 순서·삽입·요약·복합 장문은 문항 풀이에 필요한 필수 구획만 분리하고 각 구획 내부의 문단은 나누지 않는다.
- 명시적 승인 전에는 설계안만, 승인 후에는 설명이나 마크다운이 없는 유효한 JSON 객체 하나만 출력한다.
- 각 카드의 passageLength 목표 구간을 지키고 실제 출력되는 영어 텍스트의 단어 수를 직접 다시 센다.
- 정답을 본문에서 직접 재현하지 않고 매력적인 오답과 단일 정답을 유형별 논리로 검수한다.

## 번호별 카탈로그
${catalog}

## 표식
- 밑줄: [[밑줄:표현]]
- 빈칸: [[빈칸]]
- 문장 삽입: [[삽입문장:문장]], [[삽입위치:①]]부터 [[삽입위치:⑤]]
- 요약: [[요약빈칸:A]], [[요약빈칸:B]]
- 박스형 어휘: [[선택:A|첫 단어|둘째 단어]]

## 자체 검토
1. 선택한 번호 템플릿의 지문 장르와 고정 문항 수가 맞는가?
2. 선지 언어와 형태가 맞고 정답이 하나뿐인가?
3. 정답 근거가 지문에 있으며 모든 오답의 오류를 설명할 수 있는가?
4. 유형별 표식 개수와 A~D 구획이 정확한가?
5. 실제 기출의 표현이나 사례를 재사용하지 않았는가?
6. 선택한 passageLength의 목표 단어 수 범위 안에 있는가?
7. 정답만 길이·문법 구조·추상도에서 두드러지지 않고, 가장 강력한 오답과 구분하는 근거가 분명한가?
8. JSON이 {title, items:[{itemId, templateId, variantId, materialTitle, material, materialSpec, questions, qualityReview}]} 구조와 일치하는가?

## 품질 검수 JSON
${CSAT_QUALITY_REVIEW_INSTRUCTIONS}`
}
