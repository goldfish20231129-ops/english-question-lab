export const SCHOOL_NUMERIC_MARKER_LABELS = ['①', '②', '③', '④', '⑤'] as const

const SCHOOL_DISTINCT_MARKER_LABEL_GROUPS = [
  ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ'],
  ['a', 'b', 'c', 'd', 'e'],
  ['A', 'B', 'C', 'D', 'E'],
  ['i', 'ii', 'iii', 'iv', 'v'],
  ['α', 'β', 'γ', 'δ', 'ε'],
] as const

/**
 * A single inline question keeps the familiar circled positions. When two or
 * more questions annotate the same school passage, every question receives a
 * distinct label group so a marker can never be mistaken for another item.
 */
export function allocateSchoolMarkerLabels(markerQuestionIds: string[], questionId: string): string[] {
  const uniqueIds = [...new Set(markerQuestionIds)]
  const index = uniqueIds.indexOf(questionId)
  if (index < 0) return [...SCHOOL_NUMERIC_MARKER_LABELS]
  if (uniqueIds.length < 2) return [...SCHOOL_NUMERIC_MARKER_LABELS]
  return [...(SCHOOL_DISTINCT_MARKER_LABEL_GROUPS[index] ?? SCHOOL_DISTINCT_MARKER_LABEL_GROUPS.at(-1)!)]
}

export function isSchoolMarkerLabelSet(value: string[]) {
  const key = value.join('|')
  return key === SCHOOL_NUMERIC_MARKER_LABELS.join('|')
    || SCHOOL_DISTINCT_MARKER_LABEL_GROUPS.some((group) => key === group.join('|'))
}
