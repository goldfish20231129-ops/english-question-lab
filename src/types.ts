export type EnglishMode = 'school' | 'csat' | 'custom'
export type MaterialMode = 'provided' | 'generated'
export type SourceKind = 'textbook' | 'supplement' | 'external' | 'generated' | 'custom'
export type ValidationLevel = 'error' | 'warning' | 'pass'
export type StudioScreen = 'sets' | 'verification' | 'assembly' | 'preview'
export type LayoutPreset = 'csat' | 'school' | 'school-exam' | 'worksheet' | 'custom'

export type SchoolQuestionTemplateId =
  | 'content-match' | 'content-inference' | 'topic' | 'gist' | 'implication' | 'blank'
  | 'grammar-error' | 'grammar-combination' | 'vocabulary-context' | 'irrelevant'
  | 'order' | 'insertion' | 'summary' | 'multi-blank' | 'word-bank'
export type SchoolChoiceLayout = 'auto' | 'inline' | 'vertical' | 'matrix'
export type SchoolInsertionPresentation = 'isolated' | 'shared'

export type CsatQuestionFamilyId =
  | 'purpose' | 'emotion' | 'claim' | 'gist' | 'topic' | 'title' | 'implication'
  | 'content-detail' | 'chart-practical' | 'grammar' | 'vocabulary' | 'blank'
  | 'irrelevant' | 'order' | 'insertion' | 'summary' | 'long-reading'

export type CsatNumberTemplateId =
  | '18' | '19' | '20' | '21' | '22' | '23' | '24' | '25' | '26' | '27' | '28'
  | '29' | '30' | '31' | '32' | '33' | '34' | '35' | '36' | '37' | '38' | '39' | '40'
  | '41-42' | '43-45'

export type CsatVariantId =
  | 'standard' | 'vocabulary-box' | 'long-order-content' | 'long-implication-blank'
  | 'narrative-emotion-implication-blank'
export type CsatChoiceStyle = 'korean' | 'english' | 'emotion-pair' | 'position' | 'order' | 'word-pair'
export type CsatPassageLengthPreset = 'short' | 'medium' | 'long'
export type ProvidedPassageQuestionType = 'content_match' | 'sentence_insertion'
export type ProvidedPassageChoiceLanguage = 'ko' | 'en'
export type ProvidedPassageVocabularyLevel = 'source_matched' | 'grade_1' | 'grade_2' | 'grade_3_csat'
export type ProvidedPassageContentPolarity = 'match' | 'mismatch'

export interface ProvidedPassageSentence {
  id: string
  start: number
  end: number
  text: string
}

export interface ProvidedPassageBoundary {
  id: string
  offset: number
  beforeSentenceId?: string
  afterSentenceId?: string
}

export interface ProvidedPassageEvidenceSpan {
  sentenceId: string
  start: number
  end: number
  text: string
}

export interface ProvidedPassageInsertionOperation {
  kind: 'insert_sentence'
  generatedSentence: string
  candidateBoundaryIds: string[]
  answerBoundaryId: string
  positionReasons: Array<{ boundaryId: string; reason: string }>
  beforeEvidence: ProvidedPassageEvidenceSpan
  afterEvidence: ProvidedPassageEvidenceSpan
  lexicalLevel: ProvidedPassageVocabularyLevel
}

export interface ProvidedPassageGenerationResult {
  schemaId: 'english-question-lab-provided-passage-generation-v0.1'
  evidenceSpans: ProvidedPassageEvidenceSpan[]
  materialOperation: ProvidedPassageInsertionOperation | null
}

export interface ProvidedPassageState {
  version: '0.1'
  sourcePassageId: string
  sourceFingerprint: string
  originalText: string
  normalizedForFingerprint: string
  sentences: ProvidedPassageSentence[]
  boundaries: ProvidedPassageBoundary[]
  questionType: ProvidedPassageQuestionType
  choiceLanguage: ProvidedPassageChoiceLanguage
  vocabularyLevel: ProvidedPassageVocabularyLevel
  contentMatchPolarity: ProvidedPassageContentPolarity
  result?: ProvidedPassageGenerationResult
}

export type ProvidedPassageV02QuestionType = 'content_match' | 'content_inference' | 'sentence_insertion' | 'grammar'
export type ProvidedPassageGrammarTarget =
  | 'relative_clause' | 'appositive_that' | 'subject_verb_agreement' | 'participle_clause'
  | 'nonrestrictive_relative' | 'pronoun_agreement' | 'dummy_it' | 'cleft_it_that'
export type ProvidedPassageGrammarMode = 'source_form_check' | 'controlled_error_variant'

export interface ProvidedPassageV02ItemPlan {
  itemId: string
  questionType: ProvidedPassageV02QuestionType
  choiceLanguage: ProvidedPassageChoiceLanguage | null
  vocabularyLevel: ProvidedPassageVocabularyLevel
  contentMatchPolarity: ProvidedPassageContentPolarity | null
  grammarTarget: ProvidedPassageGrammarTarget | null
  grammarMode: ProvidedPassageGrammarMode | null
}

export interface ProvidedPassageGrammarOperation {
  kind: 'grammar_check'
  grammarTarget: ProvidedPassageGrammarTarget
  grammarMode: ProvidedPassageGrammarMode
  testedSpan: ProvidedPassageEvidenceSpan
  sourceForm: string
  presentedForm: string
  ruleCheck: {
    classification: ProvidedPassageGrammarTarget
    decisionRule: string
    contrastWith: string
    isUniquelyDetermined: boolean
  }
  sourceTextModified: false
}

export type ProvidedPassageV02MaterialOperation = ProvidedPassageInsertionOperation | ProvidedPassageGrammarOperation | null

export interface ProvidedPassageV02ItemResult {
  itemId: string
  evidenceSpans: ProvidedPassageEvidenceSpan[]
  materialOperation: ProvidedPassageV02MaterialOperation
}

export interface ProvidedPassageV02State {
  version: '0.2'
  sourcePassageId: string
  sourceFingerprint: string
  originalText: string
  normalizedForFingerprint: string
  sentences: ProvidedPassageSentence[]
  boundaries: ProvidedPassageBoundary[]
  itemPlans: ProvidedPassageV02ItemPlan[]
  results?: ProvidedPassageV02ItemResult[]
  importWarnings?: string[]
}

export interface CsatPassageQualityReview {
  naturalness?: number
  logicStructure?: number
  vocabularyLevel?: number
  templateFidelity?: number
}

export interface CsatQuestionQualityReview {
  slot: string
  answerInference?: number
  distractorPlausibility?: number
  choiceBalance?: number
  directAnswerOverlap?: boolean
  strongestDistractorIndex?: number
  decisiveReason?: string
  expectedDifficulty?: number
}

export interface CsatQualityReview {
  passage: CsatPassageQualityReview
  questions: CsatQuestionQualityReview[]
}

export interface CsatInputFieldDefinition {
  key: string
  label: string
  placeholder: string
  multiline?: boolean
}

export interface CsatQuestionBlueprint {
  slot: string
  type: string
  stem: string
  score: number
  choiceStyle: CsatChoiceStyle
}

export interface CsatVariantDefinition {
  id: CsatVariantId
  label: string
  description: string
}

export interface CsatTemplateDefinition {
  id: CsatNumberTemplateId
  familyId: CsatQuestionFamilyId
  numberLabel: string
  label: string
  difficultyRange: [number, number]
  defaultDifficulty: number
  choiceStyle: CsatChoiceStyle
  passageGenre: string
  passageBlueprint: string
  structureSteps: string[]
  inputFields: CsatInputFieldDefinition[]
  questions: CsatQuestionBlueprint[]
  requiredMarkers: string[]
  variants?: CsatVariantDefinition[]
}

export interface CsatDesignSpec {
  familyId: CsatQuestionFamilyId
  templateId: CsatNumberTemplateId
  variantId: CsatVariantId
  userInputs: Record<string, string>
  passagePlan: string
}

export interface CsatItemDesign {
  id: string
  familyId?: CsatQuestionFamilyId
  design?: CsatDesignSpec
  targetLevel?: string
  difficulty?: number
  topic?: string
  intention?: string
  materialMode: MaterialMode
  sourceKind: SourceKind
  materialTitle: string
  material: string
  materialSpec?: CsatMaterialSpec
  questions: EnglishQuestion[]
  passageLength?: CsatPassageLengthPreset
  qualityReview?: CsatQualityReview
}

export type CsatMaterialSpec =
  | { kind: 'prose'; paragraphs: string[] }
  | { kind: 'chart'; title: string; unit: string; categories: string[]; series: Array<{ name: string; values: number[] }> }
  | { kind: 'practical'; heading: string; fields: Record<string, string>; notes: string[] }
  | { kind: 'ordered'; lead: string; sections: Array<{ label: 'A' | 'B' | 'C'; text: string }> }
  | { kind: 'insertion'; givenSentence: string; body: string }
  | { kind: 'summary'; summary: string }
  | { kind: 'longExpository'; paragraphs: string[] }
  | { kind: 'longNarrative'; sections: Array<{ label: 'A' | 'B' | 'C' | 'D'; text: string }> }

export interface EnglishQuestion {
  id: string
  type: string
  stem: string
  choices: string[]
  answerIndex: number
  explanation: string
  intention: string
  evidenceRefs: string[]
  distractorReasons: string[]
  score?: number
  csatTemplateId?: CsatNumberTemplateId
  csatSlot?: string
  csatItemId?: string
  schoolTemplateId?: SchoolQuestionTemplateId
  schoolChoiceLayout?: SchoolChoiceLayout
  /** 내신형 요약문 완성에서 공통 지문과 별도로 출력하는 (A)·(B) 요약문 */
  schoolSummaryText?: string
}

export type VerificationScope = 'set' | 'exam'
export type VerificationStatus = 'in-progress' | 'needs-review' | 'complete'
export type VerificationSeverity = 'error' | 'warning'
export type VerificationDecision = 'approve' | 'revise' | 'ignore' | 'defer'
export type VerificationChoiceVerdict = 'correct' | 'incorrect' | 'ambiguous'

export interface VerificationChoiceAssessment {
  choiceIndex: number
  verdict: VerificationChoiceVerdict
  reason: string
}

export interface VerificationReferentAssessment {
  marker: string
  entityId: string
  evidence: string
}

export interface CsatQuestionVerification {
  setId: string
  csatItemId: string
  questionId: string
  slot: string
  predictedAnswerIndex: number
  confidence: number
  choiceAssessments: VerificationChoiceAssessment[]
  evidence: string[]
  explanationConsistent: boolean
  explanationNote: string
  strongestDistractorIndex?: number
  referents?: VerificationReferentAssessment[]
}

export interface CsatVerificationFinding {
  id: string
  setId: string
  csatItemId: string
  questionId: string
  slot: string
  severity: VerificationSeverity
  category: string
  summary: string
  evidence: string
  suggestedRepair: string
  decision: VerificationDecision
  userNote: string
}

export interface CsatVerificationRun {
  id: string
  scope: VerificationScope
  targetId: string
  targetTitle: string
  sourceFingerprint: string
  sourceRevision: string
  status: VerificationStatus
  createdAt: string
  importedAt?: string
  overallSummary: string
  questionReviews: CsatQuestionVerification[]
  findings: CsatVerificationFinding[]
  overallUserNote: string
}

export interface VerificationTarget {
  scope: VerificationScope
  id: string
}

export interface SetLayoutOverride {
  columns?: 1 | 2
  marginTop?: number
  marginRight?: number
  marginBottom?: number
  marginLeft?: number
  fontScale?: number
  lineHeight?: number
  passageWidth?: number
  passageBorder?: boolean
  breakBefore?: 'auto' | 'column' | 'page'
  keepMaterialWithFirst?: boolean
  keepQuestions?: boolean
}

export interface EnglishQuestionSet {
  id: string
  title: string
  mode: EnglishMode
  targetLevel: string
  sourceKind: SourceKind
  materialMode: MaterialMode
  materialTitle: string
  material: string
  topic: string
  difficulty: number
  difficultyScaleVersion?: 2
  intention: string
  choiceCount: number
  customPreset?: string
  csatDesign?: CsatDesignSpec
  csatItems?: CsatItemDesign[]
  materialSpec?: CsatMaterialSpec
  providedPassage?: ProvidedPassageState
  providedPassageV02?: ProvidedPassageV02State
  providedPassageQualityReview?: CsatQualityReview
  schoolInsertionPresentation?: SchoolInsertionPresentation
  questions: EnglishQuestion[]
  prompt: string
  aiRevision: number
  validatedRevision: number
  lastImportedJson: string
  explanationSourceFingerprint?: string
  layoutOverride?: SetLayoutOverride
  verificationRuns?: CsatVerificationRun[]
  createdAt: string
  updatedAt: string
}

export interface SchoolExamHeaderSettings {
  subjectName: string
  subjectCode: string
  examSession: string
  authorName: string
  showApprovalGrid: boolean
}

export interface ExamContentEntry {
  id: string
  setId: string
  csatItemId?: string
}

export interface ExamLayoutSettings {
  layoutRevision?: number
  preset: LayoutPreset
  columns: 1 | 2
  answerColumns: 1 | 2
  marginTop: number
  marginRight: number
  marginBottom: number
  marginLeft: number
  fontSize: number
  lineHeight: number
  questionGap: number
  passageBorder: boolean
  institution: string
  gradeLabel: string
  dateLabel: string
  footerText: string
  showPageNumbers: boolean
  schoolExamHeader?: SchoolExamHeaderSettings
}

export interface EnglishExamDocument {
  id: string
  title: string
  setIds: string[]
  contentEntries?: ExamContentEntry[]
  layout: ExamLayoutSettings
  setOverrides: Record<string, SetLayoutOverride>
  entryOverrides?: Record<string, SetLayoutOverride>
  verificationRuns?: CsatVerificationRun[]
  createdAt: string
  updatedAt: string
}

export interface MediaAsset {
  id: string
  setId: string
  csatItemId?: string
  name: string
  mimeType: string
  dataUrl: string
  caption: string
  createdAt: string
}

export interface ValidationIssue {
  id: string
  level: ValidationLevel
  questionId?: string
  label: string
  detail: string
}

export interface UiSettings {
  screen: StudioScreen
  activeMode: EnglishMode
}

export interface StudioBundle {
  questionSets: EnglishQuestionSet[]
  exams: EnglishExamDocument[]
  mediaAssets: MediaAsset[]
}

export interface EnglishBackup {
  appId: 'english-question-lab'
  schemaVersion: 1
  exportedAt: string
  data: StudioBundle
  preferences: UiSettings
  principles: string[]
}
