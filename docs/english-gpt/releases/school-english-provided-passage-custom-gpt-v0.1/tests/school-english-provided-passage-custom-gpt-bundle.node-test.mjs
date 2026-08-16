import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { buildBundle, validateBundle, validateExchange } from '../../../../../scripts/school-english-provided-passage-custom-gpt-bundle.mjs'
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const app=path.resolve(root,'../../../..')
const corpus=path.resolve(app,'..','영어 기출 분석과 통계','corpus-engine')
const json=(p)=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'))
const files=(base,rel='')=>fs.readdirSync(path.join(base,rel),{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(base,path.join(rel,e.name)):[path.join(rel,e.name)]).sort()
test('bundle and protected baselines validate',()=>assert.equal(validateBundle({appRoot:app,corpusRoot:corpus,bundleRoot:root,writeReports:false}).valid,true))
test('all twelve preview fixtures produce expected decisions',()=>{const fixtures=json('fixtures/preview-fixtures.json'),req=json('knowledge/provided-passage-request-schema-v0.1.json'),res=json('knowledge/provided-passage-response-schema-v0.1.json'); assert.equal(fixtures.length,12); for(const f of fixtures) assert.deepEqual(validateExchange(f.request,f.response,req,res),f.expected,f.fixtureId)})
test('manifest component hashes match bytes',()=>{const m=json('bundle-manifest.json'); for(const c of m.components){const b=fs.readFileSync(path.join(root,c.path)); assert.equal(crypto.createHash('sha256').update(b).digest('hex'),c.physicalSha256)}})
test('two clean rebuilds are byte-identical',()=>{const a=fs.mkdtempSync(path.join(os.tmpdir(),'school-gpt-a-')),b=fs.mkdtempSync(path.join(os.tmpdir(),'school-gpt-b-')); buildBundle({appRoot:app,corpusRoot:corpus,bundleRoot:a}); buildBundle({appRoot:app,corpusRoot:corpus,bundleRoot:b}); assert.deepEqual(files(a),files(b)); for(const rel of files(a)) assert.deepEqual(fs.readFileSync(path.join(a,rel)),fs.readFileSync(path.join(b,rel)),rel)})
