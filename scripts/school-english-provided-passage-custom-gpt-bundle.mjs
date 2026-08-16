import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'

export const BUNDLE_ID = 'school-english-provided-passage-generator-v0.1'
export const BUNDLE_VERSION = '0.1.0-rc.1'
const here = path.dirname(fileURLToPath(import.meta.url))
export const defaultAppRoot = path.resolve(here, '..')
export const defaultCorpusRoot = path.resolve(defaultAppRoot, '..', '영어 기출 분석과 통계', 'corpus-engine')
export const defaultBundleRoot = path.join(defaultAppRoot, 'docs/english-gpt/releases/school-english-provided-passage-custom-gpt-v0.1')

const PROTECTED = [
  ['Generator Core Instructions', 'docs/english-gpt/GENERATOR_CORE_INSTRUCTIONS_V0.md', '00bdb21060f632969a3fd9bfcfbf0965b0af23688663bf51a3b08c20bbc163eb', 'app'],
  ['Generation Contract V0', 'docs/english-gpt/GENERATION_CONTRACT_V0.md', '3a812106b9a5183debbc795f66f856dccb44f9dc8f84516d171fae1cf41de03c', 'app'],
  ['CSAT Output Schema', 'docs/english-gpt/csat-output-schema.json', '2cf9022d6c8498386e21ca7a3737d1b35c69ab459a8954f6b079c918ace5b61c', 'app'],
  ['CSAT Style Manual', 'docs/english-gpt/CSAT_STYLE_MANUAL.md', '743c0a7e83732f98a52214916d17ee5fef4f2cc12d2048e64ccabdf61546053d', 'app'],
  ['Runtime Profile JSON', 'profiles/generation-runtime-profile-v0.4.json', '5af3526617675ee77ea5fb6693037aa62e28ca892dc912d016604652b1343720', 'corpus'],
]
const OLD_BUNDLE_FINGERPRINT = 'e741041c9b122e6e89d472e35bade83740167e2c8e1569076010e505f3ee2ecf'
const REQUIRED = [
  'README.md', 'bundle-manifest.json', 'custom-gpt-setup.md',
  'instructions/SCHOOL_ENGLISH_PROVIDED_PASSAGE_CUSTOM_GPT_INSTRUCTIONS.md',
  'knowledge/PROVIDED_PASSAGE_CONTRACT_V0.1.md',
  'knowledge/provided-passage-request-schema-v0.1.json',
  'knowledge/provided-passage-response-schema-v0.1.json',
  'fixtures/preview-fixtures.json', 'fixtures/manual-preview-inputs.md',
  'tests/bundle-manifest-schema.json', 'tests/school-english-provided-passage-custom-gpt-bundle.node-test.mjs',
  'validation/validate-bundle.mjs',
  'validation/component-provenance.json',
  'validation/school-english-provided-passage-custom-gpt-validation.json',
  'validation/school-english-provided-passage-custom-gpt-validation.md',
]

const lf = (value) => value.replace(/^\uFEFF/, '').replace(/\r\n?|\u2028|\u2029/g, '\n').normalize('NFC')
const sha = (value) => crypto.createHash('sha256').update(value).digest('hex')
const logicalSha = (buffer) => sha(Buffer.from(lf(buffer.toString('utf8')), 'utf8'))
const stable = (value) => `${JSON.stringify(value, null, 2)}\n`
const write = (target, value) => {
  fs.mkdirSync(path.dirname(target), { recursive: true })
  const temp = `${target}.tmp-${process.pid}`
  fs.writeFileSync(temp, value, 'utf8')
  fs.renameSync(temp, target)
}
const copyLogical = (source, target) => write(target, `${lf(fs.readFileSync(source, 'utf8')).replace(/\n*$/, '')}\n`)
const fileRecord = (root, rel, role, canonical = null) => {
  const bytes = fs.readFileSync(path.join(root, rel))
  return { role, path: rel.replaceAll('\\', '/'), canonicalSource: canonical, logicalSha256: logicalSha(bytes), physicalSha256: sha(bytes), byteSize: bytes.length }
}

function instructions() {
  return `# School English Provided Passage Custom GPT V0.1 Instructions

## 역할과 범위

당신은 사용자가 제공한 영어 원문을 바꾸지 않고 내신형 영어 문항 하나를 설계·생성하는 전용 도구다. 지원 mode는 \`school_english_provided_passage\`, subject는 \`English\`뿐이다. 지원 문항은 \`content_match\`와 \`sentence_insertion\`뿐이다. 새 수능형 지문 제작, 원문 번역·요약·교정, 다중 문항 생성, 외부 검색은 수행하지 않는다.

## 권위 우선순위

1. Provided Passage Request/Response Schema
2. Provided Passage Contract
3. sourcePassageId·sourceFingerprint·sentence ID·boundary ID 무결성
4. 권위 원문 보존과 외부 사실 금지
5. 승인된 Request-Specific Prompt
6. 이 내신형 Custom GPT Instructions
7. 충돌하지 않는 보조 어휘·품질 지침

상위 규칙과 충돌하는 하위 규칙은 적용하지 않는다. 기존 CSAT Generator Core, CSAT Style Manual, Runtime Profile은 이 GPT의 권위 규칙이 아니다.

## 입력 검증

앱 Prompt 안의 Request JSON을 유일한 동적 요청으로 사용한다. mode와 subject, outputContract, sourcePassageId, sourceFingerprint, itemId, templateId, variantId, questionType, choiceLanguage, vocabularyLevel, contentMatchPolarity, questionCount, requiredCandidateBoundaryCount를 그대로 읽는다. source.passage를 지정된 fingerprint 규칙으로 다시 계산할 수 없거나 fingerprint가 다르면 중단한다. sentence의 text와 [start,end) 범위, boundary의 offset과 인접 sentence ID가 원문과 맞지 않아도 중단한다. 지원하지 않는 값은 임의 변환하지 말고 어떤 계약 조건이 맞지 않는지 한국어로 짧게 설명한다.

## 승인 흐름

최초 입력에는 최종 JSON을 만들지 않는다. 한국어 제목 \`[내신 영어 기존 지문 문항 설계안]\` 아래에 문제 유형, 발문 극성, 선지 언어, 어휘 수준, 정답 근거 sentence ID, 오답 구성 방식 또는 정답 경계와 앞뒤 결속 근거, 원문 비변경 확인을 제시한다. 승인 전에는 완성 문제, 일부 선지, 삽입 문장 초안, 임시 JSON을 출력하지 않는다. 마지막 문장은 Request의 approval.approvalSentence와 정확히 같아야 한다. 사용자가 전체 설계를 명시적으로 승인한 뒤에만 최종 응답을 만든다. 수정 요청을 받으면 설계안만 고쳐 다시 승인을 받는다.

## 원문과 식별자 보호

source.passage가 유일한 권위 원문이다. 단어, 문장, 순서, 구두점, 철자, 대소문자를 수정하지 않는다. 오류처럼 보여도 교정하지 않는다. 표식이나 삽입 위치를 원문에 쓰지 않는다. Response에 원문 전체 또는 수정 원문을 반환하지 않는다. Schema가 허용하는 evidence span만 직접 인용하며 sentenceId, start, end, text가 원문과 정확히 일치해야 한다. Request에 없는 ID를 생성하지 않는다. 모든 source·item 식별자와 fingerprint를 그대로 반환한다. 외부 사실이나 상식을 정답 근거로 사용하지 않는다.

## 내용 일치·불일치

선택지는 정확히 5개이며 정답은 정확히 하나다. \`contentMatchPolarity\`가 mismatch이면 정답 하나만 원문과 불일치하고 나머지 네 개는 일치해야 한다. match이면 정답 하나만 일치하고 나머지 네 개는 불일치해야 한다. answerIndex는 이 판정과 일치해야 한다. choiceLanguage가 ko이면 다섯 선지 모두 한국어 완전 문장, en이면 모두 영어 완전 문장으로 작성한다. 언어를 섞지 않는다. materialOperation은 null이다. 정답 근거 evidence span을 반환한다. 네 오답은 부분 일치, 범위 확대·축소, 관계·인과 역전, 주체·시점 변경처럼 서로 구별되는 이유를 사용하고 distractorReasons에 기록한다. 원문과 무관한 억지 오답, 복수 정답, 중복 선지, 정답만 두드러지는 길이·형식은 금지한다.

## 문장 삽입

새로 생성할 수 있는 것은 삽입 대상 영어 문장 하나뿐이다. choiceLanguage와 contentMatchPolarity는 null이어야 한다. choices는 정확히 [\"①\",\"②\",\"③\",\"④\",\"⑤\"]다. Request가 제공한 후보 경계 중 원문 순서대로 정확히 5개만 candidateBoundaryIds로 사용하며 존재하지 않는 경계를 만들지 않는다. answerBoundaryId는 후보 중 하나다. 삽입 문장은 원문 문장을 복사하지 않고도 원문의 사실과 논리에 연결되어야 한다. 정답 경계 바로 앞 문장과 바로 뒤 문장을 각각 beforeEvidence와 afterEvidence로 제시한다. 시작 또는 끝 경계처럼 양쪽 근거가 없는 위치는 정답으로 선택하지 않는다. 다섯 경계 각각의 positionReason을 기록하고 대명사·지시어·연결어·정보의 신구 관계·시간·인과를 점검한다. 원문 전체나 표식이 삽입된 원문을 반환하지 않는다.

## 어휘 수준

어휘 정책은 새로 만드는 발문, 내용 선지, 삽입 문장, 해설에만 적용한다. 원문과 evidence에는 적용하지 않는다. source_matched는 원문의 추상도와 표현 수준을 따르되 정답을 그대로 복사하지 않는다. grade_1은 직접적이고 익숙한 고1 수준 표현을 우선한다. grade_2는 중간 수준 추상어와 관계 재진술을 허용한다. grade_3_csat는 수능 독해에 자연스러운 학술적 재진술을 허용하되 희귀어와 장문으로 난도를 위장하지 않는다. 이 값들은 절대 난이도나 정답률 예측이 아니다.

## 자체 검토

최종 출력 전에 Response Schema, Request 교차 일치, 원문 전체 부재, evidence offset, ID 존재, 선택지 수·언어·중복, 단일 정답, polarity, strongestDistractorIndex와 answerIndex의 불일치 여부를 검사한다. 삽입형은 경계 순서, 다섯 positionReason, 정답 경계의 실제 앞뒤 evidence, lexicalLevel을 추가 검사한다. 하나라도 실패하면 JSON을 내보내지 말고 설계 단계로 돌아가 오류를 설명한다.

## 최종 출력

승인 후에는 \`provided-passage-response-schema-v0.1.json\`을 만족하는 JSON 객체 하나만 출력한다. 코드 블록, 머리말, 설명, 주석, 후행 쉼표, undefined, NaN, Infinity, Schema 밖 필드를 쓰지 않는다. JSON.parse가 가능해야 하며 items는 하나다. 원문 전체를 반환하지 않는다.
`
}

function readme() {
  return `# School English Provided Passage Custom GPT V0.1

- Bundle ID: \`${BUNDLE_ID}\`
- Version: \`${BUNDLE_VERSION}\`
- Target: Custom GPT manual copy/paste workflow
- Scope: provided English passage → one content match/mismatch or sentence insertion item

This bundle is separate from the CSAT Generator v0 bundle. Upload only the three files listed in \`custom-gpt-setup.md\`; do not upload legacy CSAT runtime material as authority.

Build: \`node scripts/build-school-english-provided-passage-custom-gpt-bundle.mjs\`

Validate: \`node scripts/validate-school-english-provided-passage-custom-gpt-bundle.mjs\`

Regression: \`node --test docs/english-gpt/releases/school-english-provided-passage-custom-gpt-v0.1/tests/school-english-provided-passage-custom-gpt-bundle.node-test.mjs\`
`
}

function setup() {
  return `# Custom GPT setup

## Recommended settings

- Name: 내신 영어 기존 지문 문항 생성기 V0.1
- Description: 제공된 영어 원문을 바꾸지 않고 내용 일치·불일치 또는 문장 삽입 문항 하나를 strict JSON으로 생성합니다.
- Instructions: paste \`instructions/SCHOOL_ENGLISH_PROVIDED_PASSAGE_CUSTOM_GPT_INSTRUCTIONS.md\`.
- Knowledge uploads: the Contract and the two JSON Schemas in \`knowledge/\`.
- Web search: off
- Image generation: off
- Canvas: off
- Code execution/data analysis: off
- Actions/API: none

## Conversation starters

- 앱에서 복사한 Provided Passage 제작 Prompt를 붙여넣겠습니다.
- 내신형 내용 불일치 문항 설계안을 검토해 주세요.
- 내신형 문장 삽입 설계안을 먼저 제시해 주세요.

## Workflow

앱의 내신형 문제 제작에서 기존 지문 사용을 선택하고 Prompt를 복사한다. GPT에 붙여넣고 한국어 설계안만 검토한다. 전체 설계를 승인한 뒤 JSON 객체만 복사해 앱 Import에 붙여넣는다. Response에 원문을 넣지 않는 이유는 앱이 보관한 권위 원문을 AI 출력으로 덮어쓰거나 변형하는 경로를 차단하기 위해서다.

Contract나 Schema가 새 버전이 되면 기존 Knowledge 파일을 섞지 말고 같은 버전 세트를 함께 교체하고 Bundle validator를 다시 실행한다. 이 GPT의 이름과 설명에 “내신 영어 기존 지문”을 유지하고, 수능형 새 지문 Generator v0와 같은 대화에서 사용하지 않는다.

## Manual Preview

\`fixtures/manual-preview-inputs.md\`의 12개 입력과 기대 결과를 순서대로 확인한다. 실제 API 호출은 필요하지 않다.
`
}

function fingerprint(text) { return `sha256:${sha(Buffer.from(`provided-passage-v0.1\n${lf(text)}`, 'utf8'))}` }
function sourceModel(passage) {
  const sentences = []
  let start = 0
  for (const match of passage.matchAll(/[^.!?]+[.!?]/g)) {
    const leading = match[0].match(/^\s*/)[0].length
    const text = match[0].slice(leading)
    const sentenceStart = match.index + leading
    sentences.push({ id: `s${sentences.length + 1}`, start: sentenceStart, end: sentenceStart + text.length, text })
    start = sentenceStart + text.length
  }
  if (!sentences.length) throw new Error('fixture passage needs sentences')
  const boundaries = Array.from({ length: sentences.length + 1 }, (_, i) => ({
    id: `b${i}`, offset: i === 0 ? sentences[0].start : sentences[i - 1].end,
    ...(i > 0 ? { beforeSentenceId: sentences[i - 1].id } : {}),
    ...(i < sentences.length ? { afterSentenceId: sentences[i].id } : {}),
  }))
  return { passage, sentences, boundaries }
}
function evidence(sentence) { return { sentenceId: sentence.id, start: sentence.start, end: sentence.end, text: sentence.text } }
function requestFor({ id, questionType, choiceLanguage, vocabularyLevel, polarity = null }) {
  const passage = 'Mina planted basil in a sunny window. She watered it only when the soil felt dry. After two weeks, new leaves appeared. Mina shared a few leaves with her neighbor. The neighbor used them in a warm soup. Both families later planted more herbs.'
  const source = sourceModel(passage)
  const fp = fingerprint(passage)
  return {
    schemaId: 'english-question-lab-provided-passage-request-v0.1', mode: 'school_english_provided_passage', subject: 'English',
    source: { sourcePassageId: `source-${fp.slice(7, 23)}`, sourceFingerprint: fp, title: `Preview ${id}`, ...source },
    item: { itemId: `preview-${id}`, templateId: questionType === 'content_match' ? 'school-content-match' : 'school-sentence-insertion', variantId: 'standard', questionType, choiceLanguage, vocabularyLevel, contentMatchPolarity: polarity, targetLevel: '고등학교', score: 2, questionCount: 1, requiredCandidateBoundaryCount: questionType === 'sentence_insertion' ? 5 : null },
    sourcePreservation: { authority: 'app_stored_source', responsePassage: 'forbidden', exactFingerprintRequired: true },
    approval: { firstResponse: 'design_only', approvalSentence: '이 설계로 JSON을 생성할까요? 수정할 카드가 있으면 카드 번호와 변경 사항을 알려주세요.', afterApproval: 'single_json_object' },
    outputContract: 'english-question-lab-provided-passage-generation-v0.1',
  }
}
function quality(answerIndex) { return { passage: { naturalness: 9, logicStructure: 9, vocabularyLevel: 8, templateFidelity: 9 }, questions: [{ slot: 'provided-passage', answerInference: 8, distractorPlausibility: 8, choiceBalance: 8, directAnswerOverlap: false, strongestDistractorIndex: answerIndex === 2 ? 3 : 2, decisiveReason: '원문 근거와 각 선지를 독립적으로 대조했다.', expectedDifficulty: 3 }] } }
function contentResponse(request) {
  const mismatch = request.item.contentMatchPolarity === 'mismatch'
  const ko = request.item.choiceLanguage === 'ko'
  const choices = ko
    ? ['Mina는 햇볕이 드는 창가에 바질을 심었다.', 'Mina는 흙이 마른 느낌일 때만 물을 주었다.', '새잎은 이틀 만에 나타났다.', '이웃은 바질을 따뜻한 수프에 사용했다.', '두 가족은 나중에 허브를 더 심었다.']
    : ['Mina planted basil near sunlight.', 'She watered the basil only when the soil felt dry.', 'New leaves appeared after two weeks.', 'Her neighbor used the leaves in a warm soup.', 'Mina kept every leaf for herself.']
  const answerIndex = mismatch ? (ko ? 3 : 5) : 2
  return { schemaId: 'english-question-lab-provided-passage-generation-v0.1', mode: request.mode, subject: request.subject, sourcePassageId: request.source.sourcePassageId, sourceFingerprint: request.source.sourceFingerprint, title: request.source.title,
    items: [{ itemId: request.item.itemId, templateId: request.item.templateId, variantId: 'standard', questionType: 'content_match', choiceLanguage: request.item.choiceLanguage, vocabularyLevel: request.item.vocabularyLevel, contentMatchPolarity: request.item.contentMatchPolarity,
      question: { type: '내용 일치 및 불일치', stem: mismatch ? '다음 글의 내용과 일치하지 않는 것은?' : '다음 글의 내용과 일치하는 것은?', choices, answerIndex, explanation: '원문 문장과 선지를 대조하면 정답은 하나다.', intention: '권위 원문의 명시 정보를 정확히 확인한다.', evidenceSpans: [evidence(request.source.sentences[1]), evidence(request.source.sentences[2])], distractorReasons: ['명시 정보 확인', '조건 확인', '기간 왜곡', '사용 관계 확인'], score: 2 }, materialOperation: null, qualityReview: quality(answerIndex) }] }
}
function insertionResponse(request) {
  const s = request.source.sentences
  const ids = ['b1', 'b2', 'b3', 'b4', 'b5']
  return { schemaId: 'english-question-lab-provided-passage-generation-v0.1', mode: request.mode, subject: request.subject, sourcePassageId: request.source.sourcePassageId, sourceFingerprint: request.source.sourceFingerprint, title: request.source.title,
    items: [{ itemId: request.item.itemId, templateId: request.item.templateId, variantId: 'standard', questionType: 'sentence_insertion', choiceLanguage: null, vocabularyLevel: request.item.vocabularyLevel, contentMatchPolarity: null,
      question: { type: '문장 삽입', stem: '글의 흐름으로 보아, 주어진 문장이 들어가기에 가장 적절한 곳은?', choices: ['①','②','③','④','⑤'], answerIndex: 3, explanation: '이 문장은 잎을 이웃과 나누기 직전의 전환을 이룬다.', intention: '정보 흐름과 결속 관계를 파악한다.', evidenceSpans: [evidence(s[2]), evidence(s[3])], distractorReasons: ['화제 도입 전이다.', '성장 결과 전이다.', '정답 위치다.', '수프 사용 뒤다.', '결말 직전이라 늦다.'], score: 2 },
      materialOperation: { kind: 'insert_sentence', generatedSentence: 'She was pleased that the small plant had grown so well.', candidateBoundaryIds: ids, answerBoundaryId: 'b3', positionReasons: ids.map((boundaryId, i) => ({ boundaryId, reason: i === 2 ? '성장 결과 뒤, 나눔 행동 앞이다.' : '앞뒤 정보 흐름이 충분히 연결되지 않는다.' })), beforeEvidence: evidence(s[2]), afterEvidence: evidence(s[3]), lexicalLevel: request.item.vocabularyLevel }, qualityReview: quality(3) }] }
}

function fixtures() {
  const defs = [
    ['content-mismatch-ko-source', '내용 불일치 + 한국어 선지 + source_matched', requestFor({ id:'01', questionType:'content_match', choiceLanguage:'ko', vocabularyLevel:'source_matched', polarity:'mismatch' }), null, true, 'accepted'],
    ['content-match-en-grade1', '내용 일치 + 영어 선지 + grade_1', requestFor({ id:'02', questionType:'content_match', choiceLanguage:'en', vocabularyLevel:'grade_1', polarity:'match' }), null, true, 'accepted'],
    ['insertion-grade2', '문장 삽입 + grade_2', requestFor({ id:'03', questionType:'sentence_insertion', choiceLanguage:null, vocabularyLevel:'grade_2' }), null, true, 'accepted'],
    ['insertion-grade3', '문장 삽입 + grade_3_csat', requestFor({ id:'04', questionType:'sentence_insertion', choiceLanguage:null, vocabularyLevel:'grade_3_csat' }), null, true, 'accepted'],
  ]
  for (const row of defs) row[3] = row[2].item.questionType === 'content_match' ? contentResponse(row[2]) : insertionResponse(row[2])
  const negative = (id, title, baseIndex, mutate, code) => { const request = structuredClone(defs[baseIndex][2]); const response = structuredClone(defs[baseIndex][3]); mutate(request, response); return [id,title,request,response,false,code] }
  defs.push(
    negative('fingerprint-mismatch','fingerprint 불일치 거부',0,(q)=>{q.source.sourceFingerprint=`sha256:${'0'.repeat(64)}`},'request_fingerprint_mismatch'),
    negative('unknown-sentence','존재하지 않는 sentence ID 거부',0,(_,r)=>{r.items[0].question.evidenceSpans[0].sentenceId='s99'},'unknown_sentence_id'),
    negative('unknown-boundary','존재하지 않는 boundary ID 거부',2,(_,r)=>{r.items[0].materialOperation.candidateBoundaryIds[2]='b99'},'unknown_boundary_id'),
    negative('response-contains-passage','Response 원문 전체 포함 거부',0,(q,r)=>{r.title=q.source.passage},'response_passage_forbidden'),
    negative('mixed-choice-language','선지 언어 혼합 거부',0,(_,r)=>{r.items[0].question.choices[1]='This choice is English.'},'choice_language_mismatch'),
    negative('insertion-choice-language','삽입 choice language 비-null 거부',2,(_,r)=>{r.items[0].choiceLanguage='en'},'request_response_mismatch'),
    negative('multiple-answer-risk','복수 정답 가능 결과 거부',1,(_,r)=>{r.items[0].question.choices[1]=r.items[0].question.choices[0]},'duplicate_choice'),
    negative('insertion-missing-adjacency','정답 경계 앞뒤 근거 부족 거부',2,(_,r)=>{r.items[0].materialOperation.afterEvidence=r.items[0].materialOperation.beforeEvidence},'answer_boundary_evidence_mismatch'),
  )
  return defs.map(([fixtureId,title,request,response,expectedValid,expectedCode])=>({ fixtureId,title,request,response,expected:{ valid:expectedValid, code:expectedCode } }))
}

function findExactPassage(value, passage) {
  if (typeof value === 'string') return value === passage
  if (Array.isArray(value)) return value.some((item) => findExactPassage(item, passage))
  return value && typeof value === 'object' && Object.values(value).some((item) => findExactPassage(item, passage))
}
export function validateExchange(request, response, requestSchema, responseSchema) {
  const ajv = new Ajv2020({ allErrors: true, strict: false })
  if (!ajv.compile(requestSchema)(request)) return { valid:false, code:'request_schema_invalid' }
  if (request.source.sourceFingerprint !== fingerprint(request.source.passage)) return { valid:false, code:'request_fingerprint_mismatch' }
  for (const sentence of request.source.sentences) if (request.source.passage.slice(sentence.start,sentence.end) !== sentence.text) return { valid:false, code:'request_sentence_offset_mismatch' }
  const rv = ajv.compile(responseSchema)
  if (!rv(response)) return { valid:false, code:'response_schema_invalid' }
  if (findExactPassage(response, request.source.passage)) return { valid:false, code:'response_passage_forbidden' }
  const item=response.items[0], ri=request.item
  if (response.mode!==request.mode||response.subject!==request.subject||response.sourcePassageId!==request.source.sourcePassageId||response.sourceFingerprint!==request.source.sourceFingerprint||item.itemId!==ri.itemId||item.templateId!==ri.templateId||item.variantId!==ri.variantId||item.questionType!==ri.questionType||item.choiceLanguage!==ri.choiceLanguage||item.vocabularyLevel!==ri.vocabularyLevel||item.contentMatchPolarity!==ri.contentMatchPolarity) return { valid:false, code:'request_response_mismatch' }
  const sentenceMap=new Map(request.source.sentences.map((x)=>[x.id,x]))
  const checkSpan=(span)=>{const s=sentenceMap.get(span.sentenceId); return s&&span.start>=s.start&&span.end<=s.end&&span.start<span.end&&request.source.passage.slice(span.start,span.end)===span.text}
  if (!item.question.evidenceSpans.every(checkSpan)) return { valid:false, code:item.question.evidenceSpans.some(x=>!sentenceMap.has(x.sentenceId))?'unknown_sentence_id':'evidence_offset_mismatch' }
  const keys=item.question.choices.map(x=>x.normalize('NFC').replace(/\s+/g,' ').toLowerCase())
  if (new Set(keys).size!==5) return { valid:false, code:'duplicate_choice' }
  if (ri.questionType==='content_match') {
    if (item.materialOperation!==null) return { valid:false, code:'material_operation_forbidden' }
    if (ri.choiceLanguage==='ko'&&item.question.choices.some(x=>!/[가-힣]/.test(x))) return { valid:false, code:'choice_language_mismatch' }
    if (ri.choiceLanguage==='en'&&item.question.choices.some(x=>/[가-힣]/.test(x)||!/[A-Za-z]/.test(x))) return { valid:false, code:'choice_language_mismatch' }
  } else {
    const op=item.materialOperation, boundaryMap=new Map(request.source.boundaries.map(x=>[x.id,x]))
    if (op.candidateBoundaryIds.some(x=>!boundaryMap.has(x))) return { valid:false, code:'unknown_boundary_id' }
    if (!op.candidateBoundaryIds.includes(op.answerBoundaryId)) return { valid:false, code:'answer_boundary_not_candidate' }
    const answer=boundaryMap.get(op.answerBoundaryId)
    if (!checkSpan(op.beforeEvidence)||!checkSpan(op.afterEvidence)||op.beforeEvidence.sentenceId!==answer.beforeSentenceId||op.afterEvidence.sentenceId!==answer.afterSentenceId) return { valid:false, code:'answer_boundary_evidence_mismatch' }
  }
  return { valid:true, code:'accepted' }
}

function manifestSchema() { return { $schema:'https://json-schema.org/draft/2020-12/schema', type:'object', additionalProperties:false, required:['bundleId','bundleVersion','bundleStatus','targetEnvironment','components','protectedBaselines','manifestFingerprint'], properties:{ bundleId:{const:BUNDLE_ID}, bundleVersion:{const:BUNDLE_VERSION}, bundleStatus:{const:'release_candidate'}, targetEnvironment:{const:'custom_gpt_manual_copy_paste'}, components:{type:'array',minItems:10,items:{type:'object',required:['role','path','canonicalSource','logicalSha256','physicalSha256','byteSize'],additionalProperties:false,properties:{role:{type:'string'},path:{type:'string'},canonicalSource:{type:['string','null']},logicalSha256:{type:'string',pattern:'^[0-9a-f]{64}$'},physicalSha256:{type:'string',pattern:'^[0-9a-f]{64}$'},byteSize:{type:'integer'}}}}, protectedBaselines:{type:'array',minItems:6}, manifestFingerprint:{type:'string',pattern:'^[0-9a-f]{64}$'} } } }

function manualFixtures(items) { return `# Manual Preview inputs\n\n각 fixture는 최초에는 설계안만, 명시적 승인 뒤에는 Response JSON만 출력되어야 한다. 아래 JSON의 \`request\`를 앱 Prompt의 Request JSON과 같은 방식으로 붙여넣는다.\n\n${items.map((f,i)=>`## ${i+1}. ${f.title}\n\n- fixtureId: \`${f.fixtureId}\`\n- expected: \`${f.expected.valid?'ACCEPT':'REJECT'} / ${f.expected.code}\`\n- 검증: mode·subject, 승인 gate, 원문 비변경, strict JSON 및 해당 오류 조건\n\n\`\`\`json\n${JSON.stringify(f.request,null,2)}\n\`\`\``).join('\n\n')}\n` }

function validationMarkdown(result) { return `# School English Provided Passage Custom GPT validation\n\n- Valid: \`${result.valid}\`\n- Errors: ${result.errorCount}\n- Verdict: \`${result.verdict}\`\n\n## Checks\n\n${result.checks.map(x=>`- ${x.passed?'PASS':'FAIL'} \`${x.name}\`: ${x.detail}`).join('\n')}\n` }
function testSource() { return `import test from 'node:test'\nimport assert from 'node:assert/strict'\nimport fs from 'node:fs'\nimport path from 'node:path'\nimport os from 'node:os'\nimport crypto from 'node:crypto'\nimport { fileURLToPath } from 'node:url'\nimport { buildBundle, validateBundle, validateExchange } from '../../../../../scripts/school-english-provided-passage-custom-gpt-bundle.mjs'\nconst root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')\nconst app=path.resolve(root,'../../../..')\nconst corpus=path.resolve(app,'..','영어 기출 분석과 통계','corpus-engine')\nconst json=(p)=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'))\nconst files=(base,rel='')=>fs.readdirSync(path.join(base,rel),{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(base,path.join(rel,e.name)):[path.join(rel,e.name)]).sort()\ntest('bundle and protected baselines validate',()=>assert.equal(validateBundle({appRoot:app,corpusRoot:corpus,bundleRoot:root,writeReports:false}).valid,true))\ntest('all twelve preview fixtures produce expected decisions',()=>{const fixtures=json('fixtures/preview-fixtures.json'),req=json('knowledge/provided-passage-request-schema-v0.1.json'),res=json('knowledge/provided-passage-response-schema-v0.1.json'); assert.equal(fixtures.length,12); for(const f of fixtures) assert.deepEqual(validateExchange(f.request,f.response,req,res),f.expected,f.fixtureId)})\ntest('manifest component hashes match bytes',()=>{const m=json('bundle-manifest.json'); for(const c of m.components){const b=fs.readFileSync(path.join(root,c.path)); assert.equal(crypto.createHash('sha256').update(b).digest('hex'),c.physicalSha256)}})\ntest('two clean rebuilds are byte-identical',()=>{const a=fs.mkdtempSync(path.join(os.tmpdir(),'school-gpt-a-')),b=fs.mkdtempSync(path.join(os.tmpdir(),'school-gpt-b-')); buildBundle({appRoot:app,corpusRoot:corpus,bundleRoot:a}); buildBundle({appRoot:app,corpusRoot:corpus,bundleRoot:b}); assert.deepEqual(files(a),files(b)); for(const rel of files(a)) assert.deepEqual(fs.readFileSync(path.join(a,rel)),fs.readFileSync(path.join(b,rel)),rel)})\n` }

function portableValidator() { return `import path from 'node:path'\nimport { fileURLToPath } from 'node:url'\nimport { validateBundle } from '../../../../../scripts/school-english-provided-passage-custom-gpt-bundle.mjs'\nconst bundleRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')\nconst appRoot=path.resolve(bundleRoot,'../../../..')\nconst corpusRoot=path.resolve(appRoot,'..','영어 기출 분석과 통계','corpus-engine')\nconst result=validateBundle({appRoot,corpusRoot,bundleRoot,writeReports:false})\nprocess.stdout.write(JSON.stringify(result,null,2)+'\\n')\nprocess.exitCode=result.valid?0:1\n` }

function manifestFingerprint(manifest) { const clone=structuredClone(manifest); delete clone.manifestFingerprint; return sha(Buffer.from(JSON.stringify(clone),'utf8')) }
export function buildBundle({appRoot=defaultAppRoot,corpusRoot=defaultCorpusRoot,bundleRoot=defaultBundleRoot}={}) {
  fs.mkdirSync(bundleRoot,{recursive:true})
  const canonical=[
    ['docs/english-gpt/PROVIDED_PASSAGE_CONTRACT_V0.1.md','knowledge/PROVIDED_PASSAGE_CONTRACT_V0.1.md'],
    ['docs/english-gpt/provided-passage-request-schema-v0.1.json','knowledge/provided-passage-request-schema-v0.1.json'],
    ['docs/english-gpt/provided-passage-response-schema-v0.1.json','knowledge/provided-passage-response-schema-v0.1.json'],
  ]
  for(const [src,dst] of canonical) copyLogical(path.join(appRoot,src),path.join(bundleRoot,dst))
  write(path.join(bundleRoot,'README.md'),readme())
  write(path.join(bundleRoot,'custom-gpt-setup.md'),setup())
  write(path.join(bundleRoot,'instructions/SCHOOL_ENGLISH_PROVIDED_PASSAGE_CUSTOM_GPT_INSTRUCTIONS.md'),instructions())
  const preview=fixtures()
  write(path.join(bundleRoot,'fixtures/preview-fixtures.json'),stable(preview))
  write(path.join(bundleRoot,'fixtures/manual-preview-inputs.md'),manualFixtures(preview))
  write(path.join(bundleRoot,'tests/bundle-manifest-schema.json'),stable(manifestSchema()))
  write(path.join(bundleRoot,'tests/school-english-provided-passage-custom-gpt-bundle.node-test.mjs'),testSource())
  write(path.join(bundleRoot,'validation/validate-bundle.mjs'),portableValidator())
  const roles={ 'README.md':'readme','custom-gpt-setup.md':'custom_gpt_setup','instructions/SCHOOL_ENGLISH_PROVIDED_PASSAGE_CUSTOM_GPT_INSTRUCTIONS.md':'custom_gpt_instructions','knowledge/PROVIDED_PASSAGE_CONTRACT_V0.1.md':'provided_passage_contract','knowledge/provided-passage-request-schema-v0.1.json':'request_schema','knowledge/provided-passage-response-schema-v0.1.json':'response_schema','fixtures/preview-fixtures.json':'preview_fixtures','fixtures/manual-preview-inputs.md':'manual_preview','tests/bundle-manifest-schema.json':'manifest_schema','tests/school-english-provided-passage-custom-gpt-bundle.node-test.mjs':'regression_tests','validation/validate-bundle.mjs':'automatic_validator' }
  const canonicalMap=new Map(canonical.map(([a,b])=>[b,a]))
  const components=Object.entries(roles).map(([rel,role])=>fileRecord(bundleRoot,rel,role,canonicalMap.get(rel)??null))
  const protectedBaselines=PROTECTED.map(([role,rel,expected,project])=>({role,path:rel,project,logicalSha256:expected})).concat([{role:'legacy_csAT_bundle_manifest_fingerprint',path:'docs/english-gpt/releases/generator-v0-custom-gpt/bundle-manifest.json',project:'app',manifestFingerprint:OLD_BUNDLE_FINGERPRINT}])
  const manifest={bundleId:BUNDLE_ID,bundleVersion:BUNDLE_VERSION,bundleStatus:'release_candidate',targetEnvironment:'custom_gpt_manual_copy_paste',components,protectedBaselines,manifestFingerprint:''}
  manifest.manifestFingerprint=manifestFingerprint(manifest)
  write(path.join(bundleRoot,'bundle-manifest.json'),stable(manifest))
  const provenance={bundleId:BUNDLE_ID,bundleVersion:BUNDLE_VERSION,hashPolicy:{logical:'UTF-8 after BOM removal, LF normalization and NFC',physical:'SHA-256 of exact bundle bytes',manifestFingerprint:'SHA-256 of canonical manifest JSON excluding manifestFingerprint'},components,protectedBaselines}
  write(path.join(bundleRoot,'validation/component-provenance.json'),stable(provenance))
  writeValidation(bundleRoot,{bundleId:BUNDLE_ID,bundleVersion:BUNDLE_VERSION,valid:false,errorCount:1,verdict:'BUILD_IN_PROGRESS',checks:[]})
  const result=validateBundle({appRoot,corpusRoot,bundleRoot,writeReports:false})
  writeValidation(bundleRoot,result)
  return {bundleRoot,manifest,result}
}

function add(checks,name,passed,detail){checks.push({name,passed:Boolean(passed),detail})}
export function validateBundle({appRoot=defaultAppRoot,corpusRoot=defaultCorpusRoot,bundleRoot=defaultBundleRoot,writeReports=false}={}) {
  const checks=[]
  for(const rel of REQUIRED) add(checks,`required:${rel}`,fs.existsSync(path.join(bundleRoot,rel)),rel)
  let manifest
  try{manifest=JSON.parse(fs.readFileSync(path.join(bundleRoot,'bundle-manifest.json'),'utf8')); add(checks,'manifest_parse',true,'parsed')}catch(e){add(checks,'manifest_parse',false,String(e))}
  if(manifest){
    const schema=JSON.parse(fs.readFileSync(path.join(bundleRoot,'tests/bundle-manifest-schema.json'),'utf8')); const mv=new Ajv2020({strict:false}).compile(schema)
    add(checks,'manifest_schema',mv(manifest),mv.errors?JSON.stringify(mv.errors):'passed')
    add(checks,'manifest_fingerprint',manifest.manifestFingerprint===manifestFingerprint(manifest),manifest.manifestFingerprint)
    for(const c of manifest.components){const p=path.join(bundleRoot,c.path); const b=fs.existsSync(p)?fs.readFileSync(p):null; add(checks,`component_hash:${c.role}`,b&&sha(b)===c.physicalSha256&&logicalSha(b)===c.logicalSha256,c.path)}
  }
  const req=JSON.parse(fs.readFileSync(path.join(bundleRoot,'knowledge/provided-passage-request-schema-v0.1.json'),'utf8'))
  const res=JSON.parse(fs.readFileSync(path.join(bundleRoot,'knowledge/provided-passage-response-schema-v0.1.json'),'utf8'))
  const preview=JSON.parse(fs.readFileSync(path.join(bundleRoot,'fixtures/preview-fixtures.json'),'utf8'))
  add(checks,'preview_fixture_count',preview.length===12,`${preview.length}/12`)
  for(const f of preview){const actual=validateExchange(f.request,f.response,req,res); add(checks,`fixture:${f.fixtureId}`,JSON.stringify(actual)===JSON.stringify(f.expected),`${actual.valid}/${actual.code}`)}
  for(const [role,rel,expected,project] of PROTECTED){const root=project==='corpus'?corpusRoot:appRoot; const p=path.join(root,rel); const actual=fs.existsSync(p)?logicalSha(fs.readFileSync(p)):'missing'; add(checks,`protected_logical_sha:${role}`,actual===expected,actual)}
  const old=JSON.parse(fs.readFileSync(path.join(appRoot,'docs/english-gpt/releases/generator-v0-custom-gpt/bundle-manifest.json'),'utf8'))
  add(checks,'legacy_bundle_fingerprint',old.manifestFingerprint===OLD_BUNDLE_FINGERPRINT,old.manifestFingerprint)
  const instructionsText=fs.readFileSync(path.join(bundleRoot,'instructions/SCHOOL_ENGLISH_PROVIDED_PASSAGE_CUSTOM_GPT_INSTRUCTIONS.md'),'utf8')
  add(checks,'instructions_scope',instructionsText.includes('school_english_provided_passage')&&!instructionsText.includes('새 수능형 지문을 제작'),`${Buffer.byteLength(instructionsText)} bytes`)
  add(checks,'instructions_approval_gate',instructionsText.includes('승인 전에는 완성 문제')&&instructionsText.includes('명시적으로 승인한 뒤에만'),'design first')
  add(checks,'instructions_no_runtime_authority',instructionsText.includes('Runtime Profile은 이 GPT의 권위 규칙이 아니다'),'separated')
  const errors=checks.filter(x=>!x.passed)
  const result={bundleId:BUNDLE_ID,bundleVersion:BUNDLE_VERSION,valid:errors.length===0,errorCount:errors.length,verdict:errors.length===0?'READY_TO_CREATE_AND_PREVIEW_SCHOOL_ENGLISH_CUSTOM_GPT_V0_1':'BLOCKED_VALIDATION_FAILURE',checks}
  if(writeReports) writeValidation(bundleRoot,result)
  return result
}
function writeValidation(root,result){write(path.join(root,'validation/school-english-provided-passage-custom-gpt-validation.json'),stable(result));write(path.join(root,'validation/school-english-provided-passage-custom-gpt-validation.md'),validationMarkdown(result))}
export function parseCli(argv){const o={};for(let i=0;i<argv.length;i++){if(argv[i]==='--app-root')o.appRoot=path.resolve(argv[++i]);else if(argv[i]==='--corpus-root')o.corpusRoot=path.resolve(argv[++i]);else if(argv[i]==='--bundle-root')o.bundleRoot=path.resolve(argv[++i]);else throw new Error(`unknown argument: ${argv[i]}`)}return o}
