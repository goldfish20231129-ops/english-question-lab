import { CSAT_FAMILIES, CSAT_GPT_APPROVAL_PROTOCOL, CSAT_INLINE_POSITION_CHOICES, CSAT_PASSAGE_LENGTH_LABELS, CSAT_QUALITY_REVIEW_INSTRUCTIONS, MAX_CSAT_SET_QUESTIONS, buildCsatPromptSection, countCsatPassageWords, createCsatItem, csatPrintableMaterialText, decorateCsatMaterialText, effectiveCsatDesign, embedCsatChartChoices, expectedCsatItemQuestions, expectedCsatQuestions, generateCsatGptInstructions, getCsatItems, getCsatPassageLengthRange, getCsatTemplate, hasUnnecessaryPassageBreaks, isInlinePositionTemplate, normalizeCsatPassageLength, normalizeCsatSet, plannedCsatSetQuestionCount, resolvedCsatItem } from './csat'
import { assertCsatGenerationSchema } from './generationContract'
import { generateProvidedPassagePrompt, isProvidedPassageSet, parseProvidedPassageJson, providedPassageValidationMessages } from './providedPassage'
import type { CsatMaterialSpec, CsatQualityReview, EnglishMode, EnglishQuestion, EnglishQuestionSet, ExamLayoutSettings, LayoutPreset, SourceKind, ValidationIssue } from './types'

export const MODE_LABELS: Record<EnglishMode, string> = {
  school: '내신형',
  csat: '수능형',
  custom: '맞춤설정형',
}

export const CSAT_QUESTION_TYPES = CSAT_FAMILIES.map((family) => family.label)

export const SCHOOL_QUESTION_TYPES = ['어휘', '어법', '내용 이해', '내용 일치 및 불일치', '순서 배열', '문장 삽입'] as const
export const CUSTOM_PRESETS = ['독해', '어휘', '어법', '변형 문제', '숙제용 워크시트', '단원별 미니 테스트'] as const
export const CUSTOM_QUESTION_TYPES = [...CSAT_QUESTION_TYPES, ...SCHOOL_QUESTION_TYPES, '세부 정보', '문맥 추론'] as const

export const ENGLISH_TOPIC_PRESETS = [
  '인문·철학', '심리·인지', '교육·학습', '사회·문화', '과학·기술', '환경·생태',
  '경제·경영', '예술·문학', '역사·문명', '언어·소통', '건강·생활',
] as const

function stableTopicIndex(seed: string, length: number) {
  let hash = 2166136261
  for (let index = 0; index < seed.length; index += 1) hash = Math.imul(hash ^ seed.charCodeAt(index), 16777619)
  return (hash >>> 0) % length
}

export function assignAutomaticCsatTopics(set: EnglishQuestionSet): EnglishQuestionSet {
  if (set.mode !== 'csat' || set.topic.trim()) return set
  const used = new Set(getCsatItems(set).map((item) => item.topic?.trim()).filter((topic): topic is string => Boolean(topic)))
  let changed = false
  const csatItems = getCsatItems(set).map((item, index) => {
    if (item.topic?.trim()) return item
    const unused = ENGLISH_TOPIC_PRESETS.filter((topic) => !used.has(topic))
    const candidates = unused.length ? unused : ENGLISH_TOPIC_PRESETS
    const topic = candidates[stableTopicIndex(`${set.id}:${item.id}:${index}`, candidates.length)]
    used.add(topic)
    changed = true
    return { ...item, topic }
  })
  return changed ? { ...set, csatItems } : set
}

export const ENGLISH_INTENTION_PRESETS = [
  '핵심 주장과 중심 내용을 파악하게 함',
  '글의 목적·태도·분위기를 파악하게 함',
  '세부 정보의 일치 여부를 판단하게 함',
  '문맥에 따른 어휘의 의미를 판단하게 함',
  '문장 구조와 어법의 적절성을 판단하게 함',
  '빈칸에 필요한 핵심 논리를 추론하게 함',
  '문장 간 연결 관계와 글의 흐름을 파악하게 함',
  '근거를 종합하여 함축 의미를 추론하게 함',
  '장문에서 핵심 정보와 세부 내용을 종합하게 함',
] as const

export const SOURCE_LABELS: Record<SourceKind, string> = {
  textbook: '교과서 본문',
  supplement: '부교재 지문',
  external: '외부 지문',
  generated: 'AI 생성 지문',
  custom: '사용자 정의 자료',
}

export const LAYOUT_PRESETS: Record<LayoutPreset, ExamLayoutSettings> = {
  csat: { layoutRevision: 2, preset: 'csat', columns: 2, answerColumns: 1, marginTop: 12, marginRight: 13, marginBottom: 11, marginLeft: 13, fontSize: 8.6, lineHeight: 1.32, questionGap: 3.5, passageBorder: false, institution: '', gradeLabel: '', dateLabel: '', footerText: '영어 문제 제작 연구소 창작 문항', showPageNumbers: true },
  school: { preset: 'school', columns: 1, answerColumns: 1, marginTop: 16, marginRight: 17, marginBottom: 15, marginLeft: 17, fontSize: 10.5, lineHeight: 1.72, questionGap: 8, passageBorder: true, institution: '', gradeLabel: '', dateLabel: '', footerText: '영어 문제 제작 연구소', showPageNumbers: true },
  worksheet: { preset: 'worksheet', columns: 1, answerColumns: 1, marginTop: 14, marginRight: 15, marginBottom: 14, marginLeft: 15, fontSize: 11, lineHeight: 1.75, questionGap: 10, passageBorder: true, institution: '', gradeLabel: '', dateLabel: '', footerText: 'English Worksheet', showPageNumbers: true },
  custom: { preset: 'custom', columns: 1, answerColumns: 1, marginTop: 14, marginRight: 14, marginBottom: 14, marginLeft: 14, fontSize: 10.5, lineHeight: 1.7, questionGap: 8, passageBorder: true, institution: '', gradeLabel: '', dateLabel: '', footerText: '영어 문제 제작 연구소', showPageNumbers: true },
}

const DEFAULT_STEMS: Record<string, string> = {
  목적: '다음 글의 목적으로 가장 적절한 것은?',
  '심경 및 분위기': '다음 글에 드러난 필자의 심경 변화로 가장 적절한 것은?',
  주장: '다음 글에서 필자가 주장하는 바로 가장 적절한 것은?',
  요지: '다음 글의 요지로 가장 적절한 것은?',
  주제: '다음 글의 주제로 가장 적절한 것은?',
  제목: '다음 글의 제목으로 가장 적절한 것은?',
  '함축 의미': '밑줄 친 부분이 다음 글에서 의미하는 바로 가장 적절한 것은?',
  '내용 일치 및 불일치': '다음 글의 내용과 일치하지 않는 것은?',
  '도표 및 실용문': '다음 자료의 내용과 일치하지 않는 것은?',
  어법: '다음 글의 밑줄 친 부분 중, 어법상 틀린 것은?',
  어휘: '다음 글의 밑줄 친 부분 중, 문맥상 낱말의 쓰임이 적절하지 않은 것은?',
  '빈칸 추론': '다음 빈칸에 들어갈 말로 가장 적절한 것은?',
  '무관한 문장': '다음 글에서 전체 흐름과 관계 없는 문장은?',
  '글의 순서': '주어진 글 다음에 이어질 글의 순서로 가장 적절한 것은?',
  '순서 배열': '주어진 글 다음에 이어질 글의 순서로 가장 적절한 것은?',
  '문장 삽입': '글의 흐름으로 보아, 주어진 문장이 들어가기에 가장 적절한 곳은?',
  '요약문 완성': '다음 글의 내용을 한 문장으로 요약하고자 한다. 빈칸에 들어갈 말로 가장 적절한 것은?',
  '장문 독해': '다음 글의 내용으로 가장 적절한 것은?',
  '내용 이해': '다음 글의 내용과 일치하는 것은?',
}

export function createQuestion(type: string, choiceCount = 5): EnglishQuestion {
  return {
    id: crypto.randomUUID(), type, stem: DEFAULT_STEMS[type] ?? '다음 글을 읽고 물음에 답하시오.',
    choices: Array.from({ length: choiceCount }, () => ''), answerIndex: 1, explanation: '', intention: '', evidenceRefs: [], distractorReasons: [], score: 2,
  }
}

export function questionTypesFor(mode: EnglishMode) {
  return mode === 'csat' ? [...CSAT_QUESTION_TYPES] : mode === 'school' ? [...SCHOOL_QUESTION_TYPES] : [...new Set(CUSTOM_QUESTION_TYPES)]
}

export function createEnglishSet(mode: EnglishMode = 'csat'): EnglishQuestionSet {
  const now = new Date().toISOString()
  const firstType = questionTypesFor(mode)[0]
  const sourceKind: SourceKind = mode === 'school' ? 'textbook' : mode === 'csat' ? 'generated' : 'custom'
  return {
    id: crypto.randomUUID(), title: `새 ${MODE_LABELS[mode]} 영어 세트`, mode, targetLevel: mode === 'csat' ? '고3·수능 대비' : '고등학교',
    sourceKind, materialMode: sourceKind === 'generated' ? 'generated' : 'provided', materialTitle: '', material: '', topic: '', difficulty: mode === 'csat' ? 1 : 3,
    intention: '', choiceCount: 5, customPreset: mode === 'custom' ? CUSTOM_PRESETS[0] : undefined,
    csatItems: mode === 'csat' ? [createCsatItem()] : undefined, questions: mode === 'csat' ? [] : [createQuestion(firstType, 5)], prompt: '', aiRevision: 0, validatedRevision: 0, lastImportedJson: '',
    createdAt: now, updatedAt: now,
  }
}

export function createExamLayout(preset: LayoutPreset = 'school'): ExamLayoutSettings {
  return { ...LAYOUT_PRESETS[preset] }
}

export function preferredExamPresetForSets(sets: EnglishQuestionSet[]): LayoutPreset {
  return sets.some((set) => set.mode === 'csat') ? 'csat' : 'school'
}

export function layoutForFirstSelectedSet(layout: ExamLayoutSettings, set: EnglishQuestionSet, hasContent: boolean): ExamLayoutSettings {
  if (hasContent || set.mode !== 'csat' || layout.preset !== 'school') return layout
  return {
    ...createExamLayout('csat'),
    institution: layout.institution,
    gradeLabel: layout.gradeLabel,
    dateLabel: layout.dateLabel,
    footerText: layout.footerText,
  }
}

export function applyCustomPreset(set: EnglishQuestionSet, preset: string): Partial<EnglishQuestionSet> {
  const map: Record<string, { types: string[]; topic: string; intention: string }> = {
    독해: { types: ['주제', '내용 이해', '빈칸 추론'], topic: '핵심 내용과 논리 구조 파악', intention: '글의 핵심 내용과 추론 능력을 평가한다.' },
    어휘: { types: ['어휘', '문맥 추론'], topic: '문맥 속 어휘 의미', intention: '문맥을 근거로 어휘의 의미와 쓰임을 판단하게 한다.' },
    어법: { types: ['어법', '어법'], topic: '핵심 어법 요소', intention: '문장 구조와 어법 지식을 문맥에 적용하게 한다.' },
    '변형 문제': { types: ['내용 이해', '글의 순서', '문장 삽입'], topic: '등록 지문 변형', intention: '동일 지문의 정보 관계를 새로운 문항으로 재구성한다.' },
    '숙제용 워크시트': { types: ['어휘', '내용 이해', '주제', '어법'], topic: '복습용 워크시트', intention: '수업 내용을 어휘·어법·독해 영역에서 고르게 복습한다.' },
    '단원별 미니 테스트': { types: ['내용 이해', '어휘', '어법', '빈칸 추론', '주제'], topic: '단원별 성취도 점검', intention: '단원 학습 목표의 도달 정도를 짧은 시험으로 점검한다.' },
  }
  const selected = map[preset] ?? map.독해
  return { customPreset: preset, topic: selected.topic, intention: selected.intention, questions: selected.types.map((type) => createQuestion(type, set.choiceCount)) }
}

const modeInstructions: Record<EnglishMode, string[]> = {
  csat: ['대한민국 수능 영어 읽기 영역의 문체와 사고 과정을 참고한다.', '실제 기출 지문·선지·고유 사례를 복제하지 않는다.', '듣기평가 문항은 만들지 않는다.'],
  school: ['등록된 교과서·부교재·외부 지문의 내용과 표현을 근거로 출제한다.', '영작·단답·서술형은 만들지 않고 객관식만 만든다.', '학교 시험에서 학습 내용을 확인할 수 있는 명확한 문항을 만든다.'],
  custom: ['사용자가 고른 자료와 문항 조합을 우선한다.', '학원 워크시트와 미니 테스트에서 바로 사용할 수 있게 자연스럽게 구성한다.', '정답 단서가 선지 길이나 표현에 드러나지 않게 한다.'],
}

function savedPrinciplesSection() {
  if (typeof localStorage === 'undefined') return ''
  try {
    const stored: unknown = JSON.parse(localStorage.getItem('english-question-lab-principles-v1') ?? '[]')
    const principles = Array.isArray(stored) ? stored.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())) : []
    return principles.length ? `\n[나의 영어 출제 원칙]\n${principles.map((item) => `- ${item}`).join('\n')}\n` : ''
  } catch { return '' }
}

function generateCsatBatchPrompt(set: EnglishQuestionSet) {
  const normalized = normalizeCsatSet(assignAutomaticCsatTopics(set))
  const items = getCsatItems(normalized)
  if (!items.length || items.some((item) => !item.design)) throw new Error('모든 문항 설계 카드에서 대분류와 번호 템플릿을 선택해 주세요.')
  const plannedQuestions = plannedCsatSetQuestionCount(items)
  if (plannedQuestions > MAX_CSAT_SET_QUESTIONS) throw new Error(`수능형 세트는 실제 생성 문항을 최대 ${MAX_CSAT_SET_QUESTIONS}개까지 만들 수 있습니다. 문항 카드를 줄여 주세요.`)
  return `[역할]
당신은 대한민국 수능 영어 읽기 영역의 구조를 연구한 전문 창작 출제자이다.

[제작 원칙]
${modeInstructions.csat.map((item) => `- ${item}`).join('\n')}
- 각 문항 설계 카드는 서로 독립된 지문을 사용한다.
- 41~42번과 43~45번은 각각 하나의 공유 지문을 가진 고정 묶음이다.
- 모든 문항은 객관식 5지선다이며 정답은 하나다.
- templateId와 variantId는 입력에 제시된 문자열을 그대로 반환한다. 예: "templateId": "33"
- 첫 응답에서는 지문·문항·선지·JSON을 생성하지 않고 아래 승인 절차에 따른다.
${savedPrinciplesSection()}

${CSAT_GPT_APPROVAL_PROTOCOL}

[세트 공통값]
- 세트 제목: ${normalized.title}
- 기본 대상 수준: ${normalized.targetLevel}
- 기본 난이도: ${normalized.difficulty}/5
- 기본 주제·소재: ${normalized.topic || '카드별 자동 배정값 사용'}
- 기본 출제 의도: ${normalized.intention || '유형에 맞게 설정'}

${buildCsatPromptSection(normalized)}

[승인 후 출력 JSON]
{
  "title": "세트 제목",
  "items": [
    {
      "itemId": "입력에 제시된 itemId",
      "templateId": "입력에 제시된 templateId",
      "variantId": "입력에 제시된 variantId",
      "materialTitle": "지문 제목 또는 빈 문자열",
      "material": "이 카드만의 영어 지문 또는 자료",
      "materialSpec": null,
      "questions": [
        {
          "type": "고정 문항 유형",
          "stem": "발문",
          "choices": ["선지 1", "선지 2", "선지 3", "선지 4", "선지 5"],
          "answerIndex": 1,
          "explanation": "정답 근거를 포함한 해설",
          "intention": "출제 의도",
          "evidenceRefs": ["지문에 실제로 존재하는 직접 인용"],
          "distractorReasons": ["오답 1", "오답 2", "오답 3", "오답 4"],
          "score": 2
        }
      ],
      "qualityReview": {
        "passage": {
          "naturalness": 9,
          "logicStructure": 9,
          "vocabularyLevel": 9,
          "templateFidelity": 9
        },
        "questions": [
          {
            "slot": "고정 문항 역할",
            "answerInference": 9,
            "distractorPlausibility": 9,
            "choiceBalance": 9,
            "directAnswerOverlap": false,
            "strongestDistractorIndex": 2,
            "decisiveReason": "정답과 가장 강력한 오답을 가르는 결정적 지문 근거",
            "expectedDifficulty": 3
          }
        ]
      }
    }
  ]
}

[품질 검수]
${CSAT_QUALITY_REVIEW_INSTRUCTIONS}`
}

export function generateEnglishPrompt(set: EnglishQuestionSet): string {
  if (isProvidedPassageSet(set)) return generateProvidedPassagePrompt(set)
  if (set.mode === 'csat') return generateCsatBatchPrompt(set)
  const plan = set.questions.map((question, index) => `- 문항 ${index + 1}: ${question.type}\n  발문: ${question.stem || '(AI가 유형에 맞게 작성)'}\n  선지 수: ${set.choiceCount}\n  출제 의도: ${question.intention || set.intention || '(유형에 맞게 설정)'}`).join('\n')
  const materialInstruction = set.materialMode === 'provided'
    ? `아래 등록 자료를 중심 근거로 사용한다.\n\n${set.material || '(사용자가 자료를 입력해야 함)'}`
    : `주제·소재 “${set.topic || '교육적이고 중립적인 주제'}”에 맞는 새로운 영어 지문을 작성한다.`
  let savedPrinciples: string[] = []
  if (typeof localStorage !== 'undefined') {
    try {
      const stored: unknown = JSON.parse(localStorage.getItem('english-question-lab-principles-v1') ?? '[]')
      if (Array.isArray(stored)) savedPrinciples = stored.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
    } catch { savedPrinciples = [] }
  }
  const principlesSection = savedPrinciples.length ? `\n[나의 영어 출제 원칙]\n${savedPrinciples.map((item) => `- ${item}`).join('\n')}\n` : ''
  const csatSection = ''
  return `[역할]
당신은 대한민국 고등학교 영어 평가 문항을 설계하는 전문 출제자이다.

[제작 유형]
${MODE_LABELS[set.mode]}

[제작 원칙]
${modeInstructions[set.mode].map((item) => `- ${item}`).join('\n')}
- 외부 배경지식 없이 제시 자료로 정답을 판단할 수 있게 한다.
- 객관식 ${set.choiceCount}지선다만 만들고 정답은 하나만 둔다.
- 모든 오답에 서로 다른 명백한 오류 근거를 둔다.
- 일반 영어 지문은 마지막 문장까지 빈 줄이나 문단 구분 없이 하나의 연속 문단으로 작성한다. 순서·삽입·요약·복합 장문은 문제 풀이에 필요한 필수 구획만 분리하고 각 구획 내부는 나누지 않는다.
- 설명이나 마크다운 없이 유효한 JSON 하나만 출력한다.
${principlesSection}

[세트 명세]
세트 제목: ${set.title}
대상 수준: ${set.targetLevel}
자료 종류: ${SOURCE_LABELS[set.sourceKind]}
자료 작성 방식: ${materialInstruction}
난이도: ${set.difficulty}/5
공통 출제 의도: ${set.intention || '문항 유형에 맞게 설정'}
${csatSection}

[문항 구성]
${plan}

[영어 문항 표식]
- 어법·어휘의 대상 표현은 지문에서 [[밑줄:대상 표현]]으로 표시한다.
- 빈칸은 [[빈칸]]으로 표시한다.
- 순서 배열 자료는 (A), (B), (C)를 명확히 구분한다.
- 문장 삽입은 [[삽입문장:문장]]과 [[삽입위치:①]] 형식을 사용한다.
- 요약문 완성은 [[요약빈칸:A]]와 [[요약빈칸:B]]를 사용한다.
- 박스형 어휘는 [[선택:A|첫 단어|둘째 단어]] 형식을 사용한다.

[출력 JSON]
{
  "title": "세트 제목",
  "materialTitle": "지문 제목 또는 빈 문자열",
  "material": "전체 영어 지문 또는 자료",
  "materialSpec": null,
  "questions": [
    {
      "type": "문항 유형",
      "stem": "발문",
      "choices": ["선지 1", "선지 2", "선지 3", "선지 4", "선지 5"],
      "answerIndex": 1,
      "explanation": "정답 근거를 포함한 해설",
      "intention": "출제 의도",
      "evidenceRefs": ["지문에 실제로 존재하는 직접 인용"],
      "distractorReasons": ["2번 오답 이유", "3번 오답 이유", "4번 오답 이유", "5번 오답 이유"],
      "score": 2
    }
  ]
}`
}

function cleanJson(raw: string) {
  const trimmed = raw.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  return fenced ? fenced[1] : trimmed
}

function cleanStrings(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()) : []
}

function cleanCsatQualityReview(value: unknown): CsatQualityReview | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const input = value as Record<string, unknown>
  const passageInput = input.passage && typeof input.passage === 'object' && !Array.isArray(input.passage)
    ? input.passage as Record<string, unknown> : {}
  const optionalNumber = (candidate: unknown) => typeof candidate === 'number' && Number.isFinite(candidate) ? candidate : undefined
  const questions = Array.isArray(input.questions) ? input.questions.flatMap((candidate) => {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return []
    const row = candidate as Record<string, unknown>
    return [{
      slot: typeof row.slot === 'string' ? row.slot.trim() : '',
      answerInference: optionalNumber(row.answerInference),
      distractorPlausibility: optionalNumber(row.distractorPlausibility),
      choiceBalance: optionalNumber(row.choiceBalance),
      directAnswerOverlap: typeof row.directAnswerOverlap === 'boolean' ? row.directAnswerOverlap : undefined,
      strongestDistractorIndex: optionalNumber(row.strongestDistractorIndex),
      decisiveReason: typeof row.decisiveReason === 'string' ? row.decisiveReason.trim() : undefined,
      expectedDifficulty: optionalNumber(row.expectedDifficulty),
    }]
  }) : []
  return {
    passage: {
      naturalness: optionalNumber(passageInput.naturalness),
      logicStructure: optionalNumber(passageInput.logicStructure),
      vocabularyLevel: optionalNumber(passageInput.vocabularyLevel),
      templateFidelity: optionalNumber(passageInput.templateFidelity),
    },
    questions,
  }
}

function cleanMaterialSpec(value: unknown): CsatMaterialSpec | undefined {
  if (value == null) return undefined
  if (!value || typeof value !== 'object') throw new Error('materialSpec은 객체 또는 null이어야 합니다.')
  const input = value as Record<string, unknown>
  const kind = input.kind
  const text = (key: string) => typeof input[key] === 'string' ? String(input[key]).trim() : ''
  if (kind === 'prose' || kind === 'longExpository') return { kind, paragraphs: cleanStrings(input.paragraphs) }
  if (kind === 'chart') {
    const series = Array.isArray(input.series) ? input.series.map((item) => {
      const row = item && typeof item === 'object' ? item as Record<string, unknown> : {}
      return { name: typeof row.name === 'string' ? row.name.trim() : '', values: Array.isArray(row.values) ? row.values.filter((number): number is number => typeof number === 'number' && Number.isFinite(number)) : [] }
    }) : []
    return { kind, title: text('title'), unit: text('unit'), categories: cleanStrings(input.categories), series }
  }
  if (kind === 'practical') {
    const fields = input.fields && typeof input.fields === 'object' && !Array.isArray(input.fields)
      ? Object.fromEntries(Object.entries(input.fields as Record<string, unknown>).filter((entry): entry is [string, string] => typeof entry[1] === 'string').map(([key, item]) => [key, item.trim()])) : {}
    return { kind, heading: text('heading'), fields, notes: cleanStrings(input.notes) }
  }
  if (kind === 'ordered') {
    const sections: Array<{ label: 'A' | 'B' | 'C'; text: string }> = Array.isArray(input.sections) ? input.sections.flatMap((item) => {
      const row = item && typeof item === 'object' ? item as Record<string, unknown> : {}
      return (row.label === 'A' || row.label === 'B' || row.label === 'C') && typeof row.text === 'string' ? [{ label: row.label as 'A' | 'B' | 'C', text: row.text.trim() }] : []
    }) : []
    return { kind, lead: text('lead'), sections }
  }
  if (kind === 'insertion') return { kind, givenSentence: text('givenSentence'), body: text('body') }
  if (kind === 'summary') return { kind, summary: text('summary') }
  if (kind === 'longNarrative') {
    const sections: Array<{ label: 'A' | 'B' | 'C' | 'D'; text: string }> = Array.isArray(input.sections) ? input.sections.flatMap((item) => {
      const row = item && typeof item === 'object' ? item as Record<string, unknown> : {}
      return (row.label === 'A' || row.label === 'B' || row.label === 'C' || row.label === 'D') && typeof row.text === 'string' ? [{ label: row.label as 'A' | 'B' | 'C' | 'D', text: row.text.trim() }] : []
    }) : []
    return { kind, sections }
  }
  throw new Error('materialSpec.kind가 지원되는 수능 자료 형식이 아닙니다.')
}

function parseAnswerIndex(value: unknown, choiceCount: number) {
  if (typeof value === 'number') return Math.max(1, Math.min(choiceCount, Math.trunc(value)))
  const text = typeof value === 'string' ? value : ''
  const circled = ['①', '②', '③', '④', '⑤'].indexOf(text.trim())
  if (circled >= 0) return Math.min(choiceCount, circled + 1)
  const number = Number(text.replace(/[^0-9]/g, ''))
  return Number.isFinite(number) && number >= 1 && number <= choiceCount ? number : 1
}

export function parseEnglishSetJson(raw: string, base: EnglishQuestionSet): EnglishQuestionSet {
  if (isProvidedPassageSet(base)) return parseProvidedPassageJson(raw, base)
  const parsed: unknown = JSON.parse(cleanJson(raw))
  if (!parsed || typeof parsed !== 'object') throw new Error('JSON 최상위 값은 객체여야 합니다.')
  if (base.mode === 'csat') assertCsatGenerationSchema(parsed)
  const input = parsed as Record<string, unknown>
  if (base.mode === 'csat') return parseCsatBatchJson(input, base)
  if (typeof input.material !== 'string' || !Array.isArray(input.questions)) throw new Error('material 문자열과 questions 배열이 필요합니다.')
  if (!input.questions.length) throw new Error('최소 한 문항이 필요합니다.')
  const choiceCount = base.choiceCount
  const questions = input.questions.map((value, index) => {
    if (!value || typeof value !== 'object') throw new Error(`${index + 1}번 문항 형식이 올바르지 않습니다.`)
    const item = value as Record<string, unknown>
    const choices = cleanStrings(item.choices)
    if (choices.length !== choiceCount) throw new Error(`${index + 1}번 문항은 선지 ${choiceCount}개가 필요합니다.`)
    if (typeof item.stem !== 'string') throw new Error(`${index + 1}번 문항에 stem이 필요합니다.`)
    return {
      id: crypto.randomUUID(), type: typeof item.type === 'string' ? item.type : base.questions[index]?.type ?? '내용 이해',
      stem: item.stem.trim(), choices, answerIndex: parseAnswerIndex(item.answerIndex ?? item.answer, choiceCount),
      explanation: typeof item.explanation === 'string' ? item.explanation.trim() : '', intention: typeof item.intention === 'string' ? item.intention.trim() : '',
      evidenceRefs: cleanStrings(item.evidenceRefs), distractorReasons: cleanStrings(item.distractorReasons), score: typeof item.score === 'number' ? item.score : 2,
    }
  })
  const materialSpec = cleanMaterialSpec(input.materialSpec)
  const nextRevision = base.aiRevision + 1
  const snapshot = { title: input.title, materialTitle: input.materialTitle, material: input.material, materialSpec: input.materialSpec, questions: input.questions }
  return {
    ...base, title: typeof input.title === 'string' ? input.title : base.title, materialTitle: typeof input.materialTitle === 'string' ? input.materialTitle : base.materialTitle,
    material: input.material, materialSpec, questions, choiceCount, aiRevision: nextRevision, validatedRevision: 0, lastImportedJson: JSON.stringify(snapshot, null, 2), updatedAt: new Date().toISOString(),
  }
}

function strictCsatAnswerIndex(value: unknown, itemId: string, questionIndex: number) {
  if (!Number.isInteger(value) || typeof value !== 'number' || value < 1 || value > 5) {
    throw new Error(`문항 카드 ${itemId}의 ${questionIndex + 1}번 문항 answerIndex는 1~5 정수여야 합니다.`)
  }
  return value
}

function assertRequiredQuestionText(value: unknown, field: string, itemId: string, questionIndex: number): asserts value is string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`문항 카드 ${itemId}의 ${questionIndex + 1}번 문항 ${field} 값은 비어 있을 수 없습니다.`)
}

function canonicalCsatQuestionType(value: unknown) {
  if (value === '문맥상 어휘') return '어휘'
  return value
}

function parseQuestionArray(values: unknown[], expected: ReturnType<typeof expectedCsatItemQuestions>, itemId: string, templateId: EnglishQuestion['csatTemplateId'], fallback: EnglishQuestion[] = []) {
  if (values.length !== expected.length) throw new Error(`문항 카드 ${itemId}은 문항 ${expected.length}개가 고정입니다.`)
  return values.map((value, index) => {
    if (!value || typeof value !== 'object') throw new Error(`문항 카드 ${itemId}의 ${index + 1}번 문항 형식이 올바르지 않습니다.`)
    const input = value as Record<string, unknown>
    const blueprint = expected[index]
    if (canonicalCsatQuestionType(input.type) !== blueprint.type) throw new Error(`문항 카드 ${itemId}의 ${index + 1}번 문항 type이 예상값 '${blueprint.type}'과 다릅니다.`)
    assertRequiredQuestionText(input.stem, 'stem', itemId, index)
    assertRequiredQuestionText(input.explanation, 'explanation', itemId, index)
    assertRequiredQuestionText(input.intention, 'intention', itemId, index)
    const providedChoices = cleanStrings(input.choices)
    if (providedChoices.length !== 5 || providedChoices.some((choice) => !choice)) throw new Error(`문항 카드 ${itemId}의 ${index + 1}번 문항은 내용이 채워진 선지 5개가 필요합니다.`)
    if (isInlinePositionTemplate(templateId) && providedChoices.some((choice, choiceIndex) => choice !== CSAT_INLINE_POSITION_CHOICES[choiceIndex])) {
      throw new Error(`문항 카드 ${itemId}의 ${index + 1}번 위치 선택형 choices는 ①~⑤ 표식이어야 합니다.`)
    }
    const choices = isInlinePositionTemplate(templateId) ? [...CSAT_INLINE_POSITION_CHOICES] : providedChoices
    return {
      id: fallback[index]?.id ?? crypto.randomUUID(), type: blueprint.type, stem: input.stem.trim(), choices,
      answerIndex: strictCsatAnswerIndex(input.answerIndex, itemId, index),
      explanation: input.explanation.trim(),
      intention: input.intention.trim(),
      evidenceRefs: cleanStrings(input.evidenceRefs), distractorReasons: cleanStrings(input.distractorReasons),
      score: input.score as number,
      csatTemplateId: templateId ?? fallback[index]?.csatTemplateId, csatSlot: blueprint.slot, csatItemId: itemId,
    }
  })
}

function normalizeImportedTemplateId(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function assertMaterialSpecSemantics(value: unknown, itemId: string) {
  if (value == null) return
  const spec = value as Record<string, unknown>
  if (spec.kind === 'chart') {
    const categoryCount = (spec.categories as unknown[]).length
    const invalidSeries = (spec.series as Array<Record<string, unknown>>).find((series) => (series.values as unknown[]).length !== categoryCount)
    if (invalidSeries) throw new Error(`문항 카드 ${itemId}의 chart categories와 series.values 항목 수가 일치하지 않습니다.`)
  }
  if (spec.kind === 'ordered') {
    const labels = (spec.sections as Array<Record<string, unknown>>).map((section) => section.label)
    if (labels.join(',') !== 'A,B,C') throw new Error(`문항 카드 ${itemId}의 ordered material은 A/B/C section을 순서대로 정확히 한 번씩 포함해야 합니다.`)
  }
  if (spec.kind === 'summary' && !(spec.summary as string).trim()) throw new Error(`문항 카드 ${itemId}의 summary material에 summary 문자열이 필요합니다.`)
  if (spec.kind === 'longNarrative') {
    const labels = (spec.sections as Array<Record<string, unknown>>).map((section) => section.label)
    if (labels.join(',') !== 'A,B,C,D') throw new Error(`문항 카드 ${itemId}의 longNarrative material은 A/B/C/D section을 순서대로 정확히 한 번씩 포함해야 합니다.`)
  }
}

function parseCsatBatchJson(input: Record<string, unknown>, base: EnglishQuestionSet): EnglishQuestionSet {
  const normalized = normalizeCsatSet(base)
  const currentItems = getCsatItems(normalized)
  if (currentItems.some((item) => !item.design)) throw new Error('모든 문항 설계 카드에서 번호 템플릿을 먼저 선택해 주세요.')
  const rawItems: unknown[] = Array.isArray(input.items) ? input.items : []
  if (!rawItems.length) throw new Error('수능형 JSON에는 items 배열이 필요합니다.')
  if (rawItems.length !== currentItems.length) throw new Error(`요청한 문항 카드가 누락되었습니다. ${currentItems.length}개를 모두 반환해야 합니다.`)
  const totalQuestionCount = currentItems.reduce((total, item) => total + expectedCsatItemQuestions(item).length, 0)
  if (totalQuestionCount > MAX_CSAT_SET_QUESTIONS) throw new Error(`수능형 Generation JSON의 실제 하위 문항 합계는 최대 ${MAX_CSAT_SET_QUESTIONS}개입니다.`)
  const records = rawItems.map((value, index) => {
    if (!value || typeof value !== 'object') throw new Error(`items[${index}] 형식이 올바르지 않습니다.`)
    return value as Record<string, unknown>
  })
  const ids = records.map((record) => typeof record.itemId === 'string' ? record.itemId : '')
  if (ids.some((id) => !id)) throw new Error('모든 items 항목에 itemId가 필요합니다.')
  if (new Set(ids).size !== ids.length) throw new Error('items 배열에 중복된 itemId가 있습니다.')
  const knownIds = new Set(currentItems.map((item) => item.id))
  const unknown = ids.find((id) => !knownIds.has(id))
  if (unknown) throw new Error(`알 수 없는 itemId입니다: ${unknown}`)

  const nextItems = currentItems.map((item) => {
    const record = records.find((candidate) => candidate.itemId === item.id)!
    const design = item.design!
    const template = getCsatTemplate(design.templateId)
    const allowedVariant = design.variantId === 'standard' || Boolean(template.variants?.some((variant) => variant.id === design.variantId))
    if (!allowedVariant) throw new Error(`문항 카드 ${item.id}의 templateId와 variantId 조합이 허용되지 않습니다.`)
    if (normalizeImportedTemplateId(record.templateId) !== design.templateId) throw new Error(`문항 카드 ${item.id}의 templateId가 요청과 다릅니다.`)
    if (record.variantId !== design.variantId) throw new Error(`문항 카드 ${item.id}의 variantId가 요청과 다릅니다.`)
    if (typeof record.material !== 'string' || !Array.isArray(record.questions)) throw new Error(`문항 카드 ${item.id}에는 material과 questions가 필요합니다.`)
    assertMaterialSpecSemantics(record.materialSpec, item.id)
    const expected = expectedCsatItemQuestions(item)
    return {
      ...item,
      materialTitle: typeof record.materialTitle === 'string' ? record.materialTitle.trim() : '',
      material: record.material,
      materialSpec: cleanMaterialSpec(record.materialSpec),
      questions: parseQuestionArray(record.questions, expected, item.id, design.templateId, item.questions),
      qualityReview: cleanCsatQualityReview(record.qualityReview),
    }
  })
  const nextRevision = base.aiRevision + 1
  const snapshot = {
    title: typeof input.title === 'string' ? input.title : base.title,
    items: records,
  }
  return {
    ...normalized, title: typeof input.title === 'string' ? input.title : base.title, csatItems: nextItems,
    aiRevision: nextRevision, validatedRevision: 0, lastImportedJson: JSON.stringify(snapshot, null, 2), updatedAt: new Date().toISOString(),
  }
}

const normalizeEvidence = (value: string) => value.replace(/\[\[(?:밑줄|삽입문장|삽입위치):([^\]]+)\]\]/g, '$1').replace(/\[\[(?:빈칸|요약빈칸)(?::[^\]]+)?\]\]/g, '').replace(/\[\[선택:[^|]+\|([^|]+)\|([^\]]+)\]\]/g, '$1 $2').replace(/\s+/g, ' ').trim().toLowerCase()

function hasUnnecessaryStructuredBreaks(spec?: CsatMaterialSpec) {
  if (!spec) return false
  if (spec.kind === 'prose' || spec.kind === 'longExpository') return spec.paragraphs.length > 1 || spec.paragraphs.some((paragraph) => hasUnnecessaryPassageBreaks(paragraph))
  if (spec.kind === 'ordered') return hasUnnecessaryPassageBreaks(spec.lead) || spec.sections.some((section) => hasUnnecessaryPassageBreaks(section.text))
  if (spec.kind === 'insertion') return hasUnnecessaryPassageBreaks(spec.givenSentence) || hasUnnecessaryPassageBreaks(spec.body)
  if (spec.kind === 'summary') return hasUnnecessaryPassageBreaks(spec.summary)
  if (spec.kind === 'longNarrative') return spec.sections.some((section) => hasUnnecessaryPassageBreaks(section.text))
  if (spec.kind === 'practical') return hasUnnecessaryPassageBreaks(spec.heading) || Object.values(spec.fields).some((value) => hasUnnecessaryPassageBreaks(value)) || spec.notes.some((note) => hasUnnecessaryPassageBreaks(note))
  return false
}

const englishWords = (value: string) => value.toLowerCase().match(/[a-z]+(?:'[a-z]+)*/g) ?? []
const overlapStopWords = new Set(['about', 'after', 'again', 'also', 'among', 'because', 'before', 'being', 'between', 'could', 'from', 'have', 'into', 'more', 'other', 'should', 'than', 'that', 'their', 'there', 'these', 'they', 'this', 'those', 'through', 'under', 'when', 'where', 'which', 'while', 'with', 'would'])

function hasExcessiveAnswerEcho(material: string, answer: string) {
  const passageWords = englishWords(material)
  const answerWords = englishWords(answer)
  if (answerWords.length < 3) return false
  const passage = ` ${passageWords.join(' ')} `
  if (answerWords.length >= 4 && answerWords.some((_, index) => index <= answerWords.length - 4 && passage.includes(` ${answerWords.slice(index, index + 4).join(' ')} `))) return true
  const passageSet = new Set(passageWords.filter((word) => word.length > 3 && !overlapStopWords.has(word)))
  const answerContent = answerWords.filter((word) => word.length > 3 && !overlapStopWords.has(word))
  return answerContent.length >= 4 && answerContent.filter((word) => passageSet.has(word)).length / answerContent.length >= 0.75
}

function choiceGrammarShape(choice: string) {
  const words = englishWords(choice)
  const first = words[0] ?? ''
  if (first === 'to') return 'to-infinitive'
  if (first.endsWith('ing')) return 'gerund'
  if (['can', 'could', 'may', 'might', 'must', 'should', 'will', 'would'].includes(first)) return 'modal-clause'
  if (['that', 'whether', 'how', 'why', 'when', 'where'].includes(first)) return 'subordinate-clause'
  if (['a', 'an', 'the'].includes(first)) return 'noun-phrase'
  return 'other'
}

function abstractWordRatio(choice: string) {
  const words = englishWords(choice)
  if (!words.length) return 0
  return words.filter((word) => /(tion|sion|ity|ment|ness|ance|ence|ism|acy|ive|ous|al)$/.test(word)).length / words.length
}

function validateChoiceBalance(question: EnglishQuestion, material: string, add: (issue: Omit<ValidationIssue, 'id'>) => void) {
  if (isInlinePositionTemplate(question.csatTemplateId) || question.choices.some((choice) => !choice.trim())) return
  const answer = question.choices[question.answerIndex - 1] ?? ''
  if (hasExcessiveAnswerEcho(csatPrintableMaterialText(material), answer)) add({ level: 'warning', questionId: question.id, label: '정답 직접 재현', detail: '정답 선지가 지문의 연속 구문이나 핵심어를 과도하게 되풀이합니다. 동의어·상위 개념·관계 재진술을 사용하세요.' })
  const lengths = question.choices.map((choice) => englishWords(choice).length)
  const sorted = [...lengths].sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)] || 1
  const answerLength = lengths[question.answerIndex - 1] ?? median
  if (Math.abs(answerLength - median) >= 4 && (answerLength > median * 1.45 || answerLength < median * 0.65)) add({ level: 'warning', questionId: question.id, label: '정답 선지 길이 불균형', detail: `정답 선지만 ${answerLength}단어로 다른 선지의 중앙값 ${median}단어와 두드러지게 다릅니다.` })
  const shapes = question.choices.map(choiceGrammarShape)
  const shapeCounts = new Map(shapes.map((shape) => [shape, shapes.filter((candidate) => candidate === shape).length]))
  const answerShape = shapes[question.answerIndex - 1]
  if (shapeCounts.get(answerShape) === 1 && Math.max(...shapeCounts.values()) >= 3) add({ level: 'warning', questionId: question.id, label: '정답 문법 구조 불균형', detail: '정답 선지만 다른 문법 구조로 시작해 형태 자체가 단서가 될 수 있습니다.' })
  const abstractRatios = question.choices.map(abstractWordRatio)
  const sortedRatios = [...abstractRatios].sort((a, b) => a - b)
  const medianRatio = sortedRatios[Math.floor(sortedRatios.length / 2)] ?? 0
  const answerRatio = abstractRatios[question.answerIndex - 1] ?? 0
  if (englishWords(answer).length >= 4 && Math.abs(answerRatio - medianRatio) > 0.35) add({ level: 'warning', questionId: question.id, label: '정답 추상도 불균형', detail: '정답 선지의 추상어 비율이 다른 선지와 크게 달라 표현 수준 자체가 단서가 될 수 있습니다.' })
}

function validateCsatItemQuality(item: ReturnType<typeof getCsatItems>[number], add: (issue: Omit<ValidationIssue, 'id'>) => void) {
  if (!item.design) return
  const preset = normalizeCsatPassageLength(item.passageLength)
  const range = getCsatPassageLengthRange(item.design.templateId, preset)
  const actualWords = countCsatPassageWords(item.material, item.materialSpec, item.design.templateId === '25' ? item.questions[0]?.choices : undefined)
  if (actualWords && (actualWords < range.min || actualWords > range.max)) add({ level: 'warning', label: '지문 길이 범위', detail: `${CSAT_PASSAGE_LENGTH_LABELS[preset]} 목표는 ${range.min}~${range.max}단어이고 현재 지문은 ${actualWords}단어입니다.` })
  item.questions.forEach((question) => validateChoiceBalance(question, item.materialSpec && item.materialSpec.kind !== 'chart' ? csatPrintableMaterialText('', item.materialSpec) : item.material, add))

  const review = item.qualityReview
  if (!review) { add({ level: 'warning', label: 'AI 품질 검수 누락', detail: '가져오기는 완료되었지만 qualityReview가 없습니다. 재검토 프롬프트로 품질 점수와 판단 근거를 보완하세요.' }); return }
  const passageScores = [
    ['자연스러움', review.passage.naturalness, false],
    ['논리 구조', review.passage.logicStructure, false],
    ['어휘 수준', review.passage.vocabularyLevel, false],
    ['템플릿 유사도', review.passage.templateFidelity, true],
  ] as const
  passageScores.forEach(([label, score, critical]) => {
    if (score === undefined || score < 0 || score > 10) add({ level: 'warning', label: '품질 점수 오류', detail: `지문 ${label} 점수는 0~10 범위로 기록해야 합니다.` })
    else if (score < 8) add({ level: 'warning', label: '품질 기준 미달', detail: `지문 ${label} 점수가 ${score}/10입니다. 8점 미만 결과는 AI가 한 차례 수정해야 합니다.` })
    else if (critical && score < 9) add({ level: 'warning', label: '핵심 품질 목표 미달', detail: `지문 ${label} 점수는 9점 이상을 목표로 합니다. 현재 ${score}/10입니다.` })
  })
  const expected = expectedCsatItemQuestions(item)
  expected.forEach((blueprint, index) => {
    const question = item.questions[index]
    const assessment = review.questions.find((candidate) => candidate.slot === blueprint.slot)
    if (!assessment) { add({ level: 'warning', questionId: question?.id, label: '문항 품질 검수 누락', detail: `${blueprint.slot} 역할의 품질 검수 결과가 없습니다.` }); return }
    const scores = [
      ['정답 추론성', assessment.answerInference, true],
      ['오답 매력도', assessment.distractorPlausibility, true],
      ['선지 균형', assessment.choiceBalance, false],
    ] as const
    scores.forEach(([label, score, critical]) => {
      if (score === undefined || score < 0 || score > 10) add({ level: 'warning', questionId: question?.id, label: '품질 점수 오류', detail: `${blueprint.slot} ${label} 점수는 0~10 범위로 기록해야 합니다.` })
      else if (score < 8) add({ level: 'warning', questionId: question?.id, label: '품질 기준 미달', detail: `${blueprint.slot} ${label} 점수가 ${score}/10입니다. 8점 미만 결과는 AI가 한 차례 수정해야 합니다.` })
      else if (critical && score < 9) add({ level: 'warning', questionId: question?.id, label: '핵심 품질 목표 미달', detail: `${blueprint.slot} ${label} 점수는 9점 이상을 목표로 합니다. 현재 ${score}/10입니다.` })
    })
    if (assessment.directAnswerOverlap === undefined) add({ level: 'warning', questionId: question?.id, label: '정답 재현 검수 누락', detail: `${blueprint.slot}의 directAnswerOverlap 판단이 없습니다.` })
    else if (assessment.directAnswerOverlap) add({ level: 'warning', questionId: question?.id, label: '정답 직접 재현', detail: `${blueprint.slot} 정답이 지문 표현을 직접 재현한다고 AI가 판정했습니다.` })
    if (!Number.isInteger(assessment.strongestDistractorIndex) || (assessment.strongestDistractorIndex ?? 0) < 1 || (assessment.strongestDistractorIndex ?? 0) > 5) add({ level: 'warning', questionId: question?.id, label: '강력한 오답 번호 오류', detail: `${blueprint.slot}의 가장 강력한 오답 번호는 1~5 정수여야 합니다.` })
    else if (assessment.strongestDistractorIndex === question?.answerIndex) add({ level: 'warning', questionId: question?.id, label: '강력한 오답 번호 오류', detail: `${blueprint.slot}의 가장 강력한 오답이 정답 번호와 같습니다.` })
    if (!assessment.decisiveReason?.trim()) add({ level: 'warning', questionId: question?.id, label: '결정적 구분 근거 없음', detail: `${blueprint.slot}의 정답과 가장 강력한 오답을 가르는 근거가 없습니다.` })
    if (assessment.expectedDifficulty === undefined || assessment.expectedDifficulty < 1 || assessment.expectedDifficulty > 5) add({ level: 'warning', questionId: question?.id, label: '예상 난도 오류', detail: `${blueprint.slot}의 예상 난도는 1~5 범위로 기록해야 합니다.` })
  })
}

function validateCsatStructure(set: EnglishQuestionSet, add: (issue: Omit<ValidationIssue, 'id'>) => void) {
  const design = effectiveCsatDesign(set)
  const template = getCsatTemplate(design.templateId)
  const expected = expectedCsatQuestions(set)
  const underlineCount = (set.material.match(/\[\[밑줄:[^\]]+\]\]/g) ?? []).length
  const blankCount = (set.material.match(/\[\[빈칸\]\]/g) ?? []).length
  const selectionCount = (set.material.match(/\[\[선택:[^\]]+\]\]/g) ?? []).length
  const hasEvery = (markers: string[]) => markers.every((marker) => set.material.includes(marker))
  if (set.choiceCount !== 5) add({ level: 'error', label: '수능형 선지 수', detail: '수능형 번호 템플릿은 5지선다로 고정됩니다.' })
  if (set.questions.length !== expected.length) add({ level: 'error', label: '고정 문항 수', detail: `${template.numberLabel}은 문항 ${expected.length}개가 필요합니다.` })
  if (set.difficulty < template.difficultyRange[0] || set.difficulty > template.difficultyRange[1]) add({ level: 'warning', label: '권장 난도 범위', detail: `${template.numberLabel}의 권장 난도는 ${template.difficultyRange[0]}~${template.difficultyRange[1]}입니다. 현재 설정 ${set.difficulty}를 그대로 사용할 수는 있습니다.` })
  const missingInputs = template.inputFields.filter((item) => !design.userInputs[item.key]?.trim()).map((item) => item.label)
  if (missingInputs.length) add({ level: 'warning', label: '추천 입력 미완성', detail: `AI가 임의로 결정할 항목: ${missingInputs.join(', ')}` })
  expected.forEach((blueprint, index) => {
    const actual = set.questions[index]
    if (!actual) return
    if (actual.type !== blueprint.type || actual.csatSlot && actual.csatSlot !== blueprint.slot) add({ level: 'error', questionId: actual.id, label: '번호 템플릿 역할 불일치', detail: `${index + 1}번 문항은 ${blueprint.type} 역할이어야 합니다.` })
    if (actual.choices.some((choice) => choice.trim())) {
      if (blueprint.choiceStyle === 'korean' && actual.choices.some((choice) => !/[가-힣]/.test(choice))) add({ level: 'warning', questionId: actual.id, label: '한국어 선지 형식', detail: `${template.numberLabel} ${blueprint.type} 문항은 한국어 선지가 기본입니다.` })
      if ((blueprint.choiceStyle === 'english' || blueprint.choiceStyle === 'emotion-pair') && actual.choices.some((choice) => /[가-힣]/.test(choice))) add({ level: 'warning', questionId: actual.id, label: '영어 선지 형식', detail: `${template.numberLabel} ${blueprint.type} 문항은 영어 선지가 기본입니다.` })
      if (blueprint.choiceStyle === 'emotion-pair' && actual.choices.some((choice) => !/(→|->)/.test(choice))) add({ level: 'warning', questionId: actual.id, label: '심경 변화 선지', detail: '심경 변화 선지는 initial → final 형용사쌍으로 작성하세요.' })
    }
  })

  if (design.templateId === '21' && underlineCount !== 1) add({ level: 'error', label: '함의 밑줄 수', detail: '21번형은 [[밑줄:표현]]이 정확히 1개 필요합니다.' })
  if (design.templateId === '29' && underlineCount !== 5) add({ level: 'error', label: '어법 표적 수', detail: '29번형은 서로 다른 어법 표적 [[밑줄:...]] 5개가 필요합니다.' })
  if (design.templateId === '30') {
    if (design.variantId === 'vocabulary-box' && selectionCount !== 3) add({ level: 'error', label: '박스형 어휘 표적 수', detail: '박스형 어휘는 [[선택:A|단어1|단어2]] 형식의 표적 3개가 필요합니다.' })
    if (design.variantId === 'standard' && underlineCount !== 5) add({ level: 'error', label: '어휘 표적 수', detail: '30번 기본형은 [[밑줄:...]] 표적 5개가 필요합니다.' })
  }
  if (['31', '32', '33', '34'].includes(design.templateId) && blankCount !== 1) add({ level: 'error', label: '빈칸 수', detail: `${template.numberLabel}은 [[빈칸]]이 정확히 1개 필요합니다.` })
  if (design.templateId === '35' && !hasEvery(['①', '②', '③', '④', '⑤'])) add({ level: 'error', label: '번호 문장 수', detail: '35번형은 ①~⑤ 번호 문장이 모두 필요합니다.' })
  if (design.templateId === '36' || design.templateId === '37') {
    if (!hasEvery(['(A)', '(B)', '(C)'])) add({ level: 'error', label: '순서 단락 구조', detail: `${template.numberLabel}은 도입문과 (A), (B), (C) 단락이 필요합니다.` })
  }
  if (design.templateId === '38' || design.templateId === '39') {
    const positionCount = (set.material.match(/\[\[삽입위치:[①②③④⑤]\]\]/g) ?? []).length
    const sentenceCount = (set.material.match(/\[\[삽입문장:[^\]]+\]\]/g) ?? []).length
    if (sentenceCount !== 1 || positionCount !== 5) add({ level: 'error', label: '삽입 자료 구조', detail: `${template.numberLabel}은 삽입문장 1개와 위치 ①~⑤ 5개가 필요합니다.` })
  }
  if (design.templateId === '40' && !hasEvery(['[[요약빈칸:A]]', '[[요약빈칸:B]]'])) add({ level: 'error', label: '요약 빈칸 구조', detail: '40번형은 [[요약빈칸:A]]와 [[요약빈칸:B]]가 필요합니다.' })
  if (design.templateId === '41-42') {
    if (design.variantId === 'standard' && underlineCount !== 5) add({ level: 'error', label: '장문 어휘 표적 수', detail: '41~42번 기본형은 42번용 밑줄 표적 5개가 필요합니다.' })
    if (design.variantId === 'long-order-content' && !hasEvery(['(A)', '(B)', '(C)'])) add({ level: 'error', label: '장문 순서 구조', detail: '순서+내용 변형에는 (A), (B), (C) 단락이 필요합니다.' })
    if (design.variantId === 'long-implication-blank' && (underlineCount !== 1 || blankCount !== 1)) add({ level: 'error', label: '장문 함의·빈칸 구조', detail: '함의+빈칸 변형에는 밑줄 1개와 빈칸 1개가 필요합니다.' })
  }
  if (design.templateId === '43-45') {
    if (!hasEvery(['(A)', '(B)', '(C)', '(D)'])) add({ level: 'error', label: '복합 장문 구획', detail: '43~45번형은 (A)~(D) 네 구획이 필요합니다.' })
    if (design.variantId === 'standard') {
      const decorated = decorateCsatMaterialText(set.material, design.templateId, design.variantId)
      const referentUnderlineCount = (decorated.match(/\[\[밑줄:[^\]]+\]\]/g) ?? []).length
      if (!hasEvery(['(a)', '(b)', '(c)', '(d)', '(e)']) || referentUnderlineCount !== 5) add({ level: 'error', label: '지칭 표적 구조', detail: '43~45번 기본형은 (a)~(e) 표적과 밑줄 친 지칭어 5개가 필요합니다.' })
    }
    if (design.variantId === 'narrative-emotion-implication-blank' && (underlineCount !== 1 || blankCount !== 1)) add({ level: 'error', label: '복합 장문 변형 구조', detail: '고급 변형에는 함의 밑줄 1개와 빈칸 1개가 필요합니다.' })
  }

  if (design.templateId === '25') {
    if (!set.materialSpec) add({ level: 'warning', label: '도표 구조 자료 없음', detail: 'materialSpec chart 또는 첨부 이미지를 사용해 실제 도표를 제공하세요.' })
    if (set.materialSpec?.kind === 'chart') {
      const chart = set.materialSpec
      if (!chart.categories.length || !chart.series.length || chart.series.some((series) => series.values.length !== chart.categories.length)) add({ level: 'error', label: '도표 수치 구조', detail: '모든 계열의 수치 개수는 범주 개수와 같아야 합니다.' })
    } else if (set.materialSpec) add({ level: 'error', label: '도표 자료 형식', detail: '25번형 materialSpec.kind는 chart여야 합니다.' })
    const statements = set.questions[0]?.choices ?? []
    if (statements.some((statement) => /[가-힣]/.test(statement))) add({ level: 'warning', label: '도표 진술 언어', detail: '25번형의 ①~⑤ 진술은 실제 시험지 형식에 맞는 영어 완전문장으로 작성하세요.' })
    if (/[①②③④⑤]/.test(set.material)) add({ level: 'warning', label: '도표 번호 중복', detail: '25번형 material에는 영어 도입부만 두고, ①~⑤ 진술은 choices에 번호 없이 작성하세요. 앱이 시험지 출력 시 자동으로 한 문단에 합칩니다.' })
  }
  if (design.templateId === '27' || design.templateId === '28') {
    if (!set.materialSpec) add({ level: 'warning', label: '실용문 구조 자료 없음', detail: 'materialSpec practical 또는 첨부 이미지를 사용해 안내문을 제공하세요.' })
    else if (set.materialSpec.kind !== 'practical') add({ level: 'error', label: '실용문 자료 형식', detail: `${template.numberLabel} materialSpec.kind는 practical이어야 합니다.` })
  }
}

export function validateEnglishSet(set: EnglishQuestionSet): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const add = (issue: Omit<ValidationIssue, 'id'>) => issues.push({ id: crypto.randomUUID(), ...issue })
  if (set.mode === 'csat') {
    const normalized = normalizeCsatSet(set)
    const items = getCsatItems(normalized)
    const plannedQuestions = plannedCsatSetQuestionCount(items)
    if (plannedQuestions > MAX_CSAT_SET_QUESTIONS) add({ level: 'error', label: '세트 문항 수', detail: `수능형 세트는 실제 생성 문항을 최대 ${MAX_CSAT_SET_QUESTIONS}개까지 만들 수 있습니다. 현재 ${plannedQuestions}문항입니다.` })
    items.forEach((item, itemIndex) => {
      const card = `카드 ${itemIndex + 1}`
      if (!item.design) { add({ level: 'error', label: `${card} · 템플릿 미선택`, detail: '대분류와 번호 템플릿을 선택해 주세요.' }); return }
      const resolved = resolvedCsatItem(normalized, item)
      const virtualSet: EnglishQuestionSet = {
        ...normalized, csatItems: undefined, csatDesign: item.design, materialMode: item.materialMode, sourceKind: item.sourceKind,
        materialTitle: item.materialTitle, material: item.material, materialSpec: item.materialSpec, questions: item.questions,
        targetLevel: resolved.targetLevel, difficulty: resolved.difficulty, topic: resolved.topic, intention: resolved.intention,
      }
      const cardAdd = (issue: Omit<ValidationIssue, 'id'>) => add({ ...issue, label: `${card} · ${issue.label}` })
      if (!item.material.trim()) cardAdd({ level: 'error', label: '자료 없음', detail: '이 카드의 영어 지문 또는 자료가 비어 있습니다.' })
      if (hasUnnecessaryPassageBreaks(item.material, item.design.templateId) || hasUnnecessaryStructuredBreaks(item.materialSpec)) cardAdd({ level: 'warning', label: '불필요한 문단 구분', detail: '출력에서는 자동으로 한 문단으로 합치지만, AI 결과 JSON도 필수 구획 외에는 빈 줄 없이 작성하는 것을 권장합니다.' })
      validateQuestionCollection(virtualSet, item.questions, item.material, card, cardAdd)
      validateCsatStructure(virtualSet, cardAdd)
      validateCsatItemQuality(item, cardAdd)
    })
    const grammar = items.find((item) => item.design?.templateId === '29')
    const vocabulary = items.find((item) => item.design?.templateId === '30')
    if (grammar && vocabulary) {
      const score = (grammar.questions[0]?.score ?? 0) + (vocabulary.questions[0]?.score ?? 0)
      if (score !== 5) add({ level: 'warning', label: '29·30번 권장 배점', detail: `어법과 어휘의 배점 합은 5점을 권장합니다. 현재 ${score}점입니다.` })
    }
    const answers = items.flatMap((item) => item.questions).map((question) => question.answerIndex)
    if (answers.length >= 5) {
      const counts = [1, 2, 3, 4, 5].map((answer) => answers.filter((value) => value === answer).length)
      if (Math.max(...counts) - Math.min(...counts) > 2) add({ level: 'warning', label: '정답 위치 분산', detail: '일괄 생성된 전체 문항에서 정답 위치가 한 번호에 치우쳐 있습니다.' })
    }
    if (!issues.length) add({ level: 'pass', label: '기본 검사 통과', detail: `AI 결과 리비전 ${set.aiRevision}의 ${items.length}개 문항 카드를 확인했습니다.` })
    return issues
  }
  if (!set.material.trim()) add({ level: 'error', label: '자료 없음', detail: '시험지에 사용할 영어 지문 또는 자료가 비어 있습니다.' })
  if (set.mode === 'school' && set.providedPassage) providedPassageValidationMessages(set).forEach((message) => add(message))
  if (hasUnnecessaryPassageBreaks(set.material) || hasUnnecessaryStructuredBreaks(set.materialSpec)) add({ level: 'warning', label: '불필요한 문단 구분', detail: '출력에서는 자동으로 한 문단으로 합치지만, 일반 영어 지문은 빈 줄 없이 작성하는 것을 권장합니다.' })
  const comparableMaterial = normalizeEvidence(set.material)
  set.questions.forEach((question, index) => {
    const prefix = `${index + 1}번 문항`
    if (!question.stem.trim()) add({ level: 'error', questionId: question.id, label: '발문 없음', detail: `${prefix}의 발문이 비어 있습니다.` })
    if (question.choices.length !== set.choiceCount || question.choices.some((choice) => !choice.trim())) add({ level: 'error', questionId: question.id, label: '선지 수 오류', detail: `${prefix}은 내용이 채워진 선지 ${set.choiceCount}개가 필요합니다.` })
    const normalizedChoices = question.choices.map((choice) => choice.replace(/\s+/g, ' ').trim().toLowerCase())
    if (new Set(normalizedChoices).size !== normalizedChoices.length) add({ level: 'error', questionId: question.id, label: '중복 선지', detail: `${prefix}에 동일한 선지가 있습니다.` })
    if (question.answerIndex < 1 || question.answerIndex > set.choiceCount) add({ level: 'error', questionId: question.id, label: '정답 범위', detail: `${prefix}의 정답 번호가 선지 범위를 벗어났습니다.` })
    if (!question.explanation.trim()) add({ level: 'warning', questionId: question.id, label: '해설 없음', detail: `${prefix}의 상세 해설이 비어 있습니다.` })
    if (!question.evidenceRefs.length) add({ level: 'warning', questionId: question.id, label: '정답 근거 없음', detail: `${prefix}의 지문 직접 인용 근거가 없습니다.` })
    question.evidenceRefs.forEach((evidence) => {
      if (normalizeEvidence(evidence) && !comparableMaterial.includes(normalizeEvidence(evidence))) add({ level: 'error', questionId: question.id, label: '정답 근거 불일치', detail: `${prefix}의 근거 “${evidence.slice(0, 48)}”를 지문에서 찾을 수 없습니다.` })
    })
    if (question.distractorReasons.length < Math.max(1, set.choiceCount - 1)) add({ level: 'warning', questionId: question.id, label: '오답 근거 부족', detail: `${prefix}의 오답별 오류 근거를 확인하세요.` })
    const type = question.type
    const boxVocabulary = false
    if (/어법|어휘|함축/.test(type) && !boxVocabulary && !set.material.includes('[[밑줄:')) add({ level: 'warning', questionId: question.id, label: '밑줄 표식 없음', detail: `${prefix} 유형은 지문에 [[밑줄:대상 표현]] 표식을 권장합니다.` })
    if (/빈칸/.test(type) && !/\[\[(?:빈칸|요약빈칸)\]\]/.test(set.material)) add({ level: 'error', questionId: question.id, label: '빈칸 표식 없음', detail: `${prefix}에 필요한 빈칸 표식이 지문에 없습니다.` })
    if (/순서/.test(type) && !['(A)', '(B)', '(C)'].every((marker) => set.material.includes(marker))) add({ level: 'warning', questionId: question.id, label: '순서 자료 확인', detail: `${prefix} 지문에 (A), (B), (C) 구분이 모두 있는지 확인하세요.` })
    const hasDerivedProvidedInsertion = set.providedPassage?.result?.materialOperation?.kind === 'insert_sentence'
    if (/삽입/.test(type) && !hasDerivedProvidedInsertion && (!set.material.includes('[[삽입문장:') || !set.material.includes('[[삽입위치:'))) add({ level: 'warning', questionId: question.id, label: '삽입 표식 확인', detail: `${prefix} 지문에 삽입 문장과 위치 표식이 필요합니다.` })
  })
  if (!issues.length) add({ level: 'pass', label: '기본 검사 통과', detail: `AI 결과 리비전 ${set.aiRevision}의 형식과 지문 연결을 확인했습니다.` })
  return issues
}

function validateQuestionCollection(set: EnglishQuestionSet, questions: EnglishQuestion[], material: string, prefix: string, add: (issue: Omit<ValidationIssue, 'id'>) => void) {
  const comparableMaterial = normalizeEvidence(set.csatDesign?.templateId === '25' && questions[0] ? embedCsatChartChoices(material, questions[0].choices) : material)
  questions.forEach((question, index) => {
    const questionLabel = `${prefix}의 ${index + 1}번 문항`
    const inlinePosition = isInlinePositionTemplate(question.csatTemplateId)
    if (!question.stem.trim()) add({ level: 'error', questionId: question.id, label: '발문 없음', detail: `${questionLabel}의 발문이 비어 있습니다.` })
    if (inlinePosition) {
      if (question.choices.join('|') !== CSAT_INLINE_POSITION_CHOICES.join('|')) add({ level: 'error', questionId: question.id, label: '위치 번호 오류', detail: `${questionLabel}은 별도 내용 선지 없이 지문 안 ①~⑤ 위치만 사용해야 합니다.` })
    } else if (question.choices.length !== 5 || question.choices.some((choice) => !choice.trim())) add({ level: 'error', questionId: question.id, label: '선지 수 오류', detail: `${questionLabel}은 내용이 채워진 선지 5개가 필요합니다.` })
    const normalizedChoices = question.choices.map((choice) => choice.replace(/\s+/g, ' ').trim().toLowerCase())
    if (new Set(normalizedChoices).size !== normalizedChoices.length) add({ level: 'error', questionId: question.id, label: '중복 선지', detail: `${questionLabel}에 동일한 선지가 있습니다.` })
    if (question.answerIndex < 1 || question.answerIndex > 5) add({ level: 'error', questionId: question.id, label: '정답 범위', detail: `${questionLabel}의 정답 번호가 선지 범위를 벗어났습니다.` })
    if (!question.explanation.trim()) add({ level: 'warning', questionId: question.id, label: '해설 없음', detail: `${questionLabel}의 상세 해설이 비어 있습니다.` })
    if (!question.evidenceRefs.length) add({ level: 'warning', questionId: question.id, label: '정답 근거 없음', detail: `${questionLabel}의 지문 직접 인용 근거가 없습니다.` })
    question.evidenceRefs.forEach((evidence) => {
      if (normalizeEvidence(evidence) && !comparableMaterial.includes(normalizeEvidence(evidence))) add({ level: 'error', questionId: question.id, label: '정답 근거 불일치', detail: `${questionLabel}의 근거 “${evidence.slice(0, 48)}”를 지문에서 찾을 수 없습니다.` })
    })
    if (question.distractorReasons.length < 4) add({ level: 'warning', questionId: question.id, label: '오답 근거 부족', detail: `${questionLabel}의 오답별 오류 근거를 확인하세요.` })
    const boxVocabulary = set.csatDesign?.variantId === 'vocabulary-box'
    if (/어법|어휘|함축/.test(question.type) && !boxVocabulary && !material.includes('[[밑줄:')) add({ level: 'warning', questionId: question.id, label: '밑줄 표식 없음', detail: `${questionLabel} 유형은 지문에 [[밑줄:대상 표현]] 표식이 필요합니다.` })
  })
}

export function generateReviewPrompt(set: EnglishQuestionSet, issues: ValidationIssue[]) {
  const source = set.lastImportedJson || JSON.stringify(set.mode === 'csat' ? {
    title: set.title,
    items: getCsatItems(normalizeCsatSet(set)).map((item) => ({ itemId: item.id, templateId: item.design?.templateId, variantId: item.design?.variantId, materialTitle: item.materialTitle, material: item.material, materialSpec: item.materialSpec ?? null, questions: item.questions, qualityReview: item.qualityReview })),
  } : { title: set.title, materialTitle: set.materialTitle, material: set.material, questions: set.questions }, null, 2)
  const actionable = issues.filter((issue) => issue.level !== 'pass')
  const csatRules = set.mode === 'csat' ? `\n\n${buildCsatPromptSection(set)}` : ''
  return `[역할]\n당신은 고등학교 영어 객관식 세트의 재검토자이다. 아래 자동 검사 결과를 반영하여 원본 JSON을 수정하라.\n\n[검사 대상]\nAI 결과 리비전 ${set.aiRevision}${csatRules}\n\n[자동 검사]\n${actionable.length ? actionable.map((issue) => `- ${issue.label}: ${issue.detail}`).join('\n') : '- 형식 검사는 통과했으나 정답 유일성과 문항 자연스러움을 다시 검토할 것'}\n\n[수정 원칙]\n- 이 입력은 이미 생성된 결과의 재검토이므로 별도의 설계 승인 없이 수정된 JSON을 반환한다.\n- 먼저 기존 문항을 분석하고 최소 수정안과 적극 수정안을 내부적으로 비교한 뒤, 더 타당한 최종 JSON 하나만 반환한다. 두 수정안을 출력하지 않는다.\n- 타당한 지문과 문항은 보존한다.\n- 객관식 ${set.choiceCount}지선다와 단일 정답을 유지한다.\n- evidenceRefs는 지문에 실제로 존재하는 연속된 직접 인용으로 기록한다.\n- 오답은 각기 다른 명백한 오류 근거를 갖게 한다.\n- 일반 영어 지문은 마지막 문장까지 빈 줄 없이 하나의 연속 문단으로 수정하고, 구조형 문항은 필수 구획만 유지한다.\n- 지문 길이·정답 추론성·오답 매력도·선지 균형을 다시 채점하고 qualityReview를 갱신한다.\n- 어느 품질 점수든 8점 미만이면 한 차례 수정하고, 정답 추론성·오답 매력도·템플릿 유사도는 9점 이상을 목표로 한다.\n- 설명이나 마크다운 없이 수정된 JSON 하나만 출력한다.\n\n[원본 JSON]\n${source}`
}

export interface EnglishGptConfig { school: string; csat: string; custom: string; csatVerifier: string }

export { generateCsatGptInstructions }

export async function loadEnglishGptConfig(): Promise<EnglishGptConfig> {
  const empty: EnglishGptConfig = { school: '', csat: '', custom: '', csatVerifier: '' }
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}english-gpt-config.json`, { cache: 'no-store' })
    if (!response.ok) return empty
    const value: unknown = await response.json()
    if (!value || typeof value !== 'object') return empty
    return Object.fromEntries((Object.keys(empty) as Array<keyof EnglishGptConfig>).map((key) => {
      const url = typeof (value as Record<string, unknown>)[key] === 'string' ? String((value as Record<string, unknown>)[key]).trim() : ''
      return [key, /^https:\/\/chatgpt\.com\/g\//.test(url) ? url : '']
    })) as unknown as EnglishGptConfig
  } catch { return empty }
}
