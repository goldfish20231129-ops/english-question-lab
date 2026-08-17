import { Component, useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ExamAnswerPages, ExamQuestionPages, SetLivePreview } from './ExamPaper'
import { CSAT_FAMILIES, CSAT_PASSAGE_LENGTH_LABELS, MAX_CSAT_SET_QUESTIONS, allSetQuestions, applyCsatItemTemplate, choiceStyleLabel, countCsatPassageWords, createCsatItem, csatItemHasResult, getCsatItems, getCsatPassageLengthRange, getCsatTemplate, isInlinePositionTemplate, normalizeCsatPassageLength, normalizeCsatSet, plannedCsatItemQuestionCount, plannedCsatSetQuestionCount, resolvedCsatItem, templatesForCsatFamily } from './csat'
import { CUSTOM_PRESETS, ENGLISH_INTENTION_PRESETS, ENGLISH_TOPIC_PRESETS, LAYOUT_PRESETS, MODE_LABELS, applyCustomPreset, assignAutomaticCsatTopics, createEnglishSet, createExamLayout, createQuestion, defaultQuestionStem, generateCsatGptInstructions, generateEnglishPrompt, generateReviewPrompt, layoutForFirstSelectedSet, loadEnglishGptConfig, parseEnglishSetJson, preferredExamPresetForSets, questionTypesFor, validateEnglishSet, type EnglishGptConfig } from './english'
import { contentEntriesForSet, examSetIds, moveExamContentEntry, normalizeExamDocument, resolveExamEntries } from './examLayout'
import { PROVIDED_PASSAGE_CHOICE_LANGUAGE_LABELS, PROVIDED_PASSAGE_POLARITY_LABELS, PROVIDED_PASSAGE_VOCABULARY_LABELS, fingerprintProvidedPassage, providedPassageBlockingReason, transitionSchoolProvidedPassageMode, updateProvidedPassageState } from './providedPassage'
import { PROVIDED_PASSAGE_GRAMMAR_LABELS, PROVIDED_PASSAGE_GRAMMAR_MODE_HELP, PROVIDED_PASSAGE_GRAMMAR_MODE_LABELS, PROVIDED_PASSAGE_GRAMMAR_RULES, PROVIDED_PASSAGE_V02_MAX_ITEMS, PROVIDED_PASSAGE_V02_TYPE_LABELS, createProvidedPassageV02Plan, orderedProvidedPassageV02Plans, providedPassageV02BlockingReason, providedPassageV02TransitionBlockingReason, repairProvidedPassageV02QuestionStems, syncProvidedPassageV02Questions, transitionSchoolProvidedPassageV02, updateProvidedPassageV02Material } from './providedPassageV02'
import { PASSAGE_TRANSFORM_HELP, PASSAGE_TRANSFORM_LABELS, generatePassageTransformationPrompt, parsePassageTransformationJson, type PassageTransformMode } from './passageTransform'
import { orderedSchoolQuestions } from './schoolMaterial'
import { MAX_SCHOOL_SET_QUESTIONS, SCHOOL_QUESTION_TEMPLATES, inferSchoolQuestionTemplate } from './schoolCatalog'
import { deleteExamDocument, deleteExamDocuments, deleteMediaAsset, deleteQuestionSet, saveExamDocument, saveMediaAsset, saveQuestionSet } from './studioStorage'
import type { CsatItemDesign, CsatNumberTemplateId, CsatPassageLengthPreset, CsatQuestionFamilyId, CsatVariantId, EnglishExamDocument, EnglishMode, EnglishQuestion, EnglishQuestionSet, ExamContentEntry, ExamLayoutSettings, LayoutPreset, MediaAsset, ProvidedPassageChoiceLanguage, ProvidedPassageContentPolarity, ProvidedPassageGrammarMode, ProvidedPassageGrammarTarget, ProvidedPassageV02ItemPlan, ProvidedPassageV02QuestionType, ProvidedPassageVocabularyLevel, SetLayoutOverride, StudioBundle, StudioScreen, ValidationIssue, VerificationTarget } from './types'
import { includesValue, toggleUniqueValue } from './utils'
import { VerificationStudio } from './VerificationStudio'
import { VERIFICATION_STATUS_LABELS, verificationDisplayStatus } from './verification'
import { ENGLISH_DIFFICULTY_LEVELS, englishDifficultyLabel, englishDifficultySummary } from './difficulty'
import { EXPLANATION_STATUS_LABELS, explanationSourceFingerprint, explanationStatus, generateExplanationPrompt, parseExplanationJson } from './explanation'

interface Props {
  screen: StudioScreen
  mode: EnglishMode
  bundle: StudioBundle
  setBundle: React.Dispatch<React.SetStateAction<StudioBundle>>
  notify: (message: string) => void
  verificationTarget?: VerificationTarget
  onOpenVerification?: (target: VerificationTarget) => void
}

class AssemblyPreviewBoundary extends Component<{
  children: ReactNode
  resetKey: string
  onCreateExam: () => void
  onClearExam: () => void
}, { failed: boolean; message: string }> {
  state = { failed: false, message: '' }

  static getDerivedStateFromError() { return { failed: true } }

  componentDidCatch(error: unknown) {
    this.setState({ message: error instanceof Error ? error.message : '알 수 없는 미리보기 오류' })
  }

  componentDidUpdate(previous: Readonly<{ resetKey: string }>) {
    if (this.state.failed && previous.resetKey !== this.props.resetKey) this.setState({ failed: false, message: '' })
  }

  render() {
    if (!this.state.failed) return this.props.children
    return <section className="assembly-preview-recovery" role="alert">
      <span className="eyebrow">PREVIEW RECOVERY</span>
      <h3>이 시험지의 미리보기만 잠시 중단했습니다.</h3>
      <p>세트와 다른 시험지는 그대로 유지됩니다. 왼쪽 편집기에서 다른 시험지를 선택하거나 새 시험지를 만들어 계속 작업할 수 있습니다.</p>
      {this.state.message && <details><summary>오류 원인 보기</summary><code>{this.state.message}</code></details>}
      <div className="button-row"><button onClick={() => this.setState({ failed: false, message: '' })}>미리보기 다시 시도</button><button className="primary" onClick={() => { this.props.onCreateExam(); this.setState({ failed: false, message: '' }) }}>새 빈 시험지 만들기</button><button className="danger" onClick={this.props.onClearExam}>현재 시험지 문항 비우기</button></div>
    </section>
  }
}

const MODE_HELP: Record<EnglishMode, string> = {
  school: '교과서·부교재·외부 지문을 바탕으로 내신 객관식을 설계합니다.',
  csat: '17개 수능 독해 유형과 장문 세트를 5지선다로 설계합니다.',
  custom: '여섯 가지 프리셋을 시작점으로 객관식 구성을 자유롭게 조합합니다.',
}

function persistLocally(operation: Promise<unknown>, action: string, notify: (message: string) => void) {
  void operation.catch(() => notify(`${action}을 로컬 저장소에 반영하지 못했습니다. JSON 백업을 저장해 주세요.`))
}

function QuickPresetField({ label, help, value, choices, onChange, placeholder, multiline = false }: { label: string; help?: string; value: string; choices: readonly string[]; onChange: (value: string) => void; placeholder?: string; multiline?: boolean }) {
  const separator = multiline ? '\n' : ', '
  return <label className="quick-preset-field">{label}
    {help && <small className="field-help">{help}</small>}
    {multiline
      ? <textarea value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
      : <input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />}
    <span className="quick-preset-options"><small>빠른 선택 · 여러 개 선택 가능</small>{choices.map((choice) => { const selected = includesValue(value, choice, separator); return <button type="button" className={selected ? 'selected' : ''} aria-pressed={selected} key={choice} onClick={() => onChange(toggleUniqueValue(value, choice, separator))}>{selected ? '✓ ' : ''}{choice}</button> })}</span>
  </label>
}

export function DragPreviewViewport({ children, className = '', label }: { children: ReactNode; className?: string; label: string }) {
  const viewport = useRef<HTMLDivElement>(null)
  const drag = useRef<{ pointerId: number; x: number; y: number; left: number; top: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const finishDrag = () => { drag.current = null; setDragging(false) }
  return <div
    ref={viewport}
    className={`drag-preview-viewport ${className}${dragging ? ' dragging' : ''}`.trim()}
    role="region"
    aria-label={label}
    tabIndex={0}
    onPointerDown={(event) => {
      if (event.pointerType === 'touch' || event.button !== 0) return
      drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, left: event.currentTarget.scrollLeft, top: event.currentTarget.scrollTop }
      event.currentTarget.setPointerCapture(event.pointerId)
      setDragging(true)
      event.preventDefault()
    }}
    onPointerMove={(event) => {
      const current = drag.current
      if (!current || current.pointerId !== event.pointerId) return
      event.currentTarget.scrollLeft = current.left - (event.clientX - current.x)
      event.currentTarget.scrollTop = current.top - (event.clientY - current.y)
    }}
    onPointerUp={finishDrag}
    onPointerCancel={finishDrag}
    onKeyDown={(event) => {
      const element = viewport.current
      if (!element) return
      const amount = event.key === 'PageDown' || event.key === 'PageUp' ? element.clientHeight * .8 : 52
      if (event.key === 'ArrowDown' || event.key === 'PageDown') element.scrollBy({ top: amount })
      else if (event.key === 'ArrowUp' || event.key === 'PageUp') element.scrollBy({ top: -amount })
      else if (event.key === 'ArrowRight') element.scrollBy({ left: amount })
      else if (event.key === 'ArrowLeft') element.scrollBy({ left: -amount })
      else return
      event.preventDefault()
    }}
  ><span className="drag-preview-hint">마우스로 드래그 · 터치로 스크롤</span>{children}</div>
}

export function EnglishStudio(props: Props) {
  if (props.screen === 'verification') return <VerificationStudio bundle={props.bundle} setBundle={props.setBundle} notify={props.notify} initialTarget={props.verificationTarget} />
  if (props.screen === 'assembly') return <ExamAssembly {...props} />
  if (props.screen === 'preview') return <ExamPreview {...props} />
  return <SetWorkspace {...props} />
}

function SetWorkspace({ mode, bundle, setBundle, notify, onOpenVerification }: Props) {
  const filtered = bundle.questionSets.filter((set) => set.mode === mode)
  const [activeId, setActiveId] = useState(filtered[0]?.id ?? '')
  const [jsonInput, setJsonInput] = useState('')
  const [explanationInput, setExplanationInput] = useState('')
  const [explanationPrompt, setExplanationPrompt] = useState('')
  const [issues, setIssues] = useState<ValidationIssue[]>([])
  const [reviewPrompt, setReviewPrompt] = useState('')
  const [selectedSetIds, setSelectedSetIds] = useState<string[]>([])
  const [passageTransformMode, setPassageTransformMode] = useState<PassageTransformMode>('original')
  const [passageTransformPrompt, setPassageTransformPrompt] = useState('')
  const [passageTransformInput, setPassageTransformInput] = useState('')
  const [gptConfig, setGptConfig] = useState<EnglishGptConfig>({ school: '', csat: '', custom: '', csatVerifier: '' })
  const active = bundle.questionSets.find((set) => set.id === activeId && set.mode === mode)
  const schoolProvidedMode = active?.mode === 'school' && active.materialMode === 'provided'
  const schoolProvided = schoolProvidedMode ? active.providedPassage : undefined
  const schoolProvidedV02 = schoolProvidedMode ? active.providedPassageV02 : undefined
  const schoolProvidedV02Plans = schoolProvidedV02 ? orderedProvidedPassageV02Plans(schoolProvidedV02.itemPlans) : []
  const hasProvidedPassage = Boolean(schoolProvidedMode)
  const schoolQuestionLimitReached = mode === 'school' && Boolean(active && active.questions.length >= MAX_SCHOOL_SET_QUESTIONS)
  const schoolProvidedBlockingReason = active && schoolProvidedV02 ? providedPassageV02BlockingReason(active) : active && schoolProvided ? providedPassageBlockingReason(active) : schoolProvidedMode ? '기존 지문 상태가 없습니다. 원문과 기존 문항은 유지되며 V0.2 연결 준비가 필요합니다.' : undefined
  const schoolProvidedTransitionReason = active?.mode === 'school' ? providedPassageV02TransitionBlockingReason(active) : undefined
  const activeVerificationStatus = active?.mode === 'csat' ? verificationDisplayStatus({ scope: 'set', id: active.id }, active.verificationRuns, bundle) : undefined
  const activeExplanationStatus = active ? explanationStatus(active) : 'not-ready'
  const imageInput = useRef<HTMLInputElement>(null)
  useEffect(() => { if (!active) setActiveId(filtered[0]?.id ?? '') }, [mode, active, filtered])
  useEffect(() => { setJsonInput(''); setExplanationInput(''); setExplanationPrompt(''); setIssues([]); setReviewPrompt(''); setPassageTransformMode('original'); setPassageTransformPrompt(''); setPassageTransformInput('') }, [activeId])
  useEffect(() => { setSelectedSetIds((current) => current.filter((id) => filtered.some((set) => set.id === id))) }, [mode, bundle.questionSets])
  useEffect(() => { void loadEnglishGptConfig().then(setGptConfig) }, [])

  const addSet = () => {
    const next = createEnglishSet(mode)
    setBundle((value) => ({ ...value, questionSets: [next, ...value.questionSets] }))
    setActiveId(next.id); persistLocally(saveQuestionSet(next), '새 세트', notify)
  }
  const updateSet = (patch: Partial<EnglishQuestionSet>) => {
    if (!active) return
    const candidate = { ...active, ...patch }
    const sourceChanged = explanationSourceFingerprint(candidate) !== explanationSourceFingerprint(active)
    const next = { ...candidate, explanationSourceFingerprint: sourceChanged ? undefined : candidate.explanationSourceFingerprint, updatedAt: new Date().toISOString() }
    setBundle((value) => ({ ...value, questionSets: value.questionSets.map((set) => set.id === next.id ? next : set) }))
    persistLocally(saveQuestionSet(next), '세트 변경 사항', notify)
  }
  const updateQuestion = (questionId: string, patch: Partial<EnglishQuestion>) => {
    if (!active) return
    const questions = active.questions.map((question) => question.id === questionId ? { ...question, ...patch } : question)
    updateSet({ questions: orderedSchoolQuestions({ ...active, questions }) })
  }
  const updateCsatItems = (csatItems: CsatItemDesign[]) => updateSet({ csatItems, prompt: '', validatedRevision: 0, lastImportedJson: '' })
  const setChoiceCount = (choiceCount: number) => {
    if (!active) return
    updateSet({ choiceCount, questions: active.questions.map((question) => ({ ...question, choices: Array.from({ length: choiceCount }, (_, index) => question.choices[index] ?? ''), answerIndex: Math.min(question.answerIndex, choiceCount) })) })
  }
  const selectSchoolPassageMode = (nextMode: 'provided' | 'generated') => {
    if (!active || active.mode !== 'school') return
    try {
      updateSet(nextMode === 'provided' ? transitionSchoolProvidedPassageV02(active, nextMode) : transitionSchoolProvidedPassageMode(active, nextMode))
    } catch (error) { notify(error instanceof Error ? error.message : '기존 지문 V0.2로 전환하지 못했습니다.') }
  }
  const updateSchoolProvidedV02Plans = (plans: ProvidedPassageV02ItemPlan[]) => {
    if (!active || !schoolProvidedV02) return
    const orderedPlans = orderedProvidedPassageV02Plans(plans)
    updateSet({ providedPassageV02: { ...schoolProvidedV02, itemPlans: orderedPlans, results: undefined }, questions: syncProvidedPassageV02Questions(active, orderedPlans), prompt: '', lastImportedJson: '' })
  }
  const patchSchoolProvidedV02Plan = (itemId: string, patch: Partial<ProvidedPassageV02ItemPlan>) => {
    if (!schoolProvidedV02) return
    if (patch.questionType === 'sentence_insertion' && schoolProvidedV02.itemPlans.some((plan) => plan.itemId !== itemId && plan.questionType === 'sentence_insertion')) { notify('문장 삽입은 한 세트에 한 문항만 추가할 수 있습니다.'); return }
    const plans = schoolProvidedV02.itemPlans.map((plan) => {
      if (plan.itemId !== itemId) return plan
      const next = { ...plan, ...patch }
      if (patch.questionType) {
        next.choiceLanguage = patch.questionType === 'content_match' || patch.questionType === 'content_inference' ? plan.choiceLanguage ?? 'ko' : null
        next.contentMatchPolarity = patch.questionType === 'content_match' ? plan.contentMatchPolarity ?? 'mismatch' : null
        next.grammarTarget = patch.questionType === 'grammar' ? plan.grammarTarget ?? 'relative_clause' : null
        next.grammarMode = patch.questionType === 'grammar' ? plan.grammarMode ?? 'controlled_error_variant' : null
      }
      return next
    })
    updateSchoolProvidedV02Plans(plans)
  }
  const addSchoolProvidedV02Plan = (questionType: ProvidedPassageV02QuestionType = 'content_match') => {
    if (!schoolProvidedV02 || schoolProvidedV02.itemPlans.length >= PROVIDED_PASSAGE_V02_MAX_ITEMS) return
    if (questionType === 'sentence_insertion') {
      if (schoolProvidedV02.itemPlans.some((plan) => plan.questionType === 'sentence_insertion')) { notify('문장 삽입은 이미 추가되어 있습니다. 한 세트에 한 문항만 만들 수 있습니다.'); return }
      if (schoolProvidedV02.boundaries.length < 6) { notify(`문장 삽입에는 후보 위치 5개가 필요합니다. 현재 지문은 ${schoolProvidedV02.sentences.length}문장이라 후보 경계가 부족합니다.`); return }
    }
    const nextPlan = createProvidedPassageV02Plan(undefined, questionType)
    if (questionType === 'grammar') nextPlan.grammarMode = 'controlled_error_variant'
    updateSchoolProvidedV02Plans([...schoolProvidedV02.itemPlans, nextPlan])
  }
  const removeSchoolProvidedV02Plan = (itemId: string) => {
    if (!schoolProvidedV02 || schoolProvidedV02.itemPlans.length === 1) return
    updateSchoolProvidedV02Plans(schoolProvidedV02.itemPlans.filter((plan) => plan.itemId !== itemId))
  }
  const updateSchoolProvidedOptions = (patch: Partial<Pick<NonNullable<EnglishQuestionSet['providedPassage']>, 'choiceLanguage' | 'vocabularyLevel' | 'contentMatchPolarity'>>) => {
    if (!active || !schoolProvided) return
    const nextState = updateProvidedPassageState(schoolProvided, active.material, patch)
    const stem = nextState.questionType === 'content_match' ? `다음 글의 내용과 ${nextState.contentMatchPolarity === 'match' ? '일치하는' : '일치하지 않는'} 것은?` : active.questions[0]?.stem
    updateSet({ providedPassage: nextState, questions: active.questions.map((question, index) => index === 0 && stem ? { ...question, stem } : question), prompt: '', lastImportedJson: '' })
  }
  const updateSchoolProvidedMaterial = (material: string) => {
    if (schoolProvidedV02 && active) {
      const nextState = updateProvidedPassageV02Material(schoolProvidedV02, material)
      const questions = syncProvidedPassageV02Questions(active, nextState.itemPlans).map((question) => ({ ...question, explanation: '', evidenceRefs: [], distractorReasons: [] }))
      updateSet({ material: nextState.originalText, providedPassageV02: nextState, providedPassageQualityReview: undefined, questions, prompt: '', aiRevision: 0, validatedRevision: 0, lastImportedJson: '' })
      setPassageTransformPrompt(''); setPassageTransformInput('')
      return
    }
    if (schoolProvided) updateSet({ material, providedPassage: updateProvidedPassageState(schoolProvided, material), prompt: '', lastImportedJson: '' })
  }
  const createPassageTransformPrompt = () => {
    if (!active) return
    try { setPassageTransformPrompt(generatePassageTransformationPrompt(active.material, passageTransformMode, active.targetLevel)); setPassageTransformInput(''); notify('지문 변형 프롬프트를 만들었습니다.') }
    catch (error) { notify(error instanceof Error ? error.message : '지문 변형 프롬프트를 만들지 못했습니다.') }
  }
  const applyPassageTransformation = () => {
    if (!active) return
    try {
      const result = parsePassageTransformationJson(passageTransformInput, active.material, passageTransformMode)
      if (!window.confirm('변형 지문을 이 세트의 새 기준 지문으로 적용할까요? 기존 AI 문항 결과와 근거 위치는 초기화됩니다.')) return
      updateSchoolProvidedMaterial(result.transformedPassage)
      notify(`${PASSAGE_TRANSFORM_LABELS[passageTransformMode]} 결과를 새 기준 지문으로 적용했습니다. 문항 제작 프롬프트를 다시 생성해 주세요.`)
    } catch (error) { notify(error instanceof Error ? error.message : '지문 변형 결과를 가져오지 못했습니다.') }
  }
  const selectSchoolProvidedQuestionType = (questionType: 'content_match' | 'sentence_insertion') => {
    if (!active || !schoolProvided) return
    const type = questionType === 'content_match' ? '내용 일치 및 불일치' : '문장 삽입'
    const stem = questionType === 'content_match' ? `다음 글의 내용과 ${schoolProvided.contentMatchPolarity === 'match' ? '일치하는' : '일치하지 않는'} 것은?` : '글의 흐름으로 보아, 주어진 문장이 들어가기에 가장 적절한 곳은?'
    updateSet({ providedPassage: updateProvidedPassageState(schoolProvided, active.material, { questionType }), questions: active.questions.map((question, index) => index === 0 ? { ...question, type, stem, choices: Array.from({ length: 5 }, (_, choiceIndex) => question.choices[choiceIndex] ?? ''), answerIndex: Math.min(question.answerIndex, 5), csatTemplateId: questionType === 'sentence_insertion' ? '38' : undefined, csatSlot: questionType === 'sentence_insertion' ? '문장 삽입' : undefined, csatItemId: undefined } : question), choiceCount: 5, prompt: '', lastImportedJson: '' })
  }
  const deleteSets = (ids: string[]) => {
    const selected = new Set(ids)
    const relatedAssets = bundle.mediaAssets.filter((asset) => selected.has(asset.setId))
    const changedExams = bundle.exams.flatMap((exam) => {
      const setIds = exam.setIds.filter((id) => !selected.has(id))
      const contentEntries = exam.contentEntries?.filter((entry) => !selected.has(entry.setId))
      const changed = setIds.length !== exam.setIds.length || contentEntries?.length !== exam.contentEntries?.length
      return changed ? [{ ...exam, setIds, contentEntries, updatedAt: new Date().toISOString() }] : []
    })
    const changedExamById = new Map(changedExams.map((exam) => [exam.id, exam]))
    const remaining = bundle.questionSets.filter((set) => !selected.has(set.id))
    setBundle((value) => ({
      ...value,
      questionSets: value.questionSets.filter((set) => !selected.has(set.id)),
      mediaAssets: value.mediaAssets.filter((asset) => !selected.has(asset.setId)),
      exams: value.exams.map((exam) => changedExamById.get(exam.id) ?? exam),
    }))
    if (selected.has(activeId)) setActiveId(remaining.find((set) => set.mode === mode)?.id ?? '')
    persistLocally(Promise.all([
      ...ids.map((id) => deleteQuestionSet(id)),
      ...relatedAssets.map((asset) => deleteMediaAsset(asset.id)),
      ...changedExams.map((exam) => saveExamDocument(exam)),
    ]), ids.length > 1 ? '선택 세트 삭제' : '세트 삭제', notify)
    setSelectedSetIds([])
  }
  const removeSet = () => {
    if (!active || !window.confirm(`‘${active.title}’ 세트를 삭제할까요?`)) return
    deleteSets([active.id])
    notify('세트를 삭제했습니다.')
  }
  const toggleSetForDeletion = (setId: string) => setSelectedSetIds((current) => current.includes(setId) ? current.filter((id) => id !== setId) : [...current, setId])
  const deleteSelectedSets = () => {
    if (!selectedSetIds.length || !window.confirm(`선택한 세트 ${selectedSetIds.length}개를 삭제할까요? 연결된 시험지에서는 해당 세트 문항만 빠집니다.`)) return
    const count = selectedSetIds.length
    deleteSets(selectedSetIds)
    notify(`선택한 세트 ${count}개를 삭제했습니다.`)
  }
  const copy = async (value: string, message: string) => {
    if (!value.trim()) { notify('먼저 내용을 생성해 주세요.'); return }
    try { await navigator.clipboard.writeText(value); notify(message) } catch { notify('복사하지 못했습니다. 내용을 직접 선택해 주세요.') }
  }
  const createPrompt = () => {
    if (!active) return
    try {
      const prepared = hasProvidedPassage ? active : assignAutomaticCsatTopics(active)
      const assignedCount = active.mode === 'csat' && !hasProvidedPassage && !active.topic.trim()
        ? getCsatItems(active).filter((item) => !item.topic?.trim()).length
        : 0
      updateSet({ csatItems: prepared.csatItems, prompt: generateEnglishPrompt(prepared) })
      if (assignedCount) notify(`비어 있던 ${assignedCount}개 문항 카드의 주제·소재를 자동 배정했습니다.`)
    } catch (error) { notify(error instanceof Error ? error.message : '프롬프트를 만들지 못했습니다.') }
  }
  const importJson = () => {
    if (!active) return
    try {
      const next = parseEnglishSetJson(jsonInput, active)
      setBundle((value) => ({ ...value, questionSets: value.questionSets.map((set) => set.id === next.id ? next : set) }))
      persistLocally(saveQuestionSet(next), 'AI 결과', notify); setJsonInput(''); setIssues([]); setReviewPrompt('')
      notify(`AI 결과 리비전 ${next.aiRevision}을 가져왔습니다. 최신 결과를 검사해 주세요.`)
    } catch (error) { notify(error instanceof Error ? error.message : 'JSON을 읽지 못했습니다.') }
  }
  const createExplanation = () => {
    if (!active) return
    try { setExplanationPrompt(generateExplanationPrompt(active)); notify('현재 문제·정답에 맞는 해설 제작 프롬프트를 만들었습니다.') }
    catch (error) { notify(error instanceof Error ? error.message : '해설 프롬프트를 만들지 못했습니다.') }
  }
  const importExplanation = () => {
    if (!active) return
    try {
      const next = parseExplanationJson(explanationInput, active)
      setBundle((value) => ({ ...value, questionSets: value.questionSets.map((set) => set.id === next.id ? next : set) }))
      persistLocally(saveQuestionSet(next), '해설 결과', notify)
      setExplanationInput(''); setExplanationPrompt('')
      notify('문제와 정답은 그대로 유지하고 해설지를 완성했습니다.')
    } catch (error) { notify(error instanceof Error ? error.message : '해설 JSON을 읽지 못했습니다.') }
  }
  const uploadImage = (file?: File, csatItemId?: string) => {
    if (!active || !file) return
    if (!file.type.startsWith('image/')) { notify('이미지 파일만 추가할 수 있습니다.'); return }
    if (file.size > 3 * 1024 * 1024) { notify('이미지는 3MB 이하만 추가할 수 있습니다.'); return }
    const reader = new FileReader()
    reader.onload = () => {
      const asset: MediaAsset = { id: crypto.randomUUID(), setId: active.id, csatItemId, name: file.name, mimeType: file.type, dataUrl: String(reader.result), caption: '', createdAt: new Date().toISOString() }
      setBundle((value) => ({ ...value, mediaAssets: [...value.mediaAssets, asset] })); persistLocally(saveMediaAsset(asset), '이미지', notify); notify('이미지를 추가했습니다.')
    }
    reader.readAsDataURL(file)
  }
  const updateAsset = (asset: MediaAsset) => { setBundle((value) => ({ ...value, mediaAssets: value.mediaAssets.map((item) => item.id === asset.id ? asset : item) })); persistLocally(saveMediaAsset(asset), '이미지 변경 사항', notify) }
  const removeAsset = (asset: MediaAsset) => { setBundle((value) => ({ ...value, mediaAssets: value.mediaAssets.filter((item) => item.id !== asset.id) })); persistLocally(deleteMediaAsset(asset.id), '이미지 삭제', notify) }

  return <div className="set-workspace">
    <aside className="set-sidebar">
      <div className="sidebar-heading"><div><span className="eyebrow">{MODE_LABELS[mode].toUpperCase()}</span><h2>{MODE_LABELS[mode]} 세트</h2></div><button className="primary" onClick={addSet}>+ 새 세트</button></div>
      <p>{MODE_HELP[mode]}</p>
      <div className="set-list">{filtered.map((set) => <div className={`set-list-item${set.id === activeId ? ' active' : ''}${selectedSetIds.includes(set.id) ? ' delete-selected' : ''}`} key={set.id}><button className="set-list-open" onClick={() => setActiveId(set.id)}><strong>{set.title}</strong><span>{allSetQuestions(set).length}문항 · 난이도 {set.mode === 'custom' ? `${set.difficulty}/5` : englishDifficultyLabel(set.difficulty)}</span><small>{set.aiRevision ? `AI 결과 v${set.aiRevision}` : '조건 설계 중'}</small></button><label className="set-delete-check"><input type="checkbox" aria-label={`‘${set.title}’ 세트 삭제 선택`} checked={selectedSetIds.includes(set.id)} onChange={() => toggleSetForDeletion(set.id)} /><span>삭제</span></label></div>)}</div>
      {filtered.length > 0 && <div className="set-delete-actions"><button type="button" onClick={() => setSelectedSetIds(filtered.map((set) => set.id))}>전체 선택</button><button type="button" disabled={!selectedSetIds.length} onClick={() => setSelectedSetIds([])}>선택 해제</button><button type="button" className="danger" disabled={!selectedSetIds.length} onClick={deleteSelectedSets}>선택한 세트 삭제 ({selectedSetIds.length})</button></div>}
      {!filtered.length && <div className="empty-state">아직 세트가 없습니다.</div>}
    </aside>
    {!active ? <section className="empty-editor"><h2>{MODE_LABELS[mode]} 영어 세트 제작</h2><p>새 세트를 만들어 출제 조건을 설계하세요.</p><button className="primary" onClick={addSet}>첫 세트 만들기</button></section> : <>
      <section className="set-editor">
        <div className="editor-title"><div><span className="eyebrow">ENGLISH SET DESIGN</span><h2>{active.title}</h2></div><button className="danger" onClick={removeSet}>삭제</button></div>
        <section className="editor-card">
          <h3>1. 세트 공통 조건</h3>
          <p>{mode === 'csat' ? '각 문항 카드는 아래 값을 기본으로 사용하며 카드 안에서 개별 덮어쓸 수 있습니다.' : '세트 전체에 적용할 기본 조건을 설정합니다.'}</p>
          <div className="form-grid">
            <label>세트 제목<small className="field-help">세트 목록과 시험지 조립 화면에 표시할 이름입니다.</small><input value={active.title} onChange={(event) => updateSet({ title: event.target.value })} /></label>
            <label>대상 수준<small className="field-help">문장을 읽을 학생의 학년과 실력대를 정합니다.</small><input value={active.targetLevel} onChange={(event) => updateSet({ targetLevel: event.target.value })} placeholder="예: 고2 중상위권" /></label>
            {mode === 'custom'
              ? <label>난이도<small className="field-help">1은 기본 확인, 5는 상위권 변별 수준입니다.</small><select value={active.difficulty} onChange={(event) => updateSet({ difficulty: Number(event.target.value) })}>{[1, 2, 3, 4, 5].map((value) => <option value={value} key={value}>{value} / 5</option>)}</select></label>
              : <label>난이도<small className="field-help">{englishDifficultySummary(mode, active.difficulty)}</small><select value={active.difficulty} onChange={(event) => updateSet({ difficulty: Number(event.target.value) })}>{ENGLISH_DIFFICULTY_LEVELS.map((level) => <option value={level.value} key={level.value}>{level.label}</option>)}</select></label>}
            {mode !== 'school' && <QuickPresetField label="주제·소재" help="지문이 다룰 중심 분야입니다. 비워 두면 수능형은 카드별로 자동 배정됩니다." value={active.topic} choices={ENGLISH_TOPIC_PRESETS} placeholder={mode === 'csat' ? '비워 두면 문항 카드별로 자동 배정됩니다.' : undefined} onChange={(topic) => updateSet({ topic })} />}
            {mode === 'school' && hasProvidedPassage && <label>자료 출처<select value={active.sourceKind} onChange={(event) => updateSet({ sourceKind: event.target.value as EnglishQuestionSet['sourceKind'] })}><option value="textbook">교과서 본문</option><option value="supplement">부교재 지문</option><option value="external">외부 지문</option></select></label>}
            {mode === 'custom' && <label>빠른 시작 프리셋<select value={active.customPreset} onChange={(event) => updateSet(applyCustomPreset(active, event.target.value))}>{CUSTOM_PRESETS.map((preset) => <option key={preset}>{preset}</option>)}</select></label>}
            {mode === 'custom' && <label>선지 수<select value={active.choiceCount} onChange={(event) => setChoiceCount(Number(event.target.value))}>{[2, 3, 4, 5].map((value) => <option value={value} key={value}>{value}지선다</option>)}</select></label>}
            {mode !== 'csat' && <label>자료 제목<input value={active.materialTitle} onChange={(event) => updateSet({ materialTitle: event.target.value })} /></label>}
          </div>
          <QuickPresetField label="공통 출제 의도" help="학생에게 평가하려는 독해 능력과 사고 과정을 적습니다." value={active.intention} choices={ENGLISH_INTENTION_PRESETS} multiline placeholder="학생이 어떤 능력을 발휘해야 하는지 적으세요." onChange={(intention) => updateSet({ intention })} />
          {mode === 'school' && <section className={`passage-source-mode ${hasProvidedPassage ? 'provided' : 'generated'}`} data-testid="school-passage-source-mode"><div><strong>자료 작성 방식</strong><small>{hasProvidedPassage ? '사용자가 입력한 원문은 앱이 보존하고 AI는 문항만 만듭니다.' : 'AI가 새 자료와 문항을 함께 작성하는 기존 방식입니다.'}</small></div><label><select aria-label="내신형 자료 작성 방식" value={active.materialMode === 'provided' ? 'provided' : 'generated'} onChange={(event) => selectSchoolPassageMode(event.target.value as 'provided' | 'generated')}><option value="generated">새 자료 작성</option><option value="provided">기존 지문 사용</option></select></label></section>}
          {mode === 'school' && schoolProvidedV02 ? <section className="provided-passage-panel" data-testid="school-provided-passage-panel-v02">
            <header><div><span className="eyebrow">PROVIDED PASSAGE V0.2 · SCHOOL</span><h4>한 지문 복수 문항 설계</h4></div><span className={schoolProvidedV02.originalText && schoolProvidedV02.sourceFingerprint === fingerprintProvidedPassage(active.material) ? 'source-valid' : 'source-invalid'}>{schoolProvidedV02.originalText ? '원문 분석 완료' : '원문 필요'}</span></header>
            <label>영어 지문 입력 (필수)<textarea aria-label="내신형 영어 지문 입력" className="material-input" value={active.material} onChange={(event) => updateSchoolProvidedMaterial(event.target.value)} placeholder="수정 없이 내신 문항의 근거로 사용할 영어 원문을 붙여넣으세요." /></label>
            <p className="source-analysis-help">입력한 지문에서 문장과 삽입 후보 위치를 앱이 자동 분석합니다. ‘분석 완료’는 외부 AI 연결이 아니라, 아래에서 여러 문항을 설계할 준비가 되었다는 뜻입니다.</p>
            <section className="passage-transform-panel"><div className="card-title-row"><div><strong>지문 변형 (선택)</strong><small>문항을 만들기 전에 변형 지문을 새 기준 지문으로 확정합니다.</small></div><label>변형 방식<select aria-label="내신형 지문 변형 방식" value={passageTransformMode} onChange={(event) => { setPassageTransformMode(event.target.value as PassageTransformMode); setPassageTransformPrompt(''); setPassageTransformInput('') }}>{(Object.keys(PASSAGE_TRANSFORM_LABELS) as PassageTransformMode[]).map((value) => <option value={value} key={value}>{PASSAGE_TRANSFORM_LABELS[value]}</option>)}</select></label></div><p>{PASSAGE_TRANSFORM_HELP[passageTransformMode]}</p>{passageTransformMode !== 'original' && <><div className="button-row"><button type="button" onClick={createPassageTransformPrompt}>변형 프롬프트 만들기</button><button type="button" disabled={!passageTransformPrompt} onClick={() => copy(passageTransformPrompt, '지문 변형 프롬프트를 복사했습니다.')}>프롬프트 복사</button></div><textarea className="prompt-output passage-transform-prompt" readOnly value={passageTransformPrompt} placeholder="변형 프롬프트 만들기를 누르세요." /><label>외부 AI 변형 결과 JSON<small className="field-help">변형 프롬프트에 대한 JSON 객체를 붙여넣으세요. 적용 전 transformedPassage와 changes를 비교해 주세요.</small><textarea aria-label="외부 AI 지문 변형 결과 JSON" value={passageTransformInput} onChange={(event) => setPassageTransformInput(event.target.value)} placeholder='{"schemaId":"english-question-lab-passage-transformation-v1", ...}' /></label><button type="button" className="primary" disabled={!passageTransformInput.trim()} onClick={applyPassageTransformation}>변형 지문을 새 기준 지문으로 적용</button></>}</section>
            <div className="source-identity"><span><b>sourcePassageId</b> {schoolProvidedV02.sourcePassageId}</span><span><b>sourceFingerprint</b> {schoolProvidedV02.sourceFingerprint}</span><span><b>문장/경계</b> {schoolProvidedV02.sentences.length}문장 · {schoolProvidedV02.boundaries.length}경계</span></div>
            <div className="card-title-row"><div><strong>문항 계획</strong><small>일반 문항은 같은 지문 아래에 함께 나오고, 문장 삽입만 마지막 독립 블록으로 출력됩니다. 최대 {PROVIDED_PASSAGE_V02_MAX_ITEMS}문항입니다.</small></div><div className="provided-plan-actions"><button disabled={schoolProvidedV02.itemPlans.length >= PROVIDED_PASSAGE_V02_MAX_ITEMS} onClick={() => addSchoolProvidedV02Plan('content_match')}>+ 내용 일치</button><button disabled={schoolProvidedV02.itemPlans.length >= PROVIDED_PASSAGE_V02_MAX_ITEMS} onClick={() => addSchoolProvidedV02Plan('content_inference')}>+ 내용 이해</button><button disabled={schoolProvidedV02.itemPlans.length >= PROVIDED_PASSAGE_V02_MAX_ITEMS} onClick={() => addSchoolProvidedV02Plan('grammar')}>+ 어법</button><button disabled={schoolProvidedV02.itemPlans.length >= PROVIDED_PASSAGE_V02_MAX_ITEMS || schoolProvidedV02.itemPlans.some((plan) => plan.questionType === 'sentence_insertion')} onClick={() => addSchoolProvidedV02Plan('sentence_insertion')}>+ 문장 삽입</button></div></div>
            {schoolProvidedV02.boundaries.length < 6 && <p className="provided-insertion-help">문장 삽입에는 후보 위치 5개가 필요합니다. 마침표로 끝나는 영어 문장을 최소 5개 입력하면 문장 삽입 버튼을 사용할 수 있습니다.</p>}
            <div className="provided-plan-list">{schoolProvidedV02Plans.map((plan, index) => <article className="provided-plan-card" key={plan.itemId}>
              <div className="card-title-row"><strong>문항 {index + 1}</strong><button disabled={schoolProvidedV02.itemPlans.length === 1} onClick={() => removeSchoolProvidedV02Plan(plan.itemId)}>삭제</button></div>
              <div className="form-grid"><label>문항 유형<select value={plan.questionType} onChange={(event) => patchSchoolProvidedV02Plan(plan.itemId, { questionType: event.target.value as ProvidedPassageV02QuestionType })}>{(Object.keys(PROVIDED_PASSAGE_V02_TYPE_LABELS) as ProvidedPassageV02QuestionType[]).map((value) => <option key={value} value={value}>{PROVIDED_PASSAGE_V02_TYPE_LABELS[value]}</option>)}</select><small className="field-help">유형·발문은 V0.2 계약이 함께 관리합니다. 삽입 위치 표식은 해당 문항에만 적용됩니다.</small></label>
                {(plan.questionType === 'content_match' || plan.questionType === 'content_inference') && <label>선지 언어<select value={plan.choiceLanguage ?? 'ko'} onChange={(event) => patchSchoolProvidedV02Plan(plan.itemId, { choiceLanguage: event.target.value as ProvidedPassageChoiceLanguage })}>{(Object.keys(PROVIDED_PASSAGE_CHOICE_LANGUAGE_LABELS) as ProvidedPassageChoiceLanguage[]).map((value) => <option key={value} value={value}>{PROVIDED_PASSAGE_CHOICE_LANGUAGE_LABELS[value]}</option>)}</select></label>}
                {plan.questionType === 'content_match' && <label>발문 극성<select value={plan.contentMatchPolarity ?? 'mismatch'} onChange={(event) => patchSchoolProvidedV02Plan(plan.itemId, { contentMatchPolarity: event.target.value as ProvidedPassageContentPolarity })}>{(Object.keys(PROVIDED_PASSAGE_POLARITY_LABELS) as ProvidedPassageContentPolarity[]).map((value) => <option key={value} value={value}>{PROVIDED_PASSAGE_POLARITY_LABELS[value]}</option>)}</select></label>}
                {plan.questionType === 'content_inference' && <div className="grammar-plan-guidance"><strong>내용 이해 출제 기준</strong><span>지문에 그대로 적힌 문장을 찾는 대신, 지문의 단서와 관계를 종합해 가장 타당하게 추론할 수 있는 내용을 묻습니다.</span><small>외부 배경지식·과도한 일반화·근거 없는 인과 추론은 정답으로 허용하지 않습니다.</small></div>}
                {plan.questionType === 'grammar' && <><label>핵심 문법<select value={plan.grammarTarget ?? 'relative_clause'} onChange={(event) => patchSchoolProvidedV02Plan(plan.itemId, { grammarTarget: event.target.value as ProvidedPassageGrammarTarget })}>{(Object.keys(PROVIDED_PASSAGE_GRAMMAR_LABELS) as ProvidedPassageGrammarTarget[]).map((value) => <option key={value} value={value}>{PROVIDED_PASSAGE_GRAMMAR_LABELS[value]}</option>)}</select></label><label>출제 방식<select value={plan.grammarMode ?? 'controlled_error_variant'} onChange={(event) => patchSchoolProvidedV02Plan(plan.itemId, { grammarMode: event.target.value as ProvidedPassageGrammarMode })}>{(Object.keys(PROVIDED_PASSAGE_GRAMMAR_MODE_LABELS) as ProvidedPassageGrammarMode[]).map((value) => <option key={value} value={value}>{PROVIDED_PASSAGE_GRAMMAR_MODE_LABELS[value]}</option>)}</select></label></>}
                <label>생성 영어 수준<select value={plan.vocabularyLevel} onChange={(event) => patchSchoolProvidedV02Plan(plan.itemId, { vocabularyLevel: event.target.value as ProvidedPassageVocabularyLevel })}>{(Object.keys(PROVIDED_PASSAGE_VOCABULARY_LABELS) as ProvidedPassageVocabularyLevel[]).map((value) => <option key={value} value={value}>{PROVIDED_PASSAGE_VOCABULARY_LABELS[value]}</option>)}</select></label></div>
              {plan.questionType === 'grammar' && <div className="grammar-plan-guidance"><strong>{PROVIDED_PASSAGE_GRAMMAR_LABELS[plan.grammarTarget ?? 'relative_clause']} 판정 기준</strong><span>{PROVIDED_PASSAGE_GRAMMAR_RULES[plan.grammarTarget ?? 'relative_clause']}</span><small>{PROVIDED_PASSAGE_GRAMMAR_MODE_HELP[plan.grammarMode ?? 'controlled_error_variant']} 평가원형에서는 관계사·동격 that·수 일치·동사/준동사·능수동·대명사 등 판정 가능한 핵심 항목을 분산해 지문 안에 ①~⑤와 밑줄로 표시합니다.</small>{plan.grammarMode === 'source_form_check' && <button type="button" onClick={() => patchSchoolProvidedV02Plan(plan.itemId, { grammarMode: 'controlled_error_variant' })}>평가원형 5개 밑줄로 전환</button>}</div>}
            </article>)}</div>
            <details className="sentence-preview"><summary>문장·경계 Preview</summary><ol>{schoolProvidedV02.sentences.map((sentence) => <li key={sentence.id}><b>{sentence.id}</b><span>{sentence.text}</span><small>{sentence.start}–{sentence.end}</small></li>)}</ol></details>
            <div className={`provided-validation ${schoolProvidedBlockingReason ? 'error' : 'pass'}`}><strong>V0.2 검증 결과</strong><span>{schoolProvidedBlockingReason ?? `${schoolProvidedV02.itemPlans.length}개 문항 계획과 원문 근거가 연결되었습니다.`}</span>{schoolProvidedBlockingReason?.includes('발문') && <button onClick={() => updateSet({ questions: repairProvidedPassageV02QuestionStems(active), prompt: '', lastImportedJson: '' })}>유형·발문 동기화</button>}</div>
          </section> : mode === 'school' && schoolProvided ? <section className="provided-passage-panel" data-testid="school-provided-passage-panel">
            <header><div><span className="eyebrow">PROVIDED PASSAGE V0.1 · SCHOOL</span><h4>내신형 권위 원문과 문항 생성 조건</h4></div><span className={schoolProvided.originalText && schoolProvided.sourceFingerprint === fingerprintProvidedPassage(active.material) ? 'source-valid' : 'source-invalid'}>{schoolProvided.originalText ? '원문 연결됨' : '원문 필요'}</span></header>
            <div className="form-grid"><label>문항 유형<select value={schoolProvided.questionType} onChange={(event) => selectSchoolProvidedQuestionType(event.target.value as 'content_match' | 'sentence_insertion')}><option value="content_match">내용 일치·불일치</option><option value="sentence_insertion">문장 삽입</option></select></label><label>선지 언어<small className="field-help">{schoolProvided.questionType === 'sentence_insertion' ? '문장 삽입은 위치 선택형이므로 선지 언어 설정이 적용되지 않습니다.' : '한 문항의 다섯 선지를 선택한 언어로 통일합니다.'}</small><select aria-label="내신형 선지 언어" disabled={schoolProvided.questionType === 'sentence_insertion'} value={schoolProvided.choiceLanguage} onChange={(event) => updateSchoolProvidedOptions({ choiceLanguage: event.target.value as ProvidedPassageChoiceLanguage })}>{(Object.keys(PROVIDED_PASSAGE_CHOICE_LANGUAGE_LABELS) as ProvidedPassageChoiceLanguage[]).map((value) => <option value={value} key={value}>{PROVIDED_PASSAGE_CHOICE_LANGUAGE_LABELS[value]}</option>)}</select></label><label>생성 영어 어휘 수준<small className="field-help">원문이 아니라 새 영어 선지·삽입 문장에만 적용합니다.</small><select value={schoolProvided.vocabularyLevel} onChange={(event) => updateSchoolProvidedOptions({ vocabularyLevel: event.target.value as ProvidedPassageVocabularyLevel })}>{(Object.keys(PROVIDED_PASSAGE_VOCABULARY_LABELS) as ProvidedPassageVocabularyLevel[]).map((value) => <option value={value} key={value}>{PROVIDED_PASSAGE_VOCABULARY_LABELS[value]}</option>)}</select></label><label>문항 수<small className="field-help">V0.1 MVP는 기존 지문당 한 문항만 지원합니다.</small><select aria-label="내신형 기존 지문 문항 수" value="1" disabled><option value="1">1문항</option></select></label>{schoolProvided.questionType === 'content_match' && <label>내용 일치 발문 극성<select value={schoolProvided.contentMatchPolarity} onChange={(event) => updateSchoolProvidedOptions({ contentMatchPolarity: event.target.value as ProvidedPassageContentPolarity })}>{(Object.keys(PROVIDED_PASSAGE_POLARITY_LABELS) as ProvidedPassageContentPolarity[]).map((value) => <option value={value} key={value}>{PROVIDED_PASSAGE_POLARITY_LABELS[value]}</option>)}</select></label>}</div>
            <label>영어 지문 입력 (필수)<textarea aria-label="내신형 영어 지문 입력" className="material-input" value={active.material} onChange={(event) => updateSchoolProvidedMaterial(event.target.value)} placeholder="수정 없이 내신 문항의 근거로 사용할 영어 원문을 붙여넣으세요." /></label>
            <div className="source-identity"><span><b>sourcePassageId</b> {schoolProvided.sourcePassageId}</span><span><b>sourceFingerprint</b> {schoolProvided.sourceFingerprint}</span><span><b>문장/경계</b> {schoolProvided.sentences.length}문장 · {schoolProvided.boundaries.length}경계</span></div>
            <details className="sentence-preview" open><summary>문장 분리 Preview</summary><ol>{schoolProvided.sentences.map((sentence) => <li key={sentence.id}><b>{sentence.id}</b><span>{sentence.text}</span><small>{sentence.start}–{sentence.end}</small></li>)}</ol><div className="boundary-preview">{schoolProvided.boundaries.map((boundary) => <span key={boundary.id}><b>{boundary.id}</b> @{boundary.offset}</span>)}</div></details>
            <div className={`provided-validation ${schoolProvidedBlockingReason ? 'error' : 'pass'}`}><strong>지문 검증 결과</strong><span>{schoolProvidedBlockingReason ?? '원문·fingerprint·offset이 연결되었습니다.'}</span></div>
          </section> : mode === 'school' && schoolProvidedMode ? <section className="provided-passage-panel provided-migration-panel" data-testid="school-provided-passage-migration">
            <header><div><span className="eyebrow">SAFE MIGRATION</span><h4>기존 지문 연결 정보 복구 필요</h4></div><span className="source-invalid">생성 차단</span></header>
            <p>원문과 기존 문항은 삭제하지 않았습니다. V0.2가 지원하는 내용 일치·불일치, 내용 이해·추론, 문장 삽입, 어법 조합으로 연결한 뒤 전용 프롬프트를 만들 수 있습니다.</p>
            <label>보존된 영어 지문<textarea className="material-input" value={active.material} onChange={(event) => updateSet({ material: event.target.value, prompt: '', lastImportedJson: '' })} /></label>
            <div className="provided-validation error"><strong>차단 사유</strong><span>{schoolProvidedTransitionReason ?? schoolProvidedBlockingReason}</span></div>
            <button className="primary" disabled={Boolean(schoolProvidedTransitionReason)} title={schoolProvidedTransitionReason} onClick={() => selectSchoolPassageMode('provided')}>V0.2로 연결 준비</button>
          </section> : mode !== 'csat' && <><label>영어 지문·자료<textarea className="material-input" value={active.material} onChange={(event) => updateSet({ material: event.target.value })} placeholder={mode === 'school' ? '새 지문 생성 조건이나 참고 자료를 입력할 수 있습니다.' : '출제할 영어 지문을 붙여넣으세요.'} /></label><p className="hint">밑줄 <code>[[밑줄:표현]]</code> · 빈칸 <code>[[빈칸]]</code> · 삽입 <code>[[삽입문장:문장]]</code></p></>}
        </section>

        {mode === 'csat' ? <CsatItemsEditor set={normalizeCsatSet(active)} items={getCsatItems(active)} updateItems={updateCsatItems} assets={bundle.mediaAssets.filter((asset) => asset.setId === active.id)} uploadImage={uploadImage} updateAsset={updateAsset} removeAsset={removeAsset} notify={notify} /> : <section className="editor-card">
          <div className="card-title-row"><div><h3>2. 문항 유형과 문항 수</h3><p>{schoolProvidedV02 ? `기존 지문 V0.2로 ${schoolProvidedV02.itemPlans.length}/${MAX_SCHOOL_SET_QUESTIONS}개 문항을 설계합니다.` : schoolProvided ? '기존 지문 V0.1은 한 문항을 생성합니다.' : mode === 'school' ? `하나의 지문 아래에 최대 ${MAX_SCHOOL_SET_QUESTIONS}개 객관식 문항을 배치합니다. 현재 ${active.questions.length}/${MAX_SCHOOL_SET_QUESTIONS}문항입니다.` : '하나의 지문 아래에 여러 객관식 문항을 배치합니다.'}</p></div><button disabled={hasProvidedPassage || schoolQuestionLimitReached} onClick={() => { if (mode === 'school' && active.questions.length >= MAX_SCHOOL_SET_QUESTIONS) { notify(`내신형 세트는 최대 ${MAX_SCHOOL_SET_QUESTIONS}문항까지 만들 수 있습니다.`); return } const questions = [...active.questions, createQuestion(questionTypesFor(mode)[0], active.choiceCount, mode)]; updateSet({ questions: orderedSchoolQuestions({ ...active, questions }) }) }}>+ 문항 추가</button></div>
          {mode === 'school' && (!hasProvidedPassage || Boolean(schoolProvidedV02)) && <label className="school-insertion-presentation">문장 삽입 표시 방식<small className="field-help">독립형은 삽입 문항에 지문을 한 번 더 보여주고, 공통 지문 공유형은 다른 문항과 같은 지문에 삽입 위치를 함께 표시합니다.</small><select value={active.schoolInsertionPresentation ?? 'isolated'} onChange={(event) => updateSet({ schoolInsertionPresentation: event.target.value as 'isolated' | 'shared' })}><option value="isolated">기존 호환형 · 독립 블록</option><option value="shared">학교 시험형 · 공통 지문 공유</option></select></label>}
          <div className="question-editor-list">{orderedSchoolQuestions(active).map((question, index) => <QuestionEditor key={question.id} set={active} question={question} index={index} locked={hasProvidedPassage} updateQuestion={updateQuestion} remove={() => updateSet({ questions: active.questions.filter((item) => item.id !== question.id) })} />)}</div>
        </section>}

        <section className="editor-card"><div className="card-title-row"><div><h3>{hasProvidedPassage ? '3. 기존 지문 문항 제작 프롬프트' : mode === 'csat' ? '3. 일괄 AI 제작 프롬프트' : '3. 외부 AI용 제작 프롬프트'}</h3><p>{hasProvidedPassage ? '원문과 문장 경계를 한 번만 전달하고, AI는 원문을 반환하지 않은 채 문항 데이터만 생성합니다.' : mode === 'csat' ? '빈 주제·소재는 빠른 선택 후보에서 카드별로 자동 배정한 뒤 하나의 프롬프트와 JSON으로 생성합니다.' : 'API 연결 없이 프롬프트를 복사해 원하는 외부 AI에서 사용합니다.'}</p></div><button className="primary" disabled={Boolean(schoolProvidedBlockingReason)} title={schoolProvidedBlockingReason} onClick={createPrompt}>프롬프트 생성</button></div><textarea className="prompt-output" value={active.prompt} onChange={(event) => updateSet({ prompt: event.target.value })} placeholder="프롬프트 생성 버튼을 누르세요." /><div className="button-row"><button onClick={() => void copy(active.prompt, '프롬프트를 복사했습니다.')}>프롬프트 복사</button>{mode === 'csat' && !hasProvidedPassage && <button onClick={() => void copy(generateCsatGptInstructions(), '수능형 GPT 전체 지침을 복사했습니다.')}>수능형 GPT 지침 복사</button>}<button disabled={!gptConfig[mode]} onClick={() => { if (gptConfig[mode]) { void copy(active.prompt, '프롬프트를 복사하고 전용 GPT를 열었습니다.'); window.open(gptConfig[mode], '_blank', 'noopener,noreferrer') } }}>{gptConfig[mode] ? `${MODE_LABELS[mode]} GPT 열기` : 'GPT 링크 미설정'}</button></div></section>
        <section className="editor-card"><h3>{hasProvidedPassage ? '4. 문항·정답 전용 AI JSON 가져오기' : mode === 'csat' ? '4. 일괄 문제·정답 JSON 가져오기' : '4. 문제·정답 JSON 가져오기'}</h3><p className="field-help">1차 결과에는 지문·문항·선지·정답·배점만 있으면 됩니다. 기존처럼 해설까지 포함된 JSON도 계속 가져올 수 있습니다.</p><textarea className="json-input" value={jsonInput} onChange={(event) => setJsonInput(event.target.value)} placeholder={schoolProvidedV02 ? '{"schemaId":"english-question-lab-provided-passage-generation-v0.2","mode":"school_english_provided_passage","subject":"English","sourcePassageId":"...","sourceFingerprint":"sha256:...","items":[...]}' : hasProvidedPassage ? '{"schemaId":"english-question-lab-provided-passage-generation-v0.1","mode":"school_english_provided_passage","subject":"English","sourcePassageId":"...","sourceFingerprint":"sha256:...","items":[...]}' : mode === 'csat' ? '{"title":"...","items":[{"itemId":"...","templateId":"18","variantId":"standard","material":"...","questions":[...]}]}' : '{"title":"...","material":"...","questions":[...]}'}/><button className="primary wide" onClick={importJson}>문제·정답 JSON 분석하여 가져오기</button></section>
        <section className="editor-card explanation-stage"><div className="card-title-row"><div><h3>5. 선택형 해설지 완성</h3><p>문제·정답을 먼저 완성한 뒤, 필요할 때만 해설을 별도로 생성합니다.</p></div><span className={`explanation-status ${activeExplanationStatus}`}>{EXPLANATION_STATUS_LABELS[activeExplanationStatus]}</span></div><div className="button-row"><button className="primary" disabled={activeExplanationStatus === 'not-ready'} onClick={createExplanation}>해설 제작 프롬프트 만들기</button><button disabled={!explanationPrompt} onClick={() => void copy(explanationPrompt, '해설 제작 프롬프트를 복사했습니다.')}>해설 프롬프트 복사</button><button disabled={!gptConfig[mode] || !explanationPrompt} onClick={() => { if (gptConfig[mode]) { void copy(explanationPrompt, '해설 프롬프트를 복사하고 전용 GPT를 열었습니다.'); window.open(gptConfig[mode], '_blank', 'noopener,noreferrer') } }}>전용 GPT 열기</button></div>{explanationPrompt && <textarea className="prompt-output" value={explanationPrompt} onChange={(event) => setExplanationPrompt(event.target.value)} />}<label>해설 AI 결과 JSON<small className="field-help">해설 프롬프트에 대한 JSON 결과를 붙여넣으세요. 문제·선지·정답은 수정하지 않고 해설 정보만 추가합니다.</small><textarea className="json-input" value={explanationInput} onChange={(event) => setExplanationInput(event.target.value)} placeholder='{"schemaId":"english-question-lab-explanation-v1","setId":"...","sourceRevision":1,"sourceFingerprint":"fnv1a32:...","explanations":[...]}' /></label><button className="primary wide" disabled={!explanationInput.trim()} onClick={importExplanation}>해설 JSON 분석하여 추가하기</button></section>
        <section className="editor-card"><div className="card-title-row"><div><h3>{mode === 'csat' ? '6. 최신 일괄 결과 검사와 재검토' : '6. 최신 결과 검사와 재검토'}</h3><p>현재 AI 결과 v{active.aiRevision} · 마지막 검사 v{active.validatedRevision || '-'}{activeVerificationStatus ? ` · AI 검증 ${VERIFICATION_STATUS_LABELS[activeVerificationStatus]}` : ''}</p></div><div className="button-row"><button onClick={() => { const nextIssues = validateEnglishSet(active); const next = { ...active, validatedRevision: active.aiRevision, updatedAt: new Date().toISOString() }; setIssues(nextIssues); setReviewPrompt(generateReviewPrompt(next, nextIssues)); updateSet({ validatedRevision: active.aiRevision }) }}>최신 AI 결과 검사</button>{mode === 'csat' && <button className="primary" disabled={!active.aiRevision} onClick={() => onOpenVerification?.({ scope: 'set', id: active.id })}>선택적으로 AI 검증하기</button>}</div></div>{mode === 'csat' && <p className="optional-verification-hint">별도 검증 AI는 선택 사항입니다. 실행하지 않아도 시험지 조립·인쇄·PDF 저장에 제한이 없습니다.</p>}{issues.length > 0 && <div className="validation-list">{issues.map((issue) => <article className={issue.level} key={issue.id}><strong>{issue.level === 'error' ? '오류' : issue.level === 'warning' ? '확인' : '통과'} · {issue.label}</strong><span>{issue.detail}</span></article>)}</div>}{reviewPrompt && <><textarea className="review-output" value={reviewPrompt} onChange={(event) => setReviewPrompt(event.target.value)} /><button className="wide" onClick={() => void copy(reviewPrompt, '재검토 프롬프트를 복사했습니다.')}>재검토 프롬프트 복사</button></>}</section>
        {mode !== 'csat' && <section className="editor-card"><div className="card-title-row"><div><h3>7. 이미지 자료</h3><p>파일당 3MB 이하를 권장합니다.</p></div><button onClick={() => imageInput.current?.click()}>이미지 추가</button><input ref={imageInput} type="file" accept="image/*" hidden onChange={(event) => { uploadImage(event.target.files?.[0]); event.currentTarget.value = '' }} /></div><AssetGrid assets={bundle.mediaAssets.filter((asset) => asset.setId === active.id)} updateAsset={updateAsset} removeAsset={removeAsset} /></section>}
      </section>
      <aside className="live-preview-panel"><div className="sticky-preview"><span className="eyebrow">LIVE PREVIEW</span><h3>실시간 미리보기</h3><details open><summary>현재 세트 시험지</summary><DragPreviewViewport className="live-preview-scroll" label="현재 세트 시험지 미리보기"><SetLivePreview set={active} assets={bundle.mediaAssets.filter((asset) => asset.setId === active.id)} /></DragPreviewViewport></details></div></aside>
    </>}
  </div>
}

function CsatItemsEditor({ set, items, updateItems, assets, uploadImage, updateAsset, removeAsset, notify }: { set: EnglishQuestionSet; items: CsatItemDesign[]; updateItems: (items: CsatItemDesign[]) => void; assets: MediaAsset[]; uploadImage: (file?: File, itemId?: string) => void; updateAsset: (asset: MediaAsset) => void; removeAsset: (asset: MediaAsset) => void; notify: (message: string) => void }) {
  const plannedQuestions = plannedCsatSetQuestionCount(items)
  const limitMessage = '수능형 세트는 실제 생성 문항을 최대 4개까지 만들 수 있습니다. 41~42번은 2문항, 43~45번은 3문항으로 계산합니다.'
  const addItem = () => {
    if (plannedQuestions >= MAX_CSAT_SET_QUESTIONS) { notify(limitMessage); return }
    const viewport = { left: window.scrollX, top: window.scrollY }
    updateItems([...items, createCsatItem()])
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => window.scrollTo({ ...viewport, behavior: 'auto' })))
  }
  const change = (id: string, patch: Partial<CsatItemDesign>) => {
    const current = items.find((item) => item.id === id)
    if (!current) return
    const next = { ...current, ...patch, qualityReview: undefined }
    const currentCount = plannedCsatItemQuestionCount(current)
    const nextCount = plannedCsatItemQuestionCount(next)
    const nextTotal = plannedQuestions - currentCount + nextCount
    if (nextTotal > MAX_CSAT_SET_QUESTIONS && nextCount > currentCount) { notify(limitMessage); return }
    updateItems(items.map((item) => item.id === id ? next : item))
  }
  const move = (index: number, direction: -1 | 1) => { const target = index + direction; if (target < 0 || target >= items.length) return; const next = [...items]; [next[index], next[target]] = [next[target], next[index]]; updateItems(next) }
  const duplicate = (item: CsatItemDesign) => {
    if (plannedQuestions + plannedCsatItemQuestionCount(item) > MAX_CSAT_SET_QUESTIONS) { notify(limitMessage); return }
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
    <div className="card-title-row"><div><span className="eyebrow">CSAT ITEM BUILDER</span><h3>2. 문항 설계 목록</h3><p>실제 생성 문항은 세트당 최대 4개입니다. 장문 묶음은 41~42번 2문항, 43~45번 3문항으로 계산합니다.</p></div><div className="item-count-actions"><span>{plannedQuestions} / {MAX_CSAT_SET_QUESTIONS}문항 · {items.length}카드</span><button className="primary" disabled={plannedQuestions >= MAX_CSAT_SET_QUESTIONS} onClick={addItem}>+ 문항 추가</button></div></div>
    <div className="csat-item-list">{items.map((item, index) => <CsatItemCard key={item.id} set={set} item={item} index={index} total={items.length} change={(patch) => change(item.id, patch)} move={(direction) => move(index, direction)} duplicate={() => duplicate(item)} remove={() => remove(item)} assets={assets.filter((asset) => asset.csatItemId === item.id)} uploadImage={(file) => uploadImage(file, item.id)} updateAsset={updateAsset} removeAsset={removeAsset} />)}</div>
    <button className="wide add-item-bottom" disabled={plannedQuestions >= MAX_CSAT_SET_QUESTIONS} onClick={addItem}>+ 문항 추가</button>
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
    <summary><span><b>{index + 1}</b><strong>{template ? `${template.numberLabel} · ${template.label}` : '문항 유형을 선택하세요'}</strong><small>{item.questions.length || '-'}문항 · 난이도 {englishDifficultyLabel(resolved.difficulty)}{passageRange ? ` · ${CSAT_PASSAGE_LENGTH_LABELS[passageLength]} ${passageRange.min}~${passageRange.max}단어 / 실제 ${actualWords || '-'}단어` : ''} · {qualityLabel}</small></span><span className="item-summary-actions"><button disabled={index === 0} onClick={(event) => { event.preventDefault(); move(-1) }}>위로</button><button disabled={index === total - 1} onClick={(event) => { event.preventDefault(); move(1) }}>아래로</button><button onClick={(event) => { event.preventDefault(); duplicate() }}>복제</button><button onClick={(event) => { event.preventDefault(); remove() }}>삭제</button></span></summary>
    <div className="csat-item-body">
      <div className="form-grid csat-template-selectors">
        <label>문항 대분류<small className="field-help">목적·어법·빈칸 등 만들 문제의 큰 계열을 고릅니다.</small><select value={item.familyId ?? ''} onChange={(event) => selectFamily(event.target.value as CsatQuestionFamilyId)}><option value="">선택하세요</option>{CSAT_FAMILIES.map((family) => <option value={family.id} key={family.id}>{family.label}</option>)}</select></label>
        <label>번호 템플릿<small className="field-help">평가원 번호별 발문과 고유 문제 구조를 선택합니다.</small><select value={design?.templateId ?? ''} disabled={!item.familyId} onChange={(event) => selectTemplate(event.target.value as CsatNumberTemplateId)}><option value="">선택하세요</option>{templates.map((candidate) => <option value={candidate.id} key={candidate.id}>{candidate.numberLabel} · {candidate.label}</option>)}</select></label>
        <label>출제 구조<small className="field-help">최근 기본형 또는 허용된 고급 변형을 정합니다.</small><select value={design?.variantId ?? 'standard'} disabled={!template} onChange={(event) => selectTemplate(design!.templateId, event.target.value as CsatVariantId)}><option value="standard">최근 평가원 기본형</option>{template?.variants?.map((variant) => <option value={variant.id} key={variant.id}>{variant.label}</option>)}</select></label>
        <label>지문 길이<small className="field-help">선택한 번호의 실제 기출 단어 수 범위에 맞춥니다.</small><select value={passageLength} disabled={!template} onChange={(event) => change({ passageLength: event.target.value as CsatPassageLengthPreset })}>{(['short', 'medium', 'long'] as CsatPassageLengthPreset[]).map((preset) => { const range = template ? getCsatPassageLengthRange(template.id, preset) : undefined; return <option value={preset} key={preset}>{CSAT_PASSAGE_LENGTH_LABELS[preset]}{range ? ` (${range.min}~${range.max}단어)` : ''}</option> })}</select></label>
        <label>선지 형식<small className="field-help">이 유형에서 사용하는 선지 언어와 표현 방식입니다.</small><input value={template ? choiceStyleLabel(template.choiceStyle) : '-'} readOnly /></label>
      </div>
      {design && template && <>
        <div className="item-override-panel"><h4>세트 공통값 덮어쓰기</h4><p className="hint">비워 두면 세트 공통 조건을 사용하며, 입력한 항목만 이 카드에 따로 적용됩니다.</p><div className="form-grid"><label>대상 수준<small className="field-help">이 문항만 다른 학년이나 실력대로 조정할 때 입력합니다.</small><input value={item.targetLevel ?? ''} placeholder={`공통값: ${set.targetLevel}`} onChange={(event) => change({ targetLevel: event.target.value })} /></label><label>난이도<small className="field-help">{item.difficulty === undefined ? `세트 공통값을 사용합니다: ${englishDifficultySummary('csat', set.difficulty)}` : englishDifficultySummary('csat', item.difficulty)}</small><select value={item.difficulty ?? ''} onChange={(event) => change({ difficulty: event.target.value ? Number(event.target.value) : undefined })}><option value="">공통값 ({englishDifficultyLabel(set.difficulty)})</option>{ENGLISH_DIFFICULTY_LEVELS.map((level) => <option value={level.value} key={level.value}>{level.label}</option>)}</select></label><QuickPresetField label="주제·소재" help="이 문항 지문의 중심 분야입니다. 비워 두면 공통값 또는 자동 배정값을 사용합니다." value={item.topic ?? ''} choices={ENGLISH_TOPIC_PRESETS} placeholder={set.topic ? `공통값: ${set.topic}` : '미입력 시 프롬프트 생성 때 자동 배정'} onChange={(topic) => change({ topic })} /><QuickPresetField label="출제 의도" help="이 문항에서 특별히 평가할 추론·이해 능력을 지정합니다." value={item.intention ?? ''} choices={ENGLISH_INTENTION_PRESETS} multiline placeholder={`공통값: ${set.intention || '유형에 맞게 설정'}`} onChange={(intention) => change({ intention })} /></div></div>
        <div className="form-grid"><label>자료 작성 방식<small className="field-help">새 지문 생성을 맡길지, 직접 등록한 지문으로 출제할지 정합니다.</small><select value={item.materialMode} onChange={(event) => change({ materialMode: event.target.value as 'provided' | 'generated', sourceKind: event.target.value === 'generated' ? 'generated' : 'external' })}><option value="generated">AI가 새 지문 작성</option><option value="provided">등록 지문으로 출제</option></select></label><label>자료 제목<small className="field-help">관리용 제목이며 비워 두어도 문제 생성에는 지장이 없습니다.</small><input value={item.materialTitle} onChange={(event) => change({ materialTitle: event.target.value })} /></label></div>
        <div className="csat-blueprint-grid"><section><h4>사용자 추천 입력</h4><p className="hint">선택한 번호 유형에 꼭 필요한 내용만 입력합니다. 비워 둔 항목은 AI가 다른 조건과 모순되지 않게 구성합니다.</p><div className="form-grid">{template.inputFields.map((field) => <label key={field.key}>{field.label}<small className="field-help">{field.placeholder}</small>{field.multiline ? <textarea value={design.userInputs[field.key] ?? ''} placeholder={field.placeholder} onChange={(event) => updateDesign({ userInputs: { ...design.userInputs, [field.key]: event.target.value } })} /> : <input value={design.userInputs[field.key] ?? ''} placeholder={field.placeholder} onChange={(event) => updateDesign({ userInputs: { ...design.userInputs, [field.key]: event.target.value } })} />}</label>)}</div></section><section className="structure-panel"><h4>지문 형식과 구조</h4><span className="genre-chip">{template.passageGenre}</span><ol>{template.structureSteps.map((step) => <li key={step}>{step}</li>)}</ol><label>지문 설계 메모<small className="field-help">전개 순서, 반드시 포함할 사례나 피할 표현을 자유롭게 적습니다.</small><textarea value={design.passagePlan} onChange={(event) => updateDesign({ passagePlan: event.target.value })} /></label><div className="fixed-question-plan"><strong>고정 문항</strong>{item.questions.map((question) => <span key={question.id}>{question.csatSlot ?? question.type} · {question.type} · {question.score ?? 2}점</span>)}</div></section></div>
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
            <div className="quality-question-list">{item.qualityReview.questions.map((review, reviewIndex) => <article key={`${review.slot}-${reviewIndex}`}><header><strong>{review.slot || `${reviewIndex + 1}번 문항`}</strong><span>예상 난도 {review.expectedDifficulty === undefined ? '-' : englishDifficultyLabel(review.expectedDifficulty)}</span></header><div className="quality-score-grid"><span>정답 추론성 <b>{review.answerInference ?? '-'}</b>/10</span><span>오답 매력도 <b>{review.distractorPlausibility ?? '-'}</b>/10</span><span>선지 균형 <b>{review.choiceBalance ?? '-'}</b>/10</span></div><p><b>가장 강력한 오답</b> {review.strongestDistractorIndex ? `${review.strongestDistractorIndex}번` : '미기록'} · 정답 직접 재현 {review.directAnswerOverlap === undefined ? '미검수' : review.directAnswerOverlap ? '있음' : '없음'}</p><p><b>결정적 구분 근거</b> {review.decisiveReason || '미기록'}</p></article>)}</div>
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
      <div className="form-grid"><label>문항 유형<small className="field-help">학생에게 요구할 풀이 방식과 문제 구조를 정합니다. 유형을 바꾸면 기본 발문과 선지 조판도 함께 바뀝니다.</small><select value={question.type} disabled={locked} onChange={(event) => { const type = event.target.value; const template = set.mode === 'school' ? SCHOOL_QUESTION_TEMPLATES.find((candidate) => candidate.questionType === type) : undefined; updateQuestion(question.id, { type, stem: defaultQuestionStem(type), schoolTemplateId: template?.id, schoolChoiceLayout: template?.choiceLayout }) }}>{locked ? <option>{question.type}</option> : questionTypesFor(set.mode).map((type) => <option key={type}>{type}</option>)}</select></label><label>배점<small className="field-help">시험지에 표시할 문항 점수입니다. 소수 배점도 사용할 수 있습니다.</small><input type="number" min="0.1" max="100" step="0.1" value={question.score ?? 2} onChange={(event) => updateQuestion(question.id, { score: Number(event.target.value) })} /></label>{set.mode === 'school' && <label>선지 표시<small className="field-help">자동은 선지 길이에 따라 한 줄·세로형을 결정합니다. 조합형은 표 형태가 적합합니다.</small><select value={question.schoolChoiceLayout ?? inferSchoolQuestionTemplate(question).choiceLayout} onChange={(event) => updateQuestion(question.id, { schoolChoiceLayout: event.target.value as EnglishQuestion['schoolChoiceLayout'] })}><option value="auto">길이에 따라 자동</option><option value="inline">짧은 선지 · 한 줄/복수 열</option><option value="vertical">긴 선지 · 세로형</option><option value="matrix">조합형 · 표 형태</option></select></label>}</div>
      <label>발문<small className="field-help">시험지에서 학생이 실제로 읽는 질문 문장입니다.</small><textarea value={question.stem} onChange={(event) => updateQuestion(question.id, { stem: event.target.value })} /></label>
      {inlinePosition ? <p className="inline-position-note">이 유형은 별도의 내용 선지를 작성하지 않습니다. 정답은 지문 안 ①~⑤ 위치 중에서 선택합니다.</p> : <>{embeddedChartChoices && <p className="inline-position-note">25번형의 각 칸에는 번호를 제외한 영어 완전문장을 입력하세요. 시험지에서는 도표 아래 설명문에 ①~⑤ 진술로 이어서 표시됩니다.</p>}<div className="choice-grid">{question.choices.map((choice, choiceIndex) => <label key={choiceIndex}><span>{embeddedChartChoices ? ['①', '②', '③', '④', '⑤'][choiceIndex] : choiceIndex + 1}</span><input value={choice} placeholder={embeddedChartChoices ? '지문 속 영어 진술' : '비워두면 AI가 작성'} onChange={(event) => { const choices = [...question.choices]; choices[choiceIndex] = event.target.value; updateQuestion(question.id, { choices }) }} /></label>)}</div></>}
      <div className="form-grid"><label>정답 번호<small className="field-help">현재 선지 또는 지문 위치 중 유일한 정답을 선택합니다.</small><select value={question.answerIndex} onChange={(event) => updateQuestion(question.id, { answerIndex: Number(event.target.value) })}>{question.choices.map((_, choiceIndex) => <option value={choiceIndex + 1} key={choiceIndex}>{inlinePosition ? `지문 위치 ${choiceIndex + 1}` : embeddedChartChoices ? `지문 속 ${['①', '②', '③', '④', '⑤'][choiceIndex]}` : `${choiceIndex + 1}번`}</option>)}</select></label><label>문항별 출제 의도<small className="field-help">이 문항이 평가하는 구체적인 사고 능력을 기록합니다.</small><input value={question.intention} onChange={(event) => updateQuestion(question.id, { intention: event.target.value })} /></label></div>
      <label>상세 해설<small className="field-help">정답이 되는 이유와 필요한 독해 과정을 설명합니다.</small><textarea value={question.explanation} onChange={(event) => updateQuestion(question.id, { explanation: event.target.value })} /></label>
      <div className="form-grid"><label>정답 근거 <small className="field-help">지문에서 정답을 확정하는 문장이나 정보를 한 줄에 하나씩 적습니다.</small><textarea value={question.evidenceRefs.join('\n')} onChange={(event) => updateQuestion(question.id, { evidenceRefs: event.target.value.split('\n').map((item) => item.trim()).filter(Boolean) })} /></label><label>오답 오류 근거 <small className="field-help">각 오답이 틀린 이유를 선지 순서에 맞춰 한 줄씩 적습니다.</small><textarea value={question.distractorReasons.join('\n')} onChange={(event) => updateQuestion(question.id, { distractorReasons: event.target.value.split('\n').map((item) => item.trim()).filter(Boolean) })} /></label></div>
    </div>
  </details>
}

function createExam(preset: LayoutPreset = 'school'): EnglishExamDocument {
  const now = new Date().toISOString()
  return { id: crypto.randomUUID(), title: '새 영어 시험지', setIds: [], contentEntries: [], layout: createExamLayout(preset), setOverrides: {}, entryOverrides: {}, createdAt: now, updatedAt: now }
}

function ExamAssembly({ bundle, setBundle, notify }: Props) {
  const [activeId, setActiveId] = useState(bundle.exams[0]?.id ?? '')
  const [selectedExamIds, setSelectedExamIds] = useState<string[]>([])
  const storedActive = bundle.exams.find((exam) => exam.id === activeId)
  const active = useMemo(() => storedActive ? normalizeExamDocument(storedActive, bundle.questionSets) : undefined, [storedActive, bundle.questionSets])
  const activeRef = useRef(active)
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve())
  activeRef.current = active
  useEffect(() => { if (!active && bundle.exams[0]) setActiveId(bundle.exams[0].id) }, [active, bundle.exams])
  useEffect(() => { setSelectedExamIds((current) => current.filter((id) => bundle.exams.some((exam) => exam.id === id))) }, [bundle.exams])
  const previewExam = useDeferredValue(active)
  const previewOrderKey = useMemo(() => previewExam ? `${previewExam.id}:${(previewExam.contentEntries ?? []).map((entry) => entry.id).join('|')}` : 'empty', [previewExam])
  const selectedSets = useMemo(() => (previewExam ? examSetIds(previewExam) : []).map((id) => bundle.questionSets.find((set) => set.id === id)).filter((set): set is EnglishQuestionSet => Boolean(set)), [previewExam, bundle.questionSets])
  const resolvedEntries = useMemo(() => active ? resolveExamEntries(active, bundle.questionSets) : [], [active, bundle.questionSets])
  const grammarItem = resolvedEntries.find(({ csatItem }) => csatItem?.design?.templateId === '29')?.csatItem
  const vocabularyItem = resolvedEntries.find(({ csatItem }) => csatItem?.design?.templateId === '30')?.csatItem
  const grammarVocabularyScore = (grammarItem?.questions[0]?.score ?? 0) + (vocabularyItem?.questions[0]?.score ?? 0)
  useEffect(() => {
    if (grammarItem && vocabularyItem && grammarVocabularyScore !== 5) notify(`29번 어법과 30번 어휘의 배점 합은 5점을 권장합니다. 현재 ${grammarVocabularyScore}점입니다.`)
  }, [grammarItem?.id, vocabularyItem?.id, grammarVocabularyScore])
  const addExam = () => { const next = createExam(preferredExamPresetForSets(bundle.questionSets)); setBundle((value) => ({ ...value, exams: [next, ...value.exams] })); setActiveId(next.id); persistLocally(saveExamDocument(next), '새 시험지', notify) }
  const queueExamSave = (next: EnglishExamDocument) => {
    saveQueueRef.current = saveQueueRef.current
      .catch(() => undefined)
      .then(() => saveExamDocument(next))
      .catch(() => notify('시험지 변경 사항을 로컬 저장소에 반영하지 못했습니다. JSON 백업을 저장해 주세요.'))
  }
  const updateExam = (change: Partial<EnglishExamDocument> | ((current: EnglishExamDocument) => Partial<EnglishExamDocument> | null)) => {
    const current = activeRef.current
    if (!current) return
    const patch = typeof change === 'function' ? change(current) : change
    if (!patch) return
    const next = normalizeExamDocument({ ...current, ...patch, updatedAt: new Date().toISOString() }, bundle.questionSets)
    activeRef.current = next
    setBundle((value) => ({ ...value, exams: value.exams.map((exam) => exam.id === next.id ? next : exam) }))
    queueExamSave(next)
  }
  const updateLayout = (patch: Partial<ExamLayoutSettings>) => updateExam((current) => ({ layout: { ...current.layout, ...patch } }))
  const updateSchoolExamHeader = (patch: Partial<NonNullable<ExamLayoutSettings['schoolExamHeader']>>) => updateExam((current) => ({ layout: { ...current.layout, schoolExamHeader: { subjectName: '영어', subjectCode: '', examSession: '', authorName: '', showApprovalGrid: true, ...(current.layout.schoolExamHeader ?? {}), ...patch } } }))
  const layoutForAddedContent = (current: EnglishExamDocument, set: EnglishQuestionSet, contentEntries: ExamContentEntry[]) => {
    const next = layoutForFirstSelectedSet(current.layout, set, Boolean(current.contentEntries?.length) || contentEntries.length === 0)
    if (next !== current.layout) notify('첫 수능형 세트를 추가하여 시험지 기본 양식을 수능형으로 설정했습니다.')
    return next
  }
  const toggleSet = (set: EnglishQuestionSet) => {
    const candidates = contentEntriesForSet(set)
    updateExam((currentExam) => {
      const current = currentExam.contentEntries ?? []
      const allIncluded = candidates.every((candidate) => current.some((entry) => entry.id === candidate.id))
      const contentEntries = allIncluded ? current.filter((entry) => entry.setId !== set.id) : [...current, ...candidates.filter((candidate) => !current.some((entry) => entry.id === candidate.id))]
      return { contentEntries, setIds: [...new Set(contentEntries.map((entry) => entry.setId))], layout: layoutForAddedContent(currentExam, set, contentEntries) }
    })
  }
  const toggleEntry = (entry: ExamContentEntry) => {
    updateExam((currentExam) => {
      const current = currentExam.contentEntries ?? []
      const contentEntries = current.some((candidate) => candidate.id === entry.id) ? current.filter((candidate) => candidate.id !== entry.id) : [...current, entry]
      const set = bundle.questionSets.find((candidate) => candidate.id === entry.setId)
      return { contentEntries, setIds: [...new Set(contentEntries.map((candidate) => candidate.setId))], layout: set ? layoutForAddedContent(currentExam, set, contentEntries) : currentExam.layout }
    })
  }
  const move = (entryId: string, direction: -1 | 1) => updateExam((current) => {
    const entries = current.contentEntries ?? []
    const next = moveExamContentEntry(entries, entryId, direction)
    return next === entries ? null : { contentEntries: next }
  })
  const updateOverride = (entryId: string, patch: Partial<SetLayoutOverride>) => updateExam((current) => ({ entryOverrides: { ...(current.entryOverrides ?? {}), [entryId]: { ...(current.entryOverrides?.[entryId] ?? {}), ...patch } } }))
  const clearExamEntries = () => {
    if (!active || !window.confirm('현재 시험지에서 조립한 문항만 모두 뺄까요? 세트 원본은 삭제되지 않습니다.')) return
    updateExam({ contentEntries: [], setIds: [], entryOverrides: {} })
    notify('현재 시험지의 조립 목록을 비웠습니다. 세트 원본은 그대로 유지됩니다.')
  }
  const deleteAllExams = () => {
    const ids = bundle.exams.map((exam) => exam.id)
    if (!ids.length || !window.confirm(`저장된 시험지 ${ids.length}개를 모두 삭제할까요? 문제 세트 원본은 삭제되지 않습니다.`)) return
    setBundle((value) => ({ ...value, exams: [] }))
    setActiveId('')
    persistLocally(deleteExamDocuments(ids), '시험지 일괄 삭제', notify)
    notify(`시험지 ${ids.length}개를 모두 삭제했습니다. 문제 세트는 그대로 유지됩니다.`)
  }
  const toggleExamForDeletion = (examId: string) => setSelectedExamIds((current) => current.includes(examId) ? current.filter((id) => id !== examId) : [...current, examId])
  const deleteSelectedExams = () => {
    if (!selectedExamIds.length || !window.confirm(`선택한 시험지 ${selectedExamIds.length}개를 삭제할까요? 문제 세트 원본은 삭제되지 않습니다.`)) return
    const selected = new Set(selectedExamIds)
    const remaining = bundle.exams.filter((exam) => !selected.has(exam.id))
    setBundle((value) => ({ ...value, exams: value.exams.filter((exam) => !selected.has(exam.id)) }))
    if (selected.has(activeId)) setActiveId(remaining[0]?.id ?? '')
    persistLocally(deleteExamDocuments(selectedExamIds), '선택 시험지 삭제', notify)
    notify(`선택한 시험지 ${selectedExamIds.length}개를 삭제했습니다. 문제 세트는 그대로 유지됩니다.`)
    setSelectedExamIds([])
  }

  if (!active) return <section className="empty-editor"><h2>시험지 조립</h2><p>내신형·수능형·맞춤설정형 세트를 한 시험지에 자유롭게 섞을 수 있습니다.</p><button className="primary" onClick={addExam}>첫 시험지 만들기</button></section>
  return <div className="assembly-layout"><section className="assembly-editor">
    <div className="editor-title"><div><span className="eyebrow">MIXED EXAM BUILDER</span><h2>시험지 조립과 양식 설정</h2></div><button className="primary" onClick={addExam}>+ 새 시험지</button></div>
    <details className="exam-delete-picker"><summary>삭제할 시험지 직접 선택 <span>{selectedExamIds.length ? `${selectedExamIds.length}개 선택됨` : '여러 개 선택 가능'}</span></summary><div className="exam-delete-picker-toolbar"><button type="button" onClick={() => setSelectedExamIds(bundle.exams.map((exam) => exam.id))}>전체 선택</button><button type="button" disabled={!selectedExamIds.length} onClick={() => setSelectedExamIds([])}>선택 해제</button><button type="button" className="danger" disabled={!selectedExamIds.length} onClick={deleteSelectedExams}>선택한 시험지 삭제 ({selectedExamIds.length})</button></div><div className="exam-delete-list">{bundle.exams.map((exam, index) => <label className="exam-delete-item" key={exam.id}><input type="checkbox" checked={selectedExamIds.includes(exam.id)} onChange={() => toggleExamForDeletion(exam.id)} /><span><strong>{index + 1}. {exam.title}</strong><small>{exam.id === activeId ? '현재 편집 중 · ' : ''}{new Date(exam.updatedAt).toLocaleString('ko-KR')}</small></span></label>)}</div></details>
    <section className="editor-card"><h3>시험지 기본 정보</h3><div className="form-grid"><label>시험지 선택<select value={activeId} onChange={(event) => setActiveId(event.target.value)}>{bundle.exams.map((exam) => <option value={exam.id} key={exam.id}>{exam.title}</option>)}</select></label><label>시험지 제목<input value={active.title} onChange={(event) => updateExam({ title: event.target.value })} /></label><label>학교·기관명<input value={active.layout.institution} onChange={(event) => updateLayout({ institution: event.target.value })} /></label><label>학년·반 표기<input value={active.layout.gradeLabel} onChange={(event) => updateLayout({ gradeLabel: event.target.value })} /></label><label>날짜<input value={active.layout.dateLabel} onChange={(event) => updateLayout({ dateLabel: event.target.value })} /></label><label>꼬리말<input value={active.layout.footerText} onChange={(event) => updateLayout({ footerText: event.target.value })} /></label></div>{active.layout.preset === 'school-exam' && <div className="form-grid school-exam-header-fields"><label>과목명<input value={active.layout.schoolExamHeader?.subjectName ?? '영어'} onChange={(event) => updateSchoolExamHeader({ subjectName: event.target.value })} /></label><label>과목 코드<input value={active.layout.schoolExamHeader?.subjectCode ?? ''} placeholder="예: ENG101" onChange={(event) => updateSchoolExamHeader({ subjectCode: event.target.value })} /></label><label>시행일·교시<input value={active.layout.schoolExamHeader?.examSession ?? ''} placeholder="예: 2026. 8. 17. 2교시" onChange={(event) => updateSchoolExamHeader({ examSession: event.target.value })} /></label><label>출제자<input value={active.layout.schoolExamHeader?.authorName ?? ''} onChange={(event) => updateSchoolExamHeader({ authorName: event.target.value })} /></label><label className="check-label"><input type="checkbox" checked={active.layout.schoolExamHeader?.showApprovalGrid ?? true} onChange={(event) => updateSchoolExamHeader({ showApprovalGrid: event.target.checked })} /> 검토·결재 칸 표시</label></div>}</section>
    <section className="editor-card"><h3>시험지 기본 양식</h3><div className="form-grid"><label>양식 프리셋<select value={active.layout.preset} onChange={(event) => { const preset = event.target.value as LayoutPreset; const selected = LAYOUT_PRESETS[preset]; updateExam({ layout: { ...selected, schoolExamHeader: selected.schoolExamHeader ? { ...selected.schoolExamHeader, ...(active.layout.schoolExamHeader ?? {}) } : undefined, institution: active.layout.institution, gradeLabel: active.layout.gradeLabel, dateLabel: active.layout.dateLabel } }) }}><option value="csat">수능형</option><option value="school">학교형</option><option value="school-exam">학교형-2단 시험</option><option value="worksheet">워크시트형</option><option value="custom">사용자 설정형</option></select></label><label>문제지 칼럼<select value={active.layout.columns} onChange={(event) => updateLayout({ columns: Number(event.target.value) as 1 | 2 })}><option value={1}>1단</option><option value={2}>2단</option></select></label><label>해설지 칼럼<select value={active.layout.answerColumns} onChange={(event) => updateLayout({ answerColumns: Number(event.target.value) as 1 | 2 })}><option value={1}>1단</option><option value={2}>2단</option></select></label><NumberField label="글자 크기(pt)" value={active.layout.fontSize} step={0.1} onChange={(fontSize) => updateLayout({ fontSize })} /><NumberField label="줄 간격" value={active.layout.lineHeight} step={0.05} onChange={(lineHeight) => updateLayout({ lineHeight })} /><NumberField label="문항 간격(mm)" value={active.layout.questionGap} onChange={(questionGap) => updateLayout({ questionGap })} /><NumberField label="위 여백(mm)" value={active.layout.marginTop} onChange={(marginTop) => updateLayout({ marginTop })} /><NumberField label="오른쪽 여백(mm)" value={active.layout.marginRight} onChange={(marginRight) => updateLayout({ marginRight })} /><NumberField label="아래 여백(mm)" value={active.layout.marginBottom} onChange={(marginBottom) => updateLayout({ marginBottom })} /><NumberField label="왼쪽 여백(mm)" value={active.layout.marginLeft} onChange={(marginLeft) => updateLayout({ marginLeft })} /><label className="check-label"><input type="checkbox" checked={active.layout.passageBorder} onChange={(event) => updateLayout({ passageBorder: event.target.checked })} /> 지문 테두리</label><label className="check-label"><input type="checkbox" checked={active.layout.showPageNumbers} onChange={(event) => updateLayout({ showPageNumbers: event.target.checked })} /> 페이지 번호</label></div></section>
    <section className="editor-card"><h3>세트 전체 추가 후 문항별 조정</h3><div className="assembly-set-grid">{bundle.questionSets.map((set) => { const candidates = contentEntriesForSet(set); const included = candidates.filter((candidate) => active.contentEntries?.some((entry) => entry.id === candidate.id)).length; return <details className={included ? 'selected' : ''} key={set.id}><summary><label onClick={(event) => event.stopPropagation()}><input type="checkbox" checked={included === candidates.length && included > 0} onChange={() => toggleSet(set)} /><span><strong>{set.title}</strong><small>{MODE_LABELS[set.mode]} · {allSetQuestions(set).length}문항 {included > 0 && included < candidates.length ? `· 일부 ${included}/${candidates.length}` : ''}</small></span></label>{set.mode === 'csat' && <span className="assembly-detail-toggle">문항별 선택</span>}</summary>{set.mode === 'csat' && <div className="assembly-item-checks">{candidates.map((entry, index) => { const item = getCsatItems(set)[index]; const template = item.design ? getCsatTemplate(item.design.templateId) : undefined; return <label key={entry.id}><input type="checkbox" checked={active.contentEntries?.some((candidate) => candidate.id === entry.id) ?? false} onChange={() => toggleEntry(entry)} /><span>{index + 1}. {template ? `${template.numberLabel} · ${template.label}` : '미설정 카드'} ({item.questions.length}문항)</span></label> })}</div>}</details> })}</div></section>
    <section className="editor-card"><h3>시험 순서와 문항별 양식</h3><div className="set-order-list">{resolvedEntries.map(({ entry, set, csatItem }, index) => { const override = active.entryOverrides?.[entry.id] ?? {}; const template = csatItem?.design ? getCsatTemplate(csatItem.design.templateId) : undefined; return <details key={entry.id}><summary><span><strong>{index + 1}. {template ? `${template.numberLabel} · ${template.label}` : set.title}</strong><small>{set.title} · {csatItem?.questions.length ?? set.questions.length}문항</small></span><span><button type="button" disabled={index === 0} onClick={(event) => { event.preventDefault(); event.stopPropagation(); move(entry.id, -1) }}>위로</button><button type="button" disabled={index === resolvedEntries.length - 1} onClick={(event) => { event.preventDefault(); event.stopPropagation(); move(entry.id, 1) }}>아래로</button><button type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); toggleEntry(entry) }}>제외</button></span></summary><div className="override-grid"><label>시작 위치<select value={override.breakBefore ?? 'auto'} onChange={(event) => updateOverride(entry.id, { breakBefore: event.target.value as SetLayoutOverride['breakBefore'] })}><option value="auto">자동</option><option value="column">다음 칼럼</option><option value="page">다음 페이지</option></select></label><label>칼럼<select value={override.columns ?? 0} onChange={(event) => updateOverride(entry.id, { columns: Number(event.target.value) === 0 ? undefined : Number(event.target.value) as 1 | 2 })}><option value={0}>시험지 기본값</option><option value={1}>1단</option><option value={2}>2단</option></select></label><NumberField label="글자 배율" value={override.fontScale ?? 1} step={0.05} onChange={(fontScale) => updateOverride(entry.id, { fontScale })} /><NumberField label="줄 간격" value={override.lineHeight ?? active.layout.lineHeight} step={0.05} onChange={(lineHeight) => updateOverride(entry.id, { lineHeight })} /><label className="check-label"><input type="checkbox" checked={override.passageBorder ?? active.layout.passageBorder} onChange={(event) => updateOverride(entry.id, { passageBorder: event.target.checked })} /> 지문 테두리</label><label className="check-label"><input type="checkbox" checked={override.keepMaterialWithFirst ?? true} onChange={(event) => updateOverride(entry.id, { keepMaterialWithFirst: event.target.checked })} /> 지문과 첫 문항 묶기</label><label className="check-label"><input type="checkbox" checked={override.keepQuestions ?? true} onChange={(event) => updateOverride(entry.id, { keepQuestions: event.target.checked })} /> 문항 선지 묶기</label></div></details> })}</div></section>
    <div className="button-row exam-delete-actions"><button className="danger" onClick={() => { if (!window.confirm('이 시험지를 삭제할까요?')) return; setBundle((value) => ({ ...value, exams: value.exams.filter((exam) => exam.id !== active.id) })); persistLocally(deleteExamDocument(active.id), '시험지 삭제', notify); notify('시험지를 삭제했습니다.') }}>현재 시험지 삭제</button><button className="danger" onClick={deleteAllExams}>전체 시험지 일괄 삭제 ({bundle.exams.length})</button></div>
  </section><aside className="assembly-preview"><div className="sticky-preview"><span className="eyebrow">LIVE EXAM PREVIEW</span><h3>양식 실시간 미리보기</h3><AssemblyPreviewBoundary resetKey={previewOrderKey} onCreateExam={addExam} onClearExam={clearExamEntries}>{previewExam && selectedSets.length ? <DragPreviewViewport className="scaled-paper" label="시험지 조립 미리보기"><ExamQuestionPages key={previewOrderKey} exam={previewExam} sets={selectedSets} assets={bundle.mediaAssets} /></DragPreviewViewport> : <div className="empty-state">세트를 선택하면 시험지가 바로 표시됩니다.</div>}</AssemblyPreviewBoundary></div></aside></div>
}

function NumberField({ label, value, step = 1, onChange }: { label: string; value: number; step?: number; onChange: (value: number) => void }) {
  return <label>{label}<input type="number" step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>
}

function ExamPreview({ bundle, notify }: Props) {
  const [activeId, setActiveId] = useState(bundle.exams[0]?.id ?? '')
  const [sheet, setSheet] = useState<'questions' | 'answers' | 'solutions'>('questions')
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
    try {
      const { downloadExamPagesPdf, makeExamPdfFilename } = await import('./pdfExport')
      await downloadExamPagesPdf(pages, makeExamPdfFilename(active.title, sheet)); notify('PDF 파일을 저장했습니다.')
    }
    catch { notify('PDF 저장에 실패했습니다.') }
    finally { setSaving(false) }
  }
  if (!active) return <section className="empty-editor"><h2>인쇄 미리보기</h2><p>먼저 시험지 조립에서 시험지를 만드세요.</p></section>
  return <section className="preview-screen"><div className="preview-toolbar"><label>시험지<select value={active.id} onChange={(event) => setActiveId(event.target.value)}>{bundle.exams.map((exam) => <option value={exam.id} key={exam.id}>{exam.title}</option>)}</select></label><div className="segmented"><button className={sheet === 'questions' ? 'active' : ''} onClick={() => setSheet('questions')}>문제지</button><button className={sheet === 'answers' ? 'active' : ''} onClick={() => setSheet('answers')}>정답지</button><button className={sheet === 'solutions' ? 'active' : ''} onClick={() => setSheet('solutions')}>정답·해설지</button></div><div className="button-row"><button disabled={!sets.length || !!layoutIssues.length} onClick={() => window.print()}>인쇄</button><button className="primary" disabled={!sets.length || saving || !!layoutIssues.length} onClick={() => void savePdf()}>{saving ? 'PDF 만드는 중…' : 'PDF 저장'}</button></div></div>{layoutIssues.length > 0 && <div className="export-blocker"><strong>한 칸보다 긴 문항이 있어 내보낼 수 없습니다.</strong><ul>{layoutIssues.map((issue) => <li key={issue}>{issue}</li>)}</ul></div>}{!sets.length ? <div className="empty-editor">시험지에 세트를 추가해 주세요.</div> : <div className="preview-page-stack">{sheet === 'questions' ? <ExamQuestionPages exam={active} sets={sets} assets={bundle.mediaAssets} onLayoutIssuesChange={setLayoutIssues} /> : <ExamAnswerPages exam={active} sets={sets} sheet={sheet} />}</div>}</section>
}
