import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildPassageTransformerBundle, defaultBundleRoot } from './school-english-passage-transformer-bundle.mjs'

describe('영어 내신 지문 변형기 Custom GPT 번들', () => {
  it('두 변형 모드와 근거 경계를 포함한 동기화 번들을 만든다', () => {
    const result = buildPassageTransformerBundle()
    expect(result.valid).toBe(true)
    expect(result.errorCount).toBe(0)
    expect(fs.existsSync(path.join(defaultBundleRoot, '01-INSTRUCTIONS.md'))).toBe(true)
    expect(fs.existsSync(path.join(defaultBundleRoot, '04-KNOWLEDGE-EVIDENCE-GUIDE.md'))).toBe(true)
  })

  it('Output Schema는 기존 앱 파서의 성공 필드만 허용한다', () => {
    const schema = JSON.parse(fs.readFileSync(path.join(defaultBundleRoot, '03-KNOWLEDGE-OUTPUT-SCHEMA.json'), 'utf8'))
    expect(schema.$defs.success.additionalProperties).toBe(false)
    expect(schema.$defs.success.required).toEqual([
      'schemaId', 'mode', 'sourceFingerprint', 'transformedPassage', 'changes', 'meaningPreserved', 'singleParagraph',
    ])
    expect(schema.$defs.success.properties.mode.enum).toEqual(['lexical', 'restructure'])
    expect(schema.$defs.success.allOf[0].then.properties.changes.minItems).toBe(10)
  })

  it('Instructions는 문제 생성과 fingerprint 재계산을 금지한다', () => {
    const instructions = fs.readFileSync(path.join(defaultBundleRoot, '01-INSTRUCTIONS.md'), 'utf8')
    expect(instructions).toContain('문제·선지·정답·해설을 만들지 않는다')
    expect(instructions).toContain('재계산하거나 유효성을 판정하지 말고')
    expect(instructions).toContain('changes 순차 치환만으로 결과가 재현된다')
    expect(instructions).toContain('최소 10개')
  })
})
