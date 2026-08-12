import { describe, expect, it } from 'vitest'
import { applyCsatItemTemplate, createCsatItem } from './csat'
import { createEnglishSet, createExamLayout } from './english'
import { contentEntriesForSet } from './examLayout'
import type { CsatQuestionVerification, EnglishExamDocument, EnglishQuestionSet, StudioBundle } from './types'
import {
  VERIFICATION_SCHEMA_ID, createVerificationPrompt, generateVerificationRepairPrompt,
  parseVerificationJson, updateVerificationFinding, verificationDisplayStatus,
} from './verification'

function completedSet(templateId: '33' | '43-45' = '33') {
  const set = createEnglishSet('csat')
  const item = applyCsatItemTemplate(createCsatItem(), templateId)
  item.material = templateId === '33' ? 'A complete passage with enough evidence and a [[빈칸]].' : 'A long narrative passage.'
  item.questions = item.questions.map((question, questionIndex) => ({
    ...question,
    choices: ['one', 'two', 'three', 'four', 'five'],
    answerIndex: questionIndex + 1,
    explanation: 'The passage supports the answer.',
    evidenceRefs: ['evidence'],
    distractorReasons: ['r1', 'r2', 'r3', 'r4'],
  }))
  set.csatItems = [item]
  set.aiRevision = 1
  set.lastImportedJson = '{}'
  return set
}

function bundleFor(set: EnglishQuestionSet, exam?: EnglishExamDocument): StudioBundle {
  return { questionSets: [set], exams: exam ? [exam] : [], mediaAssets: [] }
}

function reviewsFor(set: EnglishQuestionSet): CsatQuestionVerification[] {
  const item = set.csatItems![0]
  return item.questions.map((question) => ({
    setId: set.id,
    csatItemId: item.id,
    questionId: question.id,
    slot: question.csatSlot ?? item.design!.templateId,
    predictedAnswerIndex: question.answerIndex,
    confidence: 0.9,
    choiceAssessments: question.choices.map((_, index) => ({ choiceIndex: index + 1, verdict: index + 1 === question.answerIndex ? 'correct' as const : 'incorrect' as const, reason: `reason ${index + 1}` })),
    evidence: ['evidence'],
    explanationConsistent: true,
    explanationNote: 'consistent',
    strongestDistractorIndex: question.answerIndex === 1 ? 2 : 1,
  }))
}

function resultJson(run: ReturnType<typeof createVerificationPrompt>['run'], reviews: CsatQuestionVerification[], findings: unknown[] = []) {
  return JSON.stringify({ schemaId: VERIFICATION_SCHEMA_ID, targetId: run.targetId, sourceFingerprint: run.sourceFingerprint, overallSummary: '검증 요약', questionReviews: reviews, findings })
}

describe('선택형 AI 검증', () => {
  it('완성된 수능형 세트에서 독립 검증 프롬프트를 만들고 검증하지 않은 상태를 허용한다', () => {
    const set = completedSet()
    const bundle = bundleFor(set)
    expect(verificationDisplayStatus({ scope: 'set', id: set.id }, undefined, bundle)).toBe('unverified')
    const { run, prompt } = createVerificationPrompt({ scope: 'set', id: set.id }, bundle)
    expect(run.status).toBe('in-progress')
    expect(prompt).toContain('문제를 수정하거나 새 문제를 만들지 말고')
    expect(prompt).toContain('8,000자 이하')
    expect(prompt).toContain('JSON 문자열 중간에서 출력을 끝내지 않는다')
    expect(prompt).toContain(run.sourceFingerprint)
    expect(prompt).toContain(set.csatItems![0].questions[0].id)
  })

  it('검증 AI 응답이 문자열 중간에서 잘리면 재생성 방법을 안내한다', () => {
    const set = completedSet()
    const bundle = bundleFor(set)
    const { run } = createVerificationPrompt({ scope: 'set', id: set.id }, bundle)
    const truncated = `{"schemaId":"${VERIFICATION_SCHEMA_ID}","targetId":"${run.targetId}","sourceFingerprint":"${run.sourceFingerprint}","overallSummary":"검증 중`
    expect(() => parseVerificationJson(truncated, run, bundle)).toThrow('문장 중간에서 잘렸습니다')
  })

  it('닫혔지만 잘못된 JSON에는 문법 오류 안내를 표시한다', () => {
    const set = completedSet()
    const bundle = bundleFor(set)
    const { run } = createVerificationPrompt({ scope: 'set', id: set.id }, bundle)
    expect(() => parseVerificationJson('{"schemaId":}', run, bundle)).toThrow('검증 JSON 문법 오류입니다')
  })

  it('모든 문항의 단일 정답과 해설이 일치하면 검증 완료로 가져온다', () => {
    const set = completedSet()
    const bundle = bundleFor(set)
    const { run } = createVerificationPrompt({ scope: 'set', id: set.id }, bundle)
    const imported = parseVerificationJson(resultJson(run, reviewsFor(set)), run, bundle)
    expect(imported.status).toBe('complete')
    expect(imported.findings).toEqual([])
  })

  it('정답 불일치·애매한 선지·해설 불일치를 수정 개요로 계산한다', () => {
    const set = completedSet()
    const bundle = bundleFor(set)
    const { run } = createVerificationPrompt({ scope: 'set', id: set.id }, bundle)
    const reviews = reviewsFor(set)
    reviews[0] = {
      ...reviews[0],
      predictedAnswerIndex: 2,
      confidence: 0.6,
      explanationConsistent: false,
      explanationNote: '해설이 실제 근거와 다르다.',
      choiceAssessments: reviews[0].choiceAssessments.map((assessment) => assessment.choiceIndex === 1 ? { ...assessment, verdict: 'ambiguous' } : assessment.choiceIndex === 2 ? { ...assessment, verdict: 'correct' } : assessment),
    }
    const imported = parseVerificationJson(resultJson(run, reviews), run, bundle)
    expect(imported.status).toBe('needs-review')
    expect(imported.findings.map((finding) => finding.category)).toEqual(expect.arrayContaining(['정답 불일치', '정답 유일성', '해설 불일치', '낮은 검증 확신도']))
  })

  it('44번 지칭 대상이 4:1이 아니면 프로그램이 별도 오류를 만든다', () => {
    const set = completedSet('43-45')
    const bundle = bundleFor(set)
    const { run } = createVerificationPrompt({ scope: 'set', id: set.id }, bundle)
    const reviews = reviewsFor(set).map((review) => review.slot === '44' ? {
      ...review,
      referents: [
        { marker: '(a)', entityId: 'Mina', evidence: 'a' },
        { marker: '(b)', entityId: 'Jisoo', evidence: 'b' },
        { marker: '(c)', entityId: 'Jisoo', evidence: 'c' },
        { marker: '(d)', entityId: 'Mina', evidence: 'd' },
        { marker: '(e)', entityId: 'MrHan', evidence: 'e' },
      ],
    } : review)
    const imported = parseVerificationJson(resultJson(run, reviews), run, bundle)
    expect(imported.findings.some((finding) => finding.category === '지칭 4:1 구조 오류')).toBe(true)
  })

  it('사용자가 승인하거나 직접 고친 의견만 제작 GPT 수정 프롬프트에 포함한다', () => {
    const set = completedSet()
    const bundle = bundleFor(set)
    const { run } = createVerificationPrompt({ scope: 'set', id: set.id }, bundle)
    const reviews = reviewsFor(set)
    const question = set.csatItems![0].questions[0]
    const rawFinding = { setId: set.id, csatItemId: set.csatItems![0].id, questionId: question.id, slot: '33', severity: 'warning', category: '오답 매력도', summary: '오답이 너무 약함', evidence: '2번 선지', suggestedRepair: '오답을 강화한다.' }
    let imported = parseVerificationJson(resultJson(run, reviews, [rawFinding]), run, bundle)
    imported = updateVerificationFinding(imported, imported.findings[0].id, 'revise', '2번을 부분 일치 오답으로 바꾼다.')
    imported.overallUserNote = '지문 길이는 유지한다.'
    const prompt = generateVerificationRepairPrompt(imported, set)
    expect(prompt).toContain('[VERIFICATION_REPAIR]')
    expect(prompt).toContain('2번을 부분 일치 오답으로 바꾼다.')
    expect(prompt).toContain('지문 길이는 유지한다.')
    expect(prompt).toContain(set.csatItems![0].id)
  })

  it('검증 이후 원문이 수정되면 이전 결과를 재검증 필요 상태로 표시한다', () => {
    const set = completedSet()
    const bundle = bundleFor(set)
    const { run } = createVerificationPrompt({ scope: 'set', id: set.id }, bundle)
    const imported = parseVerificationJson(resultJson(run, reviewsFor(set)), run, bundle)
    set.verificationRuns = [imported]
    set.csatItems![0].material += ' Changed.'
    expect(verificationDisplayStatus({ scope: 'set', id: set.id }, set.verificationRuns, bundle)).toBe('stale')
  })

  it('조립 시험지는 포함된 수능형 카드만 하나의 선택형 검증 대상으로 만든다', () => {
    const set = completedSet()
    const exam: EnglishExamDocument = {
      id: crypto.randomUUID(), title: '혼합 시험지', setIds: [set.id], contentEntries: contentEntriesForSet(set),
      layout: createExamLayout('csat'), setOverrides: {}, entryOverrides: {}, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    }
    const { run, prompt } = createVerificationPrompt({ scope: 'exam', id: exam.id }, bundleFor(set, exam))
    expect(run.scope).toBe('exam')
    expect(prompt).toContain('조립 시험지')
    expect(prompt).toContain(set.csatItems![0].id)
  })
})
