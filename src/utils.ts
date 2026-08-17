export function appendUniqueValue(current: string, choice: string, separator: string): string {
  const values = current.split(separator).map((value) => value.trim()).filter(Boolean)
  return values.includes(choice) ? current : [...values, choice].join(separator)
}

export function toggleUniqueValue(current: string, choice: string, separator: string): string {
  const values = current.split(separator).map((value) => value.trim()).filter(Boolean)
  return values.includes(choice) ? values.filter((value) => value !== choice).join(separator) : [...values, choice].join(separator)
}

export function includesValue(current: string, choice: string, separator: string): boolean {
  return current.split(separator).map((value) => value.trim()).includes(choice)
}

export function stripLeadingChoiceMarker(value: string): string {
  const trimmed = value.trim()
  const withoutCircled = trimmed.replace(/^[①②③④⑤]\s*/, '').trim()
  if (withoutCircled && withoutCircled !== trimmed) return withoutCircled
  const withoutNumbered = trimmed.replace(/^(?:\([1-5]\)|[1-5][.)])\s+/, '').trim()
  return withoutNumbered || trimmed
}
