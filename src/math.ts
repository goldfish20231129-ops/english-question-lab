export function verifyMath(input: string): string {
  const cleaned = input.trim().replace(/\^/g, '**').replace(/\s/g, '')
  if (/^[0-9+\-*/().]+$/.test(cleaned)) { try { const value = Function(`"use strict"; return (${cleaned})`)(); return Number.isFinite(value) ? `계산 결과: ${value}` : '현재 자동 검산 범위를 벗어났습니다.' } catch { return '식을 확인하세요.' } }
  const match = input.replace(/\s/g, '').match(/^([+-]?\d*)x\^2([+-]\d*)x([+-]\d+)=0$/)
  if (match) { const n = (s: string, fallback: number) => s === '' || s === '+' ? fallback : s === '-' ? -fallback : Number(s); const a = n(match[1], 1), b = n(match[2], 0), c = n(match[3], 0); const d = b * b - 4 * a * c; if (d < 0) return '실수해 없음'; const r = Math.sqrt(d); return `해: x = ${(-b + r) / (2 * a)}, ${(-b - r) / (2 * a)}` }
  return '현재 자동 검산 범위를 벗어났습니다. (지원: 사칙연산, ax²+bx+c=0 형태의 실수해)'
}
