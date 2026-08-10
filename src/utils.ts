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
