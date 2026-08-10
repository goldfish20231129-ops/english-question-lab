import { describe, expect, it } from 'vitest'
import { hasWorkspaceContent, mediaFingerprint, parseCloudSnapshot, workspaceSignature } from './cloudSync'
import type { MediaAsset, StudioBundle } from './types'

const emptyBundle: StudioBundle = { questionSets: [], exams: [], mediaAssets: [] }

describe('cloud workspace helpers', () => {
  it('빈 작업 공간과 실제 자료가 있는 작업 공간을 구분한다', () => {
    expect(hasWorkspaceContent(emptyBundle, [])).toBe(false)
    expect(hasWorkspaceContent(emptyBundle, ['  '])).toBe(false)
    expect(hasWorkspaceContent(emptyBundle, ['정답 근거를 명확히 한다.'])).toBe(true)
    expect(hasWorkspaceContent({ ...emptyBundle, questionSets: [{}] as StudioBundle['questionSets'] }, [])).toBe(true)
  })

  it('같은 로컬 자료는 같은 동기화 서명을 만든다', () => {
    const first = workspaceSignature(emptyBundle, ['원칙'])
    const second = workspaceSignature({ questionSets: [], exams: [], mediaAssets: [] }, ['원칙'])
    expect(first).toBe(second)
    expect(first).not.toBe(workspaceSignature(emptyBundle, ['다른 원칙']))
  })

  it('이미지 변경 여부를 확인할 지문을 만든다', () => {
    const asset = {
      id: 'image-1', setId: 'set-1', name: '자료.png', mimeType: 'image/png', caption: '', createdAt: '2026-08-10T00:00:00.000Z', dataUrl: 'data:image/png;base64,AAAA',
    } satisfies MediaAsset
    expect(mediaFingerprint(asset)).toMatch(/^image\/png:2026-08-10T00:00:00\.000Z:26:[0-9a-f]{8}$/)
    expect(mediaFingerprint({ ...asset, dataUrl: 'data:image/png;base64,BBBB' })).not.toBe(mediaFingerprint(asset))
  })

  it('정상적인 클라우드 스냅샷을 읽는다', () => {
    const snapshot = parseCloudSnapshot({
      schemaVersion: 1,
      questionSets: [],
      exams: [],
      mediaAssets: [{
        id: 'image-1', setId: 'set-1', name: '자료.png', mimeType: 'image/png', caption: '', createdAt: '2026-08-10T00:00:00.000Z', storagePath: 'user/image-1', fingerprint: 'fingerprint',
      }],
      principles: ['원칙', 3],
    })
    expect(snapshot.mediaAssets[0].storagePath).toBe('user/image-1')
    expect(snapshot.principles).toEqual(['원칙'])
  })

  it('지원하지 않는 스냅샷은 거부한다', () => {
    expect(() => parseCloudSnapshot({ schemaVersion: 2, questionSets: [], exams: [], mediaAssets: [] })).toThrow('지원하지 않는')
    expect(() => parseCloudSnapshot({ schemaVersion: 1, questionSets: [], exams: [], mediaAssets: [{}] })).toThrow('이미지 목록')
  })
})
