import { normalizeStudioBundle } from './studioStorage'
import type { EnglishBackup, StudioBundle, UiSettings } from './types'

const UI_KEY = 'english-question-lab-ui-v1'
const PRINCIPLES_KEY = 'english-question-lab-principles-v1'

export const DEFAULT_UI_SETTINGS: UiSettings = { screen: 'sets', activeMode: 'csat' }

export function loadUiSettings(): UiSettings {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(UI_KEY) ?? 'null')
    if (!value || typeof value !== 'object') return DEFAULT_UI_SETTINGS
    const input = value as Partial<UiSettings>
    return {
      screen: input.screen === 'assembly' || input.screen === 'preview' ? input.screen : 'sets',
      activeMode: input.activeMode === 'school' || input.activeMode === 'custom' ? input.activeMode : 'csat',
    }
  } catch { return DEFAULT_UI_SETTINGS }
}

export const saveUiSettings = (settings: UiSettings) => localStorage.setItem(UI_KEY, JSON.stringify(settings))

export function loadPrinciples(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(PRINCIPLES_KEY) ?? '[]')
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
  } catch { return [] }
}

export const savePrinciples = (principles: string[]) => localStorage.setItem(PRINCIPLES_KEY, JSON.stringify(principles))

export function createBackup(data: StudioBundle, preferences: UiSettings, principles: string[] = []): EnglishBackup {
  return { appId: 'english-question-lab', schemaVersion: 1, exportedAt: new Date().toISOString(), data, preferences, principles }
}

export function parseBackup(input: unknown): EnglishBackup {
  if (!input || typeof input !== 'object') throw new Error('백업 JSON 최상위 값이 올바르지 않습니다.')
  const value = input as Partial<EnglishBackup>
  if (value.appId !== 'english-question-lab') throw new Error('영어 문제 제작 연구소 백업 파일이 아닙니다. 기존 국어 데이터는 가져오지 않습니다.')
  if (value.schemaVersion !== 1) throw new Error('지원하지 않는 백업 버전입니다.')
  if (!value.data || !Array.isArray(value.data.questionSets) || !Array.isArray(value.data.exams) || !Array.isArray(value.data.mediaAssets)) throw new Error('백업 데이터 구조가 올바르지 않습니다.')
  return { ...(value as EnglishBackup), data: normalizeStudioBundle(value.data), principles: Array.isArray(value.principles) ? value.principles.filter((item): item is string => typeof item === 'string') : [] }
}
