export type EnglishMode = 'school' | 'csat' | 'custom'
export type MaterialMode = 'provided' | 'generated'
export type SourceKind = 'textbook' | 'supplement' | 'external' | 'generated' | 'custom'
export type ValidationLevel = 'error' | 'warning' | 'pass'
export type StudioScreen = 'sets' | 'assembly' | 'preview'
export type LayoutPreset = 'csat' | 'school' | 'worksheet' | 'custom'

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
  intention: string
  choiceCount: number
  customPreset?: string
  csatDesign?: CsatDesignSpec
  csatItems?: CsatItemDesign[]
  materialSpec?: CsatMaterialSpec
  questions: EnglishQuestion[]
  prompt: string
  aiRevision: number
  validatedRevision: number
  lastImportedJson: string
  layoutOverride?: SetLayoutOverride
  createdAt: string
  updatedAt: string
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
}

export interface EnglishExamDocument {
  id: string
  title: string
  setIds: string[]
  contentEntries?: ExamContentEntry[]
  layout: ExamLayoutSettings
  setOverrides: Record<string, SetLayoutOverride>
  entryOverrides?: Record<string, SetLayoutOverride>
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
