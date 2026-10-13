export type Limit = { kind: string; percentUsed: number; resetsAt?: string }
export type Segment = { name: string; tokens: number }
export type Snapshot = {
  context: { tokens?: number; window: number; percent?: number; segments: Segment[] }
  rateLimits: Limit[]
  /** When the session began, in `$.clock.now()` milliseconds. */
  startedAt: number
}
export type Activity = 'idle' | 'code' | 'read' | 'design' | 'ops'

declare module 'claude-code' {
  interface PluginState {
    'usage-band': { snapshot: Snapshot | null; now: number; activity: Activity; doneAt: number; idleSince: number; workMs: number; turnStartedAt: number }
  }
}
