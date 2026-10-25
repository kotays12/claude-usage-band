import type { Limit, Reading } from '../types'

// Two readings of one window may round its reset differently.
const SAME_WINDOW_MS = 5 * 60 * 1000

export const isReading = (v: unknown): v is Reading =>
  typeof v === 'object' && v !== null && Array.isArray((v as Reading).limits) && typeof (v as Reading).at === 'number'

// The server's answer, the figures /usage reads: each window's use and reset;
// one with no reset (a model's weekly window never used) is left out.
export function parse(text: string): Limit[] {
  const body: unknown = JSON.parse(text)
  if (typeof body !== 'object' || body === null) return []
  return Object.entries(body).flatMap(([kind, w]: [string, unknown]) => {
    if (kind !== 'five_hour' && !kind.startsWith('seven_day')) return []
    const window = w as { utilization?: unknown; resets_at?: unknown } | null
    if (typeof window?.utilization !== 'number') return []
    if (typeof window.resets_at !== 'string') return []
    return [{ kind, percentUsed: Math.round(window.utilization * 10) / 10, resetsAt: window.resets_at }]
  })
}

const resetOf = (l: Limit) => (l.resetsAt ? Date.parse(l.resetsAt) : NaN)

// Use only grows inside a window: the later window, else the higher figure.
const fresher = (a: Limit, b: Limit) => {
  const ta = resetOf(a)
  const tb = resetOf(b)
  if (!Number.isNaN(ta) && !Number.isNaN(tb) && Math.abs(ta - tb) > SAME_WINDOW_MS) return ta > tb ? a : b
  return a.percentUsed >= b.percentUsed ? a : b
}

// Every window either side knows, each at its freshest figure, the session's
// own first; a window past its reset stands at zero until a reading of the new
// one comes in.
export function merge(own: Limit[], other: Limit[], at: number): Limit[] {
  const extra = other.filter(o => !own.some(l => l.kind === o.kind))
  return [...own, ...extra].map(l => {
    const o = other.find(x => x.kind === l.kind)
    const best = o ? fresher(o, l) : l
    return resetOf(best) <= at ? { kind: best.kind, percentUsed: 0 } : best
  })
}
