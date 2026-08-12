# Generation Runtime Profile 0.4

This compact profile is advisory evidence for English Question Generator v0. It does not replace the Request-Specific Prompt, Generator Core Instructions, Generation Contract, or output JSON Schema.

- Runtime profile: `csat-generator-runtime-evidence-v0.4` / `0.4.0-candidate`
- Runtime fingerprint: `64a5b6d8dc9d5d61cef3e8c62d24fa4fbe819d2f5698a24ec56cc7ef2f8f688c`
- Detailed profile: `profiles/generation-profile-12exam-gold35-ebs-reference-syntax-discourse-v0.4.json`
- Detailed fingerprint: `5758a177ca3ca064b244897999e7dc2d6211ea2edf53c10a987ce3dfe71d9fa4`

## 1. Evidence contract

Four layers remain separate. `observed_surface` is a reference range from 12 exams. `ai_candidate_semantic` covers only Gold 35 and has zero human semantic verification. `observed_reference` describes EBS listing overlap only. Syntax/Discourse combines direct `derived_surface`, explicitly named `rule_based_candidate`, structural `not_applicable`, and `unsupported` fields. Never average evidence strengths or promote a candidate/proxy to observation or verification.

## 2. Core Surface ranges

The syntax population is 276 continuous-prose passages. Practical-information documents are excluded from these prose denominators.

| Metric | n | min | median | mean | max |
|---|---:|---:|---:|---:|---:|
| Sentences per passage | 276 | 1.0 | 7.0 | 7.884058 | 32.0 |
| Maximum sentence length | 276 | 12.0 | 32.0 | 33.112319 | 85.0 |
| Embedding proxy | 276 | 0.0 | 0.666667 | 0.717763 | 3.0 |
| Modifier-span proxy | 276 | 0.0 | 7.5 | 7.645383 | 29.0 |
| Referential-distance proxy | 276 | 0.0 | 9.267857 | 9.868939 | 29.4 |
| Explicit cue density / 100 tokens | 276 | 0.0 | 2.083333 | 2.143055 | 9.375 |

No configured explicit cue was detected in 35/276 applicable passages (12.6812%). This is not evidence that those passages lack discourse relations.

These numbers describe the corpus. They are not targets, quotas, pass/fail thresholds, or a definition of KICE style. Natural, request-compliant writing may depart from them.

## 3. Sufficient-sample question-type references

Only types with at least 24 passage units are listed in this compact projection. Omitted small samples remain available in the detailed Profile but should not be generalized.

| Type | n | applicable | sentence mean | max-sentence mean | cue-density mean |
|---|---:|---:|---:|---:|---:|
| `blank` | 48 | 48 | 7.416667 | 36.5625 | 2.356225 |
| `content_match` | 24 | 24 | 16.708333 | 26.916667 | 1.33703 |
| `ordering` | 36 | 36 | 9.083333 | 25.805556 | 1.584153 |
| `practical_information` | 24 | 0 | None | None | None |
| `sentence_insertion` | 24 | 24 | 6.583333 | 36.666667 | 2.38877 |
| `title` | 24 | 24 | 10.208333 | 39.875 | 2.554574 |
| `vocabulary` | 24 | 24 | 10.666667 | 37.583333 | 2.601219 |

`main_idea` and `summary` have smaller samples and are intentionally omitted here. Their observed long-sentence or embedding values are not mandatory type conditions. Chart statistics cover extracted English prose only, not the visual graphic. Practical-information prose metrics are `not_applicable`, not zero.

## 4. Sentence construction guidance

- Vary sentence shape naturally within observed ranges; never copy the mean as a target.
- Do not alternate long and short sentences mechanically.
- A long sentence must contribute a real conceptual, logical, or modifying relation.
- Do not disguise difficulty with rare words or unnecessary sentence length.
- Do not use participles, relatives, insertions, apposition, or parallelism as quotas.

Interpretation: create sentence complexity only where the underlying concept, qualification, contrast, cause, condition, comparison, or modification requires it. A complex form without logical work is noise. Do not add relatives, participles, apposition, parentheticals, or parallel structures merely to approach a corpus count. Do not simplify a legitimately complex requested idea solely because it exceeds a median.

## 5. Discourse development guidance

- Prioritize the actual relation between sentences over connective count.
- Allow clear implicit progression without an explicit connective.
- Use contrast, cause, example, condition, and other cues only when semantically warranted.
- Do not repeat connectives or require one in every paragraph.
- Connect the passage's central relation to the evidence needed for the answer.

Explicit cues should label relations that already exist in meaning. They should not be inserted to manufacture an appearance of cohesion. A coherent passage may express contrast, causality, qualification, elaboration, or sequence without a lexical connective. Conversely, a connective does not guarantee coherent reasoning. The central relation must support the evidence path required by the item.

## 6. Format-aware application

- Use prose aggregates for ordinary exposition and the matching format aggregate for letters, notices, charts, or narratives.
- Do not force not_applicable prose metrics onto structural practical-information material.
- Design a shared passage once and keep each linked question's evidence separate.
- Treat format differences as references, not templates to reproduce verbatim.

Ordinary exposition may consult the prose aggregate. Correspondence, narrative, chart prose, notices, advertisements, segmented ordering material, and shared passages should consult their matching format in the detailed Profile. Format is a reference context, never permission to reproduce a source instance. In a shared-passage set, write the passage once and isolate each question's stem, choices, markers, and evidence.

## 7. Vocabulary reference boundary

Exam frequency is `observed_surface`; EBS listing is `observed_reference`; semantic difficulty is `unsupported`. The observed token coverage (6.6602%) and type coverage (15.4938%) are not desired ratios. EBS-listed items are not automatically important, necessary, easy, difficult, or mandatory. Unlisted vocabulary is not automatically inappropriate. Never reproduce the complete EBS headword sequence or Korean meanings.

## 8. Difficulty non-use policy

This Profile contains no corpus difficulty model, absolute difficulty score, relative percentile, observed response accuracy, grade-cut prediction, or student-response model. Candidate difficulty aggregates inherited as provenance from Profile 0.3 are disabled for generator application because no response or accuracy calibration exists.

The Request-Specific Prompt owns the requested target difficulty. Generator Core Instructions own how to realize it. An independent Verification stage owns post-generation evaluation. Do not derive or override target difficulty from grade-level Surface differences, sentence length, vocabulary overlap, syntax-candidate counts, or connective density.

## 9. Post-generation soft checks

- Is sentence length unusually outside the observed range without a request or structural reason?
- Does every complex construction contribute to the logic?
- Are connectives semantically justified rather than excessive?
- Does the selected statistic match the passage format?
- Was a shared passage generated only once?
- Was naturalness harmed merely to match a statistic?

A range departure alone must never cause automatic failure. A user request, item structure, topic, document format, shared-passage design, or approved repair may justify it. Record the reason and evaluate validity, naturalness, uniqueness of answer, and contract compliance instead of forcing statistics.

## 10. Unsupported

- `human_verified_semantic_distributions`
- `absolute_difficulty_calibration`
- `relative_difficulty_percentile`
- `observed_question_accuracy`
- `grade_cut_prediction`
- `student_response_modeling`
- `authoritative_kice_intention`
- `implicit_discourse_relation_distribution`
- `true_syntax_tree_depth`
- `dependency_parsing`
- `antecedent_resolution`
- `long_term_historical_trend`
- `ebs_vocabulary_importance_or_necessity`
- `semantic_extrapolation_beyond_gold35_candidate`

Unsupported means the current evidence cannot establish the claim. It must not be silently approximated by a Surface proxy or candidate semantic value.

## 11. Forbidden uses

- `replicate_source_exam_passages_choices_or_unique_examples`
- `replicate_exact_answer_number_distribution`
- `force_observed_means_on_every_passage`
- `use_syntax_candidate_counts_as_generation_quotas`
- `use_connective_counts_as_direct_kice_style_criterion`
- `label_candidate_semantics_as_human_verified`
- `use_ebs_listing_coverage_as_target_vocabulary_ratio`
- `interpret_grade_differences_as_absolute_difficulty`
- `present_surface_proxy_as_actual_difficulty`
- `infer_meaning_or_item_writer_intent_absent_from_sources`
- `reproduce_complete_ebs_headwords_or_korean_meanings`
- `auto_fail_only_for_departing_from_observed_range`

## 12. Authority order

1. `current_user_confirmed_requirements`
2. `request_specific_prompt`
3. `generator_core_instructions`
4. `generation_contract_and_json_schema`
5. `generation_profile_v0.4`
6. `profile_candidate_or_proxy_guidance`

Profile statistics cannot overwrite itemId, templateId, variantId, topic, length, format, user constraints, or approved repair decisions. Candidate/proxy guidance is always the lowest authority.

## 13. Copyright and content boundary

This compact file contains aggregate statistics and policies only. It contains no exam passage, choice, solution, unique source example, EBS headword list, Korean meaning list, individual 300-passage record, individual 35-question candidate, source anchor quotation, or answer-number distribution. Use the detailed Profile only for aggregate provenance and group statistics; use neither profile to recreate copyrighted source content.

## 14. Runtime decision rule

First satisfy the current request and contract. Then choose the matching format and sufficiently supported group reference. Apply sentence and discourse guidance as a naturalness-oriented soft check. Preserve evidence labels. If a claim requires implicit semantics, difficulty calibration, response data, or authoritative intent, mark it unsupported and defer it to the appropriate future analysis or Verification step.
