import Ajv2020, { type ErrorObject } from 'ajv/dist/2020'
import csatOutputSchema from '../docs/english-gpt/csat-output-schema.json'

const generationSchemaValidator = new Ajv2020({ allErrors: true, strict: true }).compile(csatOutputSchema)

function errorPath(error: ErrorObject) {
  return error.instancePath || '$'
}

function formatSchemaError(error: ErrorObject) {
  const path = errorPath(error)
  if (error.keyword === 'additionalProperties') {
    const field = (error.params as { additionalProperty: string }).additionalProperty
    return `지원되지 않는 필드: ${path}/${field}`
  }
  if (error.keyword === 'required') {
    const field = (error.params as { missingProperty: string }).missingProperty
    return `필수 필드 누락: ${path}/${field}`
  }
  if (error.keyword === 'type') {
    const expected = (error.params as { type: string }).type
    return `Generation Schema 오류: ${path} 값은 ${expected} 형식이어야 합니다.`
  }
  if (error.keyword === 'enum' || error.keyword === 'const') return `Generation Schema 오류: ${path} 값이 허용된 값과 다릅니다.`
  if (error.keyword === 'minItems' || error.keyword === 'maxItems') return `Generation Schema 오류: ${path} 배열 항목 수가 허용 범위를 벗어났습니다.`
  if (error.keyword === 'minLength') return `Generation Schema 오류: ${path} 값은 비어 있을 수 없습니다.`
  if (error.keyword === 'minimum' || error.keyword === 'maximum') return `Generation Schema 오류: ${path} 숫자가 허용 범위를 벗어났습니다.`
  return `Generation Schema 오류: ${path} ${error.message ?? '값이 올바르지 않습니다.'}`
}

export function assertCsatGenerationSchema(value: unknown): asserts value is Record<string, unknown> {
  if (generationSchemaValidator(value)) return
  const details = (generationSchemaValidator.errors ?? []).map(formatSchemaError)
  throw new Error(details.length ? details.join(' / ') : '수능형 Generation JSON이 공식 Schema와 일치하지 않습니다.')
}
