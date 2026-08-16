import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateBundle } from '../../../../../scripts/school-english-provided-passage-custom-gpt-bundle.mjs'
const bundleRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const appRoot=path.resolve(bundleRoot,'../../../..')
const corpusRoot=path.resolve(appRoot,'..','영어 기출 분석과 통계','corpus-engine')
const result=validateBundle({appRoot,corpusRoot,bundleRoot,writeReports:false})
process.stdout.write(JSON.stringify(result,null,2)+'\n')
process.exitCode=result.valid?0:1
