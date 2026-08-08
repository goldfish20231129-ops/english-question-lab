import type { ProblemProject } from './types'
const PROJECTS_KEY = 'problem-lab-projects-v1'
const PRINCIPLES_KEY = 'problem-lab-principles-v1'
export const loadProjects = (): ProblemProject[] => { try { const value = localStorage.getItem(PROJECTS_KEY); return value ? JSON.parse(value) : [] } catch { return [] } }
export const saveProjects = (projects: ProblemProject[]) => localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects))
export const loadPrinciples = (): Record<string, string[]> => { try { return JSON.parse(localStorage.getItem(PRINCIPLES_KEY) ?? '{}') } catch { return {} } }
export const savePrinciples = (principles: Record<string, string[]>) => localStorage.setItem(PRINCIPLES_KEY, JSON.stringify(principles))
export const isProjectList = (input: unknown): input is ProblemProject[] => Array.isArray(input) && input.every((p) => typeof p === 'object' && p !== null && 'id' in p && 'title' in p && 'subject' in p)
