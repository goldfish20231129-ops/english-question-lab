import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import Ajv2020 from 'ajv/dist/2020.js'
import { buildBundle, validateBundle, defaultAppRoot, defaultCorpusRoot, selectUniqueRole } from '../../../../../scripts/generator-v0-custom-gpt-bundle.mjs'

test('duplicate authoritative candidates are rejected', () => { assert.throws(() => selectUniqueRole('core', ['a', 'b']), /count must be 1/) })

test('repository bundle validates', () => { const result = validateBundle(); assert.equal(result.valid, true); assert.equal(result.errorCount, 0) })

test('runtime, output, and manifest schemas validate their instances', () => { const root=path.resolve(import.meta.dirname,'..'); const ajv=new Ajv2020({strict:false}); const pairs=[['knowledge/generation-runtime-profile-v0.4-schema.json','knowledge/generation-runtime-profile-v0.4.json'],['tests/bundle-manifest-schema.json','bundle-manifest.json']]; for(const [schemaRel,dataRel] of pairs){ const validate=ajv.compile(JSON.parse(fs.readFileSync(path.join(root,schemaRel),'utf8'))); assert.equal(validate(JSON.parse(fs.readFileSync(path.join(root,dataRel),'utf8'))),true,JSON.stringify(validate.errors)) } assert.doesNotThrow(()=>ajv.compile(JSON.parse(fs.readFileSync(path.join(root,'knowledge/csat-output-schema.json'),'utf8')))) })

test('manifest snapshots equal canonical sources', () => { const root=path.resolve(import.meta.dirname,'..'); const manifest=JSON.parse(fs.readFileSync(path.join(root,'bundle-manifest.json'),'utf8')); for(const c of manifest.components.filter(x=>x.canonicalSource)){ assert.equal(c.canonicalSha256,c.bundledSha256); assert.equal(c.canonicalByteSize,c.bundledByteSize) } })

test('custom instructions preserve approved priority and flows', () => { const root=path.resolve(import.meta.dirname,'..'); const value=fs.readFileSync(path.join(root,'instructions/GENERATOR_V0_CUSTOM_GPT_INSTRUCTIONS.md'),'utf8'); assert.ok(value.indexOf('Generation Contract V0와 csat-output-schema.json') < value.indexOf('itemId·templateId·variantId')); assert.match(value,/승인 전에는 JSON을 출력하지 않는다/); assert.match(value,/[VERIFICATION_REPAIR]/); assert.match(value,/[EXPLANATION_GENERATION_V1]/); assert.match(value,/1차 문제·정답 JSON/); assert.match(value,/완전한 최종 JSON 객체 하나/) })

test('all Core top-level sections have direct coverage', () => { const root=path.resolve(import.meta.dirname,'..'); const coverage=JSON.parse(fs.readFileSync(path.join(root,'validation/core-rule-coverage.json'),'utf8')); assert.ok(coverage.length>=16); assert.ok(coverage.every(x=>x.directInstruction)) })

test('request values are dynamic and production IDs are absent', () => { const root=path.resolve(import.meta.dirname,'..'); const value=fs.readFileSync(path.join(root,'instructions/GENERATOR_V0_CUSTOM_GPT_INSTRUCTIONS.md'),'utf8'); assert.doesNotMatch(value,/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i); assert.doesNotMatch(value,/itemIds*:s*[A-Za-z0-9_-]+/) })

test('output schemas enforce two-phase contract shapes', () => { const root=path.resolve(import.meta.dirname,'..'); const s=JSON.parse(fs.readFileSync(path.join(root,'knowledge/csat-output-schema.json'),'utf8')); const e=JSON.parse(fs.readFileSync(path.join(root,'knowledge/explanation-output-schema-v1.json'),'utf8')); assert.deepEqual(s.required,['title','items']); assert.ok(s.$defs.item.required.includes('itemId')); assert.ok(!s.$defs.item.required.includes('qualityReview')); assert.ok(!s.$defs.question.required.includes('explanation')); assert.equal(s.$defs.question.properties.choices.minItems,5); assert.equal(s.$defs.question.properties.answerIndex.maximum,5); assert.equal(e.properties.schemaId.const,'english-question-lab-explanation-v1') })

test('deterministic rebuild is byte-identical', () => { const a=fs.mkdtempSync(path.join(os.tmpdir(),'generator-v0-a-')); const b=fs.mkdtempSync(path.join(os.tmpdir(),'generator-v0-b-')); buildBundle({appRoot:defaultAppRoot,corpusRoot:defaultCorpusRoot,bundleRoot:a}); buildBundle({appRoot:defaultAppRoot,corpusRoot:defaultCorpusRoot,bundleRoot:b}); const walk=(r,d='')=>fs.readdirSync(path.join(r,d),{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(r,path.join(d,e.name)):[path.join(d,e.name)]).sort(); assert.deepEqual(walk(a),walk(b)); for(const rel of walk(a)) assert.deepEqual(fs.readFileSync(path.join(a,rel)),fs.readFileSync(path.join(b,rel))) })
