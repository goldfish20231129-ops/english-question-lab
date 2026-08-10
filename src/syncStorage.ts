import type { StudioBundle } from './types'

const DB_NAME = 'english-question-lab-sync-v1'
const DB_VERSION = 1
const STATE_STORE = 'syncState'
const RECOVERY_STORE = 'recoveries'
const MAX_RECOVERIES = 3

export interface StoredSyncState {
  userId: string
  lastRevision: number
  lastSyncedAt: string
  pending: boolean
}

export interface RecoverySnapshot {
  id: string
  userId: string
  createdAt: string
  reason: string
  bundle: StudioBundle
  principles: string[]
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(STATE_STORE)) database.createObjectStore(STATE_STORE, { keyPath: 'userId' })
      if (!database.objectStoreNames.contains(RECOVERY_STORE)) {
        const store = database.createObjectStore(RECOVERY_STORE, { keyPath: 'id' })
        store.createIndex('userId', 'userId', { unique: false })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('동기화 상태 저장소를 열지 못했습니다.'))
  })
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('동기화 상태 저장에 실패했습니다.'))
  })
}

export async function loadSyncState(userId: string): Promise<StoredSyncState | undefined> {
  const database = await openDatabase()
  try { return await requestResult(database.transaction(STATE_STORE, 'readonly').objectStore(STATE_STORE).get(userId)) as StoredSyncState | undefined }
  finally { database.close() }
}

export async function saveSyncState(state: StoredSyncState) {
  const database = await openDatabase()
  try { await requestResult(database.transaction(STATE_STORE, 'readwrite').objectStore(STATE_STORE).put(state)) }
  finally { database.close() }
}

async function recoveriesForUser(database: IDBDatabase, userId: string) {
  return await requestResult(database.transaction(RECOVERY_STORE, 'readonly').objectStore(RECOVERY_STORE).index('userId').getAll(userId)) as RecoverySnapshot[]
}

export async function saveRecoverySnapshot(userId: string, reason: string, bundle: StudioBundle, principles: string[]) {
  const database = await openDatabase()
  try {
    const value: RecoverySnapshot = { id: crypto.randomUUID(), userId, createdAt: new Date().toISOString(), reason, bundle, principles }
    await requestResult(database.transaction(RECOVERY_STORE, 'readwrite').objectStore(RECOVERY_STORE).put(value))
    const values = (await recoveriesForUser(database, userId)).sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    const expired = values.slice(MAX_RECOVERIES)
    if (expired.length) {
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(RECOVERY_STORE, 'readwrite')
        const store = transaction.objectStore(RECOVERY_STORE)
        expired.forEach((item) => store.delete(item.id))
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => reject(transaction.error ?? new Error('오래된 복구본을 정리하지 못했습니다.'))
      })
    }
    return value
  } finally { database.close() }
}

export async function loadLatestRecovery(userId: string): Promise<RecoverySnapshot | undefined> {
  const database = await openDatabase()
  try {
    const values = await recoveriesForUser(database, userId)
    return values.sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0]
  } finally { database.close() }
}
