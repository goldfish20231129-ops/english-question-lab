# English Question Generation Contract v0

## Scope

Generation Contract v0 applies only to CSAT (`mode: csat`) batch JSON imported by `parseEnglishSetJson()`.

School and custom modes keep their existing top-level JSON and importer behavior. Verification JSON and `[VERIFICATION_REPAIR]` are separate contracts.

## Authoritative structural schema

`docs/english-gpt/csat-output-schema.json` is the authoritative structural contract. The CSAT importer compiles and runs this Draft 2020-12 schema before request identity checks or internal-model conversion.

- Every field listed in `required` must be present and satisfy its declared type and bounds.
- `additionalProperties: false` is enforced. Unsupported fields are rejected rather than discarded.
- `translation` is not part of v0 and is rejected.
- The official output is one JSON object without Markdown code fences. A single outer `json` code fence remains tolerated only for backward-compatible input handling.

## answerIndex policy

`questions[].answerIndex` must be an integer from 1 through 5.

Strings, circled-number strings, decimals, zero, numbers above five, `null`, and missing values are rejected. The CSAT importer does not clamp or default an invalid answer to 1.

## Request identity policy

The app-issued request is authoritative for:

- the complete `itemId` set;
- each item's `templateId`;
- each item's `variantId`;
- the template/variant blueprint and fixed question count.

Missing, duplicate, unknown, or additional item IDs are rejected. A different template or variant is rejected. Only variants already allowed by the current template catalog are accepted.

`questions[].type` must match the blueprint type. The previously emitted label `문맥상 어휘` is accepted as the explicit compatibility alias of the canonical blueprint type `어휘`; internal storage remains canonical.

## Batch limit

The product limit is at most four actual child questions per import. Runtime semantic validation sums the blueprint question count, not `items.length`.

- `33 + 40 + 41-42` is `1 + 1 + 2 = 4` and is valid.
- one `43-45` item is three questions and is valid.
- any combination totaling more than four is rejected.

The schema uses `items.maxItems: 4` as a safe coarse bound. The blueprint-derived total is the authoritative limit.

## materialSpec policy

Supported kinds remain:

- `prose`
- `chart`
- `practical`
- `ordered`
- `insertion`
- `summary`
- `longExpository`
- `longNarrative`

The JSON Schema validates each kind's required fields. Runtime semantic validation additionally rejects renderer-critical relationships that the schema cannot express simply:

- every chart series must have the same number of values as categories;
- ordered sections must be exactly A, B, C in order;
- summary text must not be blank;
- long narrative sections must be exactly A, B, C, D in order.

## Structural validation versus quality validation

Import is atomic and rejects:

- invalid JSON or schema violations;
- missing required fields or unsupported fields;
- request identity, template, or variant mismatches;
- invalid answer index, question type, question count, or choice count;
- a batch over four actual questions;
- renderer-critical `materialSpec` errors.

On failure, `aiRevision`, `lastImportedJson`, and the existing valid result are unchanged.

`validateEnglishSet()` remains responsible for post-import quality checks such as passage naturalness and length, evidence accuracy, answer and distractor quality, difficulty, vocabulary level, and whether AI self-review scores are substantively credible.

`distractorReasons` and `qualityReview` remain required generation metadata for validation and editing. They are not rendered on the current answer/explanation pages and are not quality guarantees by themselves.

## Repair and verification

Verification prompts, verification result JSON, and repair prompts are not part of Generation Contract v0. A repair response still returns the complete CSAT Generation JSON and therefore passes through the same strict v0 importer before it can replace a result.
