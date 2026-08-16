import { collapseCsatProseParagraphs, csatLongExpositoryText, csatLongNarrativeSections, csatPrintFlow, embedCsatChartChoices, getCsatItems, splitCsatSummaryMaterial } from './csat'
import { providedPassagePresentationSpec } from './providedPassage'
import { providedPassageV02PresentationSpec, providedPassageV02QuestionMaterialText, providedPassageV02SharedMaterialText } from './providedPassageV02'
import { generatedSchoolSharedMaterialPresentation, isSchoolInsertionQuestion, orderedSchoolQuestions, schoolQuestionMaterialPresentation, usesInlineSchoolChoices, usesQuestionScopedSchoolMaterial } from './schoolMaterial'
import type { CsatItemDesign, CsatMaterialSpec, EnglishExamDocument, EnglishQuestion, EnglishQuestionSet, ExamContentEntry, ExamLayoutSettings, MediaAsset, SetLayoutOverride } from './types'

export type ExamFlowKind = 'set-header' | 'structured-material' | 'summary-material' | 'long-expository-material' | 'long-narrative-section' | 'material' | 'asset' | 'question' | 'question-lead' | 'question-choices'

export interface ExamFlowBlock {
  id: string
  sourceId: string
  setId: string
  kind: ExamFlowKind
  units: number
  set?: EnglishQuestionSet
  csatItem?: CsatItemDesign
  materialSpec?: CsatMaterialSpec
  text?: string
  summaryText?: string
  groupNumberLabel?: string
  sectionLabel?: 'A' | 'B' | 'C' | 'D'
  asset?: MediaAsset
  question?: EnglishQuestion
  questionNumber?: number
  questionPart?: 'full' | 'lead' | 'choices'
  keepWithNext?: boolean
  keepTogetherId?: string
  materialContinues?: boolean
  effectiveLayout: ExamLayoutSettings
  override: SetLayoutOverride
}

export function contentEntriesForSet(set: EnglishQuestionSet): ExamContentEntry[] {
  if (set.mode === 'csat') return getCsatItems(set).map((item) => ({ id: `set:${set.id}:item:${item.id}`, setId: set.id, csatItemId: item.id }))
  return [{ id: `set:${set.id}`, setId: set.id }]
}

function finiteNumber(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function normalizeExamLayout(value: unknown): ExamLayoutSettings {
  const fallback = examFallbackLayout()
  const input = value && typeof value === 'object' ? value as Partial<ExamLayoutSettings> : {}
  const preset = input.preset === 'csat' || input.preset === 'school' || input.preset === 'worksheet' || input.preset === 'custom' ? input.preset : fallback.preset
  return {
    ...fallback,
    ...input,
    preset,
    columns: input.columns === 2 ? 2 : 1,
    answerColumns: input.answerColumns === 2 ? 2 : 1,
    marginTop: finiteNumber(input.marginTop, fallback.marginTop),
    marginRight: finiteNumber(input.marginRight, fallback.marginRight),
    marginBottom: finiteNumber(input.marginBottom, fallback.marginBottom),
    marginLeft: finiteNumber(input.marginLeft, fallback.marginLeft),
    fontSize: finiteNumber(input.fontSize, fallback.fontSize),
    lineHeight: finiteNumber(input.lineHeight, fallback.lineHeight),
    questionGap: finiteNumber(input.questionGap, fallback.questionGap),
    passageBorder: typeof input.passageBorder === 'boolean' ? input.passageBorder : fallback.passageBorder,
    institution: typeof input.institution === 'string' ? input.institution : '',
    gradeLabel: typeof input.gradeLabel === 'string' ? input.gradeLabel : '',
    dateLabel: typeof input.dateLabel === 'string' ? input.dateLabel : '',
    footerText: typeof input.footerText === 'string' ? input.footerText : '',
    showPageNumbers: typeof input.showPageNumbers === 'boolean' ? input.showPageNumbers : fallback.showPageNumbers,
  }
}

export function normalizeExamDocument(exam: EnglishExamDocument, sets: EnglishQuestionSet[]): EnglishExamDocument {
  const setById = new Map(sets.map((set) => [set.id, set]))
  const storedEntries = Array.isArray(exam.contentEntries) && exam.contentEntries.length
    ? exam.contentEntries
    : (Array.isArray(exam.setIds) ? exam.setIds : []).flatMap((setId) => {
      const set = sets.find((candidate) => candidate.id === setId)
      return set ? contentEntriesForSet(set) : []
    })
  const seenEntries = new Set<string>()
  const entries = storedEntries.filter((entry): entry is ExamContentEntry => {
    if (!entry || typeof entry !== 'object' || typeof entry.id !== 'string' || typeof entry.setId !== 'string') return false
    if (seenEntries.has(entry.id)) return false
    const set = setById.get(entry.setId)
    if (!set) return false
    if (entry.csatItemId && !getCsatItems(set).some((item) => item.id === entry.csatItemId)) return false
    seenEntries.add(entry.id)
    return true
  })
  const setOverrides = exam.setOverrides && typeof exam.setOverrides === 'object' ? exam.setOverrides : {}
  const storedEntryOverrides = exam.entryOverrides && typeof exam.entryOverrides === 'object' ? exam.entryOverrides : {}
  const entryOverrides = Object.fromEntries(Object.entries(storedEntryOverrides).filter(([entryId]) => seenEntries.has(entryId)))
  entries.forEach((entry) => {
    if (!entryOverrides[entry.id] && setOverrides[entry.setId]) entryOverrides[entry.id] = { ...setOverrides[entry.setId] }
  })
  const normalizedLayout = normalizeExamLayout(exam.layout)
  const layout = normalizedLayout.preset === 'csat' && (normalizedLayout.layoutRevision ?? 1) < 2
    ? {
      ...normalizedLayout,
      layoutRevision: 2,
      fontSize: Math.abs(normalizedLayout.fontSize - 10.2) < 0.001 ? 8.6 : normalizedLayout.fontSize,
      lineHeight: Math.abs(normalizedLayout.lineHeight - 1.62) < 0.001 ? 1.32 : normalizedLayout.lineHeight,
      questionGap: Math.abs(normalizedLayout.questionGap - 6) < 0.001 ? 3.5 : normalizedLayout.questionGap,
    }
    : normalizedLayout
  return { ...exam, layout, setOverrides, contentEntries: entries, entryOverrides, setIds: [...new Set(entries.map((entry) => entry.setId))] }
}

export function moveExamContentEntry(entries: ExamContentEntry[], entryId: string, direction: -1 | 1) {
  const index = entries.findIndex((entry) => entry.id === entryId)
  const target = index + direction
  if (index < 0 || target < 0 || target >= entries.length) return entries
  const next = [...entries]
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}

export function examSetIds(exam: EnglishExamDocument) {
  return [...new Set((exam.contentEntries?.length ? exam.contentEntries.map((entry) => entry.setId) : exam.setIds))]
}

export function resolveExamEntries(exam: EnglishExamDocument, sets: EnglishQuestionSet[]) {
  const normalized = normalizeExamDocument(exam, sets)
  return (normalized.contentEntries ?? []).flatMap((entry) => {
    const set = sets.find((candidate) => candidate.id === entry.setId)
    if (!set) return []
    const csatItem = entry.csatItemId ? getCsatItems(set).find((item) => item.id === entry.csatItemId) : undefined
    if (entry.csatItemId && !csatItem) return []
    return [{ entry, set, csatItem }]
  })
}

export interface ExamLayoutPage {
  layout: ExamLayoutSettings
  columns: ExamFlowBlock[][]
}

export interface ExamLayoutMetrics {
  blockHeights: Record<string, number>
  columnHeights: Record<string, number>
  layoutHeights?: Record<string, number>
}

export function renderEnglishMarkup(value: string) {
  return value
    .replace(/\[\[밑줄:([^\]]+)\]\]/g, '<u>$1</u>')
    .replace(/\[\[빈칸\]\]/g, '<span class="english-blank">&nbsp;</span>')
    .replace(/\[\[요약빈칸(?::([^\]]+))?\]\]/g, '<span class="english-summary-blank">($1)</span>')
    .replace(/\[\[삽입문장:([^\]]+)\]\]/g, '<span class="insertion-sentence">$1</span>')
    .replace(/\[\[삽입위치:([^\]]+)\]\]/g, '<b class="insertion-position">$1</b>')
    .replace(/\[\[선택:([^|]+)\|([^|]+)\|([^\]]+)\]\]/g, '<span class="vocabulary-choice"><b>($1)</b> $2 / $3</span>')
}

export function splitMaterial(material: string) {
  return material.split(/\n\s*\n/).map((item) => item.trim()).filter(Boolean)
}

const lines = (text: string, width: number) => Math.max(1, Math.ceil(text.replace(/\[\[[^\]]+\]\]/g, '표식').length / width))

export function effectiveSetLayout(base: ExamLayoutSettings, override: SetLayoutOverride = {}): ExamLayoutSettings {
  return {
    ...base,
    columns: override.columns ?? base.columns,
    marginTop: override.marginTop ?? base.marginTop,
    marginRight: override.marginRight ?? base.marginRight,
    marginBottom: override.marginBottom ?? base.marginBottom,
    marginLeft: override.marginLeft ?? base.marginLeft,
    fontSize: base.fontSize * (override.fontScale ?? 1),
    lineHeight: override.lineHeight ?? base.lineHeight,
    passageBorder: override.passageBorder ?? base.passageBorder,
  }
}

export function examFlowMeasurementKey(blocks: ExamFlowBlock[]) {
  return blocks
    .map((block) => {
      const questionLength = block.question
        ? block.question.stem.length + block.question.choices.reduce((sum, choice) => sum + choice.length, 0)
        : 0
      return `${block.id}@${geometryKey(block.effectiveLayout)}#${block.units}#${block.text?.length ?? 0}#${block.summaryText?.length ?? 0}#${questionLength}`
    })
    .join('|')
}

export function geometryKey(layout: ExamLayoutSettings) {
  return [layout.columns, layout.marginTop, layout.marginRight, layout.marginBottom, layout.marginLeft, layout.fontSize.toFixed(2), layout.lineHeight.toFixed(2)].join('|')
}

export function buildExamFlowBlocks(exam: EnglishExamDocument, sets: EnglishQuestionSet[], assets: MediaAsset[]): ExamFlowBlock[] {
  const result: ExamFlowBlock[] = []
  let number = 0
  let previousSourceSetId = ''
  const emittedSharedAssets = new Set<string>()
  resolveExamEntries(exam, sets).forEach(({ entry, set, csatItem }) => {
    const override = { ...(set.layoutOverride ?? {}), ...(exam.setOverrides[set.id] ?? {}), ...(exam.entryOverrides?.[entry.id] ?? {}) }
    const layout = effectiveSetLayout(exam.layout, override)
    const generatedSharedMaterial = csatItem ? undefined : generatedSchoolSharedMaterialPresentation(set)
    const providedSharedMaterial = csatItem ? undefined : providedPassageV02SharedMaterialText(set)
    const materialSpec = set.providedPassageV02 ? undefined : csatItem?.materialSpec ?? generatedSharedMaterial?.spec ?? providedPassagePresentationSpec(set)
    const material = csatItem?.material ?? providedSharedMaterial ?? generatedSharedMaterial?.text ?? set.material
    const questions = csatItem?.questions ?? orderedSchoolQuestions(set)
    const blockSetId = entry.id
    const printFlow = set.mode === 'csat' && csatItem ? csatPrintFlow(csatItem.design?.templateId ?? questions[0]?.csatTemplateId) : undefined
    const keepTogetherId = printFlow && printFlow !== 'material-questions' ? entry.id : undefined
    if (layout.preset !== 'csat' && previousSourceSetId !== set.id) result.push({ id: `${entry.id}-header`, sourceId: `${entry.id}-header`, setId: blockSetId, kind: 'set-header', units: 3, set, csatItem, effectiveLayout: layout, override })

    const pushMaterials = (includeMaterial = true) => {
      const templateId = csatItem?.design?.templateId ?? questions[0]?.csatTemplateId
      const width = layout.columns === 2 ? 52 : 92
      const firstQuestionNumber = number + 1
      const lastQuestionNumber = number + Math.max(1, questions.length)
      const groupNumberLabel = firstQuestionNumber === lastQuestionNumber ? `${firstQuestionNumber}` : `${firstQuestionNumber}~${lastQuestionNumber}`
      const pushStructuredMaterial = () => {
        if (!materialSpec) return
        const structuredText = materialSpec.kind === 'ordered'
          ? `${materialSpec.lead} ${materialSpec.sections.map((section) => section.text).join(' ')}`
          : materialSpec.kind === 'insertion'
            ? `${materialSpec.givenSentence} ${materialSpec.body}`
            : materialSpec.kind === 'summary'
              ? materialSpec.summary
              : materialSpec.kind === 'longNarrative'
                ? materialSpec.sections.map((section) => section.text).join(' ')
                : materialSpec.kind === 'prose' || materialSpec.kind === 'longExpository'
                  ? materialSpec.paragraphs.join(' ')
                  : ''
        result.push({
          id: `${entry.id}-structured-material`, sourceId: `${entry.id}-structured-material`, setId: blockSetId, kind: 'structured-material',
          units: materialSpec.kind === 'chart' ? 18 : materialSpec.kind === 'practical' ? 13 : lines(collapseCsatProseParagraphs(structuredText, templateId), width) + 3,
          set, csatItem, materialSpec, keepTogetherId, effectiveLayout: layout, override,
        })
      }
      const plainMaterial = templateId === '25' && questions[0] ? embedCsatChartChoices(material, questions[0].choices) : material
      const pushPlainMaterial = () => splitMaterial(collapseCsatProseParagraphs(plainMaterial, templateId)).forEach((text, index) => {
        const maxChars = layout.columns === 2 ? 980 : 1700
        const pieces: string[] = []
        let rest = text
        while (!keepTogetherId && rest.length > maxChars) {
          let cut = rest.lastIndexOf('. ', maxChars)
          if (cut < maxChars * 0.55) cut = rest.lastIndexOf(' ', maxChars)
          if (cut < maxChars * 0.55) cut = maxChars
          pieces.push(rest.slice(0, cut + 1).trim())
          rest = rest.slice(cut + 1).trim()
        }
        if (rest) pieces.push(rest)
        pieces.forEach((piece, pieceIndex) => result.push({
          id: `${entry.id}-material-${index}-${pieceIndex}`, sourceId: `${entry.id}-material-${index}`, setId: blockSetId, kind: 'material',
          units: lines(piece, width) + 1, text: piece, set, csatItem, keepTogetherId,
          materialContinues: set.mode === 'csat' && Boolean(csatItem) && pieceIndex < pieces.length - 1,
          effectiveLayout: layout, override,
        }))
      })
      if (includeMaterial && set.mode === 'csat' && templateId === '41-42') {
        const text = csatLongExpositoryText(material, materialSpec)
        result.push({
          id: `${entry.id}-long-expository`, sourceId: `${entry.id}-long-expository`, setId: blockSetId, kind: 'long-expository-material',
          units: lines(text, width) + 5, text, groupNumberLabel, set, csatItem,
          effectiveLayout: layout, override,
        })
      } else if (includeMaterial && set.mode === 'csat' && templateId === '43-45') {
        csatLongNarrativeSections(material, materialSpec).forEach((section, index) => result.push({
          id: `${entry.id}-long-narrative-${section.label}`, sourceId: `${entry.id}-long-narrative-${section.label}`, setId: blockSetId, kind: 'long-narrative-section',
          units: lines(section.text, width) + 5, text: section.text, sectionLabel: section.label,
          groupNumberLabel: index === 0 ? groupNumberLabel : undefined, set, csatItem,
          effectiveLayout: layout, override,
        }))
      } else if (includeMaterial && set.mode === 'csat' && templateId === '40') {
        const summaryMaterial = splitCsatSummaryMaterial(material, materialSpec)
        result.push({
          id: `${entry.id}-summary-material`, sourceId: `${entry.id}-summary-material`, setId: blockSetId, kind: 'summary-material',
          units: lines(summaryMaterial.passage, width) + lines(summaryMaterial.summary, width) + 6,
          text: summaryMaterial.passage, summaryText: summaryMaterial.summary, set, csatItem, keepTogetherId,
          effectiveLayout: layout, override,
        })
      } else if (includeMaterial) {
        const structuredReplacesText = Boolean(materialSpec && materialSpec.kind !== 'chart' && materialSpec.kind !== 'summary')
        if (materialSpec?.kind !== 'summary') pushStructuredMaterial()
        if (!structuredReplacesText) pushPlainMaterial()
        if (materialSpec?.kind === 'summary') pushStructuredMaterial()
      }
      const entryAssets = assets.filter((asset) => asset.setId === set.id && (asset.csatItemId ? asset.csatItemId === csatItem?.id : !emittedSharedAssets.has(set.id)))
      entryAssets.forEach((asset) => result.push({
        id: `${entry.id}-asset-${asset.id}`, sourceId: `${entry.id}-asset-${asset.id}`, setId: blockSetId, kind: 'asset', units: 16, asset, set, csatItem, effectiveLayout: layout, override,
        keepTogetherId,
      }))
      emittedSharedAssets.add(set.id)
    }

    const pushQuestion = (question: EnglishQuestion, part: 'full' | 'lead' | 'choices') => {
      if (part !== 'choices') number += 1
      const width = layout.columns === 2 ? 50 : 88
      const stemUnits = lines(question.stem, width)
      const choiceUnits = usesInlineSchoolChoices(set, question) ? 0 : question.choices.reduce((sum, choice) => sum + lines(choice, width), 0)
      const scopedGeneratedMaterial = usesQuestionScopedSchoolMaterial(set)
      const generatedPresentation = scopedGeneratedMaterial ? schoolQuestionMaterialPresentation(set, question) : undefined
      const providedInsertion = Boolean(set.providedPassageV02 && isSchoolInsertionQuestion(question))
      const questionMaterialSpec = part !== 'choices'
        ? providedInsertion ? providedPassageV02PresentationSpec(set, question.id) : generatedPresentation?.spec
        : undefined
      const questionMaterialText = part === 'choices' ? ''
        : questionMaterialSpec?.kind === 'insertion' ? `${questionMaterialSpec.givenSentence} ${questionMaterialSpec.body}`
          : providedInsertion ? providedPassageV02QuestionMaterialText(set, question.id)
            : generatedPresentation?.text ?? ''
      const questionMaterialUnits = questionMaterialText ? lines(collapseCsatProseParagraphs(questionMaterialText), width) + 3 : 0
      result.push({
        id: `${entry.id}-${question.id}-${part}`, sourceId: `${entry.id}-${question.id}`, setId: blockSetId,
        kind: part === 'full' ? 'question' : part === 'lead' ? 'question-lead' : 'question-choices',
        units: part === 'lead' ? stemUnits + questionMaterialUnits + 1 : part === 'choices' ? choiceUnits + 2 : stemUnits + questionMaterialUnits + choiceUnits + 5,
        question, questionNumber: number, questionPart: part,
        keepWithNext: part === 'lead' && (override.keepMaterialWithFirst ?? true),
        keepTogetherId,
        set, csatItem, effectiveLayout: layout, override,
      })
    }

    if (set.mode === 'csat' && csatItem) {
      const flow = printFlow!
      if (flow === 'material-questions') {
        pushMaterials()
        questions.forEach((question) => pushQuestion(question, 'full'))
      } else {
        const question = questions[0]
        if (question) pushQuestion(question, 'lead')
        pushMaterials()
        if (question && flow === 'lead-material-choices') pushQuestion(question, 'choices')
      }
    } else {
      pushMaterials(set.providedPassageV02 ? Boolean(providedSharedMaterial) : (!usesQuestionScopedSchoolMaterial(set) || Boolean(generatedSharedMaterial)))
      questions.forEach((question) => pushQuestion(question, 'full'))
    }
    previousSourceSetId = set.id
  })
  return result
}

function estimatedCapacity(layout: ExamLayoutSettings) {
  const usable = 297 - layout.marginTop - layout.marginBottom - 28
  return Math.max(30, usable / (layout.fontSize * layout.lineHeight * 0.35))
}

export function paginateExamBlocks(blocks: ExamFlowBlock[], metrics?: ExamLayoutMetrics): ExamLayoutPage[] {
  const pages: ExamLayoutPage[] = []
  let page: ExamLayoutPage | undefined
  let columnIndex = 0
  let used = 0
  let previousSetId = ''

  const startPage = (layout: ExamLayoutSettings) => {
    page = { layout, columns: Array.from({ length: layout.columns }, () => []) }
    pages.push(page)
    columnIndex = 0
    used = 0
  }
  const advanceColumn = (layout: ExamLayoutSettings) => {
    if (!page || columnIndex >= page.columns.length - 1) startPage(layout)
    else { columnIndex += 1; used = 0 }
  }
  let blockIndex = 0
  while (blockIndex < blocks.length) {
    const block = blocks[blockIndex]
    let groupEnd = blockIndex + 1
    if (block.keepTogetherId) {
      while (groupEnd < blocks.length && blocks[groupEnd].keepTogetherId === block.keepTogetherId) groupEnd += 1
    }
    const group = blocks.slice(blockIndex, groupEnd)
    const setChanged = previousSetId && previousSetId !== block.setId
    const geometryChanged = page && geometryKey(page.layout) !== geometryKey(block.effectiveLayout)
    const requestedPage = setChanged && (block.override.breakBefore === 'page' || geometryChanged)
    const requestedColumn = setChanged && block.override.breakBefore === 'column'
    if (!page || requestedPage) startPage(block.effectiveLayout)
    else if (requestedColumn) advanceColumn(block.effectiveLayout)

    const measuredColumnHeights = metrics ? Object.values(metrics.columnHeights) : []
    const capacity = metrics?.layoutHeights?.[geometryKey(block.effectiveLayout)]
      ?? (measuredColumnHeights.length ? Math.max(...measuredColumnHeights) : undefined)
      ?? estimatedCapacity(block.effectiveLayout)
    const size = group.reduce((sum, candidate) => sum + (metrics?.blockHeights[candidate.id] ?? candidate.units), 0)
    const next = group.length === 1 && block.keepWithNext ? blocks[blockIndex + 1] : undefined
    const nextSize = next && next.setId === block.setId ? metrics?.blockHeights[next.id] ?? next.units : 0
    if (used > 0 && used + size + nextSize > capacity) advanceColumn(block.effectiveLayout)
    page!.columns[columnIndex].push(...group)
    used += size
    previousSetId = group.at(-1)?.setId ?? block.setId
    blockIndex += group.length
  }
  return pages.length ? pages : [{ layout: examFallbackLayout(), columns: [[]] }]
}

function examFallbackLayout(): ExamLayoutSettings {
  return { layoutRevision: 2, preset: 'custom', columns: 1, answerColumns: 1, marginTop: 14, marginRight: 14, marginBottom: 14, marginLeft: 14, fontSize: 10.5, lineHeight: 1.7, questionGap: 8, passageBorder: true, institution: '', gradeLabel: '', dateLabel: '', footerText: '', showPageNumbers: true }
}

export function getOversizedQuestionIssues(blocks: ExamFlowBlock[], metrics?: ExamLayoutMetrics) {
  if (!metrics) return []
  const maxCapacity = Math.max(0, ...Object.values(metrics.layoutHeights ?? {}), ...Object.values(metrics.columnHeights))
  const grouped = new Map<string, ExamFlowBlock[]>()
  blocks.forEach((block) => {
    if (!block.keepTogetherId) return
    grouped.set(block.keepTogetherId, [...(grouped.get(block.keepTogetherId) ?? []), block])
  })
  const groupedIssues = [...grouped.values()].flatMap((group) => {
    const size = group.reduce((sum, block) => sum + (metrics.blockHeights[block.id] ?? 0), 0)
    const numbered = group.find((block) => block.questionNumber)
    return size > maxCapacity + 1 ? [`${numbered?.questionNumber ?? '?'}번 문항의 발문·지문·선지 전체가 한 칸보다 깁니다.`] : []
  })
  const standaloneIssues = blocks.filter((block) => !block.keepTogetherId && (block.kind === 'question' || block.kind === 'question-choices') && (metrics.blockHeights[block.id] ?? 0) > maxCapacity + 1)
    .map((block) => `${block.questionNumber}번 문항의 발문과 선지 전체가 한 칸보다 깁니다.`)
  return [...groupedIssues, ...standaloneIssues]
}
