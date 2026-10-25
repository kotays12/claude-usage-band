import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Reading, Segment } from '../types'
import { classify } from './activity'
import { isReading, merge, parse } from './limits'
import { ALT, mascot } from './mascot'
import type { Pose } from './mascot'
import { hourglass, lane, level, ring } from './scene'

const snapshot = atom({ plugin: 'usage-band', key: 'snapshot' } as const, null)
const now = atom({ plugin: 'usage-band', key: 'now' } as const, 0)
const activity = atom({ plugin: 'usage-band', key: 'activity' } as const, 'idle')
const doneAt = atom({ plugin: 'usage-band', key: 'doneAt' } as const, 0)
const idleSince = atom({ plugin: 'usage-band', key: 'idleSince' } as const, 0)
// Time spent working: the sum of turns, from a prompt to its answer.
const workMs = atom({ plugin: 'usage-band', key: 'workMs' } as const, 0)
const turnStartedAt = atom({ plugin: 'usage-band', key: 'turnStartedAt' } as const, 0)
// The account's windows as the server last answered them.
const server = atom({ plugin: 'usage-band', key: 'server' } as const, null)

// The band looks again this often, so an idle chat still shows where things stand.
const TICK_MS = 5 * 1000
const MINUTE = 60 * 1000
// Clawd cheers this long after a turn, and dozes off after this long idle.
const DONE_MS = 2400
const SLEEP_MS = 3 * 60 * 1000
// Work time is kept per session in the plugin's store, so a resumed session
// picks up where it left off; only the most recent sessions are kept.
const WORK_PREFIX = 'work:'
const WORK_KEEP = 50
// The session's own limits come with each API response, so an idle chat would
// show them stale while other sessions spend the same quota: the server answers
// the account's windows as they stand now. The last reading any session got is
// kept in the store, so sessions share it.
const USAGE_URL = 'https://api.anthropic.com/api/oauth/usage'
const SHARED_KEY = 'limits'
const SERVER_MS = 10 * 1000
// After a refusal, ask again this much later: a busy server, or no subscription.
const BUSY_MS = 2 * 60 * 1000
const OFF_MS = 15 * 60 * 1000
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const BAR_CELLS = 12

// -- formatting --------------------------------------------------------------

const compact = (n: number) => {
  if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${+(n / 1_000).toFixed(1)}k`
  return String(n)
}

const label = (kind: string) => {
  if (kind === 'five_hour') return 'Session'
  if (kind === 'seven_day') return 'Weekly'
  if (kind === 'spend_limit') return 'Credits'
  const model = /^seven_day_(.+)$/.exec(kind)?.[1]
  return model ? `Weekly · ${model.charAt(0).toUpperCase()}${model.slice(1)}` : kind
}

const resets = (iso: string | undefined, at: number) => {
  if (!iso) return ''
  const target = new Date(iso)
  const ms = target.getTime() - at
  if (Number.isNaN(ms) || ms <= 0) return ''
  const minutes = Math.round(ms / 60000)
  if (minutes < 60) return `${minutes}m`
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`
  const h = target.getHours()
  const clock = `${h % 12 || 12}:${String(target.getMinutes()).padStart(2, '0')}${h < 12 ? 'am' : 'pm'}`
  return `${DAYS[target.getDay()]} ${clock}`
}

const termColor = { ok: 'suggestion', warn: 'warning', hot: 'error' } as const
const pctColor = { ok: undefined, warn: 'warning', hot: 'error' } as const

const elapsed = (ms: number) => {
  const minutes = Math.max(0, Math.floor(ms / 60000))
  if (minutes < 60) return `${minutes}m`
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`
}

const cells = (percent: number, width: number) => Math.max(0, Math.min(width, Math.round((percent / 100) * width)))

// -- data --------------------------------------------------------------------

async function refresh($: EngineInterface) {
  const u = await $.session.usage({ breakdown: 'summary' })
  const t = await $.clock.now()
  const segments: Segment[] = (u.context.breakdown?.categories ?? [])
    .filter(c => c.kind === 'used' && c.tokens > 0)
    .map(c => ({ name: c.name, tokens: c.tokens }))

  const next = {
    context: { tokens: u.context.tokens, window: u.context.window, percent: u.context.percent, segments },
    rateLimits: u.rateLimits.map(r => ({ kind: r.kind, percentUsed: r.percentUsed, resetsAt: r.resetsAt })),
    startedAt: u.startedAt,
  }
  // A write redraws the band: only when a figure moved.
  if (JSON.stringify(await read($, snapshot)) !== JSON.stringify(next)) await update($, snapshot, () => next)
  return t
}

let serverNextAt = 0

async function poll($: EngineInterface, t: number): Promise<Reading | null> {
  if (t < serverNextAt) return null
  serverNextAt = t + SERVER_MS

  const shared = await $.store.get(SHARED_KEY)
  if (isReading(shared) && t - shared.at < SERVER_MS) return shared

  try {
    const auth = await $.session.authorize()
    if (auth?.kind !== 'bearer') {
      serverNextAt = t + OFF_MS
      return null
    }
    const res = await $.http.fetch(USAGE_URL, {
      auth: auth.handle,
      headers: { 'anthropic-beta': 'oauth-2025-04-20', accept: 'application/json' },
    })
    if (!res.ok) {
      const retry = Number(res.headers['retry-after']) * 1000 || 0
      serverNextAt = t + (res.status === 429 ? Math.max(BUSY_MS, retry) : OFF_MS)
      return null
    }
    const reading = { limits: parse(res.text), at: t }
    await $.store.set(SHARED_KEY, reading)
    return reading
  } catch {
    // Refused by policy or offline: the session's own figures stand.
    serverNextAt = t + OFF_MS
    return null
  }
}

async function pollServer($: EngineInterface, t: number) {
  const reading = await poll($, t)
  if (reading && JSON.stringify((await read($, server))?.limits) !== JSON.stringify(reading.limits)) {
    await update($, server, () => reading)
  }
}

type WorkEntry = { ms: number; at: number }

const isWorkEntry = (v: unknown): v is WorkEntry =>
  typeof v === 'object' && v !== null && typeof (v as WorkEntry).ms === 'number' && typeof (v as WorkEntry).at === 'number'

async function loadWork($: EngineInterface) {
  const saved = await $.store.get(WORK_PREFIX + (await $.session.id()))
  if (isWorkEntry(saved)) await update($, workMs, prev => Math.max(prev, saved.ms))
}

async function saveWork($: EngineInterface, ms: number, at: number) {
  await $.store.set(WORK_PREFIX + (await $.session.id()), { ms, at } satisfies WorkEntry)

  const keys = (await $.store.keys()).filter(k => k.startsWith(WORK_PREFIX))
  if (keys.length <= WORK_KEEP) return
  const entries = await Promise.all(keys.map(async k => ({ k, v: await $.store.get(k) })))
  const stale = entries
    .sort((a, b) => (isWorkEntry(a.v) ? a.v.at : 0) - (isWorkEntry(b.v) ? b.v.at : 0))
    .slice(0, keys.length - WORK_KEEP)
  await Promise.all(stale.map(e => $.store.delete(e.k)))
}

// -- hooks -------------------------------------------------------------------

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const t = await refresh($)
    await update($, now, () => t)
    await update($, idleSince, prev => prev || t)
    await loadWork($)
    void pollServer($, t)
    void $.clock.every(TICK_MS, async () => {
      const t = await refresh($)
      await pollServer($, t)
      // Resets and the work clock count minutes: between moves, redraw once a minute.
      if (Math.floor(t / MINUTE) !== Math.floor((await read($, now)) / MINUTE)) await update($, now, () => t)
    })

    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    const t = await refresh($)
    await update($, now, () => t)

    return next(e)
  })

  // Clawd's role follows the work: thinking reads, then each tool sets it.
  on('prompt.submit', async ($, e, next) => {
    const t = await $.clock.now()
    await update($, activity, () => 'read')
    await update($, turnStartedAt, () => t)
    await update($, now, () => t)

    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const role = classify(e)
    await update($, activity, () => role)

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    // A subagent's turn ends inside the main one: the main turn counts it.
    if (e.agentId) return next(e)

    const t = await $.clock.now()
    await update($, activity, () => 'idle')
    await update($, doneAt, () => t)
    await update($, idleSince, () => t)
    await update($, now, () => t)
    const started = await read($, turnStartedAt)
    if (started > 0) {
      const took = e.durationMs > 0 ? e.durationMs : t - started
      const total = await update($, workMs, prev => prev + Math.max(0, took))
      await update($, turnStartedAt, () => 0)
      void saveWork($, total, t)
    }
    // Redraw once the cheer is over, so Clawd settles back to idle.
    void $.clock.after(DONE_MS, async () => {
      const later = await $.clock.now()
      await update($, now, () => later)
    })

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const snap = await read($, snapshot)

    if (e.props.hasSurvey || snap === null) {
      return next(e)
    }

    // Other mods' bands sit beneath this one; draw theirs above ours, the status row stays last.
    const below = await next(e)
    const at = (await read($, now)) || (await $.clock.now())
    const { context } = snap
    const rateLimits = merge(snap.rateLimits, (await read($, server))?.limits ?? [], at)
    const ctxPercent = context.percent ?? 0
    const ctxFigure = `${compact(context.tokens ?? 0)} / ${compact(context.window)}`
    // Work so far, plus the turn running now.
    const started = await read($, turnStartedAt)
    const live = e.props.isWorking && started > 0 ? Math.max(0, at - started) : 0
    const worked = elapsed((await read($, workMs)) + live)

    if (e.surface === 'terminal') {
      const { Box, Text } = $.ui.resolve(e)
      // One line always: the bars get whatever columns the text leaves.
      const groups = [
        ['Context', `${ctxPercent}%`, ctxFigure],
        ...rateLimits.map(r => [label(r.kind), `${r.percentUsed}%`, resets(r.resetsAt, at) && `↻ ${resets(r.resetsAt, at)}`]),
      ]
      const text = groups.reduce((sum, g) => sum + g.join(' ').length + 2, 0) + worked.length + 2
      const gaps = 2 * groups.length
      const width = Math.max(3, Math.min(BAR_CELLS, Math.floor((e.props.bodyColumns - text - gaps) / groups.length)))
      const bar = (percent: number, color: string) => (
        <Text>
          <Text color={color}>{'━'.repeat(cells(percent, width))}</Text>
          <Text color="subtle">{'━'.repeat(width - cells(percent, width))}</Text>
        </Text>
      )

      return (
        <Box flexDirection="column">
          {below}
          <Box key="usage-band" flexDirection="row" flexWrap="nowrap" columnGap={2} overflow="hidden">
            <Box key="ctx" gap={1} flexShrink={0}>
              <Text color="subtle">Context</Text>
              {bar(ctxPercent, termColor[level(ctxPercent)])}
              <Text bold>{ctxPercent}%</Text>
              <Text color="subtle">{ctxFigure}</Text>
            </Box>
            {rateLimits.map(r => (
              <Box key={r.kind} gap={1} flexShrink={0}>
                <Text color="subtle">{label(r.kind)}</Text>
                {bar(r.percentUsed, termColor[level(r.percentUsed)])}
                <Text bold>{r.percentUsed}%</Text>
                <Text color="subtle">{resets(r.resetsAt, at) && `↻ ${resets(r.resetsAt, at)}`}</Text>
              </Box>
            ))}
            <Text color="subtle">⧗ {worked}</Text>
          </Box>
        </Box>
      )
    }

    const { Box, Svg, Text } = $.ui.resolve(e)
    const pose: Pose = e.props.isWorking
      ? await read($, activity)
      : at - (await read($, doneAt)) < DONE_MS
        ? 'done'
        : at - (await read($, idleSince)) > SLEEP_MS && (await read($, idleSince)) > 0
          ? 'sleep'
          : 'idle'
    const isSweating = ctxPercent >= 85 || rateLimits.some(r => r.percentUsed >= 90)
    const clawd = mascot(pose, isSweating)
    const track = lane(ctxPercent, context.segments, e.props.isWorking)
    const timer = hourglass()

    // One line always: everything keeps its size but the context lane, which
    // has no width of its own and gives up room when the band runs short.
    return (
      <Box flexDirection="column">
        {below}
        <Box key="usage-band" flexDirection="row" flexWrap="nowrap" alignItems="center" columnGap={2} overflow="hidden">
          <Box key="ctx" alignItems="center" gap={1} flexShrink={1}>
            <Box flexShrink={0}>
              <Svg source={clawd.svg} alt={ALT[pose]} width={clawd.width} height={clawd.height} />
            </Box>
            <Box key="lane" flexShrink={1} minWidth={3}>
              <Svg source={track.svg} alt={`Context ${ctxPercent}% used`} height={track.height} />
            </Box>
            <Box flexShrink={0} gap={1}>
              <Text bold color={pctColor[level(ctxPercent)]}>{ctxPercent}%</Text>
              <Text color="subtle">{ctxFigure}</Text>
            </Box>
          </Box>
          {rateLimits.map(r => {
            const dial = ring(r.percentUsed)
            const reset = resets(r.resetsAt, at)
            return (
              <Box key={r.kind} alignItems="center" gap={1} flexShrink={0}>
                <Svg source={dial.svg} alt={`${label(r.kind)} ${r.percentUsed}% used`} width={dial.width} height={dial.height} />
                <Text color="subtle">{label(r.kind)}</Text>
                <Text bold color={pctColor[level(r.percentUsed)]}>{r.percentUsed}%</Text>
                {reset ? <Text color="subtle">↻ {reset}</Text> : null}
              </Box>
            )
          })}
          <Box key="time" alignItems="center" gap={1} flexShrink={0}>
            <Svg source={timer.svg} alt="Time spent working" width={timer.width} height={timer.height} />
            <Text color="subtle">{worked}</Text>
          </Box>
        </Box>
      </Box>
    )
  })
}
