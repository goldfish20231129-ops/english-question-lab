# School English Provided Passage Custom GPT V0.1

- Bundle ID: `school-english-provided-passage-generator-v0.1`
- Version: `0.1.0-rc.1`
- Target: Custom GPT manual copy/paste workflow
- Scope: provided English passage → one content match/mismatch or sentence insertion item

This bundle is separate from the CSAT Generator v0 bundle. Upload only the three files listed in `custom-gpt-setup.md`; do not upload legacy CSAT runtime material as authority.

Build: `node scripts/build-school-english-provided-passage-custom-gpt-bundle.mjs`

Validate: `node scripts/validate-school-english-provided-passage-custom-gpt-bundle.mjs`

Regression: `node --test docs/english-gpt/releases/school-english-provided-passage-custom-gpt-v0.1/tests/school-english-provided-passage-custom-gpt-bundle.node-test.mjs`
