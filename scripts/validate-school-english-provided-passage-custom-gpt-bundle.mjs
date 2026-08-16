import { parseCli, validateBundle } from './school-english-provided-passage-custom-gpt-bundle.mjs'
try { const result=validateBundle({...parseCli(process.argv.slice(2)),writeReports:true}); process.stdout.write(`${JSON.stringify(result,null,2)}\n`); process.exitCode=result.valid?0:1 } catch(error){process.stderr.write(`${error instanceof Error?error.stack:String(error)}\n`);process.exitCode=1}
