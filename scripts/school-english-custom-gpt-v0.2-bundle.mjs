import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const BUNDLE_ID = 'school-english-custom-gpt-v0.2'
export const BUNDLE_VERSION = '0.2.1'

const here = path.dirname(fileURLToPath(import.meta.url))
export const defaultAppRoot = path.resolve(here, '..')
export const defaultBundleRoot = path.join(defaultAppRoot, 'docs/english-gpt/school-english-custom-gpt-v0.2-bundle')

const COMPONENTS = [
  ['instructions', 'docs/english-gpt/SCHOOL_ENGLISH_PROVIDED_PASSAGE_CUSTOM_GPT_INSTRUCTIONS_V0.2.md', '01-INSTRUCTIONS.md'],
  ['contract', 'docs/english-gpt/PROVIDED_PASSAGE_CONTRACT_V0.2.md', '02-KNOWLEDGE-CONTRACT.md'],
  ['request_schema', 'docs/english-gpt/provided-passage-request-schema-v0.2.json', '03-KNOWLEDGE-REQUEST-SCHEMA.json'],
  ['response_schema', 'docs/english-gpt/provided-passage-response-schema-v0.2.json', '04-KNOWLEDGE-RESPONSE-SCHEMA.json'],
  ['setup_guide', 'docs/english-gpt/SCHOOL_ENGLISH_CUSTOM_GPT_V0.2_SETUP.md', '05-SETUP-GUIDE.md'],
  ['explanation_schema', 'docs/english-gpt/explanation-output-schema-v1.json', '06-KNOWLEDGE-EXPLANATION-SCHEMA.json'],
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

export function buildBundle({ appRoot = defaultAppRoot, bundleRoot = defaultBundleRoot } = {}) {
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
  const bundledRequest = JSON.parse(fs.readFileSync(path.join(bundleRoot, '03-KNOWLEDGE-REQUEST-SCHEMA.json'), 'utf8'))
  const canonicalFacts = requestSchemaFacts(canonicalRequest)
  const bundledFacts = requestSchemaFacts(bundledRequest)
  checks.push({ name: 'requiredStem:canonical_required', passed: canonicalFacts.requiredStemRequired, detail: String(canonicalFacts.requiredStemRequired) })
  checks.push({ name: 'requiredStem:canonical_property', passed: canonicalFacts.requiredStemProperty?.type === 'string' && canonicalFacts.requiredStemProperty?.minLength === 1, detail: JSON.stringify(canonicalFacts.requiredStemProperty) })
  checks.push({ name: 'requiredStem:bundle_contract', passed: JSON.stringify(canonicalFacts) === JSON.stringify(bundledFacts), detail: JSON.stringify(bundledFacts) })

  const schemaIds = fs.readdirSync(bundleRoot)
    .filter((name) => name.endsWith('.json') && name !== 'bundle-manifest.json')
    .map((name) => JSON.parse(fs.readFileSync(path.join(bundleRoot, name), 'utf8')))
    .map((schema) => schema?.properties?.schemaId?.const)
    .filter(Boolean)
  const requestSchemaMatches = schemaIds.filter((value) => value === canonicalFacts.schemaId)
  checks.push({ name: 'request_schema:single_v0.2_identity', passed: requestSchemaMatches.length === 1, detail: `${requestSchemaMatches.length}` })

  const instructions = fs.readFileSync(path.join(bundleRoot, '01-INSTRUCTIONS.md'), 'utf8')
  checks.push({ name: 'instructions:requiredStem_contract', passed: instructions.includes('item.required') && instructions.includes('item.properties.requiredStem') && instructions.includes('additional-properties 오류를 적용하지 않는다'), detail: 'requiredStem is an allowed required property' })
  checks.push({ name: 'instructions:immediate_generation', passed: instructions.includes('승인 질문') && instructions.includes('즉시 Response Schema V0.2'), detail: 'valid Request returns JSON immediately' })
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
