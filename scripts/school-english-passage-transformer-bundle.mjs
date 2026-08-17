import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const BUNDLE_ID = 'school-english-passage-transformer-v1'
export const BUNDLE_VERSION = '1.0.1'

const here = path.dirname(fileURLToPath(import.meta.url))
export const defaultAppRoot = path.resolve(here, '..')
export const defaultBundleRoot = path.join(defaultAppRoot, 'docs/english-gpt/school-english-passage-transformer-v1-bundle')

const COMPONENTS = [
  ['instructions', 'docs/english-gpt/SCHOOL_ENGLISH_PASSAGE_TRANSFORMER_INSTRUCTIONS_V1.md', '01-INSTRUCTIONS.md'],
  ['contract', 'docs/english-gpt/SCHOOL_ENGLISH_PASSAGE_TRANSFORMATION_CONTRACT_V1.md', '02-KNOWLEDGE-CONTRACT.md'],
  ['output_schema', 'docs/english-gpt/passage-transformation-output-schema-v1.json', '03-KNOWLEDGE-OUTPUT-SCHEMA.json'],
  ['evidence_guide', 'docs/english-gpt/SCHOOL_ENGLISH_PASSAGE_TRANSFORMATION_EVIDENCE_GUIDE_V1.md', '04-KNOWLEDGE-EVIDENCE-GUIDE.md'],
  ['setup_guide', 'docs/english-gpt/SCHOOL_ENGLISH_PASSAGE_TRANSFORMER_SETUP_V1.md', '05-SETUP-GUIDE.md'],
]

const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex')
const stableJson = (value) => `${JSON.stringify(value, null, 2)}\n`

function atomicWrite(target, bytes) {
  fs.mkdirSync(path.dirname(target), { recursive: true })
  const temp = `${target}.tmp-${process.pid}`
  fs.writeFileSync(temp, bytes)
  fs.renameSync(temp, target)
}

function record(appRoot, bundleRoot, [role, canonicalSource, bundledPath]) {
  const canonical = fs.readFileSync(path.join(appRoot, canonicalSource))
  const bundled = fs.readFileSync(path.join(bundleRoot, bundledPath))
  return { role, canonicalSource, bundledPath, canonicalSha256: sha256(canonical), bundledSha256: sha256(bundled), byteSize: bundled.length }
}

export function validatePassageTransformerBundle({ appRoot = defaultAppRoot, bundleRoot = defaultBundleRoot } = {}) {
  const checks = COMPONENTS.map((component) => {
    const item = record(appRoot, bundleRoot, component)
    return { name: `snapshot:${item.role}`, passed: item.canonicalSha256 === item.bundledSha256, detail: item.bundledPath }
  })
  const instructions = fs.readFileSync(path.join(bundleRoot, '01-INSTRUCTIONS.md'), 'utf8')
  const contract = fs.readFileSync(path.join(bundleRoot, '02-KNOWLEDGE-CONTRACT.md'), 'utf8')
  const schema = JSON.parse(fs.readFileSync(path.join(bundleRoot, '03-KNOWLEDGE-OUTPUT-SCHEMA.json'), 'utf8'))
  const evidence = fs.readFileSync(path.join(bundleRoot, '04-KNOWLEDGE-EVIDENCE-GUIDE.md'), 'utf8')
  checks.push({ name: 'instructions:two_modes', passed: instructions.includes('모드 1: lexical') && instructions.includes('모드 2: restructure'), detail: 'lexical and restructure are distinct' })
  checks.push({ name: 'instructions:lexical_minimum', passed: instructions.includes('최소 10개') && instructions.includes('안전한 후보가 10개보다 적은'), detail: 'lexical mode requires ten safe, distinct changes' })
  checks.push({ name: 'instructions:opaque_fingerprint', passed: instructions.includes('불투명 식별값') && instructions.includes('재계산'), detail: 'fingerprint is preserved, not recomputed' })
  checks.push({ name: 'contract:new_lineage', passed: contract.includes('새 sourcePassageId') && contract.includes('변형 전 fingerprint를 이후 문항 Request에 재사용하지 않는다'), detail: 'accepted transform becomes a new authoritative source' })
  checks.push({ name: 'schema:identity', passed: schema.$defs?.success?.properties?.schemaId?.const === 'english-question-lab-passage-transformation-v1', detail: schema.$defs?.success?.properties?.schemaId?.const })
  checks.push({ name: 'schema:strict_success', passed: schema.$defs?.success?.additionalProperties === false && schema.$defs?.success?.properties?.mode?.enum?.join(',') === 'lexical,restructure', detail: 'strict success output' })
  checks.push({ name: 'schema:lexical_minimum', passed: schema.$defs?.success?.allOf?.[0]?.then?.properties?.changes?.minItems === 10, detail: 'lexical changes minItems is 10' })
  checks.push({ name: 'evidence:boundaries', passed: evidence.includes('observed_surface') && evidence.includes('observed_reference') && evidence.includes('unsupported') && evidence.includes('객관식 어법 13문항'), detail: 'corpus, vocabulary and school grammar evidence remain bounded' })
  const errors = checks.filter((check) => !check.passed)
  return { bundleId: BUNDLE_ID, bundleVersion: BUNDLE_VERSION, valid: errors.length === 0, errorCount: errors.length, checks }
}

export function buildPassageTransformerBundle({ appRoot = defaultAppRoot, bundleRoot = defaultBundleRoot } = {}) {
  for (const [, source, target] of COMPONENTS) atomicWrite(path.join(bundleRoot, target), fs.readFileSync(path.join(appRoot, source)))
  const components = COMPONENTS.map((component) => record(appRoot, bundleRoot, component))
  const manifest = { bundleId: BUNDLE_ID, bundleVersion: BUNDLE_VERSION, generatedFromCanonicalFiles: true, components, manifestFingerprint: sha256(Buffer.from(JSON.stringify(components), 'utf8')) }
  atomicWrite(path.join(bundleRoot, 'bundle-manifest.json'), Buffer.from(stableJson(manifest), 'utf8'))
  return validatePassageTransformerBundle({ appRoot, bundleRoot })
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = buildPassageTransformerBundle()
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  process.exitCode = result.valid ? 0 : 1
}
