import type { SupabaseClient } from '@supabase/supabase-js'
import type { EnglishExamDocument, EnglishQuestionSet, MediaAsset, StudioBundle } from './types'

export const CLOUD_TABLE = 'user_workspaces'
export const CLOUD_MEDIA_BUCKET = 'english-media'
export const CLOUD_SCHEMA_VERSION = 1

export interface CloudMediaAsset extends Omit<MediaAsset, 'dataUrl'> {
  storagePath: string
  fingerprint: string
}

export interface CloudWorkspaceSnapshot {
  schemaVersion: 1
  questionSets: EnglishQuestionSet[]
  exams: EnglishExamDocument[]
  mediaAssets: CloudMediaAsset[]
  principles: string[]
}

export interface RemoteWorkspace {
  userId: string
  snapshot: CloudWorkspaceSnapshot
  revision: number
  updatedAt: string
}

interface RemoteWorkspaceRow {
  user_id: string
  snapshot: unknown
  revision: number
  updated_at: string
}

export class CloudConflictError extends Error {
  constructor() {
    super('다른 기기에서 더 새로운 변경이 발견되었습니다.')
    this.name = 'CloudConflictError'
  }
}

export function hasWorkspaceContent(bundle: StudioBundle, principles: string[] = []) {
  return bundle.questionSets.length > 0 || bundle.exams.length > 0 || bundle.mediaAssets.length > 0 || principles.some((item) => item.trim())
}

export function workspaceSignature(bundle: StudioBundle, principles: string[]) {
  return JSON.stringify({ bundle, principles })
}

export function mediaFingerprint(asset: MediaAsset) {
  let hash = 2166136261
  for (let index = 0; index < asset.dataUrl.length; index += 1) {
    hash ^= asset.dataUrl.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `${asset.mimeType}:${asset.createdAt}:${asset.dataUrl.length}:${(hash >>> 0).toString(16).padStart(8, '0')}`
}

function isCloudMediaAsset(input: unknown): input is CloudMediaAsset {
  if (!input || typeof input !== 'object') return false
  const value = input as Partial<CloudMediaAsset>
  return typeof value.id === 'string' && typeof value.setId === 'string' && typeof value.name === 'string'
    && typeof value.mimeType === 'string' && typeof value.caption === 'string' && typeof value.createdAt === 'string'
    && typeof value.storagePath === 'string' && typeof value.fingerprint === 'string'
}

export function parseCloudSnapshot(input: unknown): CloudWorkspaceSnapshot {
  if (!input || typeof input !== 'object') throw new Error('클라우드 작업 공간 형식이 올바르지 않습니다.')
  const value = input as Partial<CloudWorkspaceSnapshot>
  if (value.schemaVersion !== CLOUD_SCHEMA_VERSION || !Array.isArray(value.questionSets) || !Array.isArray(value.exams) || !Array.isArray(value.mediaAssets)) {
    throw new Error('지원하지 않는 클라우드 작업 공간 형식입니다.')
  }
  if (!value.mediaAssets.every(isCloudMediaAsset)) throw new Error('클라우드 이미지 목록 형식이 올바르지 않습니다.')
  return {
    schemaVersion: CLOUD_SCHEMA_VERSION,
    questionSets: value.questionSets,
    exams: value.exams,
    mediaAssets: value.mediaAssets,
    principles: Array.isArray(value.principles) ? value.principles.filter((item): item is string => typeof item === 'string') : [],
  }
}

function parseRemoteRow(row: RemoteWorkspaceRow): RemoteWorkspace {
  return { userId: row.user_id, snapshot: parseCloudSnapshot(row.snapshot), revision: row.revision, updatedAt: row.updated_at }
}

export async function loadRemoteWorkspace(client: SupabaseClient, userId: string): Promise<RemoteWorkspace | null> {
  const { data, error } = await client.from(CLOUD_TABLE).select('user_id,snapshot,revision,updated_at').eq('user_id', userId).maybeSingle()
  if (error) throw new Error(`클라우드 작업 공간을 불러오지 못했습니다: ${error.message}`)
  return data ? parseRemoteRow(data as RemoteWorkspaceRow) : null
}

export async function saveRemoteWorkspace(
  client: SupabaseClient,
  userId: string,
  snapshot: CloudWorkspaceSnapshot,
  expectedRevision: number,
): Promise<RemoteWorkspace> {
  const nextRevision = expectedRevision + 1
  const updatedAt = new Date().toISOString()
  if (expectedRevision === 0) {
    const { data, error } = await client.from(CLOUD_TABLE).insert({ user_id: userId, snapshot, revision: nextRevision, updated_at: updatedAt }).select('user_id,snapshot,revision,updated_at').maybeSingle()
    if (error?.code === '23505') throw new CloudConflictError()
    if (error) throw new Error(`클라우드 작업 공간을 만들지 못했습니다: ${error.message}`)
    if (!data) throw new CloudConflictError()
    return parseRemoteRow(data as RemoteWorkspaceRow)
  }
  const { data, error } = await client.from(CLOUD_TABLE)
    .update({ snapshot, revision: nextRevision, updated_at: updatedAt })
    .eq('user_id', userId).eq('revision', expectedRevision)
    .select('user_id,snapshot,revision,updated_at').maybeSingle()
  if (error) throw new Error(`클라우드 작업 공간을 저장하지 못했습니다: ${error.message}`)
  if (!data) throw new CloudConflictError()
  return parseRemoteRow(data as RemoteWorkspaceRow)
}

function dataUrlToBlob(dataUrl: string) {
  const [header, body] = dataUrl.split(',', 2)
  const mimeType = header.match(/^data:([^;]+)/)?.[1] ?? 'application/octet-stream'
  const binary = atob(body ?? '')
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return new Blob([bytes], { type: mimeType })
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('클라우드 이미지를 읽지 못했습니다.'))
    reader.readAsDataURL(blob)
  })
}

export async function buildCloudSnapshot(
  client: SupabaseClient,
  userId: string,
  bundle: StudioBundle,
  principles: string[],
  previous?: CloudWorkspaceSnapshot,
): Promise<CloudWorkspaceSnapshot> {
  const previousAssets = new Map(previous?.mediaAssets.map((asset) => [asset.id, asset]))
  const mediaAssets: CloudMediaAsset[] = []
  for (const asset of bundle.mediaAssets) {
    const fingerprint = mediaFingerprint(asset)
    const version = fingerprint.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '')
    const storagePath = `${userId}/${asset.id}-${version}`
    const existing = previousAssets.get(asset.id)
    if (!existing || existing.fingerprint !== fingerprint || existing.storagePath !== storagePath) {
      const { error } = await client.storage.from(CLOUD_MEDIA_BUCKET).upload(storagePath, dataUrlToBlob(asset.dataUrl), {
        contentType: asset.mimeType,
        upsert: true,
      })
      if (error) throw new Error(`이미지 “${asset.name}”을 클라우드에 저장하지 못했습니다: ${error.message}`)
    }
    const { dataUrl: _dataUrl, ...metadata } = asset
    void _dataUrl
    mediaAssets.push({ ...metadata, storagePath, fingerprint })
  }
  return { schemaVersion: CLOUD_SCHEMA_VERSION, questionSets: bundle.questionSets, exams: bundle.exams, mediaAssets, principles }
}

export async function removeObsoleteCloudMedia(client: SupabaseClient, previous: CloudWorkspaceSnapshot | undefined, current: CloudWorkspaceSnapshot) {
  if (!previous) return
  const currentPaths = new Set(current.mediaAssets.map((asset) => asset.storagePath))
  const obsolete = previous.mediaAssets.map((asset) => asset.storagePath).filter((path) => !currentPaths.has(path))
  if (!obsolete.length) return
  const { error } = await client.storage.from(CLOUD_MEDIA_BUCKET).remove(obsolete)
  if (error) throw new Error(`삭제된 이미지의 클라우드 정리에 실패했습니다: ${error.message}`)
}

export async function hydrateCloudSnapshot(client: SupabaseClient, snapshot: CloudWorkspaceSnapshot): Promise<{ bundle: StudioBundle; principles: string[] }> {
  const mediaAssets: MediaAsset[] = []
  for (const asset of snapshot.mediaAssets) {
    const { data, error } = await client.storage.from(CLOUD_MEDIA_BUCKET).download(asset.storagePath)
    if (error || !data) throw new Error(`이미지 “${asset.name}”을 클라우드에서 불러오지 못했습니다: ${error?.message ?? '파일 없음'}`)
    const { storagePath: _storagePath, fingerprint: _fingerprint, ...metadata } = asset
    void _storagePath; void _fingerprint
    mediaAssets.push({ ...metadata, dataUrl: await blobToDataUrl(data) })
  }
  return { bundle: { questionSets: snapshot.questionSets, exams: snapshot.exams, mediaAssets }, principles: snapshot.principles }
}
