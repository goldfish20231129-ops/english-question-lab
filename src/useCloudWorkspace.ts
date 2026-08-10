import { useCallback, useEffect, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  buildCloudSnapshot,
  CloudConflictError,
  hasWorkspaceContent,
  hydrateCloudSnapshot,
  loadRemoteWorkspace,
  removeObsoleteCloudMedia,
  saveRemoteWorkspace,
  workspaceSignature,
  type CloudWorkspaceSnapshot,
  type RemoteWorkspace,
} from './cloudSync'
import { normalizeStudioBundle, replaceStudioBundle } from './studioStorage'
import { loadLatestRecovery, loadSyncState, saveRecoverySnapshot, saveSyncState } from './syncStorage'
import type { StudioBundle } from './types'

export type CloudSyncStatus = 'starting' | 'synced' | 'pending' | 'syncing' | 'offline' | 'conflict' | 'error'

export const CLOUD_SYNC_LABELS: Record<CloudSyncStatus, string> = {
  starting: '클라우드 연결 중',
  synced: '클라우드 동기화 완료',
  pending: '저장 대기 중',
  syncing: '클라우드 동기화 중',
  offline: '오프라인 · 연결 후 동기화',
  conflict: '동기화 충돌 확인 필요',
  error: '동기화 오류',
}

interface UseCloudWorkspaceOptions {
  client: SupabaseClient
  userId: string
  localReady: boolean
  bundle: StudioBundle
  principles: string[]
  setBundle: (value: StudioBundle) => void
  setPrinciples: (value: string[]) => void
}

export function useCloudWorkspace({ client, userId, localReady, bundle, principles, setBundle, setPrinciples }: UseCloudWorkspaceOptions) {
  const [status, setStatus] = useState<CloudSyncStatus>('starting')
  const [message, setMessage] = useState('')
  const [conflict, setConflict] = useState<RemoteWorkspace | null>(null)
  const [lastSyncedAt, setLastSyncedAt] = useState('')
  const [hasRecovery, setHasRecovery] = useState(false)
  const bundleRef = useRef(bundle)
  const principlesRef = useRef(principles)
  const initializedRef = useRef(false)
  const revisionRef = useRef(0)
  const baselineRef = useRef('')
  const previousSnapshotRef = useRef<CloudWorkspaceSnapshot | undefined>(undefined)
  const timerRef = useRef<number | undefined>(undefined)
  const pushingRef = useRef(false)
  const pushAgainRef = useRef(false)
  const pushNowRef = useRef<() => Promise<void>>(async () => undefined)
  const conflictRef = useRef<RemoteWorkspace | null>(null)

  bundleRef.current = bundle
  principlesRef.current = principles
  conflictRef.current = conflict

  const persistState = useCallback(async (pending: boolean) => {
    const timestamp = pending ? lastSyncedAt : new Date().toISOString()
    await saveSyncState({ userId, lastRevision: revisionRef.current, lastSyncedAt: timestamp, pending })
    if (!pending) setLastSyncedAt(timestamp)
  }, [lastSyncedAt, userId])

  const saveRecovery = useCallback(async (reason: string, recoveryBundle: StudioBundle, recoveryPrinciples: string[]) => {
    await saveRecoverySnapshot(userId, reason, recoveryBundle, recoveryPrinciples)
    setHasRecovery(true)
  }, [userId])

  const applyRemote = useCallback(async (remote: RemoteWorkspace, preserveLocal = false) => {
    setStatus('syncing')
    const hydrated = await hydrateCloudSnapshot(client, remote.snapshot)
    const normalizedBundle = normalizeStudioBundle(hydrated.bundle)
    if (preserveLocal && hasWorkspaceContent(bundleRef.current, principlesRef.current)) {
      await saveRecovery('클라우드 자료를 내려받기 전 보존한 이 기기 자료', bundleRef.current, principlesRef.current)
    }
    const signature = workspaceSignature(normalizedBundle, hydrated.principles)
    baselineRef.current = signature
    revisionRef.current = remote.revision
    previousSnapshotRef.current = remote.snapshot
    await replaceStudioBundle(normalizedBundle)
    setBundle(normalizedBundle)
    setPrinciples(hydrated.principles)
    await saveSyncState({ userId, lastRevision: remote.revision, lastSyncedAt: remote.updatedAt, pending: false })
    setLastSyncedAt(remote.updatedAt)
    setMessage('다른 기기의 최신 작업을 불러왔습니다.')
    setStatus('synced')
  }, [client, saveRecovery, setBundle, setPrinciples, userId])

  const schedulePush = useCallback(() => {
    window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => void pushNowRef.current(), 1000)
  }, [])

  const pushNow = useCallback(async () => {
    if (!initializedRef.current || conflictRef.current) return
    if (pushingRef.current) { pushAgainRef.current = true; return }
    if (!navigator.onLine) {
      setStatus('offline')
      await persistState(true)
      return
    }
    pushingRef.current = true
    setStatus('syncing')
    setMessage('')
    const sourceBundle = bundleRef.current
    const sourcePrinciples = principlesRef.current
    const sourceSignature = workspaceSignature(sourceBundle, sourcePrinciples)
    const previous = previousSnapshotRef.current
    try {
      const snapshot = await buildCloudSnapshot(client, userId, sourceBundle, sourcePrinciples, previous)
      const remote = await saveRemoteWorkspace(client, userId, snapshot, revisionRef.current)
      revisionRef.current = remote.revision
      previousSnapshotRef.current = remote.snapshot
      baselineRef.current = sourceSignature
      try {
        await removeObsoleteCloudMedia(client, previous, snapshot)
      } catch (cleanupError) {
        setMessage(cleanupError instanceof Error ? `${cleanupError.message} 최신 작업 자체는 저장되었습니다.` : '이전 이미지 파일은 정리하지 못했지만 최신 작업은 저장되었습니다.')
      }
      await saveSyncState({ userId, lastRevision: remote.revision, lastSyncedAt: remote.updatedAt, pending: false })
      setLastSyncedAt(remote.updatedAt)
      setStatus('synced')
      if (workspaceSignature(bundleRef.current, principlesRef.current) !== sourceSignature) {
        await saveSyncState({ userId, lastRevision: remote.revision, lastSyncedAt: remote.updatedAt, pending: true })
        setStatus('pending')
        pushAgainRef.current = true
      }
    } catch (error) {
      if (error instanceof CloudConflictError) {
        const remote = await loadRemoteWorkspace(client, userId)
        if (remote) { conflictRef.current = remote; setConflict(remote) }
        setStatus('conflict')
        setMessage('다른 기기에서도 수정되었습니다. 보존할 버전을 선택하세요.')
      } else {
        setStatus(navigator.onLine ? 'error' : 'offline')
        setMessage(error instanceof Error ? error.message : '클라우드 저장에 실패했습니다.')
        await persistState(true)
      }
    } finally {
      pushingRef.current = false
      if (pushAgainRef.current && !conflictRef.current) {
        pushAgainRef.current = false
        window.setTimeout(() => void pushNowRef.current(), 0)
      }
    }
  }, [client, persistState, userId])

  pushNowRef.current = pushNow

  const checkRemote = useCallback(async () => {
    if (!initializedRef.current || conflictRef.current || !navigator.onLine || pushingRef.current) return
    try {
      const remote = await loadRemoteWorkspace(client, userId)
      if (!remote || remote.revision <= revisionRef.current) {
        if (workspaceSignature(bundleRef.current, principlesRef.current) !== baselineRef.current) await pushNowRef.current()
        return
      }
      const localChanged = workspaceSignature(bundleRef.current, principlesRef.current) !== baselineRef.current
      if (localChanged) {
        conflictRef.current = remote; setConflict(remote); setStatus('conflict'); setMessage('이 기기와 다른 기기에서 모두 수정되었습니다.')
      } else await applyRemote(remote, true)
    } catch (error) {
      setStatus(navigator.onLine ? 'error' : 'offline')
      setMessage(error instanceof Error ? error.message : '클라우드 확인에 실패했습니다.')
    }
  }, [applyRemote, client, userId])

  useEffect(() => {
    if (!localReady) return
    let cancelled = false
    initializedRef.current = false
    conflictRef.current = null; setStatus('starting'); setConflict(null); setMessage('')
    void (async () => {
      try {
        const [remote, storedState, latestRecovery] = await Promise.all([
          navigator.onLine ? loadRemoteWorkspace(client, userId) : Promise.resolve(null),
          loadSyncState(userId), loadLatestRecovery(userId),
        ])
        if (cancelled) return
        setHasRecovery(Boolean(latestRecovery))
        const localSignature = workspaceSignature(bundleRef.current, principlesRef.current)
        if (!navigator.onLine && storedState?.userId === userId) {
          revisionRef.current = storedState.lastRevision
          baselineRef.current = storedState.pending ? '' : localSignature
          setLastSyncedAt(storedState.lastSyncedAt)
          initializedRef.current = true
          setStatus('offline')
          return
        }
        if (!remote) {
          revisionRef.current = 0; previousSnapshotRef.current = undefined; baselineRef.current = localSignature
          initializedRef.current = true
          await saveSyncState({ userId, lastRevision: 0, lastSyncedAt: '', pending: true })
          if (navigator.onLine) await pushNowRef.current()
          else setStatus('offline')
          return
        }
        revisionRef.current = remote.revision
        previousSnapshotRef.current = remote.snapshot
        if (storedState?.userId === userId && storedState.lastRevision > 0) {
          setLastSyncedAt(storedState.lastSyncedAt)
          if (storedState.pending && storedState.lastRevision !== remote.revision) {
            initializedRef.current = true; conflictRef.current = remote; setConflict(remote); setStatus('conflict'); setMessage('오프라인 변경과 다른 기기의 변경이 겹쳤습니다.'); return
          }
          if (storedState.pending) {
            baselineRef.current = ''
            initializedRef.current = true
            await pushNowRef.current()
            return
          }
          if (remote.revision > storedState.lastRevision) await applyRemote(remote, true)
          else { baselineRef.current = localSignature; initializedRef.current = true; setStatus('synced') }
          initializedRef.current = true
          return
        }
        if (hasWorkspaceContent(bundleRef.current, principlesRef.current)) {
          initializedRef.current = true; conflictRef.current = remote; setConflict(remote); setStatus('conflict'); setMessage('이 브라우저의 기존 자료와 클라우드 자료가 모두 있습니다.'); return
        }
        await applyRemote(remote)
        initializedRef.current = true
      } catch (error) {
        if (cancelled) return
        initializedRef.current = true
        setStatus(navigator.onLine ? 'error' : 'offline')
        setMessage(error instanceof Error ? error.message : '클라우드 연결에 실패했습니다.')
      }
    })()
    return () => { cancelled = true; initializedRef.current = false; window.clearTimeout(timerRef.current) }
  }, [applyRemote, client, localReady, userId])

  useEffect(() => {
    if (!initializedRef.current || conflict) return
    const signature = workspaceSignature(bundle, principles)
    if (signature === baselineRef.current) return
    void saveSyncState({ userId, lastRevision: revisionRef.current, lastSyncedAt, pending: true })
    setStatus(navigator.onLine ? 'pending' : 'offline')
    if (navigator.onLine) schedulePush()
  }, [bundle, conflict, lastSyncedAt, principles, schedulePush, userId])

  useEffect(() => {
    const onOnline = () => { setStatus('pending'); void checkRemote() }
    const onOffline = () => setStatus('offline')
    const onVisibility = () => { if (document.visibilityState === 'visible') void checkRemote() }
    window.addEventListener('online', onOnline); window.addEventListener('offline', onOffline); document.addEventListener('visibilitychange', onVisibility)
    const interval = window.setInterval(() => { if (document.visibilityState === 'visible') void checkRemote() }, 30000)
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); document.removeEventListener('visibilitychange', onVisibility); window.clearInterval(interval) }
  }, [checkRemote])

  const resolveConflict = useCallback(async (choice: 'local' | 'cloud') => {
    if (!conflict) return
    setStatus('syncing'); setMessage('')
    if (choice === 'cloud') {
      await applyRemote(conflict, true)
      conflictRef.current = null; setConflict(null)
      return
    }
    const remoteHydrated = await hydrateCloudSnapshot(client, conflict.snapshot)
    await saveRecovery('이 기기 자료로 교체하기 전 보존한 클라우드 자료', remoteHydrated.bundle, remoteHydrated.principles)
    revisionRef.current = conflict.revision
    previousSnapshotRef.current = conflict.snapshot
    baselineRef.current = ''
    conflictRef.current = null; setConflict(null)
    await saveSyncState({ userId, lastRevision: conflict.revision, lastSyncedAt: conflict.updatedAt, pending: true })
    await pushNowRef.current()
  }, [applyRemote, client, conflict, saveRecovery, userId])

  const downloadLatestRecovery = useCallback(async () => {
    const recovery = await loadLatestRecovery(userId)
    if (!recovery) return false
    const backup = {
      appId: 'english-question-lab', schemaVersion: 1, exportedAt: recovery.createdAt,
      data: recovery.bundle, preferences: { screen: 'sets', activeMode: 'csat' }, principles: recovery.principles,
      recoveryReason: recovery.reason,
    }
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob); link.download = `영어-문제-제작-복구본-${recovery.createdAt.slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(link.href)
    return true
  }, [userId])

  const flushForLogout = useCallback(async () => {
    if (!navigator.onLine || conflictRef.current) return false
    await pushNowRef.current()
    return !conflictRef.current && workspaceSignature(bundleRef.current, principlesRef.current) === baselineRef.current
  }, [])

  return {
    status, statusLabel: CLOUD_SYNC_LABELS[status], message, conflict, lastSyncedAt, hasRecovery,
    syncNow: pushNow, flushForLogout, resolveConflict, downloadLatestRecovery,
    hasPending: status === 'pending' || status === 'syncing' || status === 'offline' || status === 'error' || status === 'conflict',
  }
}
