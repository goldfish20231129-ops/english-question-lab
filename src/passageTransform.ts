import { normalizeEnglishPassage } from './csat'
import { fingerprintProvidedPassage } from './providedPassage'

export type PassageTransformMode = 'original' | 'lexical' | 'restructure'

export const PASSAGE_TRANSFORM_LABELS: Record<PassageTransformMode, string> = {
  original: '원문 그대로 사용',
  lexical: '표현만 바꾸기',
  restructure: '내용 동일 재구성',
}

export const PASSAGE_TRANSFORM_HELP: Record<PassageTransformMode, string> = {
  original: '입력한 지문을 수정하지 않고 그대로 문항 제작에 사용합니다.',
  lexical: '문장 순서와 사실·논리는 유지하고 문맥상 자연스러운 단어·구만 동의 표현으로 바꿉니다.',
  restructure: '모든 사실·논리·예시·태도를 보존하면서 문장을 결합·분리하거나 전개 표현을 새롭게 구성합니다.',
}

export interface PassageTransformationResult {
  schemaId: 'english-question-lab-passage-transformation-v1'
  mode: Exclude<PassageTransformMode, 'original'>
  sourceFingerprint: string
  transformedPassage: string
  changes: Array<{ before: string; after: string; reason: string }>
  meaningPreserved: true
  singleParagraph: true
}

function cleanJson(raw: string) {
  return raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
}

function occurrences(text: string, target: string) {
  if (!target) return 0
  return text.split(target).length - 1
}

export function generatePassageTransformationPrompt(source: string, mode: PassageTransformMode, targetLevel: string) {
  const passage = normalizeEnglishPassage(source)
  if (!passage) throw new Error('먼저 변형할 영어 지문을 입력해 주세요.')
  if (mode === 'original') throw new Error('원문 그대로 사용은 별도의 변형 프롬프트가 필요하지 않습니다.')
  const fingerprint = fingerprintProvidedPassage(passage)
  const modeRules = mode === 'lexical'
    ? `- 문장 수, 문장 순서, 문장 경계, 사실, 논리 관계, 예시, 수치, 고유명사, 부정·조건·범위를 바꾸지 않는다.
- 자연스러운 동의 단어·구만 최소 범위로 교체한다. 예: accurate는 문맥에 따라 precise 또는 exact가 가능하지만 뜻과 문법이 맞을 때만 사용한다.
- 희귀어로 난도를 위장하거나 모든 단어를 기계적으로 치환하지 않는다.
- changes의 before는 현재 작업 지문에서 정확히 한 번만 나오는 최소 표현으로 적고, 그 위치의 치환만으로 transformedPassage가 완성되어야 한다.`
    : `- 원문의 모든 핵심 주장, 세부 사실, 인과·대조·조건·부정, 범위, 예시, 수치, 고유명사와 필자의 태도를 빠짐없이 보존한다.
- 문장 결합·분리, 주어 전환, 능동·수동 전환, 연결 표현과 문장 순서 조정은 의미가 완전히 같을 때만 허용한다.
- 내용을 요약·확장하거나 새 예시·해석·평가를 추가하지 않는다.
- changes에는 주요 재구성 내용을 사람이 비교할 수 있게 기록한다.`
  return `[SCHOOL_PASSAGE_TRANSFORMATION_V1]
당신은 고등학교 영어 내신 지문을 의미 손실 없이 변형하는 편집자다.

[변형 방식]
${PASSAGE_TRANSFORM_LABELS[mode]}

[공통 절대 규칙]
- 대상 수준은 ${targetLevel || '고등학교'}이다.
- 원문의 의미와 정답 근거가 달라질 가능성이 있는 변경은 하지 않는다.
- 결과 영어 지문은 첫 문장부터 마지막 문장까지 줄바꿈·빈 줄 없는 하나의 연속 문단으로 작성한다.
- 문법적으로 정확하고 자연스러운 영어를 사용한다.
- sourceFingerprint를 그대로 반환한다.
- 설명·마크다운·코드 블록 없이 유효한 JSON 객체 하나만 출력한다.
${modeRules}

[출력 JSON]
{
  "schemaId": "english-question-lab-passage-transformation-v1",
  "mode": "${mode}",
  "sourceFingerprint": "${fingerprint}",
  "transformedPassage": "줄바꿈 없는 변형 지문",
  "changes": [
    { "before": "원문 표현", "after": "변형 표현", "reason": "뜻이 유지되는 이유" }
  ],
  "meaningPreserved": true,
  "singleParagraph": true
}

[원문]
${passage}`
}

export function parsePassageTransformationJson(raw: string, source: string, expectedMode: PassageTransformMode): PassageTransformationResult {
  if (expectedMode === 'original') throw new Error('원문 그대로 사용은 변형 결과를 가져오지 않습니다.')
  let value: unknown
  try { value = JSON.parse(cleanJson(raw)) } catch (error) { throw new Error(`지문 변형 JSON 문법 오류입니다. (${error instanceof Error ? error.message : 'JSON 확인 필요'})`, { cause: error }) }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('지문 변형 결과의 최상위 값은 객체여야 합니다.')
  const input = value as Record<string, unknown>
  if (input.schemaId !== 'english-question-lab-passage-transformation-v1') throw new Error('지문 변형 schemaId가 올바르지 않습니다.')
  if (input.mode !== expectedMode) throw new Error('요청한 지문 변형 방식과 AI 결과의 mode가 다릅니다.')
  const normalizedSource = normalizeEnglishPassage(source)
  if (input.sourceFingerprint !== fingerprintProvidedPassage(normalizedSource)) throw new Error('변형 결과가 현재 화면의 원문을 기준으로 만들어지지 않았습니다.')
  if (input.meaningPreserved !== true) throw new Error('AI가 원문 의미의 완전한 보존을 확인하지 않았습니다.')
  if (input.singleParagraph !== true) throw new Error('AI가 한 문단 출력을 확인하지 않았습니다.')
  if (typeof input.transformedPassage !== 'string') throw new Error('transformedPassage 문자열이 필요합니다.')
  const transformedPassage = normalizeEnglishPassage(input.transformedPassage)
  if (!transformedPassage || transformedPassage === normalizedSource) throw new Error('변형 지문이 비어 있거나 원문과 같습니다.')
  if (!Array.isArray(input.changes) || !input.changes.length) throw new Error('원문과 변형문을 비교할 changes 배열이 필요합니다.')
  const changes = input.changes.map((item, index) => {
    if (!item || typeof item !== 'object') throw new Error(`changes[${index}] 형식이 올바르지 않습니다.`)
    const row = item as Record<string, unknown>
    if (typeof row.before !== 'string' || typeof row.after !== 'string' || typeof row.reason !== 'string' || !row.before || !row.after || !row.reason) throw new Error(`changes[${index}]에는 before, after, reason이 필요합니다.`)
    return { before: row.before, after: row.after, reason: row.reason }
  })
  if (expectedMode === 'lexical') {
    let rebuilt = normalizedSource
    changes.forEach((change, index) => {
      if (occurrences(rebuilt, change.before) !== 1) throw new Error(`표현 변경 ${index + 1}의 before가 현재 지문에서 정확히 한 번 확인되지 않습니다.`)
      rebuilt = rebuilt.replace(change.before, change.after)
    })
    if (normalizeEnglishPassage(rebuilt) !== transformedPassage) throw new Error('표현만 바꾸기 결과에 changes로 설명되지 않은 문장 재구성 또는 내용 변경이 있습니다.')
  }
  return {
    schemaId: 'english-question-lab-passage-transformation-v1', mode: expectedMode,
    sourceFingerprint: String(input.sourceFingerprint), transformedPassage, changes,
    meaningPreserved: true, singleParagraph: true,
  }
}
