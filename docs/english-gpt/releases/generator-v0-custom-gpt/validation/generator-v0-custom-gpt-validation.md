# Generator v0 Custom GPT validation

- Valid: `true`
- Errors: 0
- Verdict: `READY_TO_CREATE_AND_TEST_CUSTOM_GPT_V0`

## Checks

- PASS `required:README.md`: README.md
- PASS `required:bundle-manifest.json`: bundle-manifest.json
- PASS `required:custom-gpt-setup.md`: custom-gpt-setup.md
- PASS `required:instructions/GENERATOR_CORE_INSTRUCTIONS_V0.md`: instructions/GENERATOR_CORE_INSTRUCTIONS_V0.md
- PASS `required:instructions/GENERATOR_V0_CUSTOM_GPT_INSTRUCTIONS.md`: instructions/GENERATOR_V0_CUSTOM_GPT_INSTRUCTIONS.md
- PASS `required:knowledge/GENERATION_RUNTIME_PROFILE_V0.4.md`: knowledge/GENERATION_RUNTIME_PROFILE_V0.4.md
- PASS `required:knowledge/generation-runtime-profile-v0.4.json`: knowledge/generation-runtime-profile-v0.4.json
- PASS `required:knowledge/generation-runtime-profile-v0.4-schema.json`: knowledge/generation-runtime-profile-v0.4-schema.json
- PASS `required:knowledge/GENERATION_CONTRACT_V0.md`: knowledge/GENERATION_CONTRACT_V0.md
- PASS `required:knowledge/csat-output-schema.json`: knowledge/csat-output-schema.json
- PASS `required:knowledge/CSAT_STYLE_MANUAL.md`: knowledge/CSAT_STYLE_MANUAL.md
- PASS `required:validation/generator-v0-custom-gpt-validation.json`: validation/generator-v0-custom-gpt-validation.json
- PASS `required:validation/generator-v0-custom-gpt-validation.md`: validation/generator-v0-custom-gpt-validation.md
- PASS `required:validation/component-provenance.json`: validation/component-provenance.json
- PASS `required:validation/component-provenance.md`: validation/component-provenance.md
- PASS `required:validation/document-conflict-report.md`: validation/document-conflict-report.md
- PASS `required:validation/core-rule-coverage.json`: validation/core-rule-coverage.json
- PASS `required:tests/bundle-manifest-schema.json`: tests/bundle-manifest-schema.json
- PASS `required:tests/generator-v0-custom-gpt-bundle.node-test.mjs`: tests/generator-v0-custom-gpt-bundle.node-test.mjs
- PASS `manifest_json_parse`: parsed
- PASS `manifest_identity`: english-question-lab-generator-v0/0.1.0-rc.1
- PASS `manifest_fingerprint`: e741041c9b122e6e89d472e35bade83740167e2c8e1569076010e505f3ee2ecf
- PASS `approved_priority`: Core/Cleanup approved order
- PASS `manifest_schema_validation`: passed
- PASS `bundle_hash:generator_core`: instructions/GENERATOR_CORE_INSTRUCTIONS_V0.md
- PASS `snapshot_byte_equality:generator_core`: docs/english-gpt/GENERATOR_CORE_INSTRUCTIONS_V0.md
- PASS `bundle_hash:generation_contract`: knowledge/GENERATION_CONTRACT_V0.md
- PASS `snapshot_byte_equality:generation_contract`: docs/english-gpt/GENERATION_CONTRACT_V0.md
- PASS `bundle_hash:output_json_schema`: knowledge/csat-output-schema.json
- PASS `snapshot_byte_equality:output_json_schema`: docs/english-gpt/csat-output-schema.json
- PASS `bundle_hash:style_manual`: knowledge/CSAT_STYLE_MANUAL.md
- PASS `snapshot_byte_equality:style_manual`: docs/english-gpt/CSAT_STYLE_MANUAL.md
- PASS `bundle_hash:runtime_profile_markdown`: knowledge/GENERATION_RUNTIME_PROFILE_V0.4.md
- PASS `snapshot_byte_equality:runtime_profile_markdown`: profiles/GENERATION_RUNTIME_PROFILE_V0.4.md
- PASS `bundle_hash:runtime_profile_json`: knowledge/generation-runtime-profile-v0.4.json
- PASS `snapshot_byte_equality:runtime_profile_json`: profiles/generation-runtime-profile-v0.4.json
- PASS `bundle_hash:runtime_profile_schema`: knowledge/generation-runtime-profile-v0.4-schema.json
- PASS `snapshot_byte_equality:runtime_profile_schema`: schemas/generation-runtime-profile-v0.4-schema.json
- PASS `bundle_hash:custom_gpt_binding_instructions`: instructions/GENERATOR_V0_CUSTOM_GPT_INSTRUCTIONS.md
- PASS `bundle_hash:custom_gpt_setup`: custom-gpt-setup.md
- PASS `runtime_schema_validation`: passed
- PASS `runtime_fingerprint`: 64a5b6d8dc9d5d61cef3e8c62d24fa4fbe819d2f5698a24ec56cc7ef2f8f688c
- PASS `runtime_detailed_crosswalk`: 5758a177ca3ca064b244897999e7dc2d6211ea2edf53c10a987ce3dfe71d9fa4
- PASS `runtime_schema_identity`: https://local.corpus-engine.invalid/schemas/generation-runtime-profile-v0.4-schema.json
- PASS `difficulty_model_absent`: disabled
- PASS `output_schema_parse`: English Question Lab CSAT Batch Result
- PASS `output_schema_contract`: ID/5 choices/answerIndex
- PASS `instructions_priority_order`: 319,370,420,440,471,512,556
- PASS `retired_priority_absent`: old runtime priority token absent
- PASS `approval_flow`: initial approval gate
- PASS `repair_flow`: repair returns complete JSON
- PASS `dynamic_request_separation`: no production request value
- PASS `forbidden_source_content_absence`: no source passage/choice/EBS list fields in runtime
- PASS `core_rule_coverage`: 16/16
- PASS `no_duplicate_paths`: 19 files
- PASS `knowledge_no_duplicate_bytes`: 7 knowledge/reference files
- PASS `no_project_bundle`: Custom GPT target only

## Limitations

- manual Request and JSON transfer
- Custom GPT editor capacity must be confirmed in the actual UI
- Runtime Profile 0.4 is candidate because semantic annotations are not human verified
- Style Manual is supplementary and non-authoritative
