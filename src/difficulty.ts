import type { EnglishMode } from './types'

export const ENGLISH_DIFFICULTY_LEVELS = [
  { value: 1, label: '매우 쉬움', summary: '기초 확인 중심' },
  { value: 2, label: '쉬움', summary: '직접 근거 중심' },
  { value: 3, label: '약간 쉬움', summary: '짧은 재진술과 연결' },
  { value: 4, label: '보통', summary: '평균적인 고등학교 평가 수준' },
  { value: 5, label: '약간 어려움', summary: '복수 근거와 정교한 오답' },
  { value: 6, label: '어려움', summary: '상위권 변별 수준' },
  { value: 7, label: '매우 어려움', summary: '최상위권 변별 수준' },
  { value: 8, label: '최상', summary: '허용 가능한 최고 변별 수준' },
] as const

const COMMON_GUIDANCE: Record<number, string> = {
  1: '핵심 근거가 한 문장에 명시되고, 익숙한 어휘와 단순한 문장 구조를 사용하며, 오답은 지문과 뚜렷하게 어긋나게 한다.',
  2: '근거가 가까운 위치에 직접 제시되고, 기본적인 바꾸어 쓰기만 요구하며, 대부분의 오답은 한 가지 명백한 오류로 소거되게 한다.',
  3: '한두 문장의 정보를 연결하고 쉬운 동의 표현을 해석해야 풀리게 하며, 오답 하나 정도는 지문의 일부와 표면적으로 일치하게 한다.',
  4: '글의 중심 흐름과 두 개 안팎의 근거를 종합하게 하고, 일반적인 고등학교 학술 어휘를 사용하며, 최소 두 오답이 처음에는 그럴듯하게 보이게 한다.',
  5: '글의 여러 부분에 흩어진 근거와 관계 재진술을 결합하게 하고, 범위·인과·주체를 미세하게 왜곡한 매력적인 오답을 포함한다.',
  6: '상위권 학생을 변별하도록 추상적 관계와 2~3단계 추론을 요구하고, 정답과 강한 오답의 차이가 결정적 근거 하나에서 드러나게 한다.',
  7: '최상위권 수준의 긴 추론 거리와 정교한 논리 구분을 요구하되, 모든 선지가 문법과 내용 면에서 자연스럽고 단일 정답은 명확하게 유지한다.',
  8: '해당 유형에서 허용되는 최고 수준의 다단계 종합과 미세한 범위·관계 판별을 요구하되, 희귀어·불필요한 장문·모호성으로 난도를 위장하지 않는다.',
}

const MODE_GUIDANCE: Record<'csat' | 'school', Record<number, string>> = {
  csat: {
    1: '수능 읽기 유형을 처음 연습하는 학생도 핵심 단서를 바로 찾을 수 있는 수준이다.',
    2: '수능 쉬운 2점 문항보다 부담이 낮거나 비슷한 수준이다.',
    3: '수능의 평이한 2점 문항에 가까운 수준이다.',
    4: '수능의 평균적인 2점 문항 또는 무난한 3점 문항 수준이다.',
    5: '수능의 다소 까다로운 3점 문항 수준이다.',
    6: '수능 상위권 변별 3점 문항 수준이다.',
    7: '수능 최상위권 변별 문항 수준이지만 교육과정 밖 지식은 요구하지 않는다.',
    8: '평가원형 문항으로 성립 가능한 최고난도 수준이며 정답 유일성과 공정성을 절대 훼손하지 않는다.',
  },
  school: {
    1: '수업 직후 원문의 기본 사실과 표현을 확인하는 수준이다.',
    2: '본문의 한 문장이나 가까운 두 문장에서 답을 확인할 수 있는 수준이다.',
    3: '본문 표현의 쉬운 변형과 짧은 문맥 연결을 확인하는 수준이다.',
    4: '일반적인 학교 시험의 평균 난도로, 본문 이해와 기본 적용을 함께 확인한다.',
    5: '본문 여러 부분을 연결하고 수업에서 다룬 개념을 적용해야 하는 수준이다.',
    6: '학교 시험 상위권을 변별하도록 세부 근거와 문맥 관계를 정밀하게 판단하는 수준이다.',
    7: '내신 최상위권을 변별하되 원문과 수업 범위를 벗어난 배경지식은 요구하지 않는 수준이다.',
    8: '원문과 학습 범위 안에서 가능한 최고난도이며, 복수 정답이나 억지 어휘 함정을 허용하지 않는다.',
  },
}

export function normalizeEnglishDifficulty(value: number) {
  if (!Number.isFinite(value)) return 4
  return Math.min(8, Math.max(1, Math.round(value)))
}

export function englishDifficultyLevel(value: number) {
  const normalized = normalizeEnglishDifficulty(value)
  return ENGLISH_DIFFICULTY_LEVELS.find((level) => level.value === normalized) ?? ENGLISH_DIFFICULTY_LEVELS[3]
}

export function englishDifficultyLabel(value: number) {
  return englishDifficultyLevel(value).label
}

export function englishDifficultyPrompt(mode: EnglishMode, value: number) {
  const level = englishDifficultyLevel(value)
  const modeKey = mode === 'school' ? 'school' : 'csat'
  return `${level.label} (${level.value}/8)\n- 기준: ${MODE_GUIDANCE[modeKey][level.value]}\n- 구현: ${COMMON_GUIDANCE[level.value]}`
}

export function englishDifficultySummary(mode: EnglishMode, value: number) {
  const level = englishDifficultyLevel(value)
  const modeKey = mode === 'school' ? 'school' : 'csat'
  return `${level.label}: ${MODE_GUIDANCE[modeKey][level.value]}`
}

export function legacyCsatDifficultyToEight(value: number) {
  return ({ 1: 2, 2: 3, 3: 4, 4: 6, 5: 8 } as Record<number, number>)[value] ?? normalizeEnglishDifficulty(value)
}
