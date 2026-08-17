import { normalizeCsatSet } from './csat'
import { normalizeExamDocument } from './examLayout'
import { inferSchoolQuestionTemplate } from './schoolCatalog'
import type { EnglishExamDocument, EnglishQuestionSet, MediaAsset, StudioBundle } from './types'

const DB_NAME = 'english-question-lab-studio-v1'
const DB_VERSION = 1
const QUESTION_SETS = 'questionSets'
const EXAMS = 'examDocuments'
const MEDIA = 'mediaAssets'

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(QUESTION_SETS)) database.createObjectStore(QUESTION_SETS, { keyPath: 'id' })
      if (!database.objectStoreNames.contains(EXAMS)) database.createObjectStore(EXAMS, { keyPath: 'id' })
      if (!database.objectStoreNames.contains(MEDIA)) {
        const store = database.createObjectStore(MEDIA, { keyPath: 'id' })
        store.createIndex('setId', 'setId', { unique: false })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('영어 전용 브라우저 저장소를 열 수 없습니다.'))
  })
}

function result<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('브라우저 저장 작업에 실패했습니다.'))
  })
}

async function getAll<T>(storeName: string) {
  const database = await openDatabase()
  try { return await result(database.transaction(storeName, 'readonly').objectStore(storeName).getAll()) as T[] }
  finally { database.close() }
}

async function put<T>(storeName: string, value: T) {
  const database = await openDatabase()
  try { await result(database.transaction(storeName, 'readwrite').objectStore(storeName).put(value)) }
  finally { database.close() }
}

async function remove(storeName: string, id: string) {
  const database = await openDatabase()
  try { await result(database.transaction(storeName, 'readwrite').objectStore(storeName).delete(id)) }
  finally { database.close() }
}

async function removeMany(storeName: string, ids: string[]) {
  if (!ids.length) return
  const database = await openDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(storeName, 'readwrite')
      const store = transaction.objectStore(storeName)
      ids.forEach((id) => store.delete(id))
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error('여러 항목을 삭제하지 못했습니다.'))
      transaction.onabort = () => reject(transaction.error ?? new Error('일괄 삭제가 중단되었습니다.'))
    })
  } finally { database.close() }
}

async function replace<T>(storeName: string, values: T[]) {
  const database = await openDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(storeName, 'readwrite')
      const store = transaction.objectStore(storeName)
      store.clear()
      values.forEach((value) => store.put(value))
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error('백업을 복원하지 못했습니다.'))
      transaction.onabort = () => reject(transaction.error ?? new Error('백업 복원이 중단되었습니다.'))
    })
  } finally { database.close() }
}

export async function loadStudioBundle(): Promise<StudioBundle> {
  const [questionSets, exams, mediaAssets] = await Promise.all([
    getAll<EnglishQuestionSet>(QUESTION_SETS), getAll<EnglishExamDocument>(EXAMS), getAll<MediaAsset>(MEDIA),
  ])
  return normalizeStudioBundle({ questionSets, exams, mediaAssets })
}

export function normalizeStudioBundle(bundle: StudioBundle): StudioBundle {
  const questionSets = bundle.questionSets.map(normalizeQuestionSet)
  const exams = bundle.exams.map((exam) => normalizeExamDocument(exam, questionSets))
  return { questionSets, exams, mediaAssets: bundle.mediaAssets }
}

export function normalizeQuestionSet(value: EnglishQuestionSet): EnglishQuestionSet {
  const normalized = normalizeCsatSet(value)
  if (normalized.mode !== 'school') return normalized
  return {
    ...normalized,
    schoolInsertionPresentation: normalized.schoolInsertionPresentation ?? 'isolated',
    questions: normalized.questions.map((question) => {
      const template = inferSchoolQuestionTemplate(question)
      return { ...question, schoolTemplateId: question.schoolTemplateId ?? template.id, schoolChoiceLayout: question.schoolChoiceLayout ?? template.choiceLayout }
    }),
  }
}

export const saveQuestionSet = (value: EnglishQuestionSet) => put(QUESTION_SETS, normalizeQuestionSet(value))
export const deleteQuestionSet = (id: string) => remove(QUESTION_SETS, id)
export const saveExamDocument = (value: EnglishExamDocument) => put(EXAMS, value)
export const deleteExamDocument = (id: string) => remove(EXAMS, id)
export const deleteExamDocuments = (ids: string[]) => removeMany(EXAMS, ids)
export const saveMediaAsset = (value: MediaAsset) => put(MEDIA, value)
export const deleteMediaAsset = (id: string) => remove(MEDIA, id)

export async function replaceStudioBundle(bundle: StudioBundle) {
  const normalized = normalizeStudioBundle(bundle)
  await Promise.all([replace(QUESTION_SETS, normalized.questionSets), replace(EXAMS, normalized.exams), replace(MEDIA, normalized.mediaAssets)])
}
