import { useEffect, useMemo, useRef, useState } from 'react'
import { ExamAnswerPages, ExamQuestionPages, SetLivePreview } from './ExamPaper'
import { CSAT_FAMILIES, CSAT_PASSAGE_LENGTH_LABELS, allSetQuestions, applyCsatItemTemplate, choiceStyleLabel, countCsatPassageWords, createCsatItem, csatItemHasResult, getCsatItems, getCsatPassageLengthRange, getCsatTemplate, isInlinePositionTemplate, normalizeCsatPassageLength, normalizeCsatSet, resolvedCsatItem, templatesForCsatFamily } from './csat'
import { CUSTOM_PRESETS, ENGLISH_INTENTION_PRESETS, ENGLISH_TOPIC_PRESETS, LAYOUT_PRESETS, MODE_LABELS, applyCustomPreset, createEnglishSet, createExamLayout, createQuestion, generateCsatGptInstructions, generateEnglishPrompt, generateReviewPrompt, loadEnglishGptConfig, parseEnglishSetJson, questionTypesFor, validateEnglishSet, type EnglishGptConfig } from './english'
import { downloadExamPagesPdf, makeExamPdfFilename } from './pdfExport'
import { contentEntriesForSet, examSetIds, normalizeExamDocument, resolveExamEntries } from './examLayout'
import { deleteExamDocument, deleteMediaAsset, deleteQuestionSet, saveExamDocument, saveMediaAsset, saveQuestionSet } from './studioStorage'
import type { CsatItemDesign, CsatNumberTemplateId, CsatPassageLengthPreset, CsatQuestionFamilyId, CsatVariantId, EnglishExamDocument, EnglishMode, EnglishQuestion, EnglishQuestionSet, ExamContentEntry, ExamLayoutSettings, LayoutPreset, MediaAsset, SetLayoutOverride, StudioBundle, ValidationIssue } from './types'
import { includesValue, toggleUniqueValue } from './utils'

interface Props {
  screen: 'sets' | 'assembly' | 'preview'
  mode: EnglishMode
  bundle: StudioBundle
  setBundle: React.Dispatch<React.SetStateAction<StudioBundle>>
  notify: (message: string) => void
}

const MODE_HELP: Record<EnglishMode, string> = {
  school: '교과서·부교재·외부 지문을 바탕으로 내신 객관식을 설계합니다.',
  csat: '17개 수능 독해 유형과 장문 세트를 5지선다로 설계합니다.',
  custom: '여섯 가지 프리셋을 시작점으로 객관식 구성을 자유롭게 조합합니다.',
}

function QuickPresetField({ label, value, choices, onChange, placeholder, multiline = false }: { label: string; value: string; choices: readonly string[]; onChange: (value: string) => void; placeholder?: string; multiline?: boolean }) {
  const separator = multiline ? '\n' : ', '
  return <label className="quick-preset-field">{label}
    {multiline
      ? <textarea value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
      : <input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />}
    <span className="quick-preset-options"><small>빠른 선택 · 여러 개 선택 가능</small>{choices.map((choice) => { const selected = includesValue(value, choice, separator); return <button type="button" className={selected ? 'selected' : ''} aria-pressed={selected} key={choice} onClick={() => onChange(toggleUniqueValue(value, choice, separator))}>{selected ? '✓ ' : ''}{choice}</button> })}</span>
  </label>
}

export function EnglishStudio(props: Props) {
  if (props.screen === 'assembly') return <ExamAssembly {...props} />
  if (props.screen === 'preview') return <ExamPreview {...props} />
  return <SetWorkspace {...props} />
}

function SetWorkspace({ mode, bundle, setBundle, notify }: Props) {
  const filtered = bundle.questionSets.filter((set) => set.mode === mode)
  const [activeId, setActiveId] = useState(filtered[0]?.id ?? '')
  const [jsonInput, setJsonInput] = useState('')
  const [issues, setIssues] = useState<ValidationIssue[]>([])
  const [reviewPrompt, setReviewPrompt] = useState('')
  const [gptConfig, setGptConfig] = useState<EnglishGptConfig>({ school: '', csat: '', custom: '' })
  const active = bundle.questionSets.find((set) => set.id === activeId && set.mode === mode)
  const imageInput = useRef<HTMLInputElement>(null)
  useEffect(() => { if (!active) setActiveId(filtered[0]?.id ?? '') }, [mode, active, filtered])
  useEffect(() => { setJsonInput(''); setIssues([]); setReviewPrompt('') }, [activeId])
  useEffect(() => { void loadEnglishGptConfig().then(setGptConfig) }, [])

  const addSet = () => {
    const next = createEnglishSet(mode)
    setBundle((value) => ({ ...value, questionSets: [next, ...value.questionSets] }))
    setActiveId(next.id); void saveQuestionSet(next)
  }
  const updateSet = (patch: Partial<EnglishQuestionSet>) => {
    if (!active) return
    const next = { ...active, ...patch, updatedAt: new Date().toISOString() }
    setBundle((value) => ({ ...value, questionSets: value.questionSets.map((set) => set.id === next.id ? next : set) }))
    void saveQuestionSet(next)
  }
  const updateQuestion = (questionId: string, patch: Partial<EnglishQuestion>) => updateSet({ questions: active?.questions.map((question) => question.id === questionId ? { ...question, ...patch } : question) })
  const updateCsatItems = (csatItems: CsatItemDesign[]) => updateSet({ csatItems, prompt: '', validatedRevision: 0, lastImportedJson: '' })
  const setChoiceCount = (choiceCount: number) => {
    if (!active) return
    updateSet({ choiceCount, questions: active.questions.map((question) => ({ ...question, choices: Array.from({ length: choiceCount }, (_, index) => question.choices[index] ?? ''), answerIndex: Math.min(question.answerIndex, choiceCount) })) })
  }
  const removeSet = () => {
    if (!active || !window.confirm(`‘${active.title}’ 세트를 삭제할까요?`)) return
    setBundle((value) => ({ ...value, questionSets: value.questionSets.filter((set) => set.id !== active.id), mediaAssets: value.mediaAssets.filter((asset) => asset.setId !== active.id), exams: value.exams.map((exam) => ({ ...exam, setIds: exam.setIds.filter((id) => id !== active.id), contentEntries: exam.contentEntries?.filter((entry) => entry.setId !== active.id) })) }))
    void deleteQuestionSet(active.id)
    bundle.mediaAssets.filter((asset) => asset.setId === active.id).forEach((asset) => void deleteMediaAsset(asset.id))
    notify('세트를 삭제했습니다.')
  }
  const copy = async (value: string, message: string) => {
    if (!value.trim()) { notify('먼저 내용을 생성해 주세요.'); return }
    try { await navigator.clipboard.writeText(value); notify(message) } catch { notify('복사하지 못했습니다. 내용을 직접 선택해 주세요.') }
  }
  const importJson = () => {
    if (!active) return
    try {
      const next = parseEnglishSetJson(jsonInput, active)
      setBundle((value) => ({ ...value, questionSets: value.questionSets.map((set) => set.id === next.id ? next : set) }))
      void saveQuestionSet(next); setJsonInput(''); setIssues([]); setReviewPrompt('')
      notify(`AI 결과 리비전 ${next.aiRevision}을 가져왔습니다. 최신 결과를 검사해 주세요.`)
    } catch (error) { notify(error instanceof Error ? error.message : 'JSON을 읽지 못했습니다.') }
  }
  const uploadImage = (file?: File, csatItemId?: string) => {
    if (!active || !file) return
    if (!file.type.startsWith('image/')) { notify('이미지 파일만 추가할 수 있습니다.'); return }
    if (file.size > 3 * 1024 * 1024) { notify('이미지는 3MB 이하만 추가할 수 있습니다.'); return }
    const reader = new FileReader()
    reader.onload = () => {
      const asset: MediaAsset = { id: crypto.randomUUID(), setId: active.id, csatItemId, name: file.name, mimeType: file.type, dataUrl: String(reader.result), caption: '', createdAt: new Date().toISOString() }
      setBundle((value) => ({ ...value, mediaAssets: [...value.mediaAssets, asset] })); void saveMediaAsset(asset); notify('이미지를 추가했습니다.')
    }
    reader.readAsDataURL(file)
  }
  const updateAsset = (asset: MediaAsset) => { setBundle((value) => ({ ...value, mediaAssets: value.mediaAssets.map((item) => item.id === asset.id ? asset : item) })); void saveMediaAsset(asset) }
  const removeAsset = (asset: MediaAsset) => { setBundle((value) => ({ ...value, mediaAssets: value.mediaAssets.filter((item) => item.id !== asset.id) })); void deleteMediaAsset(asset.id) }

  return <div className="set-workspace">
    <aside className="set-sidebar">
      <div className="sidebar-heading"><div><span className="eyebrow">{MODE_LABELS[mode].toUpperCase()}</span><h2>{MODE_LABELS[mode]} 세트</h2></div><button className="primary" onClick={addSet}>+ 새 세트</button></div>
      <p>{MODE_HELP[mode]}</p>
      <div className="set-list">{filtered.map((set) => <button className={set.id === activeId ? 'active' : ''} key={set.id} onClick={() => setActiveId(set.id)}><strong>{set.title}</strong><span>{allSetQuestions(set).length}문항 · 난이도 {set.difficulty}/5</span><small>{set.aiRevision ? `AI 결과 v${set.aiRevision}` : '조건 설계 중'}</small></button>)}</div>
      {!filtered.length && <div className="empty-state">아직 세트가 없습니다.</div>}
    </aside>
    {!active ? <section className="empty-editor"><h2>{MODE_LABELS[mode]} 영어 세트 제작</h2><p>새 세트를 만들어 출제 조건을 설계하세요.</p><button className="primary" onClick={addSet}>첫 세트 만들기</button></section> : <>
      <section className="set-editor">
        <div className="editor-title"><div><span className="eyebrow">ENGLISH SET DESIGN</span><h2>{active.title}</h2></div><button className="danger" onClick={removeSet}>삭제</button></div>
        <section className="editor-card">
          <h3>1. 세트 공통 조건</h3>
          <p>{mode === 'csat' ? '각 문항 카드는 아래 값을 기본으로 사용하며 카드 안에서 개별 덮어쓸 수 있습니다.' : '세트 전체에 적용할 기본 조건을 설정합니다.'}</p>
          <div className="form-grid">
            <label>세트 제목<input value={active.title} onChange={(event) => updateSet({ title: event.target.value })} /></label>
            <label>대상 수준<input value={active.targetLevel} onChange={(event) => updateSet({ targetLevel: event.target.value })} placeholder="예: 고2 중상위권" /></label>
            <label>난이도<select value={active.difficulty} onChange={(event) => updateSet({ difficulty: Number(event.target.value) })}>{[1, 2, 3, 4, 5].map((value) => <option value={value} key={value}>{value} / 5</option>)}</select></label>
            <QuickPresetField label="주제·소재" value={active.topic} choices={ENGLISH_TOPIC_PRESETS} onChange={(topic) => updateSet({ topic })} />
            {mode === 'school' && <label>자료 출처<select value={active.sourceKind} onChange={(event) => updateSet({ sourceKind: event.target.value as EnglishQuestionSet['sourceKind'], materialMode: 'provided' })}><option value="textbook">교과서 본문</option><option value="supplement">부교재 지문</option><option value="external">외부 지문</option></select></label>}
            {mode === 'custom' && <label>빠른 시작 프리셋<select value={active.customPreset} onChange={(event) => updateSet(applyCustomPreset(active, event.target.value))}>{CUSTOM_PRESETS.map((preset) => <option key={preset}>{preset}</option>)}</select></label>}
            {mode === 'custom' && <label>선지 수<select value={active.choiceCount} onChange={(event) => setChoiceCount(Number(event.target.value))}>{[2, 3, 4, 5].map((value) => <option value={value} key={value}>{value}지선다</option>)}</select></label>}
            {mode !== 'csat' && <label>자료 제목<input value={active.materialTitle} onChange={(event) => updateSet({ materialTitle: event.target.value })} /></label>}
          </div>
          <QuickPresetField label="공통 출제 의도" value={active.intention} choices={ENGLISH_INTENTION_PRESETS} multiline placeholder="학생이 어떤 능력을 발휘해야 하는지 적으세요." onChange={(intention) => updateSet({ intention })} />
          {mode !== 'csat' && <><label>영어 지문·자료<textarea className="material-input" value={active.material} onChange={(event) => updateSet({ material: event.target.value })} placeholder="출제할 영어 지문을 붙여넣으세요." /></label><p className="hint">밑줄 <code>[[밑줄:표현]]</code> · 빈칸 <code>[[빈칸]]</code> · 삽입 <code>[[삽입문장:문장]]</code></p></>}
        </section>

        {mode === 'csat' ? <CsatItemsEditor set={normalizeCsatSet(active)} items={getCsatItems(active)} updateItems={updateCsatItems} assets={bundle.mediaAssets.filter((asset) => asset.setId === active.id)} uploadImage={uploadImage} updateAsset={updateAsset} removeAsset={removeAsset} notify={notify} /> : <section className="editor-card">
          <div className="card-title-row"><div><h3>2. 문항 유형과 문항 수</h3><p>발문·선지를 비워 두면 외부 AI가 조건에 맞춰 완성합니다.</p></div><button onClick={() => updateSet({ questions: [...active.questions, createQuestion(questionTypesFor(mode)[0], active.choiceCount)] })}>+ 문항 추가</button></div>
          <div className="question-editor-list">{active.questions.map((question, index) => <QuestionEditor key={question.id} set={active} question={question} index={index} updateQuestion={updateQuestion} remove={() => updateSet({ questions: active.questions.filter((item) => item.id !== question.id) })} />)}</div>
        </section>}

        <section className="editor-card"><div className="card-title-row"><div><h3>{mode === 'csat' ? '3. 일괄 AI 제작 프롬프트' : '3. 외부 AI용 제작 프롬프트'}</h3><p>{mode === 'csat' ? '모든 문항 카드를 하나의 프롬프트와 JSON으로 생성합니다.' : 'API 연결 없이 프롬프트를 복사해 원하는 외부 AI에서 사용합니다.'}</p></div><button className="primary" onClick={() => { try { updateSet({ prompt: generateEnglishPrompt(active) }) } catch (error) { notify(error instanceof Error ? error.message : '프롬프트를 만들지 못했습니다.') } }}>프롬프트 생성</button></div><textarea className="prompt-output" value={active.prompt} onChange={(event) => updateSet({ prompt: event.target.value })} placeholder="프롬프트 생성 버튼을 누르세요." /><div className="button-row"><button onClick={() => void copy(active.prompt, '프롬프트를 복사했습니다.')}>프롬프트 복사</button>{mode === 'csat' && <button onClick={() => void copy(generateCsatGptInstructions(), '수능형 GPT 전체 지침을 복사했습니다.')}>수능형 GPT 지침 복사</button>}<button disabled={!gptConfig[mode]} onClick={() => { if (gptConfig[mode]) { void copy(active.prompt, '프롬프트를 복사하고 전용 GPT를 열었습니다.'); window.open(gptConfig[mode], '_blank', 'noopener,noreferrer') } }}>{gptConfig[mode] ? `${MODE_LABELS[mode]} GPT 열기` : 'GPT 링크 미설정'}</button></div></section>
        <section className="editor-card"><h3>{mode === 'csat' ? '4. 일괄 AI 결과 JSON 가져오기' : '4. AI 결과 JSON 가져오기'}</h3><textarea className="json-input" value={jsonInput} onChange={(event) => setJsonInput(event.target.value)} placeholder={mode === 'csat' ? '{"title":"...","items":[{"itemId":"...","templateId":"18","variantId":"standard","material":"...","questions":[...]}]}' : '{"title":"...","material":"...","questions":[...]}'}/><button className="primary wide" onClick={importJson}>JSON 분석하여 가져오기</button></section>
        <section className="editor-card"><div className="card-title-row"><div><h3>{mode === 'csat' ? '5. 최신 일괄 결과 검사와 재검토' : '5. 최신 결과 검사와 재검토'}</h3><p>현재 AI 결과 v{active.aiRevision} · 마지막 검사 v{active.validatedRevision || '-'}</p></div><button onClick={() => { const nextIssues = validateEnglishSet(active); const next = { ...active, validatedRevision: active.aiRevision, updatedAt: new Date().toISOString() }; setIssues(nextIssues); setReviewPrompt(generateReviewPrompt(next, nextIssues)); updateSet({ validatedRevision: active.aiRevision }) }}>최신 AI 결과 검사</button></div>{issues.length > 0 && <div className="validation-list">{issues.map((issue) => <article className={issue.level} key={issue.id}><strong>{issue.level === 'error' ? '오류' : issue.level === 'warning' ? '확인' : '통과'} · {issue.label}</strong><span>{issue.detail}</span></article>)}</div>}{reviewPrompt && <><textarea className="review-output" value={reviewPrompt} onChange={(event) => setReviewPrompt(event.target.value)} /><button className="wide" onClick={() => void copy(reviewPrompt, '재검토 프롬프트를 복사했습니다.')}>재검토 프롬프트 복사</button></>}</section>
        {mode !== 'csat' && <section className="editor-card"><div className="card-title-row"><div><h3>6. 이미지 자료</h3><p>파일당 3MB 이하를 권장합니다.</p></div><button onClick={() => imageInput.current?.click()}>이미지 추가</button><input ref={imageInput} type="file" accept="image/*" hidden onChange={(event) => { uploadImage(event.target.files?.[0]); event.currentTarget.value = '' }} /></div><AssetGrid assets={bundle.mediaAssets.filter((asset) => asset.setId === active.id)} updateAsset={updateAsset} removeAsset={removeAsset} /></section>}
      </section>
      <aside className="live-preview-panel"><div className="sticky-preview"><span className="eyebrow">LIVE PREVIEW</span><h3>실시간 미리보기</h3><details open><summary>현재 세트 시험지</summary><SetLivePreview set={active} assets={bundle.mediaAssets.filter((asset) => asset.setId === active.id)} /></details></div></aside>
    </>}
  </div>
}

function CsatItemsEditor({ set, items, updateItems, assets, uploadImage, updateAsset, removeAsset, notify }: { set: EnglishQuestionSet; items: CsatItemDesign[]; updateItems: (items: CsatItemDesign[]) => void; assets: MediaAsset[]; uploadImage: (file?: File, itemId?: string) => void; updateAsset: (asset: MediaAsset) => void; removeAsset: (asset: MediaAsset) => void; notify: (message: string) => void }) {
  const addItem = () => {
    if (items.length >= 20) { notify('문항 설계 카드는 최대 20개까지 추가할 수 있습니다.'); return }
    const viewport = { left: window.scrollX, top: window.scrollY }
    updateItems([...items, createCsatItem()])
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => window.scrollTo({ ...viewport, behavior: 'auto' })))
  }
  const change = (id: string, patch: Partial<CsatItemDesign>) => updateItems(items.map((item) => item.id === id ? { ...item, ...patch, qualityReview: undefined } : item))
  const move = (index: number, direction: -1 | 1) => { const target = index + direction; if (target < 0 || target >= items.length) return; const next = [...items]; [next[index], next[target]] = [next[target], next[index]]; updateItems(next) }
  const duplicate = (item: CsatItemDesign) => {
    if (items.length >= 20) { notify('문항 설계 카드는 최대 20개까지 추가할 수 있습니다.'); return }
    const copy = createCsatItem()
    const next = item.design ? applyCsatItemTemplate({ ...copy, targetLevel: item.targetLevel, difficulty: item.difficulty, topic: item.topic, intention: item.intention, materialMode: item.materialMode, sourceKind: item.sourceKind, passageLength: normalizeCsatPassageLength(item.passageLength) }, item.design.templateId, item.design.variantId) : copy
    if (item.design && next.design) next.design = { ...next.design, userInputs: { ...item.design.userInputs }, passagePlan: item.design.passagePlan }
    updateItems([...items, next]); notify('설정만 복제하고 AI 결과는 비웠습니다.')
  }
  const remove = (item: CsatItemDesign) => {
    if (items.length === 1) { notify('수능형 세트에는 최소 한 개의 문항 카드가 필요합니다.'); return }
    if (csatItemHasResult(item) && !window.confirm('이 카드의 지문·문항·해설이 함께 삭제됩니다. 계속할까요?')) return
    assets.filter((asset) => asset.csatItemId === item.id).forEach(removeAsset)
    updateItems(items.filter((candidate) => candidate.id !== item.id))
  }
  return <section className="editor-card csat-items-section">
    <div className="card-title-row"><div><span className="eyebrow">CSAT ITEM BUILDER</span><h3>2. 문항 설계 목록</h3><p>각 카드는 독립 지문을 사용합니다. 장문 묶음은 한 카드 안에서 함께 관리됩니다.</p></div><div className="item-count-actions"><span>{items.length} / 20</span><button className="primary" onClick={addItem}>+ 문항 추가</button></div></div>
    <div className="csat-item-list">{items.map((item, index) => <CsatItemCard key={item.id} set={set} item={item} index={index} total={items.length} change={(patch) => change(item.id, patch)} move={(direction) => move(index, direction)} duplicate={() => duplicate(item)} remove={() => remove(item)} assets={assets.filter((asset) => asset.csatItemId === item.id)} uploadImage={(file) => uploadImage(file, item.id)} updateAsset={updateAsset} removeAsset={removeAsset} />)}</div>
    <button className="wide add-item-bottom" disabled={items.length >= 20} onClick={addItem}>+ 문항 추가</button>
  </section>
}

function CsatItemCard({ set, item, index, total, change, move, duplicate, remove, assets, uploadImage, updateAsset, removeAsset }: { set: EnglishQuestionSet; item: CsatItemDesign; index: number; total: number; change: (patch: Partial<CsatItemDesign>) => void; move: (direction: -1 | 1) => void; duplicate: () => void; remove: () => void; assets: MediaAsset[]; uploadImage: (file?: File) => void; updateAsset: (asset: MediaAsset) => void; removeAsset: (asset: MediaAsset) => void }) {
  const imageInput = useRef<HTMLInputElement>(null)
  const [expanded, setExpanded] = useState(false)
  const design = item.design
  const template = design ? getCsatTemplate(design.templateId) : undefined
  const templates = item.familyId ? templatesForCsatFamily(item.familyId) : []
  const resolved = resolvedCsatItem(set, item)
  const passageLength = normalizeCsatPassageLength(item.passageLength)
  const passageRange = design ? getCsatPassageLengthRange(design.templateId, passageLength) : undefined
  const actualWords = countCsatPassageWords(item.material, item.materialSpec, item.design?.templateId === '25' ? item.questions[0]?.choices : undefined)
  const lengthWithinTarget = Boolean(passageRange && actualWords >= passageRange.min && actualWords <= passageRange.max)
  const qualityScores = item.qualityReview ? [
    item.qualityReview.passage.naturalness, item.qualityReview.passage.logicStructure,
    item.qualityReview.passage.vocabularyLevel, item.qualityReview.passage.templateFidelity,
    ...item.qualityReview.questions.flatMap((review) => [review.answerInference, review.distractorPlausibility, review.choiceBalance]),
  ] : []
  const qualityComplete = Boolean(lengthWithinTarget && item.qualityReview && item.qualityReview.questions.length === item.questions.length && qualityScores.length >= 7 && qualityScores.every((score) => score !== undefined && score >= 8 && score <= 10)
    && (item.qualityReview.passage.templateFidelity ?? 0) >= 9
    && item.qualityReview.questions.every((review) => (review.answerInference ?? 0) >= 9 && (review.distractorPlausibility ?? 0) >= 9 && Boolean(review.decisiveReason)))
  const qualityLabel = !csatItemHasResult(item) ? '품질 검수 전' : qualityComplete ? '품질 검수 완료' : item.qualityReview ? '품질 기준 확인 필요' : '품질 검수 누락'
  const updateDesign = (patch: Partial<NonNullable<CsatItemDesign['design']>>) => design && change({ design: { ...design, ...patch } })
  const selectTemplate = (templateId: CsatNumberTemplateId, variantId: CsatVariantId = 'standard') => {
    if (csatItemHasResult(item) && !window.confirm('유형을 바꾸면 이 카드의 기존 지문과 AI 결과가 초기화됩니다. 계속할까요?')) return
    change(applyCsatItemTemplate(item, templateId, variantId))
  }
  const selectFamily = (familyId: CsatQuestionFamilyId) => {
    if (csatItemHasResult(item) && !window.confirm('대분류를 바꾸면 이 카드의 기존 지문과 AI 결과가 초기화됩니다. 계속할까요?')) return
    change({ familyId, design: undefined, questions: [], material: '', materialTitle: '', materialSpec: undefined })
  }
  const updateQuestion = (questionId: string, patch: Partial<EnglishQuestion>) => change({ questions: item.questions.map((question) => question.id === questionId ? { ...question, ...patch } : question) })
  return <details className="csat-item-card" open={expanded} onToggle={(event) => setExpanded(event.currentTarget.open)}>
    <summary><span><b>{index + 1}</b><strong>{template ? `${template.numberLabel} · ${template.label}` : '문항 유형을 선택하세요'}</strong><small>{item.questions.length || '-'}문항 · 난이도 {resolved.difficulty}/5{passageRange ? ` · ${CSAT_PASSAGE_LENGTH_LABELS[passageLength]} ${passageRange.min}~${passageRange.max}단어 / 실제 ${actualWords || '-'}단어` : ''} · {qualityLabel}</small></span><span className="item-summary-actions"><button disabled={index === 0} onClick={(event) => { event.preventDefault(); move(-1) }}>위로</button><button disabled={index === total - 1} onClick={(event) => { event.preventDefault(); move(1) }}>아래로</button><button onClick={(event) => { event.preventDefault(); duplicate() }}>복제</button><button onClick={(event) => { event.preventDefault(); remove() }}>삭제</button></span></summary>
    <div className="csat-item-body">
      <div className="form-grid csat-template-selectors">
        <label>문항 대분류<select value={item.familyId ?? ''} onChange={(event) => selectFamily(event.target.value as CsatQuestionFamilyId)}><option value="">선택하세요</option>{CSAT_FAMILIES.map((family) => <option value={family.id} key={family.id}>{family.label}</option>)}</select></label>
        <label>번호 템플릿<select value={design?.templateId ?? ''} disabled={!item.familyId} onChange={(event) => selectTemplate(event.target.value as CsatNumberTemplateId)}><option value="">선택하세요</option>{templates.map((candidate) => <option value={candidate.id} key={candidate.id}>{candidate.numberLabel} · {candidate.label}</option>)}</select></label>
        <label>출제 구조<select value={design?.variantId ?? 'standard'} disabled={!template} onChange={(event) => selectTemplate(design!.templateId, event.target.value as CsatVariantId)}><option value="standard">최근 평가원 기본형</option>{template?.variants?.map((variant) => <option value={variant.id} key={variant.id}>{variant.label}</option>)}</select></label>
        <label>지문 길이<select value={passageLength} disabled={!template} onChange={(event) => change({ passageLength: event.target.value as CsatPassageLengthPreset })}>{(['short', 'medium', 'long'] as CsatPassageLengthPreset[]).map((preset) => { const range = template ? getCsatPassageLengthRange(template.id, preset) : undefined; return <option value={preset} key={preset}>{CSAT_PASSAGE_LENGTH_LABELS[preset]}{range ? ` (${range.min}~${range.max}단어)` : ''}</option> })}</select></label>
        <label>선지 형식<input value={template ? choiceStyleLabel(template.choiceStyle) : '-'} readOnly /></label>
      </div>
      {design && template && <>
        <div className="item-override-panel"><h4>세트 공통값 덮어쓰기</h4><div className="form-grid"><label>대상 수준<input value={item.targetLevel ?? ''} placeholder={`공통값: ${set.targetLevel}`} onChange={(event) => change({ targetLevel: event.target.value })} /></label><label>난이도<select value={item.difficulty ?? ''} onChange={(event) => change({ difficulty: event.target.value ? Number(event.target.value) : undefined })}><option value="">공통값 ({set.difficulty}/5)</option>{[1, 2, 3, 4, 5].map((value) => <option value={value} key={value}>{value}/5</option>)}</select></label><QuickPresetField label="주제·소재" value={item.topic ?? ''} choices={ENGLISH_TOPIC_PRESETS} placeholder={`공통값: ${set.topic || '미입력'}`} onChange={(topic) => change({ topic })} /><QuickPresetField label="출제 의도" value={item.intention ?? ''} choices={ENGLISH_INTENTION_PRESETS} multiline placeholder={`공통값: ${set.intention || '유형에 맞게 설정'}`} onChange={(intention) => change({ intention })} /></div></div>
        <div className="form-grid"><label>자료 작성 방식<select value={item.materialMode} onChange={(event) => change({ materialMode: event.target.value as 'provided' | 'generated', sourceKind: event.target.value === 'generated' ? 'generated' : 'external' })}><option value="generated">AI가 새 지문 작성</option><option value="provided">등록 지문으로 출제</option></select></label><label>자료 제목<input value={item.materialTitle} onChange={(event) => change({ materialTitle: event.target.value })} /></label></div>
        <div className="csat-blueprint-grid"><section><h4>사용자 추천 입력</h4><div className="form-grid">{template.inputFields.map((field) => <label key={field.key}>{field.label}{field.multiline ? <textarea value={design.userInputs[field.key] ?? ''} placeholder={field.placeholder} onChange={(event) => updateDesign({ userInputs: { ...design.userInputs, [field.key]: event.target.value } })} /> : <input value={design.userInputs[field.key] ?? ''} placeholder={field.placeholder} onChange={(event) => updateDesign({ userInputs: { ...design.userInputs, [field.key]: event.target.value } })} />}</label>)}</div></section><section className="structure-panel"><h4>지문 형식과 구조</h4><span className="genre-chip">{template.passageGenre}</span><ol>{template.structureSteps.map((step) => <li key={step}>{step}</li>)}</ol><label>지문 설계 메모<textarea value={design.passagePlan} onChange={(event) => updateDesign({ passagePlan: event.target.value })} /></label><div className="fixed-question-plan"><strong>고정 문항</strong>{item.questions.map((question) => <span key={question.id}>{question.csatSlot ?? question.type} · {question.type} · {question.score ?? 2}점</span>)}</div></section></div>
        <details className="editor-fold material-editor-fold">
          <summary><span><strong>영어 지문·자료</strong><small>{item.material.trim() ? `입력됨 · 실제 ${actualWords || 0}단어` : '아직 입력되지 않음'}</small></span><span className="fold-toggle-label" /></summary>
          <div className="editor-fold-body">
            <label>영어 지문·자료<textarea className="material-input" value={item.material} onChange={(event) => change({ material: event.target.value })} placeholder={item.materialMode === 'generated' ? 'AI 결과를 가져오면 이 카드의 지문이 채워집니다.' : '이 문항에 사용할 영어 지문을 붙여넣으세요.'} /></label>
            <p className="hint">밑줄 <code>[[밑줄:표현]]</code> · 빈칸 <code>[[빈칸]]</code> · 삽입 <code>[[삽입문장:문장]]</code> / <code>[[삽입위치:①]]</code> · 요약 <code>[[요약빈칸:A]]</code></p>
          </div>
        </details>
        <section className={`quality-review-panel ${qualityComplete ? 'complete' : 'needs-review'}`}>
          <div className="quality-review-heading"><div><h4>지문 길이와 AI 자체검수</h4><p>{CSAT_PASSAGE_LENGTH_LABELS[passageLength]} 목표 {passageRange?.min}~{passageRange?.max}단어 · 실제 {actualWords || 0}단어</p></div><span>{qualityLabel}</span></div>
          {item.qualityReview ? <>
            <div className="quality-score-grid">
              <span>자연스러움 <b>{item.qualityReview.passage.naturalness ?? '-'}</b>/10</span>
              <span>논리 구조 <b>{item.qualityReview.passage.logicStructure ?? '-'}</b>/10</span>
              <span>어휘 수준 <b>{item.qualityReview.passage.vocabularyLevel ?? '-'}</b>/10</span>
              <span>템플릿 유사도 <b>{item.qualityReview.passage.templateFidelity ?? '-'}</b>/10</span>
            </div>
            <div className="quality-question-list">{item.qualityReview.questions.map((review, reviewIndex) => <article key={`${review.slot}-${reviewIndex}`}><header><strong>{review.slot || `${reviewIndex + 1}번 문항`}</strong><span>예상 난도 {review.expectedDifficulty ?? '-'}/5</span></header><div className="quality-score-grid"><span>정답 추론성 <b>{review.answerInference ?? '-'}</b>/10</span><span>오답 매력도 <b>{review.distractorPlausibility ?? '-'}</b>/10</span><span>선지 균형 <b>{review.choiceBalance ?? '-'}</b>/10</span></div><p><b>가장 강력한 오답</b> {review.strongestDistractorIndex ? `${review.strongestDistractorIndex}번` : '미기록'} · 정답 직접 재현 {review.directAnswerOverlap === undefined ? '미검수' : review.directAnswerOverlap ? '있음' : '없음'}</p><p><b>결정적 구분 근거</b> {review.decisiveReason || '미기록'}</p></article>)}</div>
          </> : <p className="quality-empty">기존 JSON은 그대로 가져올 수 있습니다. 최신 결과 검사 후 재검토 프롬프트를 사용하면 이 영역의 점수와 판단 근거를 보완할 수 있습니다.</p>}
        </section>
        <div className="question-editor-list">{item.questions.map((question, questionIndex) => <QuestionEditor key={question.id} set={set} question={question} index={questionIndex} locked updateQuestion={updateQuestion} remove={() => undefined} />)}</div>
        <div className="card-title-row item-assets-title"><h4>이미지 자료</h4><button onClick={() => imageInput.current?.click()}>이미지 추가</button><input ref={imageInput} type="file" accept="image/*" hidden onChange={(event) => { uploadImage(event.target.files?.[0]); event.currentTarget.value = '' }} /></div><AssetGrid assets={assets} updateAsset={updateAsset} removeAsset={removeAsset} />
      </>}
    </div>
  </details>
}

function AssetGrid({ assets, updateAsset, removeAsset }: { assets: MediaAsset[]; updateAsset: (asset: MediaAsset) => void; removeAsset: (asset: MediaAsset) => void }) {
  return <div className="asset-grid">{assets.map((asset) => <article key={asset.id}><img src={asset.dataUrl} alt={asset.caption || asset.name} /><input value={asset.caption} placeholder="이미지 설명" onChange={(event) => updateAsset({ ...asset, caption: event.target.value })} /><button onClick={() => removeAsset(asset)}>삭제</button></article>)}</div>
}

function QuestionEditor({ set, question, index, locked = false, updateQuestion, remove }: { set: EnglishQuestionSet; question: EnglishQuestion; index: number; locked?: boolean; updateQuestion: (id: string, patch: Partial<EnglishQuestion>) => void; remove: () => void }) {
  const inlinePosition = isInlinePositionTemplate(question.csatTemplateId)
  const embeddedChartChoices = question.csatTemplateId === '25'
  const roleLabel = question.csatSlot ? `${question.csatSlot} 역할` : `${index + 1}번 문항`
  const completedChoices = question.choices.filter((choice) => choice.trim()).length
  return <details className="question-editor editor-fold">
    <summary><span><strong>{roleLabel}</strong><small>{question.type} · {question.score ?? 2}점 · 발문 {question.stem.trim() ? '입력됨' : '미입력'} · 선지 {completedChoices}/{question.choices.length}</small></span><span className="question-fold-actions"><span className="fold-toggle-label" />{!locked && <button disabled={set.questions.length === 1} onClick={(event) => { event.preventDefault(); event.stopPropagation(); remove() }}>삭제</button>}</span></summary>
    <div className="editor-fold-body">
      <div className="form-grid"><label>문항 유형<select value={question.type} disabled={locked} onChange={(event) => updateQuestion(question.id, { type: event.target.value })}>{locked ? <option>{question.type}</option> : questionTypesFor(set.mode).map((type) => <option key={type}>{type}</option>)}</select></label><label>배점<input type="number" min="1" max="10" value={question.score ?? 2} onChange={(event) => updateQuestion(question.id, { score: Number(event.target.value) })} /></label></div>
      <label>발문<textarea value={question.stem} onChange={(event) => updateQuestion(question.id, { stem: event.target.value })} /></label>
      {inlinePosition ? <p className="inline-position-note">이 유형은 별도의 내용 선지를 작성하지 않습니다. 정답은 지문 안 ①~⑤ 위치 중에서 선택합니다.</p> : <>{embeddedChartChoices && <p className="inline-position-note">25번형의 각 칸에는 번호를 제외한 영어 완전문장을 입력하세요. 시험지에서는 도표 아래 설명문에 ①~⑤ 진술로 이어서 표시됩니다.</p>}<div className="choice-grid">{question.choices.map((choice, choiceIndex) => <label key={choiceIndex}><span>{embeddedChartChoices ? ['①', '②', '③', '④', '⑤'][choiceIndex] : choiceIndex + 1}</span><input value={choice} placeholder={embeddedChartChoices ? '지문 속 영어 진술' : '비워두면 AI가 작성'} onChange={(event) => { const choices = [...question.choices]; choices[choiceIndex] = event.target.value; updateQuestion(question.id, { choices }) }} /></label>)}</div></>}
      <div className="form-grid"><label>정답 번호<select value={question.answerIndex} onChange={(event) => updateQuestion(question.id, { answerIndex: Number(event.target.value) })}>{question.choices.map((_, choiceIndex) => <option value={choiceIndex + 1} key={choiceIndex}>{inlinePosition ? `지문 위치 ${choiceIndex + 1}` : embeddedChartChoices ? `지문 속 ${['①', '②', '③', '④', '⑤'][choiceIndex]}` : `${choiceIndex + 1}번`}</option>)}</select></label><label>문항별 출제 의도<input value={question.intention} onChange={(event) => updateQuestion(question.id, { intention: event.target.value })} /></label></div>
      <label>상세 해설<textarea value={question.explanation} onChange={(event) => updateQuestion(question.id, { explanation: event.target.value })} /></label>
      <div className="form-grid"><label>정답 근거 <small>한 줄에 하나</small><textarea value={question.evidenceRefs.join('\n')} onChange={(event) => updateQuestion(question.id, { evidenceRefs: event.target.value.split('\n').map((item) => item.trim()).filter(Boolean) })} /></label><label>오답 오류 근거 <small>한 줄에 하나</small><textarea value={question.distractorReasons.join('\n')} onChange={(event) => updateQuestion(question.id, { distractorReasons: event.target.value.split('\n').map((item) => item.trim()).filter(Boolean) })} /></label></div>
    </div>
  </details>
}

function createExam(): EnglishExamDocument {
  const now = new Date().toISOString()
  return { id: crypto.randomUUID(), title: '새 영어 시험지', setIds: [], contentEntries: [], layout: createExamLayout('school'), setOverrides: {}, entryOverrides: {}, createdAt: now, updatedAt: now }
}

function ExamAssembly({ bundle, setBundle, notify }: Props) {
  const [activeId, setActiveId] = useState(bundle.exams[0]?.id ?? '')
  const storedActive = bundle.exams.find((exam) => exam.id === activeId)
  const active = storedActive ? normalizeExamDocument(storedActive, bundle.questionSets) : undefined
  useEffect(() => { if (!active && bundle.exams[0]) setActiveId(bundle.exams[0].id) }, [active, bundle.exams])
  const selectedSets = useMemo(() => (active ? examSetIds(active) : []).map((id) => bundle.questionSets.find((set) => set.id === id)).filter((set): set is EnglishQuestionSet => Boolean(set)), [active, bundle.questionSets])
  const resolvedEntries = useMemo(() => active ? resolveExamEntries(active, bundle.questionSets) : [], [active, bundle.questionSets])
  const grammarItem = resolvedEntries.find(({ csatItem }) => csatItem?.design?.templateId === '29')?.csatItem
  const vocabularyItem = resolvedEntries.find(({ csatItem }) => csatItem?.design?.templateId === '30')?.csatItem
  const grammarVocabularyScore = (grammarItem?.questions[0]?.score ?? 0) + (vocabularyItem?.questions[0]?.score ?? 0)
  useEffect(() => {
    if (grammarItem && vocabularyItem && grammarVocabularyScore !== 5) notify(`29번 어법과 30번 어휘의 배점 합은 5점을 권장합니다. 현재 ${grammarVocabularyScore}점입니다.`)
  }, [grammarItem?.id, vocabularyItem?.id, grammarVocabularyScore])
  const addExam = () => { const next = createExam(); setBundle((value) => ({ ...value, exams: [next, ...value.exams] })); setActiveId(next.id); void saveExamDocument(next) }
  const updateExam = (patch: Partial<EnglishExamDocument>) => {
    if (!active) return
    const next = normalizeExamDocument({ ...active, ...patch, updatedAt: new Date().toISOString() }, bundle.questionSets)
    setBundle((value) => ({ ...value, exams: value.exams.map((exam) => exam.id === next.id ? next : exam) })); void saveExamDocument(next)
  }
  const updateLayout = (patch: Partial<ExamLayoutSettings>) => updateExam({ layout: { ...active!.layout, ...patch } })
  const toggleSet = (set: EnglishQuestionSet) => {
    const candidates = contentEntriesForSet(set)
    const current = active!.contentEntries ?? []
    const allIncluded = candidates.every((candidate) => current.some((entry) => entry.id === candidate.id))
    const contentEntries = allIncluded ? current.filter((entry) => entry.setId !== set.id) : [...current, ...candidates.filter((candidate) => !current.some((entry) => entry.id === candidate.id))]
    updateExam({ contentEntries, setIds: [...new Set(contentEntries.map((entry) => entry.setId))] })
  }
  const toggleEntry = (entry: ExamContentEntry) => {
    const current = active!.contentEntries ?? []
    const contentEntries = current.some((candidate) => candidate.id === entry.id) ? current.filter((candidate) => candidate.id !== entry.id) : [...current, entry]
    updateExam({ contentEntries, setIds: [...new Set(contentEntries.map((candidate) => candidate.setId))] })
  }
  const move = (index: number, direction: -1 | 1) => { const entries = active?.contentEntries ?? []; const target = index + direction; if (!active || target < 0 || target >= entries.length) return; const next = [...entries]; [next[index], next[target]] = [next[target], next[index]]; updateExam({ contentEntries: next }) }
  const updateOverride = (entryId: string, patch: Partial<SetLayoutOverride>) => updateExam({ entryOverrides: { ...(active!.entryOverrides ?? {}), [entryId]: { ...(active!.entryOverrides?.[entryId] ?? {}), ...patch } } })

  if (!active) return <section className="empty-editor"><h2>시험지 조립</h2><p>내신형·수능형·맞춤설정형 세트를 한 시험지에 자유롭게 섞을 수 있습니다.</p><button className="primary" onClick={addExam}>첫 시험지 만들기</button></section>
  return <div className="assembly-layout"><section className="assembly-editor">
    <div className="editor-title"><div><span className="eyebrow">MIXED EXAM BUILDER</span><h2>시험지 조립과 양식 설정</h2></div><button className="primary" onClick={addExam}>+ 새 시험지</button></div>
    <section className="editor-card"><h3>시험지 기본 정보</h3><div className="form-grid"><label>시험지 선택<select value={activeId} onChange={(event) => setActiveId(event.target.value)}>{bundle.exams.map((exam) => <option value={exam.id} key={exam.id}>{exam.title}</option>)}</select></label><label>시험지 제목<input value={active.title} onChange={(event) => updateExam({ title: event.target.value })} /></label><label>기관명<input value={active.layout.institution} onChange={(event) => updateLayout({ institution: event.target.value })} /></label><label>학년·반 표기<input value={active.layout.gradeLabel} onChange={(event) => updateLayout({ gradeLabel: event.target.value })} /></label><label>날짜<input value={active.layout.dateLabel} onChange={(event) => updateLayout({ dateLabel: event.target.value })} /></label><label>꼬리말<input value={active.layout.footerText} onChange={(event) => updateLayout({ footerText: event.target.value })} /></label></div></section>
    <section className="editor-card"><h3>시험지 기본 양식</h3><div className="form-grid"><label>양식 프리셋<select value={active.layout.preset} onChange={(event) => { const preset = event.target.value as LayoutPreset; updateExam({ layout: { ...LAYOUT_PRESETS[preset], institution: active.layout.institution, gradeLabel: active.layout.gradeLabel, dateLabel: active.layout.dateLabel } }) }}><option value="csat">수능형</option><option value="school">학교형</option><option value="worksheet">워크시트형</option><option value="custom">사용자 설정형</option></select></label><label>문제지 칼럼<select value={active.layout.columns} onChange={(event) => updateLayout({ columns: Number(event.target.value) as 1 | 2 })}><option value={1}>1단</option><option value={2}>2단</option></select></label><label>해설지 칼럼<select value={active.layout.answerColumns} onChange={(event) => updateLayout({ answerColumns: Number(event.target.value) as 1 | 2 })}><option value={1}>1단</option><option value={2}>2단</option></select></label><NumberField label="글자 크기(pt)" value={active.layout.fontSize} step={0.1} onChange={(fontSize) => updateLayout({ fontSize })} /><NumberField label="줄 간격" value={active.layout.lineHeight} step={0.05} onChange={(lineHeight) => updateLayout({ lineHeight })} /><NumberField label="문항 간격(mm)" value={active.layout.questionGap} onChange={(questionGap) => updateLayout({ questionGap })} /><NumberField label="위 여백(mm)" value={active.layout.marginTop} onChange={(marginTop) => updateLayout({ marginTop })} /><NumberField label="오른쪽 여백(mm)" value={active.layout.marginRight} onChange={(marginRight) => updateLayout({ marginRight })} /><NumberField label="아래 여백(mm)" value={active.layout.marginBottom} onChange={(marginBottom) => updateLayout({ marginBottom })} /><NumberField label="왼쪽 여백(mm)" value={active.layout.marginLeft} onChange={(marginLeft) => updateLayout({ marginLeft })} /><label className="check-label"><input type="checkbox" checked={active.layout.passageBorder} onChange={(event) => updateLayout({ passageBorder: event.target.checked })} /> 지문 테두리</label><label className="check-label"><input type="checkbox" checked={active.layout.showPageNumbers} onChange={(event) => updateLayout({ showPageNumbers: event.target.checked })} /> 페이지 번호</label></div></section>
    <section className="editor-card"><h3>세트 전체 추가 후 문항별 조정</h3><div className="assembly-set-grid">{bundle.questionSets.map((set) => { const candidates = contentEntriesForSet(set); const included = candidates.filter((candidate) => active.contentEntries?.some((entry) => entry.id === candidate.id)).length; return <details className={included ? 'selected' : ''} key={set.id}><summary><label onClick={(event) => event.stopPropagation()}><input type="checkbox" checked={included === candidates.length && included > 0} onChange={() => toggleSet(set)} /><span><strong>{set.title}</strong><small>{MODE_LABELS[set.mode]} · {allSetQuestions(set).length}문항 {included > 0 && included < candidates.length ? `· 일부 ${included}/${candidates.length}` : ''}</small></span></label>{set.mode === 'csat' && <span className="assembly-detail-toggle">문항별 선택</span>}</summary>{set.mode === 'csat' && <div className="assembly-item-checks">{candidates.map((entry, index) => { const item = getCsatItems(set)[index]; const template = item.design ? getCsatTemplate(item.design.templateId) : undefined; return <label key={entry.id}><input type="checkbox" checked={active.contentEntries?.some((candidate) => candidate.id === entry.id) ?? false} onChange={() => toggleEntry(entry)} /><span>{index + 1}. {template ? `${template.numberLabel} · ${template.label}` : '미설정 카드'} ({item.questions.length}문항)</span></label> })}</div>}</details> })}</div></section>
    <section className="editor-card"><h3>시험 순서와 문항별 양식</h3><div className="set-order-list">{resolvedEntries.map(({ entry, set, csatItem }, index) => { const override = active.entryOverrides?.[entry.id] ?? {}; const template = csatItem?.design ? getCsatTemplate(csatItem.design.templateId) : undefined; return <details key={entry.id}><summary><span><strong>{index + 1}. {template ? `${template.numberLabel} · ${template.label}` : set.title}</strong><small>{set.title} · {csatItem?.questions.length ?? set.questions.length}문항</small></span><span><button disabled={index === 0} onClick={(event) => { event.preventDefault(); move(index, -1) }}>위로</button><button disabled={index === resolvedEntries.length - 1} onClick={(event) => { event.preventDefault(); move(index, 1) }}>아래로</button><button onClick={(event) => { event.preventDefault(); toggleEntry(entry) }}>제외</button></span></summary><div className="override-grid"><label>시작 위치<select value={override.breakBefore ?? 'auto'} onChange={(event) => updateOverride(entry.id, { breakBefore: event.target.value as SetLayoutOverride['breakBefore'] })}><option value="auto">자동</option><option value="column">다음 칼럼</option><option value="page">다음 페이지</option></select></label><label>칼럼<select value={override.columns ?? 0} onChange={(event) => updateOverride(entry.id, { columns: Number(event.target.value) === 0 ? undefined : Number(event.target.value) as 1 | 2 })}><option value={0}>시험지 기본값</option><option value={1}>1단</option><option value={2}>2단</option></select></label><NumberField label="글자 배율" value={override.fontScale ?? 1} step={0.05} onChange={(fontScale) => updateOverride(entry.id, { fontScale })} /><NumberField label="줄 간격" value={override.lineHeight ?? active.layout.lineHeight} step={0.05} onChange={(lineHeight) => updateOverride(entry.id, { lineHeight })} /><label className="check-label"><input type="checkbox" checked={override.passageBorder ?? active.layout.passageBorder} onChange={(event) => updateOverride(entry.id, { passageBorder: event.target.checked })} /> 지문 테두리</label><label className="check-label"><input type="checkbox" checked={override.keepMaterialWithFirst ?? true} onChange={(event) => updateOverride(entry.id, { keepMaterialWithFirst: event.target.checked })} /> 지문과 첫 문항 묶기</label><label className="check-label"><input type="checkbox" checked={override.keepQuestions ?? true} onChange={(event) => updateOverride(entry.id, { keepQuestions: event.target.checked })} /> 문항 선지 묶기</label></div></details> })}</div></section>
    <button className="danger" onClick={() => { if (!window.confirm('이 시험지를 삭제할까요?')) return; setBundle((value) => ({ ...value, exams: value.exams.filter((exam) => exam.id !== active.id) })); void deleteExamDocument(active.id); notify('시험지를 삭제했습니다.') }}>시험지 삭제</button>
  </section><aside className="assembly-preview"><div className="sticky-preview"><span className="eyebrow">LIVE EXAM PREVIEW</span><h3>양식 실시간 미리보기</h3>{selectedSets.length ? <div className="scaled-paper"><ExamQuestionPages exam={active} sets={selectedSets} assets={bundle.mediaAssets} /></div> : <div className="empty-state">세트를 선택하면 시험지가 바로 표시됩니다.</div>}</div></aside></div>
}

function NumberField({ label, value, step = 1, onChange }: { label: string; value: number; step?: number; onChange: (value: number) => void }) {
  return <label>{label}<input type="number" step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>
}

function ExamPreview({ bundle, notify }: Props) {
  const [activeId, setActiveId] = useState(bundle.exams[0]?.id ?? '')
  const [sheet, setSheet] = useState<'questions' | 'answers'>('questions')
  const [saving, setSaving] = useState(false)
  const [layoutIssues, setLayoutIssues] = useState<string[]>([])
  const rawActive = bundle.exams.find((exam) => exam.id === activeId) ?? bundle.exams[0]
  const active = rawActive ? normalizeExamDocument(rawActive, bundle.questionSets) : undefined
  const sets = useMemo(() => (active ? examSetIds(active) : []).map((id) => bundle.questionSets.find((set) => set.id === id)).filter((set): set is EnglishQuestionSet => Boolean(set)), [active, bundle.questionSets])
  const savePdf = async () => {
    if (!active || saving || layoutIssues.length) return
    const pages = Array.from(document.querySelectorAll<HTMLElement>('.preview-page-stack .print-page'))
    if (!pages.length) { notify('PDF로 저장할 페이지가 없습니다.'); return }
    setSaving(true)
    try { await downloadExamPagesPdf(pages, makeExamPdfFilename(active.title, sheet)); notify('PDF 파일을 저장했습니다.') }
    catch { notify('PDF 저장에 실패했습니다.') }
    finally { setSaving(false) }
  }
  if (!active) return <section className="empty-editor"><h2>인쇄 미리보기</h2><p>먼저 시험지 조립에서 시험지를 만드세요.</p></section>
  return <section className="preview-screen"><div className="preview-toolbar"><label>시험지<select value={active.id} onChange={(event) => setActiveId(event.target.value)}>{bundle.exams.map((exam) => <option value={exam.id} key={exam.id}>{exam.title}</option>)}</select></label><div className="segmented"><button className={sheet === 'questions' ? 'active' : ''} onClick={() => setSheet('questions')}>문제지</button><button className={sheet === 'answers' ? 'active' : ''} onClick={() => setSheet('answers')}>정답·해설지</button></div><div className="button-row"><button disabled={!sets.length || !!layoutIssues.length} onClick={() => window.print()}>인쇄</button><button className="primary" disabled={!sets.length || saving || !!layoutIssues.length} onClick={() => void savePdf()}>{saving ? 'PDF 만드는 중…' : 'PDF 저장'}</button></div></div>{layoutIssues.length > 0 && <div className="export-blocker"><strong>한 칸보다 긴 문항이 있어 내보낼 수 없습니다.</strong><ul>{layoutIssues.map((issue) => <li key={issue}>{issue}</li>)}</ul></div>}{!sets.length ? <div className="empty-editor">시험지에 세트를 추가해 주세요.</div> : <div className="preview-page-stack">{sheet === 'questions' ? <ExamQuestionPages exam={active} sets={sets} assets={bundle.mediaAssets} onLayoutIssuesChange={setLayoutIssues} /> : <ExamAnswerPages exam={active} sets={sets} />}</div>}</section>
}
