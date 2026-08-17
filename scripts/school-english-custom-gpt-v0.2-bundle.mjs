import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const BUNDLE_ID = 'school-english-custom-gpt-v0.2'
export const BUNDLE_VERSION = '0.2.10'

const here = path.dirname(fileURLToPath(import.meta.url))
export const defaultAppRoot = path.resolve(here, '..')
export const defaultBundleRoot = path.join(defaultAppRoot, 'docs/english-gpt/school-english-custom-gpt-v0.2-bundle')

const COMPONENTS = [
  ['instructions', 'docs/english-gpt/SCHOOL_ENGLISH_PROVIDED_PASSAGE_CUSTOM_GPT_INSTRUCTIONS_V0.2.md', '01-INSTRUCTIONS.md'],
  ['contract', 'docs/english-gpt/PROVIDED_PASSAGE_CONTRACT_V0.2.md', '02-KNOWLEDGE-CONTRACT.md'],
  ['request_schema', 'docs/english-gpt/provided-passage-request-schema-v0.2.json', '03-KNOWLEDGE-REQUEST-SCHEMA-V0.2.10.json'],
  ['response_schema', 'docs/english-gpt/provided-passage-response-schema-v0.2.json', '04-KNOWLEDGE-RESPONSE-SCHEMA.json'],
  ['setup_guide', 'docs/english-gpt/SCHOOL_ENGLISH_CUSTOM_GPT_V0.2_SETUP.md', '05-SETUP-GUIDE.md'],
  ['explanation_schema', 'docs/english-gpt/explanation-output-schema-v1.json', '06-KNOWLEDGE-EXPLANATION-SCHEMA.json'],
  ['detailed_rules', 'docs/english-gpt/SCHOOL_ENGLISH_CUSTOM_GPT_DETAILED_RULES_V0.2.md', '07-KNOWLEDGE-DETAILED-RULES.md'],
  ['school_grammar_evidence', 'docs/english-gpt/SCHOOL_ENGLISH_CUSTOM_GPT_SCHOOL_GRAMMAR_EVIDENCE_V0.2.md', '08-KNOWLEDGE-SCHOOL-GRAMMAR-EVIDENCE.md'],
  ['grammar_design_profiles', 'docs/english-gpt/SCHOOL_ENGLISH_CUSTOM_GPT_GRAMMAR_DESIGN_PROFILES_V0.2.md', '09-KNOWLEDGE-GRAMMAR-DESIGN-PROFILES.md'],
]

const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex')
const stableJson = (value) => `${JSON.stringify(value, null, 2)}\n`

function atomicWrite(target, bytes) {
  fs.mkdirSync(path.dirname(target), { recursive: true })
  const temp = `${target}.tmp-${process.pid}`
  fs.writeFileSync(temp, bytes)
  fs.renameSync(temp, target)
}

function componentRecord(appRoot, bundleRoot, [role, canonicalSource, bundledPath]) {
  const canonicalBytes = fs.readFileSync(path.join(appRoot, canonicalSource))
  const bundledBytes = fs.readFileSync(path.join(bundleRoot, bundledPath))
  return {
    role,
    canonicalSource: canonicalSource.replaceAll('\\', '/'),
    bundledPath: bundledPath.replaceAll('\\', '/'),
    canonicalSha256: sha256(canonicalBytes),
    bundledSha256: sha256(bundledBytes),
    byteSize: bundledBytes.length,
  }
}

function requestSchemaFacts(schema) {
  const item = schema?.$defs?.item
  return {
    schemaId: schema?.properties?.schemaId?.const,
    requiredStemRequired: Array.isArray(item?.required) && item.required.includes('requiredStem'),
    requiredStemProperty: item?.properties?.requiredStem,
    additionalProperties: item?.additionalProperties,
  }
}

function summarySchemaFacts(requestSchema, responseSchema) {
  const requestItem = requestSchema?.$defs?.item
  const responseItem = responseSchema?.$defs?.item
  const requestSummary = requestItem?.allOf?.find((rule) => rule?.if?.properties?.questionType?.const === 'summary')
  const responseSummary = responseItem?.allOf?.find((rule) => rule?.if?.properties?.questionType?.const === 'summary')
  return {
    requestMaxItems: requestSchema?.properties?.items?.maxItems,
    requestQuestionType: requestItem?.properties?.questionType?.enum?.includes('summary'),
    requestTemplateId: requestItem?.properties?.templateId?.enum?.includes('school-summary'),
    responseMaxItems: responseSchema?.properties?.items?.maxItems,
    responseQuestionType: responseItem?.properties?.questionType?.enum?.includes('summary'),
    responseTemplateId: responseItem?.properties?.templateId?.enum?.includes('school-summary'),
    responseQuestionTypeLabel: responseSchema?.$defs?.question?.properties?.type?.enum?.includes('요약문 완성'),
    responseSummaryText: responseSchema?.$defs?.question?.properties?.summaryText?.type === 'string',
    requestChoiceLanguageEnglish: requestSummary?.then?.properties?.choiceLanguage?.const === 'en',
    responseChoiceLanguageEnglish: responseSummary?.then?.properties?.choiceLanguage?.const === 'en',
  }
}

export function buildBundle({ appRoot = defaultAppRoot, bundleRoot = defaultBundleRoot } = {}) {
  fs.rmSync(path.join(bundleRoot, '03-KNOWLEDGE-REQUEST-SCHEMA.json'), { force: true })
  for (const [, canonicalSource, bundledPath] of COMPONENTS) {
    atomicWrite(path.join(bundleRoot, bundledPath), fs.readFileSync(path.join(appRoot, canonicalSource)))
  }
  const components = COMPONENTS.map((component) => componentRecord(appRoot, bundleRoot, component))
  const manifest = {
    bundleId: BUNDLE_ID,
    bundleVersion: BUNDLE_VERSION,
    generatedFromCanonicalFiles: true,
    components,
    requestSchemaId: 'english-question-lab-provided-passage-request-v0.2',
    manifestFingerprint: sha256(Buffer.from(JSON.stringify(components), 'utf8')),
  }
  atomicWrite(path.join(bundleRoot, 'bundle-manifest.json'), Buffer.from(stableJson(manifest), 'utf8'))
  return validateBundle({ appRoot, bundleRoot })
}

export function validateBundle({ appRoot = defaultAppRoot, bundleRoot = defaultBundleRoot } = {}) {
  const checks = []
  for (const component of COMPONENTS) {
    const record = componentRecord(appRoot, bundleRoot, component)
    checks.push({ name: `snapshot:${record.role}`, passed: record.canonicalSha256 === record.bundledSha256, detail: record.bundledPath })
  }

  const canonicalRequest = JSON.parse(fs.readFileSync(path.join(appRoot, 'docs/english-gpt/provided-passage-request-schema-v0.2.json'), 'utf8'))
  const bundledRequest = JSON.parse(fs.readFileSync(path.join(bundleRoot, '03-KNOWLEDGE-REQUEST-SCHEMA-V0.2.10.json'), 'utf8'))
  const canonicalResponse = JSON.parse(fs.readFileSync(path.join(appRoot, 'docs/english-gpt/provided-passage-response-schema-v0.2.json'), 'utf8'))
  const bundledResponse = JSON.parse(fs.readFileSync(path.join(bundleRoot, '04-KNOWLEDGE-RESPONSE-SCHEMA.json'), 'utf8'))
  const canonicalFacts = requestSchemaFacts(canonicalRequest)
  const bundledFacts = requestSchemaFacts(bundledRequest)
  checks.push({ name: 'requiredStem:canonical_required', passed: canonicalFacts.requiredStemRequired, detail: String(canonicalFacts.requiredStemRequired) })
  checks.push({ name: 'requiredStem:canonical_property', passed: canonicalFacts.requiredStemProperty?.type === 'string' && canonicalFacts.requiredStemProperty?.minLength === 1, detail: JSON.stringify(canonicalFacts.requiredStemProperty) })
  checks.push({ name: 'requiredStem:bundle_contract', passed: JSON.stringify(canonicalFacts) === JSON.stringify(bundledFacts), detail: JSON.stringify(bundledFacts) })
  const canonicalSummary = summarySchemaFacts(canonicalRequest, canonicalResponse)
  const bundledSummary = summarySchemaFacts(bundledRequest, bundledResponse)
  checks.push({ name: 'summary:canonical_contract', passed: Object.values(canonicalSummary).every((value) => value === true || value === 5), detail: JSON.stringify(canonicalSummary) })
  checks.push({ name: 'summary:bundle_contract', passed: JSON.stringify(canonicalSummary) === JSON.stringify(bundledSummary), detail: JSON.stringify(bundledSummary) })
  const grammarProfileEnum = canonicalRequest?.$defs?.item?.properties?.grammarDesignProfile?.enum ?? []
  checks.push({ name: 'grammar_profile:optional_source_preference', passed: !canonicalRequest.$defs.item.required.includes('grammarDesignProfile') && ['school_exam_balanced','clause_relations','verb_and_nonfinite','agreement_voice_reference','source_best_fit',null].every((value) => grammarProfileEnum.includes(value)), detail: JSON.stringify(grammarProfileEnum) })

  const schemaIds = fs.readdirSync(bundleRoot)
    .filter((name) => name.endsWith('.json') && name !== 'bundle-manifest.json')
    .map((name) => JSON.parse(fs.readFileSync(path.join(bundleRoot, name), 'utf8')))
    .map((schema) => schema?.properties?.schemaId?.const)
    .filter(Boolean)
  const requestSchemaMatches = schemaIds.filter((value) => value === canonicalFacts.schemaId)
  checks.push({ name: 'request_schema:single_v0.2_identity', passed: requestSchemaMatches.length === 1, detail: `${requestSchemaMatches.length}` })

  const instructions = fs.readFileSync(path.join(bundleRoot, '01-INSTRUCTIONS.md'), 'utf8')
  const contract = fs.readFileSync(path.join(bundleRoot, '02-KNOWLEDGE-CONTRACT.md'), 'utf8')
  const detailedRules = fs.readFileSync(path.join(bundleRoot, '07-KNOWLEDGE-DETAILED-RULES.md'), 'utf8')
  const grammarEvidence = fs.readFileSync(path.join(bundleRoot, '08-KNOWLEDGE-SCHOOL-GRAMMAR-EVIDENCE.md'), 'utf8')
  const grammarProfiles = fs.readFileSync(path.join(bundleRoot, '09-KNOWLEDGE-GRAMMAR-DESIGN-PROFILES.md'), 'utf8')
  checks.push({ name: 'instructions:exact_character_limit', passed: instructions.length === 8000, detail: `${instructions.length}` })
  checks.push({ name: 'instructions:requiredStem_contract', passed: instructions.includes('item.required') && instructions.includes('item.properties.requiredStem') && instructions.includes('additional-properties 오류를 적용하지 않는다'), detail: 'requiredStem is an allowed required property' })
  checks.push({ name: 'instructions:immediate_generation', passed: instructions.includes('승인 질문') && instructions.includes('즉시 문제·정답 JSON 하나') && instructions.includes('Response Schema V0.2'), detail: 'valid Request returns JSON immediately' })
  checks.push({ name: 'instructions:boundary_ids_internal_only', passed: instructions.includes('candidateBoundaryIds') && instructions.includes('ID 숫자를 위치 번호로 바꾸지 않는다') && instructions.includes('사용자용 문자열에는 `b3`, `b5` 같은 내부 ID를 남기지 않는다'), detail: 'boundary IDs stay structural and user text uses candidate-order labels' })
  checks.push({ name: 'instructions:grammar_design_profile', passed: instructions.includes('`items[].grammarDesignProfile`은 `$defs.item.properties`에 정의된 선택 필드') && instructions.includes('추가 속성이 아니다') && instructions.includes('school_exam_balanced') && instructions.includes('source_best_fit'), detail: 'grammarDesignProfile is explicitly authorized by Instructions' })
  checks.push({ name: 'instructions:boundary_answer_consistency', passed: instructions.includes('answerIndex') && instructions.includes('answerBoundaryId') && (instructions.includes('같은 위치 지시') || instructions.includes('위치 일치')), detail: 'answer index and answer boundary must identify the same candidate' })
  checks.push({ name: 'instructions:summary_self_check', passed: instructions.includes('questionType은 `summary`') && instructions.includes('각각 정확히 한 번') && instructions.includes('`|`가 정확히 하나') && instructions.includes('materialOperation은 null'), detail: 'summary has a complete pre-output checklist' })
  checks.push({ name: 'instructions:automatic_grammar_target', passed: instructions.includes('grammarTarget이 `null`이어도') && instructions.includes('controlled_error_variant의 구체 grammarTarget은 우선값') && instructions.includes('source_form_check의 태그만 강제값') && instructions.includes('실제로 선택한 태그'), detail: 'automatic and preferred grammar targets resolve to source-evidenced concrete targets' })
  checks.push({ name: 'instructions:first_phase_minimal_json', passed: instructions.includes('필수 materialOperation만 반환한다') && instructions.includes('2차에만 쓴다'), detail: 'first phase excludes explanation-only fields' })
  checks.push({ name: 'instructions:json_string_safety', passed: instructions.includes('JSON.parse 가능 여부') && instructions.includes('`‘ ’`'), detail: 'quoted text cannot break JSON strings' })
  checks.push({ name: 'instructions:opaque_fingerprint', passed: instructions.includes('불투명 식별값') && instructions.includes('source.passage만 직접 SHA-256 처리해 재계산·대조하지 않는다') && instructions.includes('Response에 글자 단위로 그대로 반환'), detail: 'generator preserves the app-computed fingerprint without recomputing it' })
  checks.push({ name: 'contract:opaque_fingerprint', passed: contract.includes('버전 접두어와 정규화 규칙') && contract.includes('직접 SHA-256 처리해') && contract.includes('유효한 Request를 거부하지 않는다'), detail: 'contract assigns fingerprint validation to the app' })
  checks.push({ name: 'knowledge:detailed_rules', passed: detailedRules.includes('## 7. 요약문 완성') && detailedRules.includes('## 9. 최종 자체검수') && detailedRules.includes('candidateBoundaryIds.indexOf(answerBoundaryId)+1'), detail: 'detailed type rules and checks are available as Knowledge' })
  checks.push({ name: 'knowledge:school_grammar_evidence', passed: grammarEvidence.includes('객관식 어법 13문항') && grammarEvidence.includes('observed_surface') && grammarEvidence.includes('observed_reference') && grammarEvidence.includes('unsupported') && grammarEvidence.includes('제작 프롬프트가 각 itemId에 배정한 choices 배열'), detail: 'school grammar PDF observations and corpus evidence boundaries are available as Knowledge' })
  checks.push({ name: 'knowledge:grammar_design_profiles', passed: grammarProfiles.includes('school_exam_balanced') && grammarProfiles.includes('clause_relations') && grammarProfiles.includes('verb_and_nonfinite') && grammarProfiles.includes('agreement_voice_reference') && grammarProfiles.includes('source_best_fit') && grammarProfiles.includes('객관식 13문항') && grammarProfiles.includes('원문에 없는 구조'), detail: 'school grammar profile settings and item-level observations are available as Knowledge' })
  const staleRequiredStemClaims = [
    'requiredStem 필드가 Request Schema V0.2의 item 정의에 없다',
    'requiredStem은 미정의 속성이다',
    'requiredStem은 정의되지 않은 속성이다',
    'requiredStem은 추가 속성이다',
    'requiredStem이 추가 속성이다',
  ]
  checks.push({ name: 'instructions:no_undefined_claim', passed: staleRequiredStemClaims.every((claim) => !instructions.includes(claim)), detail: 'no stale requiredStem claim' })

  const errors = checks.filter((check) => !check.passed)
  return { bundleId: BUNDLE_ID, bundleVersion: BUNDLE_VERSION, valid: errors.length === 0, errorCount: errors.length, checks }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = buildBundle()
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  process.exitCode = result.valid ? 0 : 1
}
