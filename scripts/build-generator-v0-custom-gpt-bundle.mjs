import { buildBundle, parseCli } from './generator-v0-custom-gpt-bundle.mjs'

try {
  const result = buildBundle(parseCli(process.argv.slice(2)))
  process.stdout.write(`${JSON.stringify({
    bundleId: result.manifest.bundleId,
    bundleVersion: result.manifest.bundleVersion,
    bundleRoot: result.bundleRoot,
    componentCount: result.manifest.components.length,
    manifestFingerprint: result.manifest.manifestFingerprint,
    valid: result.validation.valid,
    verdict: result.validation.verdict,
  }, null, 2)}\n`)
  process.exitCode = result.validation.valid ? 0 : 1
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
  process.exitCode = 1
}
