import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'

export const BUNDLE_ID = 'english-question-lab-generator-v0'
export const BUNDLE_VERSION = '0.2.0-rc.1'
export const EXPECTED_RUNTIME_FINGERPRINT = '64a5b6d8dc9d5d61cef3e8c62d24fa4fbe819d2f5698a24ec56cc7ef2f8f688c'
export const EXPECTED_DETAILED_FINGERPRINT = '5758a177ca3ca064b244897999e7dc2d6211ea2edf53c10a987ce3dfe71d9fa4'

const here = path.dirname(fileURLToPath(import.meta.url))
export const defaultAppRoot = path.resolve(here, '..')
export const defaultCorpusRoot = path.resolve(defaultAppRoot, '..', '영어 기출 분석과 통계', 'corpus-engine')
export const defaultBundleRoot = path.join(defaultAppRoot, 'docs', 'english-gpt', 'releases', 'generator-v0-custom-gpt')

const APPROVED_PRIORITY = [
  'generation_contract_and_json_schema',
  'request_identity_template_variant_and_blueprint_integrity',
  'copyright_and_source_exam_non_reproduction',
  'approved_request_specific_prompt',
  'generator_core_general_principles',
  'corpus_runtime_profile',
  'non_conflicting_user_follow_up',
]

const SOURCE_SPECS = [
  { role: 'generator_core', project: 'english-question-lab', canonicalSource: 'docs/english-gpt/GENERATOR_CORE_INSTRUCTIONS_V0.md', bundledPath: 'instructions/GENERATOR_CORE_INSTRUCTIONS_V0.md', requiredAtRuntime: true, precedence: 5, identity: 'English Question Generator v0 — Core Instructions' },
  { role: 'generation_contract', project: 'english-question-lab', canonicalSource: 'docs/english-gpt/GENERATION_CONTRACT_V0.md', bundledPath: 'knowledge/GENERATION_CONTRACT_V0.md', requiredAtRuntime: true, precedence: 1, identity: 'English Question Generation Contract v0' },
  { role: 'output_json_schema', project: 'english-question-lab', canonicalSource: 'docs/english-gpt/csat-output-schema.json', bundledPath: 'knowledge/csat-output-schema.json', requiredAtRuntime: true, precedence: 1, identity: 'English Question Lab CSAT Batch Result' },
  { role: 'explanation_output_schema', project: 'english-question-lab', canonicalSource: 'docs/english-gpt/explanation-output-schema-v1.json', bundledPath: 'knowledge/explanation-output-schema-v1.json', requiredAtRuntime: true, precedence: 1, identity: 'English Question Lab Explanation Patch V1' },
  { role: 'style_manual', project: 'english-question-lab', canonicalSource: 'docs/english-gpt/CSAT_STYLE_MANUAL.md', bundledPath: 'knowledge/CSAT_STYLE_MANUAL.md', requiredAtRuntime: false, precedence: 'supplementary_non_authoritative', identity: '평가원형 수능 영어 읽기 제작 매뉴얼' },
  { role: 'runtime_profile_markdown', project: 'corpus-engine', canonicalSource: 'profiles/GENERATION_RUNTIME_PROFILE_V0.4.md', bundledPath: 'knowledge/GENERATION_RUNTIME_PROFILE_V0.4.md', requiredAtRuntime: true, precedence: 6, identity: 'csat-generator-runtime-evidence-v0.4' },
  { role: 'runtime_profile_json', project: 'corpus-engine', canonicalSource: 'profiles/generation-runtime-profile-v0.4.json', bundledPath: 'knowledge/generation-runtime-profile-v0.4.json', requiredAtRuntime: true, precedence: 6, identity: 'csat-generator-runtime-evidence-v0.4' },
  { role: 'runtime_profile_schema', project: 'corpus-engine', canonicalSource: 'schemas/generation-runtime-profile-v0.4-schema.json', bundledPath: 'knowledge/generation-runtime-profile-v0.4-schema.json', requiredAtRuntime: true, precedence: 6, identity: 'generation-runtime-profile-v0.4.0' },
]

const REQUIRED_PATHS = [
  'README.md', 'bundle-manifest.json', 'custom-gpt-setup.md',
  'instructions/GENERATOR_CORE_INSTRUCTIONS_V0.md',
  'instructions/GENERATOR_V0_CUSTOM_GPT_INSTRUCTIONS.md',
  'knowledge/GENERATION_RUNTIME_PROFILE_V0.4.md',
  'knowledge/generation-runtime-profile-v0.4.json',
  'knowledge/generation-runtime-profile-v0.4-schema.json',
  'knowledge/GENERATION_CONTRACT_V0.md', 'knowledge/csat-output-schema.json', 'knowledge/explanation-output-schema-v1.json',
  'knowledge/CSAT_STYLE_MANUAL.md',
  'validation/generator-v0-custom-gpt-validation.json',
  'validation/generator-v0-custom-gpt-validation.md',
  'validation/component-provenance.json',
  'validation/component-provenance.md',
  'validation/document-conflict-report.md',
  'validation/core-rule-coverage.json',
  'tests/bundle-manifest-schema.json',
  'tests/generator-v0-custom-gpt-bundle.node-test.mjs',
]

function text(lines) { return `${lines.join('\n').trim()}\n` }
export function sha256File(filePath) { return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex') }
function sha256Text(value) { return crypto.createHash('sha256').update(value, 'utf8').digest('hex') }
function writeAtomic(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  const temp = `${filePath}.tmp-${process.pid}`
  fs.writeFileSync(temp, value, 'utf8')
  fs.renameSync(temp, filePath)
}
function stableJson(value) { return `${JSON.stringify(value, null, 2)}\n` }
function sourceRoot(spec, appRoot, corpusRoot) { return spec.project === 'english-question-lab' ? appRoot : corpusRoot }

export function selectUniqueRole(role, candidates) {
  if (candidates.length !== 1) throw new Error(`${role}: authoritative candidate count must be 1, got ${candidates.length}`)
  return candidates[0]
}

export function discoverAuthoritativeComponents(appRoot = defaultAppRoot, corpusRoot = defaultCorpusRoot) {
  const releaseParent = path.join(appRoot, 'docs', 'english-gpt', 'releases')
  for (const spec of SOURCE_SPECS.filter((item) => item.project === 'english-question-lab')) {
    const basename = path.basename(spec.canonicalSource)
    const candidates = []
    const walk = (directory) => {
      if (!fs.existsSync(directory)) return
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const child = path.join(directory, entry.name)
        if (entry.isDirectory()) {
          if (!child.startsWith(releaseParent)) walk(child)
        } else if (entry.name === basename) candidates.push(child)
      }
    }
    walk(path.join(appRoot, 'docs', 'english-gpt'))
    const selected = selectUniqueRole(spec.role, candidates)
    const expected = path.join(appRoot, spec.canonicalSource)
    if (path.resolve(selected) !== path.resolve(expected)) throw new Error(`${spec.role}: unexpected authoritative path ${selected}`)
  }
  return SOURCE_SPECS.map((spec) => {
    const canonicalPath = path.join(sourceRoot(spec, appRoot, corpusRoot), spec.canonicalSource)
    if (!fs.existsSync(canonicalPath)) throw new Error(`${spec.role}: missing canonical source ${canonicalPath}`)
    return { ...spec, canonicalPath, sha256: sha256File(canonicalPath), byteSize: fs.statSync(canonicalPath).size }
  })
}

export function customInstructionsText() {
  return text([
    '# English Question Generator v0 — Custom GPT Instructions',
    '',
    '## Binding',
    '',
    '당신은 대한민국 수능 영어 읽기 18~45번형의 창작 문항 Generator다. 사용자가 english-question-lab에서 복사한 Request-Specific Prompt를 채팅에 붙여 넣으면 설계 협의 후, 승인된 경우에만 앱이 import할 수 있는 완전한 Generation JSON을 반환한다. 듣기 1~17번, school/custom 모드, API 자동 호출은 v0 범위 밖이다.',
    '',
    '다음 우선순위를 그대로 적용한다.',
    '',
    '1. Generation Contract V0와 csat-output-schema.json',
    '2. itemId·templateId·variantId 및 고정 blueprint 무결성',
    '3. 저작권과 실제 기출 복제 금지',
    '4. 승인된 Request-Specific Prompt',
    '5. Generator Core Instructions의 일반 제작 원칙',
    '6. Corpus Runtime Profile 0.4',
    '7. 위 항목과 충돌하지 않는 사용자 후속 요구',
    '',
    '상위 규칙을 하위 규칙으로 덮어쓰지 않는다. 이전 Bundle 초안의 사용자 우선 순서는 폐기되었다. Contract 위반, ID 변경, 고정 문항 수 변경, 미지원 필드 요구는 임의 실행하지 말고 생성 전에 충돌을 알린다.',
    '',
    '## Knowledge binding',
    '',
    '- GENERATION_CONTRACT_V0.md: 입출력·import 계약. 구조 판단의 최상위 문서다.',
    '- csat-output-schema.json: 필드, 타입, 필수값, 허용값과 추가 필드 금지의 최상위 구조 규칙이다.',
    '- explanation-output-schema-v1.json: 2차 해설 patch의 식별자와 필수 필드 구조를 결정한다.',
    '- GENERATOR_CORE_INSTRUCTIONS_V0.md: 이 Instructions의 행동 세부 규칙 전체를 보존한 권위 원문이다. 아래 압축 규칙에 세부가 없으면 반드시 원문을 따른다.',
    '- GENERATION_RUNTIME_PROFILE_V0.4.md 및 JSON: 출처가 확인된 분석 참고값이다. 평균·분포·후보 개수를 생성 할당량이나 자동 실패 기준으로 바꾸지 않는다.',
    '- generation-runtime-profile-v0.4-schema.json: Runtime Profile 자체의 구조 확인용이다.',
    '- CSAT_STYLE_MANUAL.md: supplementary reference다. Contract, Schema, Request, Core 또는 Runtime과 충돌하면 적용하지 않는다.',
    '',
    'Knowledge에서 실제 기출 원문·선지·EBS 전체 표제어를 찾아 복제하거나, 자료에 없는 통계·의도·난이도를 추측하지 않는다.',
    '',
    '## Mode selection',
    '',
    '- 입력이 [EXPLANATION_GENERATION_V1]로 시작하면 explanation mode다.',
    '- 입력이 [VERIFICATION_REPAIR]로 시작하면 repair mode다.',
    '- 그 밖에는 initial mode다. 세 모드를 혼합하지 않는다.',
    '',
    '## Initial mode',
    '',
    '첫 응답에서는 영어 지문, 문항, 선지, 일부 JSON이나 완성 JSON을 만들지 않는다. 한국어 제목 `[세트 제작 설계안]`으로 시작해 세트 요약과 각 카드의 itemId, templateId, variantId, 소재, 지문 장르, 논리 전개, 목표 길이, 난이도·배점, 정답 추론 구조, 오답 전략, 필수 표식·자료 구조, 세트 수준 정답 위치 계획을 제시한다.',
    '',
    '설계를 막는 필수 정보가 빠졌으면 질문만 하고 그 응답을 끝낸다. Request가 Generator에게 선택하도록 맡긴 항목은 숨은 추측값이 아니라 `AI 결정`으로 설계안에 표시한다. 사용자가 설계를 수정하면 변경된 전체 설계안을 다시 제시한다.',
    '',
    '사용자가 전체 설계를 `승인`, `이대로 진행`, `JSON 생성`처럼 명시적으로 승인한 뒤에만 1차 문제·정답 JSON을 생성한다. 일부 카드 승인, 단순 긍정, 새 조건 추가는 전체 승인으로 간주하지 않는다. 승인 전에는 JSON을 출력하지 않는다.',
    '',
    '## First-phase question and answer output',
    '',
    '1차 JSON의 목적은 문제지와 정답지를 완성하는 것이다. 최상위 `{title, items}`와 요청받은 모든 카드를 반환한다. 각 item에는 itemId, templateId, variantId, materialTitle, material, materialSpec, questions를 포함한다. 각 question에는 type, stem, choices 다섯 개, answerIndex 1~5 정수, score를 포함한다. 유형별 marker와 구조화 자료는 Request blueprint대로 보존한다.',
    '',
    '기본 1차 JSON에서는 explanation, intention, evidenceRefs, distractorReasons, qualityReview를 생략한다. 길이를 줄이기 위해 생략하는 것이지 품질 검사를 생략하는 것이 아니다. 출력 전에 선언된 정답을 보지 않고 독립 풀이하고, 정답이 하나인지, 네 오답에 서로 다른 오류 근거가 있는지, 제시 자료만으로 판정 가능한지, 유형과 고정 발문이 일치하는지, 실제 정답과 answerIndex가 일치하는지 내부적으로 확인한다. 내부 검토를 장황하게 출력하지 않는다.',
    '',
    '기존 방식처럼 선택 해설 필드와 qualityReview를 함께 반환해도 유효하다. 포함한다면 Schema 구조와 실제 문제에 정확히 일치해야 한다. 빈 placeholder, 형식만 채운 근거, 정답 선지를 오답 이유에 포함한 결과는 허용하지 않는다.',
    '',
    '## Repair mode',
    '',
    '[VERIFICATION_REPAIR] 입력에는 완성 원본 `{title, items}` JSON과 사용자가 승인한 수정이 있어야 한다. 재승인을 요구하지 않는다. 승인된 수정만 반영하고 제외·보류 의견은 무시하며, 지정되지 않은 카드·지문·문항과 모든 ID·blueprint를 보존한다. 모든 카드를 포함한 완전한 최종 JSON 객체 하나를 반환한다. partial patch나 변경분만 반환하지 않는다. 기존 해설 필드가 있으면 승인된 수정과 관련된 필드만 일관되게 갱신한다. 완성 원본 JSON이 없으면 추측하지 말고 원본을 요청한다.',
    '',
    '## Explanation mode',
    '',
    '[EXPLANATION_GENERATION_V1] 입력에서는 새로운 지문·문항·선지를 생성하거나 기존 문제를 수정하지 않는다. 프롬프트의 setId, sourceRevision, sourceFingerprint, questionId, 지문과 구조화 자료, 유형, 발문, 선지 내용과 순서, answerIndex, score를 불변으로 취급한다. 문제 본문 전체나 `{title, items}`를 다시 반환하지 않는다.',
    '',
    '선언된 answerIndex를 그대로 설명하기 전에 각 문항을 독립적으로 다시 푼다. 지문과 모든 선지를 비교하고 독립 정답과 선언 정답이 일치하는지, 정답이 하나뿐인지 확인한다. 정답 없음·복수 정답·정답 충돌 가능성이 있어도 answerIndex를 임의로 바꾸지 않는다. 이 경우 explanation 첫머리에 `[정답 충돌 확인 필요]`를 쓰고 유일성이 성립하지 않는 이유를 구체적으로 설명한다.',
    '',
    '모든 questionId에 해설을 정확히 한 번씩 반환한다. 누락·중복·알 수 없는 ID·이전 fingerprint·다른 revision을 사용하지 않는다. explanation은 정답 도출 과정과 결정적 근거, intention은 평가 능력, evidenceRefs는 지문에 실제로 존재하는 직접 인용만 담는다. distractorReasons는 정답을 제외한 네 선지의 번호와 구체적 오류를 담으며 주체 변경, 범위 확대·축소, 인과 역전, 긍정·부정 반전, 사실 왜곡, 없는 조건 추가, 시점·대상 혼동, 중심·부차 내용 혼동, 필요·충분조건 혼동을 구별한다.',
    '',
    '해설 기준은 유형별로 적용한다. 내용 일치·불일치는 달라진 사실·주체·수치·조건, 내용 이해·추론은 단서에서 결론으로 이어지는 과정, 주제·요지·제목은 글 전체 포괄 범위, 함축·빈칸은 문맥 논리와 재진술 관계, 어법은 검사 구조·오류·올바른 형태, 어휘는 대조·인과·역접 관계, 무관문·순서·삽입은 선행·후행 연결, 요약은 원문의 핵심 관계, 공유 장문은 하위 문항별 독립 근거를 설명한다.',
    '',
    '2차 출력은 explanation-output-schema-v1.json을 따르는 JSON 객체 하나다. schemaId는 english-question-lab-explanation-v1이며 입력의 setId, sourceRevision, sourceFingerprint를 그대로 반환하고 explanations 배열에 각 questionId의 explanation, intention, evidenceRefs, distractorReasons만 둔다.',
    '',
    '해설 JSON의 distractorReasons 배열은 정답 선지를 제외한 네 오답만 실제 번호와 함께 기록한다. 예를 들어 정답이 ②이면 ①·③·④·⑤의 이유만 둔다. “지문과 다르다”처럼 근거 없는 문장을 반복하지 않고 무엇이 어떻게 달라졌는지 밝힌다. 여러 단서가 필요한 문항은 필요한 근거를 모두 제시하되 지문에 없는 문장을 인용 형식으로 만들지 않는다.',
    '',
    '## ID and blueprint integrity',
    '',
    '입력과 출력의 itemId 집합은 정확히 같아야 하며 누락·추가·중복이 없어야 한다. 각 itemId의 templateId·variantId 연결과 blueprint의 질문 type·고정 문항 수를 유지한다. 공유 지문은 하나의 item 안에 둔다. 41~42는 questions 2개, 43~45는 3개다. 실제 하위 문항 총수는 최대 4개다. 모든 문항은 정확히 5개 선택지를 가지며 answerIndex는 1~5 정수다. 내부 id나 design 구조를 출력하지 않는다.',
    '',
    '1차 선택 필드로 evidenceRefs를 출력한다면 해당 카드 material에 실제로 연속해서 존재하는 직접 인용만 넣는다. distractorReasons는 정답을 제외한 네 오답에 대응한다. qualityReview는 선택적 자기평가 metadata이며 Validator·Verifier·사람 검수를 대체하지 않는다.',
    '',
    '## Copyright, quality, and answer policy',
    '',
    '실제 기출의 문장, 선지, 인물, 기관, 장소, 수치, 특유 사례를 복제하거나 조금 바꿔 재사용하지 않는다. 분석 자료는 구조적 특징만 참고한다. 새 지문은 의미·논리·표현 차원에서 독립적으로 창작한다.',
    '',
    '지문은 하나의 중심 논리를 유지하고 문항이 요구하는 근거를 충분히 포함해야 한다. 정답은 하나만 가능해야 하며, 선지는 문법·품사·추상도·길이·범주를 가능한 한 평행하게 만든다. 정답 번호 계획은 논리적 타당성보다 우선하지 않으며 공유 지문의 하위 문항도 서로 다른 근거로 풀리게 한다.',
    '',
    '## Type integrity',
    '',
    '목적·심경·주장·요지·주제·제목은 각 유형의 범위와 추상도를 구별한다. 목적은 의사소통 목적, 주장은 요구하는 입장, 요지·주제·제목은 글 전체의 초점과 범위를 묻는다. 함축 의미는 밑줄 표현의 문맥상 의미를 핵심 논리와 연결한다. 도표는 시각 자료, 단위·수치와 영어 진술 경계를 유지한다. 내용 일치·불일치와 실용문은 실제 구조화 자료에서 검증 가능해야 한다.',
    '',
    '어법은 문맥에서 하나의 명백한 오류만 두고, 어휘는 철자 오류가 아니라 문맥상 하나의 부적절어를 둔다. 빈칸은 글의 핵심 논리를 복원하게 한다. 무관문은 정확히 한 문장만 중심 흐름에서 벗어난다. 순서는 도입문과 A·B·C의 지시·정보 관계로 유일해야 한다. 삽입은 주어진 문장과 다섯 위치 표식을 보존하고 앞뒤 단서가 한 위치만 지지해야 한다. 요약문은 원문 핵심 관계를 압축하고 두 빈칸 조합은 하나만 정답이어야 한다.',
    '',
    '41~42와 43~45는 각각 하나의 공유 지문과 고정 하위 문항 구조를 유지한다. 41~42 하위 문항은 서로 다른 근거로 풀리고 문항별 표식이 다른 문항에 전파되지 않게 한다. 43~45는 A·B·C·D 사건 전개, 지칭 관계와 각 하위 문항의 독립 근거가 충돌하지 않게 한다. 정확한 marker, materialSpec, 선택지 언어와 variant 세부는 Request blueprint와 Schema를 따른다.',
    '',
    '사용자 제공 자료를 쓰라는 Request가 있으면 사실을 추가하거나 임의 재작성하지 않는다. Contract가 요구하는 비파괴적 구조화 범위가 불명확하면 승인 전에 질문한다.',
    '',
    '## Runtime Profile use',
    '',
    'Runtime Profile은 지문·문장·선지 길이의 관찰 범위, 어휘 reference 경계, 구문·담화 surface 경향, 형식별 참고 통계와 soft check에만 사용한다. 평균 단어 수, EBS coverage 비율, 구문 후보 수, 연결어 빈도, 학년 차이, Candidate Semantic 분포를 강제하지 않는다. 목표 난이도는 Request가 정하고, 구현 원칙은 Core가 정하며, 사후 평가는 독립 Verification이 담당한다. 범위 이탈 하나만으로 문항을 자동 실패시키지 않는다.',
    '',
    '## Pre-output review and strict output',
    '',
    '1차 출력 전에 ID 집합·template/variant·문항 수·선지 5개·answerIndex·단일 정답·근거·네 오답·표식·materialSpec·자연스러움·저작권·Schema·JSON 문법을 순서대로 검사한다. 선택 해설 metadata를 포함했다면 함께 검사한다. 오류가 있으면 관련 내용을 일관되게 고친 뒤 전체 검사를 다시 수행한다.',
    '',
    '승인 후 1차, repair mode와 explanation mode의 최종 응답은 설명, 머리말, 사과, 주석, Markdown code fence 없이 유효한 JSON 객체 하나만 출력한다. 1차와 repair는 `{title, items}`, explanation mode는 `english-question-lab-explanation-v1` 객체다. Schema에 없는 필드를 추가하지 않는다. 문자열의 큰따옴표를 escape하고 배열과 객체를 끝까지 닫는다. 생략 표시, undefined, NaN, Infinity, trailing comma를 쓰지 않는다.',
    '',
    '응답 길이가 부족하면 동일한 설명의 반복과 장황한 자기평가를 먼저 줄인다. 필수 카드·문항·ID·선지·구조를 생략하거나 JSON 문자열 중간에서 끝내지 않는다. 반환 직전에 모든 따옴표와 대괄호·중괄호가 닫혔는지, 요청된 배열 항목이 전부 존재하는지, JSON.parse 가능한지 마지막으로 확인한다.',
  ])
}

function setupText() {
  return text([
    '# Generator v0 Custom GPT 설정', '',
    '## 권장 이름과 설명', '',
    '- 이름: `수능 영어 문항 Generator v0`',
    '- 설명: `english-question-lab의 Request-Specific Prompt를 설계 협의 후 엄격한 Generation JSON으로 변환하는 수능 영어 읽기 전용 Generator`', '',
    '## Configure', '',
    'Custom GPT 편집은 ChatGPT 웹의 GPTs 영역에서 Create를 선택해 진행한다. Instructions에는 `instructions/GENERATOR_V0_CUSTOM_GPT_INSTRUCTIONS.md`의 본문을 붙여 넣는다. 정확한 입력 용량은 이 Bundle이 가정하지 않으므로 저장 전 실제 편집기에서 전체 입력 여부를 확인한다.', '',
    '공식 설정 개요: https://help.openai.com/en/articles/8554397-creating-and-editing-gpts', '',
    '다음 파일을 Knowledge로 업로드한다.', '',
    '1. `instructions/GENERATOR_CORE_INSTRUCTIONS_V0.md`',
    '2. `knowledge/GENERATION_CONTRACT_V0.md`',
    '3. `knowledge/csat-output-schema.json`',
    '4. `knowledge/explanation-output-schema-v1.json`',
    '5. `knowledge/GENERATION_RUNTIME_PROFILE_V0.4.md`',
    '6. `knowledge/generation-runtime-profile-v0.4.json`',
    '7. `knowledge/generation-runtime-profile-v0.4-schema.json`', '',
    '`knowledge/CSAT_STYLE_MANUAL.md`는 supplementary reference다. 업로드할 수 있지만 필수는 아니며 다른 권위 문서와 충돌하면 적용하지 않는다.', '',
    '이 v0에는 Web Search, Image Generation, Canvas, Code Interpreter, Apps, Actions가 필요하지 않다. 특히 API Action을 만들지 않는다. 기능 표시와 명칭은 계정·워크스페이스에 따라 달라질 수 있으므로 불필요한 기능을 켜지 않는다는 원칙만 적용한다.', '',
    '## Conversation starters', '',
    '- `english-question-lab에서 복사한 Request-Specific Prompt를 붙여 넣겠습니다. 먼저 설계안만 제시해 주세요.`',
    '- `[VERIFICATION_REPAIR] 프롬프트와 완성 원본 JSON을 보내겠습니다. 승인된 수정만 반영해 주세요.`', '',
    '- `[EXPLANATION_GENERATION_V1] 프롬프트를 보내겠습니다. 문제는 바꾸지 말고 해설 JSON만 반환해 주세요.`', '',
    '## 수동 흐름', '',
    '1. 앱에서 Request-Specific Prompt를 생성해 Custom GPT 채팅에 붙여 넣는다.',
    '2. `[세트 제작 설계안]`만 받았는지 확인하고 필요한 내용을 수정한다.',
    '3. 전체 설계를 명시적으로 승인한다.',
    '4. 1차 문제·정답 JSON 객체 하나만 반환됐는지 확인해 앱의 JSON 입력 영역에 붙여 넣는다.',
    '5. 해설이 필요하면 앱에서 해설 프롬프트를 만들고 `[EXPLANATION_GENERATION_V1]` 응답을 해설 JSON 입력 영역에 붙여 넣는다.',
    '6. 앱 검증이나 사람 검수 후 수정이 필요하면 앱이 만든 `[VERIFICATION_REPAIR]` 프롬프트와 원본 JSON을 새 메시지로 보낸다.', '',
    '## 업데이트', '',
    'Runtime Profile은 Corpus Engine과 자동 동기화되지 않는다. 새 버전으로 바꿀 때 canonical 파일을 Bundle builder로 다시 snapshot하고 manifest의 SHA-256과 runtime fingerprint를 검증한 뒤 Knowledge 파일을 수동 교체한다. API 자동 연결은 별도 통합 작업이다.', '',
    '## 테스트', '',
    'Preview에서 initial 설계, 승인 전 JSON 금지, 승인 후 1차 문제·정답 JSON, 기존 1단계 호환 JSON, explanation patch, stale fingerprint 차단, ID 보존, 41~42, 43~45, repair 전체 반환, Contract 충돌 차단을 시험한다. 실제 문제를 배포하거나 앱과 자동 연결하는 테스트가 아니라 수동 계약 검증이다.',
  ])
}

function readmeText() {
  return text([
    '# Generator V0 Custom GPT Release Bundle', '',
    `- Bundle: \`${BUNDLE_ID}\``, `- Version: \`${BUNDLE_VERSION}\``,
    '- Status: release candidate', '- Target: Custom GPT, manual copy/paste integration only', '',
    '이 Bundle은 검증된 Core, 1차 Generation Contract, 2차 Explanation Schema와 Corpus Runtime Profile 0.4를 Custom GPT 설정에 연결하는 release snapshot이다. API와 Corpus 자료를 변경하지 않는다.', '',
    '## 사용', '',
    '1. `custom-gpt-setup.md`에 따라 Custom GPT를 구성한다.',
    '2. `instructions/GENERATOR_V0_CUSTOM_GPT_INSTRUCTIONS.md`를 Instructions에 넣는다.',
    '3. setup 문서가 지정한 Knowledge 파일을 업로드한다.',
    '4. 앱의 Request-Specific Prompt를 채팅에 붙여 넣고 설계안을 승인한다.',
    '5. 반환된 1차 문제·정답 JSON을 앱에 수동으로 가져온다.',
    '6. 필요할 때 앱의 해설 프롬프트로 2차 explanation JSON을 받아 별도로 가져온다.', '',
    '자동 API 호출, 자동 Corpus 동기화, 실제 문제 생성, Gold/Semantic 변경은 포함하지 않는다. 모든 snapshot의 출처와 SHA-256은 `bundle-manifest.json` 및 validation 보고서에 기록되어 있다.',
  ])
}

function conflictReportText() {
  return text([
    '# Generator v0 Custom GPT 문서 충돌 보고서', '',
    '## 승인된 해소', '',
    '이전 Bundle 초안의 사용자 우선 순서는 폐기했다. 최종 순서는 Contract/Schema → ID·blueprint → 저작권 → 승인된 Request → Core 일반 원칙 → Runtime Profile → 비충돌 사용자 후속 요구다. 이는 Core와 Cleanup 보고서에 일치한다.', '',
    '## Style Manual', '',
    'Style Manual은 `supplementary_reference`로 묶는다. 현행 Runtime 필수 자료가 아니며 Contract, Schema, Request, Core, Runtime과 충돌하는 경우 적용하지 않는다. 원본은 수정하지 않았다.', '',
    '## 남은 경고', '',
    '- 공식 OpenAI 문서는 Instructions를 행동 규칙, Knowledge를 참고자료로 구분하지만 Custom GPT Instructions의 정확한 문자 제한을 제시하지 않는다.',
    '- 따라서 핵심 행동은 압축 Instructions에 직접 배치하고 Core 전체를 byte-identical Knowledge로 제공했다.',
    '- Custom GPT는 Corpus Engine과 자동 동기화되지 않으며 앱 연동은 수동 복사/붙여넣기다.',
  ])
}

function coreCoverage(coreText) {
  const headings = coreText.split(/\r?\n/).filter((line) => /^## /.test(line))
  const custom = customInstructionsText()
  const mapping = {
    'Contract boundary': 'Binding', 'Priority': 'Binding', 'Mode selection': 'Mode selection',
    'Initial mode': 'Initial mode', 'Missing information': 'Initial mode', 'Repair mode': 'Repair mode',
    'Explanation mode': 'Explanation mode',
    'ID and blueprint integrity': 'ID and blueprint integrity', 'Copyright and originality': 'Copyright, quality, and answer policy',
    'Common question quality': 'Copyright, quality, and answer policy', 'Answer position policy': 'Copyright, quality, and answer policy',
    'Type registry': 'Type integrity', 'User-provided material': 'Type integrity', 'Optional Corpus Profile': 'Runtime Profile use',
    'Pre-output review algorithm': 'Pre-output review and strict output', 'qualityReview': 'ID and blueprint integrity',
    'Strict JSON output': 'Pre-output review and strict output',
  }
  return headings.map((heading) => {
    const name = heading.replace(/^## (?:\d+(?:\.\d+)?\.?\s+)?/, '')
    const target = mapping[name]
    return { coreHeading: heading, customInstructionsSection: target ?? null, directInstruction: Boolean(target && custom.includes(`## ${target}`)), fullDetailFallback: 'instructions/GENERATOR_CORE_INSTRUCTIONS_V0.md' }
  })
}

function generatedTestSource() {
  return text([
    "import test from 'node:test'", "import assert from 'node:assert/strict'", "import fs from 'node:fs'", "import os from 'node:os'", "import path from 'node:path'", "import Ajv2020 from 'ajv/dist/2020.js'",
    "import { buildBundle, validateBundle, defaultAppRoot, defaultCorpusRoot, selectUniqueRole } from '../../../../../scripts/generator-v0-custom-gpt-bundle.mjs'", '',
    "test('duplicate authoritative candidates are rejected', () => { assert.throws(() => selectUniqueRole('core', ['a', 'b']), /count must be 1/) })", '',
    "test('repository bundle validates', () => { const result = validateBundle(); assert.equal(result.valid, true); assert.equal(result.errorCount, 0) })", '',
    "test('runtime, output, and manifest schemas validate their instances', () => { const root=path.resolve(import.meta.dirname,'..'); const ajv=new Ajv2020({strict:false}); const pairs=[['knowledge/generation-runtime-profile-v0.4-schema.json','knowledge/generation-runtime-profile-v0.4.json'],['tests/bundle-manifest-schema.json','bundle-manifest.json']]; for(const [schemaRel,dataRel] of pairs){ const validate=ajv.compile(JSON.parse(fs.readFileSync(path.join(root,schemaRel),'utf8'))); assert.equal(validate(JSON.parse(fs.readFileSync(path.join(root,dataRel),'utf8'))),true,JSON.stringify(validate.errors)) } assert.doesNotThrow(()=>ajv.compile(JSON.parse(fs.readFileSync(path.join(root,'knowledge/csat-output-schema.json'),'utf8')))) })", '',
    "test('manifest snapshots equal canonical sources', () => { const root=path.resolve(import.meta.dirname,'..'); const manifest=JSON.parse(fs.readFileSync(path.join(root,'bundle-manifest.json'),'utf8')); for(const c of manifest.components.filter(x=>x.canonicalSource)){ assert.equal(c.canonicalSha256,c.bundledSha256); assert.equal(c.canonicalByteSize,c.bundledByteSize) } })", '',
    "test('custom instructions preserve approved priority and flows', () => { const root=path.resolve(import.meta.dirname,'..'); const value=fs.readFileSync(path.join(root,'instructions/GENERATOR_V0_CUSTOM_GPT_INSTRUCTIONS.md'),'utf8'); assert.ok(value.indexOf('Generation Contract V0와 csat-output-schema.json') < value.indexOf('itemId·templateId·variantId')); assert.match(value,/승인 전에는 JSON을 출력하지 않는다/); assert.match(value,/\[VERIFICATION_REPAIR\]/); assert.match(value,/\[EXPLANATION_GENERATION_V1\]/); assert.match(value,/1차 문제·정답 JSON/); assert.match(value,/완전한 최종 JSON 객체 하나/) })", '',
    "test('all Core top-level sections have direct coverage', () => { const root=path.resolve(import.meta.dirname,'..'); const coverage=JSON.parse(fs.readFileSync(path.join(root,'validation/core-rule-coverage.json'),'utf8')); assert.ok(coverage.length>=16); assert.ok(coverage.every(x=>x.directInstruction)) })", '',
    "test('request values are dynamic and production IDs are absent', () => { const root=path.resolve(import.meta.dirname,'..'); const value=fs.readFileSync(path.join(root,'instructions/GENERATOR_V0_CUSTOM_GPT_INSTRUCTIONS.md'),'utf8'); assert.doesNotMatch(value,/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i); assert.doesNotMatch(value,/itemId\s*:\s*[A-Za-z0-9_-]+/) })", '',
    "test('output schemas enforce two-phase contract shapes', () => { const root=path.resolve(import.meta.dirname,'..'); const s=JSON.parse(fs.readFileSync(path.join(root,'knowledge/csat-output-schema.json'),'utf8')); const e=JSON.parse(fs.readFileSync(path.join(root,'knowledge/explanation-output-schema-v1.json'),'utf8')); assert.deepEqual(s.required,['title','items']); assert.ok(s.$defs.item.required.includes('itemId')); assert.ok(!s.$defs.item.required.includes('qualityReview')); assert.ok(!s.$defs.question.required.includes('explanation')); assert.equal(s.$defs.question.properties.choices.minItems,5); assert.equal(s.$defs.question.properties.answerIndex.maximum,5); assert.equal(e.properties.schemaId.const,'english-question-lab-explanation-v1') })", '',
    "test('deterministic rebuild is byte-identical', () => { const a=fs.mkdtempSync(path.join(os.tmpdir(),'generator-v0-a-')); const b=fs.mkdtempSync(path.join(os.tmpdir(),'generator-v0-b-')); buildBundle({appRoot:defaultAppRoot,corpusRoot:defaultCorpusRoot,bundleRoot:a}); buildBundle({appRoot:defaultAppRoot,corpusRoot:defaultCorpusRoot,bundleRoot:b}); const walk=(r,d='')=>fs.readdirSync(path.join(r,d),{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(r,path.join(d,e.name)):[path.join(d,e.name)]).sort(); assert.deepEqual(walk(a),walk(b)); for(const rel of walk(a)) assert.deepEqual(fs.readFileSync(path.join(a,rel)),fs.readFileSync(path.join(b,rel))) })",
  ])
}

function manifestSchema() {
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: 'Generator v0 Custom GPT Bundle Manifest', type: 'object', additionalProperties: false,
    required: ['bundleId', 'bundleVersion', 'bundleStatus', 'targetEnvironment', 'createdFrom', 'approvedPrecedence', 'components', 'validationCommands', 'unsupportedFeatures', 'knownLimitations', 'deterministicBuild', 'manifestFingerprint'],
    properties: {
      bundleId: { const: BUNDLE_ID }, bundleVersion: { const: BUNDLE_VERSION }, bundleStatus: { const: 'release_candidate' }, targetEnvironment: { const: 'custom_gpt_manual_copy_paste' },
      createdFrom: { type: 'object' }, approvedPrecedence: { type: 'array', minItems: 7, maxItems: 7, items: { type: 'string' } },
      components: { type: 'array', minItems: 9, items: { type: 'object', required: ['role', 'bundledPath', 'bundledSha256', 'bundledByteSize', 'identity', 'requiredAtRuntime', 'precedence', 'provenance'], properties: { role: { type: 'string' }, canonicalProject: { type: ['string', 'null'] }, canonicalSource: { type: ['string', 'null'] }, bundledPath: { type: 'string' }, canonicalSha256: { type: ['string', 'null'] }, bundledSha256: { type: 'string', pattern: '^[0-9a-f]{64}$' }, canonicalByteSize: { type: ['integer', 'null'] }, bundledByteSize: { type: 'integer' }, identity: { type: 'string' }, requiredAtRuntime: { type: 'boolean' }, precedence: { type: ['integer', 'string'] }, provenance: { type: 'string' } }, additionalProperties: false } },
      validationCommands: { type: 'array', items: { type: 'string' } }, unsupportedFeatures: { type: 'array', items: { type: 'string' } }, knownLimitations: { type: 'array', items: { type: 'string' } }, deterministicBuild: { type: 'object' }, manifestFingerprint: { type: 'string', pattern: '^[0-9a-f]{64}$' },
    },
  }
}

function componentRecord(component, bundleRoot) {
  const bundled = path.join(bundleRoot, component.bundledPath)
  return {
    role: component.role, canonicalProject: component.project ?? null,
    canonicalSource: component.canonicalSource ?? null, bundledPath: component.bundledPath,
    canonicalSha256: component.sha256 ?? null, bundledSha256: sha256File(bundled),
    canonicalByteSize: component.byteSize ?? null, bundledByteSize: fs.statSync(bundled).size,
    identity: component.identity, requiredAtRuntime: component.requiredAtRuntime,
    precedence: component.precedence, provenance: component.canonicalSource ? 'byte_identical_snapshot' : 'deterministic_bundle_generation',
  }
}

export function buildBundle({ appRoot = defaultAppRoot, corpusRoot = defaultCorpusRoot, bundleRoot = defaultBundleRoot } = {}) {
  const sources = discoverAuthoritativeComponents(appRoot, corpusRoot)
  const runtime = JSON.parse(fs.readFileSync(path.join(corpusRoot, 'profiles/generation-runtime-profile-v0.4.json'), 'utf8'))
  if (runtime.runtimeFingerprint !== EXPECTED_RUNTIME_FINGERPRINT) throw new Error('runtime fingerprint mismatch')
  if (runtime.detailedProfile.profileFingerprint !== EXPECTED_DETAILED_FINGERPRINT) throw new Error('detailed profile fingerprint mismatch')
  if (runtime.metadata.profileVersion !== '0.4.0-candidate') throw new Error('runtime profile version mismatch')

  fs.mkdirSync(bundleRoot, { recursive: true })
  for (const source of sources) {
    const destination = path.join(bundleRoot, source.bundledPath)
    fs.mkdirSync(path.dirname(destination), { recursive: true })
    fs.copyFileSync(source.canonicalPath, destination)
  }
  writeAtomic(path.join(bundleRoot, 'README.md'), readmeText())
  writeAtomic(path.join(bundleRoot, 'custom-gpt-setup.md'), setupText())
  writeAtomic(path.join(bundleRoot, 'instructions/GENERATOR_V0_CUSTOM_GPT_INSTRUCTIONS.md'), customInstructionsText())
  writeAtomic(path.join(bundleRoot, 'validation/document-conflict-report.md'), conflictReportText())
  const coverage = coreCoverage(fs.readFileSync(path.join(appRoot, 'docs/english-gpt/GENERATOR_CORE_INSTRUCTIONS_V0.md'), 'utf8'))
  writeAtomic(path.join(bundleRoot, 'validation/core-rule-coverage.json'), stableJson(coverage))
  writeAtomic(path.join(bundleRoot, 'tests/bundle-manifest-schema.json'), stableJson(manifestSchema()))
  writeAtomic(path.join(bundleRoot, 'tests/generator-v0-custom-gpt-bundle.node-test.mjs'), generatedTestSource())

  const generated = [
    { role: 'custom_gpt_binding_instructions', bundledPath: 'instructions/GENERATOR_V0_CUSTOM_GPT_INSTRUCTIONS.md', identity: 'Generator v0 Custom GPT binding instructions', requiredAtRuntime: true, precedence: 'binding_with_approved_priority' },
    { role: 'custom_gpt_setup', bundledPath: 'custom-gpt-setup.md', identity: 'Custom GPT setup guide', requiredAtRuntime: false, precedence: 'setup_only' },
  ]
  const components = [...sources, ...generated].map((item) => componentRecord(item, bundleRoot))
  const manifest = {
    bundleId: BUNDLE_ID, bundleVersion: BUNDLE_VERSION, bundleStatus: 'release_candidate',
    targetEnvironment: 'custom_gpt_manual_copy_paste',
    createdFrom: { generatorCoreReadiness: 'READY_TO_BUILD_GENERATOR_V0', runtimeProfileVerdict: 'READY_TO_BUILD_GENERATOR_V0_RELEASE_BUNDLE', runtimeFingerprint: EXPECTED_RUNTIME_FINGERPRINT, detailedProfileFingerprint: EXPECTED_DETAILED_FINGERPRINT },
    approvedPrecedence: APPROVED_PRIORITY, components,
    validationCommands: ['node scripts/validate-generator-v0-custom-gpt-bundle.mjs', 'node --test docs/english-gpt/releases/generator-v0-custom-gpt/tests/generator-v0-custom-gpt-bundle.node-test.mjs', 'pnpm verify'],
    unsupportedFeatures: ['automatic_api_generation', 'automatic_app_import', 'automatic_corpus_synchronization', 'difficulty_calibration', 'human_verified_semantic_distributions', 'source_exam_reproduction'],
    knownLimitations: ['manual Request and JSON transfer', 'Custom GPT editor capacity must be confirmed in the actual UI', 'Runtime Profile 0.4 is candidate because semantic annotations are not human verified', 'Style Manual is supplementary and non-authoritative'],
    deterministicBuild: { timestampIncluded: false, canonicalEncoding: 'UTF-8; source snapshots copied byte-for-byte', manifestFingerprintExcludes: ['manifestFingerprint'] },
  }
  manifest.manifestFingerprint = sha256Text(JSON.stringify(manifest))
  writeAtomic(path.join(bundleRoot, 'bundle-manifest.json'), stableJson(manifest))

  const provenance = { bundleId: BUNDLE_ID, bundleVersion: BUNDLE_VERSION, components, protectedSourceMutation: false }
  writeAtomic(path.join(bundleRoot, 'validation/component-provenance.json'), stableJson(provenance))
  writeAtomic(path.join(bundleRoot, 'validation/component-provenance.md'), text(['# Component provenance', '', ...components.map((c) => `- \`${c.role}\`: \`${c.canonicalSource ?? 'generated'}\` → \`${c.bundledPath}\`; SHA-256 \`${c.bundledSha256}\`; ${c.bundledByteSize} bytes; precedence \`${c.precedence}\`.`)]))
  writeValidation(bundleRoot, validateBundle({ appRoot, corpusRoot, bundleRoot, writeReports: false }))
  const finalValidation = validateBundle({ appRoot, corpusRoot, bundleRoot, writeReports: false })
  writeValidation(bundleRoot, finalValidation)
  return { bundleRoot, manifest, validation: finalValidation }
}

function addCheck(checks, name, passed, detail) { checks.push({ name, passed: Boolean(passed), detail }) }
function manifestFingerprint(manifest) { const clone = structuredClone(manifest); delete clone.manifestFingerprint; return sha256Text(JSON.stringify(clone)) }

export function validateBundle({ appRoot = defaultAppRoot, corpusRoot = defaultCorpusRoot, bundleRoot = defaultBundleRoot, writeReports = false } = {}) {
  const checks = []
  let manifest = null
  for (const rel of REQUIRED_PATHS) addCheck(checks, `required:${rel}`, fs.existsSync(path.join(bundleRoot, rel)), rel)
  try { manifest = JSON.parse(fs.readFileSync(path.join(bundleRoot, 'bundle-manifest.json'), 'utf8')); addCheck(checks, 'manifest_json_parse', true, 'parsed') } catch (error) { addCheck(checks, 'manifest_json_parse', false, String(error)) }
  if (manifest) {
    addCheck(checks, 'manifest_identity', manifest.bundleId === BUNDLE_ID && manifest.bundleVersion === BUNDLE_VERSION, `${manifest.bundleId}/${manifest.bundleVersion}`)
    addCheck(checks, 'manifest_fingerprint', manifest.manifestFingerprint === manifestFingerprint(manifest), manifest.manifestFingerprint)
    addCheck(checks, 'approved_priority', JSON.stringify(manifest.approvedPrecedence) === JSON.stringify(APPROVED_PRIORITY), 'Core/Cleanup approved order')
    try {
      const schema = JSON.parse(fs.readFileSync(path.join(bundleRoot, 'tests/bundle-manifest-schema.json'), 'utf8'))
      const validate = new Ajv2020({ strict: false }).compile(schema)
      addCheck(checks, 'manifest_schema_validation', validate(manifest), validate.errors ? JSON.stringify(validate.errors) : 'passed')
    } catch (error) { addCheck(checks, 'manifest_schema_validation', false, String(error)) }
    for (const component of manifest.components ?? []) {
      const bundled = path.join(bundleRoot, component.bundledPath)
      addCheck(checks, `bundle_hash:${component.role}`, fs.existsSync(bundled) && sha256File(bundled) === component.bundledSha256, component.bundledPath)
      if (component.canonicalSource) {
        const root = component.canonicalProject === 'corpus-engine' ? corpusRoot : appRoot
        const canonical = path.join(root, component.canonicalSource)
        const equal = fs.existsSync(canonical) && sha256File(canonical) === component.canonicalSha256 && fs.readFileSync(canonical).equals(fs.readFileSync(bundled))
        addCheck(checks, `snapshot_byte_equality:${component.role}`, equal, component.canonicalSource)
      }
    }
  }
  try {
    const runtime = JSON.parse(fs.readFileSync(path.join(bundleRoot, 'knowledge/generation-runtime-profile-v0.4.json'), 'utf8'))
    const schema = JSON.parse(fs.readFileSync(path.join(bundleRoot, 'knowledge/generation-runtime-profile-v0.4-schema.json'), 'utf8'))
    const validate = new Ajv2020({ strict: false }).compile(schema)
    addCheck(checks, 'runtime_schema_validation', validate(runtime), validate.errors ? JSON.stringify(validate.errors) : 'passed')
    addCheck(checks, 'runtime_fingerprint', runtime.runtimeFingerprint === EXPECTED_RUNTIME_FINGERPRINT, runtime.runtimeFingerprint)
    addCheck(checks, 'runtime_detailed_crosswalk', runtime.detailedProfile.profileFingerprint === EXPECTED_DETAILED_FINGERPRINT, runtime.detailedProfile.profileFingerprint)
    addCheck(checks, 'runtime_schema_identity', schema.$id?.includes('generation-runtime-profile-v0.4-schema.json') && schema.properties?.metadata, schema.$id)
    addCheck(checks, 'difficulty_model_absent', runtime.difficultyPolicy.corpusDifficultyModelUsed === false && runtime.difficultyPolicy.candidateDifficulty.generatorApplication === 'disabled', 'disabled')
  } catch (error) { addCheck(checks, 'runtime_json_and_schema', false, String(error)) }
  try {
    const output = JSON.parse(fs.readFileSync(path.join(bundleRoot, 'knowledge/csat-output-schema.json'), 'utf8'))
    new Ajv2020({ strict: false }).compile(output)
    addCheck(checks, 'output_schema_parse', output.title === 'English Question Lab CSAT Batch Result' && output.required.includes('items'), output.title)
    addCheck(checks, 'output_schema_contract', output.$defs.item.required.includes('itemId') && output.$defs.question.properties.choices.minItems === 5 && output.$defs.question.properties.answerIndex.maximum === 5, 'ID/5 choices/answerIndex')
  } catch (error) { addCheck(checks, 'output_schema_parse', false, String(error)) }
  const custom = fs.existsSync(path.join(bundleRoot, 'instructions/GENERATOR_V0_CUSTOM_GPT_INSTRUCTIONS.md')) ? fs.readFileSync(path.join(bundleRoot, 'instructions/GENERATOR_V0_CUSTOM_GPT_INSTRUCTIONS.md'), 'utf8') : ''
  const ordered = ['Generation Contract V0와 csat-output-schema.json', 'itemId·templateId·variantId', '저작권과 실제 기출 복제 금지', '승인된 Request-Specific Prompt', 'Generator Core Instructions의 일반 제작 원칙', 'Corpus Runtime Profile 0.4', '사용자 후속 요구'].map((term) => custom.indexOf(term))
  addCheck(checks, 'instructions_priority_order', ordered.every((value, index) => value >= 0 && (index === 0 || value > ordered[index - 1])), ordered.join(','))
  addCheck(checks, 'retired_priority_absent', !custom.includes('current_user_confirmed_requirements'), 'old runtime priority token absent')
  addCheck(checks, 'approval_flow', custom.includes('승인 전에는 JSON을 출력하지 않는다') && custom.includes('명시적으로 승인한 뒤에만'), 'initial approval gate')
  addCheck(checks, 'repair_flow', custom.includes('[VERIFICATION_REPAIR]') && custom.includes('완전한 최종 JSON 객체 하나'), 'repair returns complete JSON')
  addCheck(checks, 'dynamic_request_separation', !/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i.test(custom) && !/itemId\s*:\s*[A-Za-z0-9_-]+/.test(custom), 'no production request value')
  const runtimeRaw = fs.existsSync(path.join(bundleRoot, 'knowledge/generation-runtime-profile-v0.4.json')) ? fs.readFileSync(path.join(bundleRoot, 'knowledge/generation-runtime-profile-v0.4.json'), 'utf8') : ''
  addCheck(checks, 'forbidden_source_content_absence', !/("raw_text"|"normalized_text"|"choices"|"entries"|"koreanMeanings"|"answerDistribution")/.test(runtimeRaw), 'no source passage/choice/EBS list fields in runtime')
  try {
    const coverage = JSON.parse(fs.readFileSync(path.join(bundleRoot, 'validation/core-rule-coverage.json'), 'utf8'))
    addCheck(checks, 'core_rule_coverage', coverage.length >= 16 && coverage.every((item) => item.directInstruction), `${coverage.filter((item) => item.directInstruction).length}/${coverage.length}`)
  } catch (error) { addCheck(checks, 'core_rule_coverage', false, String(error)) }
  const relativePaths = []
  const walk = (directory, rel = '') => { const current = path.join(directory, rel); if (!fs.existsSync(current)) return; for (const entry of fs.readdirSync(current, { withFileTypes: true })) { const next = path.join(rel, entry.name); if (entry.isDirectory()) walk(directory, next); else relativePaths.push(next.replaceAll('\\', '/')) } }
  walk(bundleRoot)
  addCheck(checks, 'no_duplicate_paths', new Set(relativePaths).size === relativePaths.length, `${relativePaths.length} files`)
  const knowledgeFiles = relativePaths.filter((rel) => rel.startsWith('knowledge/') || rel === 'instructions/GENERATOR_CORE_INSTRUCTIONS_V0.md')
  const knowledgeHashes = knowledgeFiles.map((rel) => sha256File(path.join(bundleRoot, rel)))
  addCheck(checks, 'knowledge_no_duplicate_bytes', new Set(knowledgeHashes).size === knowledgeHashes.length, `${knowledgeFiles.length} knowledge/reference files`)
  addCheck(checks, 'no_project_bundle', !relativePaths.some((rel) => rel.includes('project-setup') || rel.includes('GENERATOR_V0_PROJECT')), 'Custom GPT target only')
  const errors = checks.filter((check) => !check.passed)
  const result = { bundleId: BUNDLE_ID, bundleVersion: BUNDLE_VERSION, valid: errors.length === 0, errorCount: errors.length, verdict: errors.length === 0 ? 'READY_TO_CREATE_AND_TEST_CUSTOM_GPT_V0' : 'BLOCKED_CUSTOM_GPT_BUNDLE_VALIDATION', checks, limitations: manifest?.knownLimitations ?? [] }
  if (writeReports) writeValidation(bundleRoot, result)
  return result
}

function writeValidation(bundleRoot, result) {
  writeAtomic(path.join(bundleRoot, 'validation/generator-v0-custom-gpt-validation.json'), stableJson(result))
  writeAtomic(path.join(bundleRoot, 'validation/generator-v0-custom-gpt-validation.md'), text(['# Generator v0 Custom GPT validation', '', `- Valid: \`${result.valid}\``, `- Errors: ${result.errorCount}`, `- Verdict: \`${result.verdict}\``, '', '## Checks', '', ...result.checks.map((c) => `- ${c.passed ? 'PASS' : 'FAIL'} \`${c.name}\`: ${c.detail}`), '', '## Limitations', '', ...result.limitations.map((v) => `- ${v}`)]))
}

export function parseCli(argv) {
  const options = {}
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--app-root') options.appRoot = path.resolve(argv[++i])
    else if (argv[i] === '--corpus-root') options.corpusRoot = path.resolve(argv[++i])
    else if (argv[i] === '--bundle-root') options.bundleRoot = path.resolve(argv[++i])
    else throw new Error(`unknown argument: ${argv[i]}`)
  }
  return options
}
