import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { collapseCsatProseParagraphs, csatLongExpositoryText, csatLongNarrativeSections, csatPrintFlow, decorateCsatMaterialText, embedCsatChartChoices, getCsatItems, getCsatTemplate, isInlinePositionTemplate, resolvedCsatItem, splitCsatSummaryMaterial, usesContinuousCsatProse } from './csat'
import { CsatMaterialView } from './CsatMaterialView'
import { buildExamFlowBlocks, examFlowMeasurementKey, geometryKey, getOversizedQuestionIssues, paginateExamBlocks, resolveExamEntries, type ExamFlowBlock, type ExamLayoutMetrics } from './examLayout'
import type { CsatItemDesign, EnglishExamDocument, EnglishQuestion, EnglishQuestionSet, ExamLayoutSettings, MediaAsset } from './types'

const MARKUP = /\[\[(밑줄|빈칸|요약빈칸|삽입문장|삽입위치|선택)(?::([^\]]+))?\]\]/g
const CIRCLED = ['①', '②', '③', '④', '⑤']

export function EnglishText({ text }: { text: string }) {
  const nodes: ReactNode[] = []
  let cursor = 0
  for (const match of text.matchAll(MARKUP)) {
    const index = match.index ?? 0
    if (index > cursor) nodes.push(text.slice(cursor, index))
    const key = `${index}-${match[1]}`
    if (match[1] === '밑줄') nodes.push(<u key={key}>{match[2]}</u>)
    else if (match[1] === '빈칸') nodes.push(<span className="english-blank" key={key}>&nbsp;</span>)
    else if (match[1] === '요약빈칸') nodes.push(<span className="english-summary-blank" key={key}>({match[2] || 'A·B'})&nbsp;</span>)
    else if (match[1] === '삽입문장') nodes.push(<span className="insertion-sentence" key={key}>{match[2]}</span>)
    else if (match[1] === '삽입위치') nodes.push(<b className="insertion-position" key={key}>{match[2]}</b>)
    else { const [label, left, right] = (match[2] ?? '').split('|'); nodes.push(<span className="vocabulary-choice" key={key}><b>({label})</b> {left} / {right}</span>) }
    cursor = index + match[0].length
  }
  if (cursor < text.length) nodes.push(text.slice(cursor))
  return <>{nodes}</>
}

function paperStyle(layout: ExamLayoutSettings): CSSProperties {
  return {
    padding: `${layout.marginTop}mm ${layout.marginRight}mm ${layout.marginBottom}mm ${layout.marginLeft}mm`,
    fontSize: `${layout.fontSize}pt`, lineHeight: layout.lineHeight,
    '--question-gap': `${layout.questionGap}mm`,
  } as CSSProperties
}

function Header({ exam, pageNumber, layout }: { exam: EnglishExamDocument; pageNumber: number; layout: ExamLayoutSettings }) {
  return <header className={`paper-header preset-${layout.preset}`}>
    <div><small>{layout.institution || 'ENGLISH QUESTION LAB'}</small><h1>{exam.title}</h1></div>
    <div className="student-fields"><span>{layout.gradeLabel || '학년·반'} __________</span><span>이름 __________</span>{layout.dateLabel && <span>{layout.dateLabel}</span>}</div>
    {layout.showPageNumbers && <b>{pageNumber}</b>}
  </header>
}

function Footer({ layout, pageNumber, total }: { layout: ExamLayoutSettings; pageNumber: number; total: number }) {
  return <footer className="paper-footer"><span>{layout.footerText}</span>{layout.showPageNumbers && <strong>{pageNumber} / {total}</strong>}</footer>
}

function SetHeader({ block }: { block: ExamFlowBlock }) {
  const set = block.set!
  return <div className="paper-set-header" data-flow-id={block.id}><span>{set.mode === 'csat' ? '수능형' : set.mode === 'school' ? '내신형' : '맞춤형'}</span><strong>{set.title}</strong>{set.materialTitle && <small>{set.materialTitle}</small>}</div>
}

const csatItemTemplateId = (item?: CsatItemDesign) => item?.design?.templateId ?? item?.questions[0]?.csatTemplateId
const structuredMaterialReplacesPlainText = (spec?: EnglishQuestionSet['materialSpec']) => Boolean(spec && spec.kind !== 'chart' && spec.kind !== 'summary')
const displayedMaterialText = (text: string, item?: CsatItemDesign) => {
  const templateId = csatItemTemplateId(item)
  return decorateCsatMaterialText(collapseCsatProseParagraphs(text, templateId), templateId, item?.design?.variantId)
}

function MaterialBlock({ block }: { block: ExamFlowBlock }) {
  const chartStatements = csatItemTemplateId(block.csatItem) === '25'
  const bordered = block.effectiveLayout.passageBorder && !chartStatements
  return <div className={`paper-material${bordered ? ' bordered' : ''}${chartStatements ? ' csat-chart-statements' : ''}${block.materialContinues ? ' continues' : ''}`} data-flow-id={block.id}><p><EnglishText text={displayedMaterialText(block.text ?? '', block.csatItem)} /></p></div>
}

function StructuredMaterialBlock({ block }: { block: ExamFlowBlock }) {
  return <div className="paper-structured-material" data-flow-id={block.id}>{block.materialSpec && <CsatMaterialView spec={block.materialSpec} collapseParagraphs={usesContinuousCsatProse(csatItemTemplateId(block.csatItem))} renderText={(text) => <EnglishText text={displayedMaterialText(text, block.csatItem)} />} />}</div>
}

function CsatSummaryMaterial({ passage, summary, item }: { passage: string; summary: string; item?: CsatItemDesign }) {
  return <div className="csat-summary-material">
    <div className="csat-summary-passage"><p><EnglishText text={displayedMaterialText(passage, item)} /></p></div>
    {summary && <><div className="csat-summary-arrow" aria-hidden="true">↓</div><div className="csat-summary-sentence"><p><EnglishText text={displayedMaterialText(summary, item)} /></p></div></>}
  </div>
}

function SummaryMaterialBlock({ block }: { block: ExamFlowBlock }) {
  return <div data-flow-id={block.id}><CsatSummaryMaterial passage={block.text ?? ''} summary={block.summaryText ?? ''} item={block.csatItem} /></div>
}

const longReadingPrompt = (range: string) => `[${range}] 다음 글을 읽고, 물음에 답하시오.`

function LongExpositoryMaterial({ text, range, item }: { text: string; range: string; item?: CsatItemDesign }) {
  return <div className="csat-long-reading-material"><strong className="csat-long-reading-prompt">{longReadingPrompt(range)}</strong><div className="csat-long-expository-box"><p><EnglishText text={displayedMaterialText(text, item)} /></p></div></div>
}

function LongNarrativeSection({ text, label, range, item }: { text: string; label: 'A' | 'B' | 'C' | 'D'; range?: string; item?: CsatItemDesign }) {
  return <div className="csat-long-reading-material">{range && <strong className="csat-long-reading-prompt">{longReadingPrompt(range)}</strong>}<strong className="csat-long-narrative-label">({label})</strong><div className="csat-long-narrative-box"><p><EnglishText text={displayedMaterialText(text, item)} /></p></div></div>
}

function LongExpositoryMaterialBlock({ block }: { block: ExamFlowBlock }) {
  return <div data-flow-id={block.id}><LongExpositoryMaterial text={block.text ?? ''} range={block.groupNumberLabel ?? '41~42'} item={block.csatItem} /></div>
}

function LongNarrativeSectionBlock({ block }: { block: ExamFlowBlock }) {
  return <div data-flow-id={block.id}><LongNarrativeSection text={block.text ?? ''} label={block.sectionLabel ?? 'A'} range={block.groupNumberLabel} item={block.csatItem} /></div>
}

function AssetBlock({ block }: { block: ExamFlowBlock }) {
  return <figure className="paper-asset" data-flow-id={block.id}><img src={block.asset?.dataUrl} alt={block.asset?.caption || block.asset?.name} />{block.asset?.caption && <figcaption>{block.asset.caption}</figcaption>}</figure>
}

export function QuestionContent({ question, number, part = 'full' }: { question: EnglishQuestion; number: number; part?: 'full' | 'lead' | 'choices' }) {
  const showLead = part === 'full' || part === 'lead'
  const showChoices = (part === 'full' || part === 'choices') && !isInlinePositionTemplate(question.csatTemplateId)
  return <>{showLead && <h4><b>{number}.</b> <EnglishText text={question.stem} />{question.score && question.score !== 2 && <em>[{question.score}점]</em>}</h4>}{showChoices && <ol>{question.choices.map((choice, index) => <li key={index}><span>{CIRCLED[index] ?? `${index + 1}.`}</span><EnglishText text={choice || '(선지 미입력)'} /></li>)}</ol>}</>
}

function QuestionBlock({ block }: { block: ExamFlowBlock }) {
  const part = block.questionPart ?? 'full'
  return <article className={`paper-question question-${part}`} data-flow-id={block.id}><QuestionContent question={block.question!} number={block.questionNumber!} part={part} /></article>
}

function FlowBlock({ block }: { block: ExamFlowBlock }) {
  if (block.kind === 'set-header') return <SetHeader block={block} />
  if (block.kind === 'structured-material') return <StructuredMaterialBlock block={block} />
  if (block.kind === 'summary-material') return <SummaryMaterialBlock block={block} />
  if (block.kind === 'long-expository-material') return <LongExpositoryMaterialBlock block={block} />
  if (block.kind === 'long-narrative-section') return <LongNarrativeSectionBlock block={block} />
  if (block.kind === 'material') return <MaterialBlock block={block} />
  if (block.kind === 'asset') return <AssetBlock block={block} />
  return <QuestionBlock block={block} />
}

export function ExamQuestionPages({ exam, sets, assets, onLayoutIssuesChange }: { exam: EnglishExamDocument; sets: EnglishQuestionSet[]; assets: MediaAsset[]; onLayoutIssuesChange?: (issues: string[]) => void }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [measurement, setMeasurement] = useState<{ flowKey: string; metrics: ExamLayoutMetrics }>()
  const blocks = useMemo(() => buildExamFlowBlocks(exam, sets, assets), [exam, sets, assets])
  const flowKey = useMemo(() => examFlowMeasurementKey(blocks), [blocks])
  const metrics = measurement?.flowKey === flowKey ? measurement.metrics : undefined
  const pages = useMemo(() => paginateExamBlocks(blocks, metrics), [blocks, metrics])
  const issues = useMemo(() => getOversizedQuestionIssues(blocks, metrics), [blocks, metrics])
  const issueKey = issues.join('\n')
  useEffect(() => onLayoutIssuesChange?.(issues), [issueKey, onLayoutIssuesChange])

  useLayoutEffect(() => {
    // Every flow is measured once. A second synchronous measurement after
    // pagination can oscillate between two column arrangements for mixed
    // CSAT blocks (notably 33 + 40) and trip React's update-depth guard.
    if (measurement?.flowKey === flowKey) return
    const root = rootRef.current
    if (!root) return
    const blockHeights: Record<string, number> = {}
    root.querySelectorAll<HTMLElement>('[data-flow-id]').forEach((element) => {
      const style = getComputedStyle(element)
      // offsetHeight excludes the 48% transform used only by the assembly preview.
      // It therefore stays in the same unit as column.clientHeight.
      const marginTop = parseFloat(style.marginTop || '0')
      const marginBottom = parseFloat(style.marginBottom || '0')
      const height = element.offsetHeight + (Number.isFinite(marginTop) ? marginTop : 0) + (Number.isFinite(marginBottom) ? marginBottom : 0)
      blockHeights[element.dataset.flowId ?? ''] = Number.isFinite(height) ? height : 0
    })
    const columnHeights: Record<string, number> = {}
    const layoutHeights: Record<string, number> = {}
    root.querySelectorAll<HTMLElement>('[data-column-key]').forEach((column) => {
      columnHeights[column.dataset.columnKey ?? ''] = column.clientHeight
      const layoutKey = column.dataset.layoutKey
      if (layoutKey) layoutHeights[layoutKey] = Math.max(layoutHeights[layoutKey] ?? 0, column.clientHeight)
    })
    const next = { blockHeights, columnHeights, layoutHeights }
    setMeasurement({ flowKey, metrics: next })
  }, [pages, flowKey, measurement?.flowKey])

  return <div className="exam-question-pages" ref={rootRef} key={flowKey}>{pages.map((page, pageIndex) => <article className={`exam-page print-page preset-${page.layout.preset}`} style={paperStyle(page.layout)} key={pageIndex}>
    <Header exam={exam} pageNumber={pageIndex + 1} layout={page.layout} />
    <div className={`paper-columns columns-${page.layout.columns}`}>{page.columns.map((column, columnIndex) => <div className="paper-column" data-column-key={`${pageIndex}-${columnIndex}`} data-layout-key={geometryKey(page.layout)} key={columnIndex}>{column.map((block) => <FlowBlock block={block} key={block.id} />)}</div>)}</div>
    <Footer layout={page.layout} pageNumber={pageIndex + 1} total={pages.length} />
  </article>)}</div>
}

export function ExamAnswerPages({ exam, sets }: { exam: EnglishExamDocument; sets: EnglishQuestionSet[] }) {
  const questions = resolveExamEntries(exam, sets).flatMap(({ set, csatItem }) => (csatItem?.questions ?? set.questions).map((question) => ({ set, question, csatItem })))
  const perPage = exam.layout.answerColumns === 2 ? 8 : 5
  const chunks = Array.from({ length: Math.max(1, Math.ceil(questions.length / perPage)) }, (_, index) => questions.slice(index * perPage, (index + 1) * perPage))
  return <div className="exam-answer-pages">{chunks.map((chunk, pageIndex) => <article className={`exam-page answer-page print-page preset-${exam.layout.preset}`} style={paperStyle(exam.layout)} key={pageIndex}>
    <Header exam={exam} pageNumber={pageIndex + 1} layout={exam.layout} />
    <h2>정답 및 해설</h2><div className={`answer-columns columns-${exam.layout.answerColumns}`}>{chunk.map(({ set, question, csatItem }, index) => {
      const number = pageIndex * perPage + index + 1
      return <section key={question.id}><h3>{number}. 정답 {CIRCLED[question.answerIndex - 1] ?? question.answerIndex} <small>{set.title}</small></h3><p>{question.explanation || '해설이 입력되지 않았습니다.'}</p><dl><dt>정답 근거</dt><dd>{question.evidenceRefs.join(' / ') || '미입력'}</dd><dt>출제 의도</dt><dd>{question.intention || csatItem?.intention || set.intention || '미입력'}</dd></dl></section>
    })}</div><Footer layout={exam.layout} pageNumber={pageIndex + 1} total={chunks.length} />
  </article>)}</div>
}

export function SetLivePreview({ set, assets = [] }: { set: EnglishQuestionSet; assets?: MediaAsset[] }) {
  if (set.mode === 'csat') {
    let number = 0
    return <div className="live-paper csat-live-paper"><header><span>수능형 영어</span><strong>{set.title}</strong></header>{getCsatItems(set).map((item, index) => {
      const start = number
      number += item.questions.length
      return <CsatItemPreview key={item.id} set={set} item={item} index={index} startNumber={start} assets={assets.filter((asset) => asset.csatItemId === item.id || (!asset.csatItemId && index === 0))} />
    })}</div>
  }
  const structuredReplacesText = structuredMaterialReplacesPlainText(set.materialSpec)
  const plainMaterial = <div className={`live-material${set.layoutOverride?.passageBorder === false ? '' : ' bordered'}`}><p><EnglishText text={collapseCsatProseParagraphs(set.material || '지문 또는 자료를 입력하면 여기에 즉시 표시됩니다.')} /></p></div>
  const structuredMaterial = set.materialSpec && <CsatMaterialView spec={set.materialSpec} collapseParagraphs={set.materialSpec.kind === 'prose' || set.materialSpec.kind === 'longExpository'} renderText={(text) => <EnglishText text={collapseCsatProseParagraphs(text)} />} />
  return <div className="live-paper"><header><span>{set.mode === 'school' ? '내신형 영어' : '맞춤설정형 영어'}</span><strong>{set.title}</strong></header>{set.materialTitle && <h4>{set.materialTitle}</h4>}{set.materialSpec?.kind === 'summary' && plainMaterial}{structuredMaterial}{(!structuredReplacesText && set.materialSpec?.kind !== 'summary') && plainMaterial}{assets.map((asset) => <figure key={asset.id}><img src={asset.dataUrl} alt={asset.caption || asset.name} /><figcaption>{asset.caption}</figcaption></figure>)}{set.questions.map((question, index) => <article key={question.id}><QuestionContent question={question} number={index + 1} /></article>)}</div>
}

function CsatItemPreview({ set, item, index, startNumber, assets }: { set: EnglishQuestionSet; item: CsatItemDesign; index: number; startNumber: number; assets: MediaAsset[] }) {
  const templateId = csatItemTemplateId(item)
  const template = templateId ? getCsatTemplate(templateId) : undefined
  const resolved = resolvedCsatItem(set, item)
  const structuredReplacesText = structuredMaterialReplacesPlainText(item.materialSpec)
  const flow = csatPrintFlow(template?.id)
  const materialFallback = template ? `지문 설계: ${template.structureSteps.join(' → ')}` : '문항 유형과 번호 템플릿을 선택하세요.'
  const plainMaterialText = template?.id === '25' && item.questions[0]
    ? embedCsatChartChoices(item.material || materialFallback, item.questions[0].choices)
    : item.material || materialFallback
  const plainMaterial = <div className={`live-material${set.layoutOverride?.passageBorder === false || template?.id === '25' ? '' : ' bordered'}${template?.id === '25' ? ' csat-chart-statements' : ''}`}><p><EnglishText text={displayedMaterialText(plainMaterialText, item)} /></p></div>
  const structuredMaterial = item.materialSpec && <CsatMaterialView spec={item.materialSpec} collapseParagraphs={usesContinuousCsatProse(template?.id)} renderText={(text) => <EnglishText text={displayedMaterialText(text, item)} />} />
  const summaryMaterial = template?.id === '40' ? splitCsatSummaryMaterial(item.material, item.materialSpec) : undefined
  const longExpository = template?.id === '41-42' ? csatLongExpositoryText(item.material, item.materialSpec) : undefined
  const longNarrative = template?.id === '43-45' ? csatLongNarrativeSections(item.material, item.materialSpec) : undefined
  const itemRange = item.questions.length > 1 ? `${startNumber + 1}~${startNumber + item.questions.length}` : `${startNumber + 1}`
  const material = <>{item.materialTitle && <h4>{item.materialTitle}</h4>}{longExpository !== undefined
    ? <LongExpositoryMaterial text={longExpository} range={itemRange} item={item} />
    : longNarrative !== undefined
      ? <>{longNarrative.map((section, sectionIndex) => <LongNarrativeSection key={section.label} text={section.text} label={section.label} range={sectionIndex === 0 ? itemRange : undefined} item={item} />)}</>
      : summaryMaterial
    ? <CsatSummaryMaterial passage={summaryMaterial.passage} summary={summaryMaterial.summary} item={item} />
    : <>{item.materialSpec?.kind === 'summary' && plainMaterial}{structuredMaterial}{(!structuredReplacesText && item.materialSpec?.kind !== 'summary') && plainMaterial}</>}{assets.map((asset) => <figure key={asset.id}><img src={asset.dataUrl} alt={asset.caption || asset.name} /><figcaption>{asset.caption}</figcaption></figure>)}</>
  return <section className="csat-item-preview"><section className="csat-preview-meta"><strong>{index + 1}. {template ? `${template.numberLabel} · ${template.label}` : '번호 템플릿 미선택'}</strong>{template && <><span>{template.passageGenre}</span><small>난이도 {resolved.difficulty}/5 · {template.passageBlueprint}</small></>}</section>{flow === 'material-questions' ? <>{material}{item.questions.map((question, questionIndex) => <article key={question.id}><QuestionContent question={question} number={startNumber + questionIndex + 1} /></article>)}</> : <>{item.questions[0] && <article><QuestionContent question={item.questions[0]} number={startNumber + 1} part="lead" /></article>}{material}{flow === 'lead-material-choices' && item.questions[0] && <article><QuestionContent question={item.questions[0]} number={startNumber + 1} part="choices" /></article>}</>}</section>
}
