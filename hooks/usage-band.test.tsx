import type { SessionUsage } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

import { classify } from './activity'
import { mascot } from './mascot'

const BAND = {
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 10,
    bodyColumns: 160,
    scroll: { offset: 0, bodyRows: 10 },
    view: {},
  },
} as const

const category = (name: string, tokens: number, kind: 'used' | 'free') => ({
  name,
  tokens,
  kind,
  color: 'text',
  isDeferred: false,
})

const NOW = Date.parse('2026-10-09T12:00:00Z')

const USAGE = {
  startedAt: NOW - 83 * 60_000,
  context: {
    tokens: 94_900,
    window: 1_000_000,
    percent: 9,
    breakdown: {
      categories: [
        category('System prompt', 20_000, 'used'),
        category('Messages', 74_900, 'used'),
        category('Free space', 905_100, 'free'),
      ],
    },
  },
  rateLimits: [
    { kind: 'five_hour', percentUsed: 45 },
    { kind: 'seven_day', percentUsed: 92 },
  ],
} as unknown as SessionUsage

// The test's own hook answers $.session.usage the way the engine would, then a
// measurement reaches the plugin as after a turn.
type Body = Extract<Parameters<typeof test>[1], (...args: never[]) => unknown>

const measure = async (...[$, on]: Parameters<Body>) => {
  mock.clock(on, { now: NOW })
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box key="engine" />
  })
  on('session.usage', () => ({ value: USAGE }))
  on('session.measure', (_$, e) => ({ changed: e.changed }))
  await $.session.measure({
    context: { tokens: 94_900, window: 1_000_000, percent: 9 },
    rateLimits: USAGE.rateLimits,
    changed: ['context', 'rateLimits'],
  })
}

test('terminal band shows context and limits', async ($, on) => {
  await measure($, on)
  const ui = await $.ui.mount({ plugin: 'usage-band', surface: 'terminal', ...BAND })

  expect(await ui.find({ type: 'Text', text: '9%' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /94\.9k \/ 1M/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Session' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Weekly' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '92%' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /\$/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: '⧗ 0m' })).toBeDefined()

  await ui.unmount()
})

test('desktop band: resting Clawd, lane and rings as plain images', async ($, on) => {
  await measure($, on)
  const ui = await $.ui.mount({ plugin: 'usage-band', surface: 'desktop', ...BAND })

  expect(await ui.find({ type: 'Text', text: '9%' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '94.9k / 1M' })).toBeDefined()
  expect((await ui.find({ type: 'Text', text: '92%' }))?.props.color).toBe('error')
  expect(await ui.find({ type: 'Text', text: '0m' })).toBeDefined()

  const clawd = await ui.find({ type: 'Svg' })
  expect(clawd?.props.alt).toBe('Clawd is resting')
  expect(clawd?.props.isInteractive).toBeUndefined()
  // Weekly at 92% makes Clawd sweat.
  expect(String(clawd?.props.source)).toContain('class="sweat"')

  await ui.unmount()
})

test('a Bash call puts the hard hat on while the turn runs', async ($, on) => {
  on('tool.call', () => ({ result: { stdout: '', stderr: '', interrupted: false }, isError: false, text: '' }) as never)
  await measure($, on)
  await $.tool.call({ tool: 'Bash', command: 'ls' } as never)

  const working = await $.ui.mount({
    plugin: 'usage-band',
    surface: 'desktop',
    ...BAND,
    props: { ...BAND.props, isWorking: true },
  })
  expect((await working.find({ type: 'Svg' }))?.props.alt).toBe('Clawd is doing ops work')
  await working.unmount()
})

test('classify reads the role off the tool', () => {
  expect(classify({ tool: 'Edit', file_path: 'src/app.ts' })).toBe('code')
  expect(classify({ tool: 'Write', file_path: 'styles/main.css' })).toBe('design')
  expect(classify({ tool: 'Grep' })).toBe('read')
  expect(classify({ tool: 'WebSearch' })).toBe('read')
  expect(classify({ tool: 'Agent', subagent_type: 'Explore' })).toBe('read')
  expect(classify({ tool: 'Skill', skill: 'frontend-design:frontend-design' })).toBe('design')
  expect(classify({ tool: 'mcp__figma__get_file' })).toBe('design')
  expect(classify({ tool: 'mcp__gitlab__list_merge_requests' })).toBe('read')
  expect(classify({ tool: 'mcp__gitlab__create_issue' })).toBe('ops')
  expect(classify({ tool: 'Bash' })).toBe('ops')
})

test('a narrow terminal band stays one line: the bars give up room', async ($, on) => {
  await measure($, on)

  const narrow = await $.ui.mount({
    plugin: 'usage-band',
    surface: 'terminal',
    ...BAND,
    props: { ...BAND.props, bodyColumns: 90 },
  })
  const bar = await narrow.find({ type: 'Text', text: /^━+$/ })
  expect(bar?.text.length).toBeLessThan(12)
  await narrow.unmount()
})

test('work time sums turns, not the time between them', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  mock.store(on)
  on('session.id', () => ({ value: 'session-1' }) as never)
  on('prompt.submit', (_$, e) => e as never)
  on('turn.complete', (_$, e) => ({ text: e.answer }))
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box key="engine" />
  })
  on('session.usage', () => ({ value: USAGE }))
  on('session.measure', (_$, e) => ({ changed: e.changed }))
  await $.session.measure({
    context: { tokens: 94_900, window: 1_000_000, percent: 9 },
    rateLimits: USAGE.rateLimits,
    changed: ['context', 'rateLimits'],
  })

  const turn = async (ms: number) => {
    await $.prompt.submit({ text: 'go', wait: false } as never)
    await clock.advance(ms)
    await $.turn.complete({ reason: 'answer', answer: 'done', durationMs: ms, isAborted: false, turnId: `t${ms}` })
  }

  await turn(20 * 60_000)
  await clock.advance(45 * 60_000) // idle between messages: not counted
  await turn(5 * 60_000)
  // A subagent's turn inside the main one adds nothing of its own.
  await $.turn.complete({ reason: 'answer', answer: '', durationMs: 60_000, isAborted: false, turnId: 'sub', agentId: 'a1' })

  const ui = await $.ui.mount({ plugin: 'usage-band', surface: 'terminal', ...BAND })
  expect(await ui.find({ type: 'Text', text: '⧗ 25m' })).toBeDefined()
  await ui.unmount()
})

test('every pose draws its own props', () => {
  expect(mascot('sleep', false).svg).toContain('class="z"')
  expect(mascot('done', false).svg).toContain('class="confetti"')
  expect(mascot('code', false).svg).toContain('class="typeL"')
  expect(mascot('read', false).svg).toContain('class="page"')
  expect(mascot('design', false).svg).toContain('class="stroke"')
  expect(mascot('ops', false).svg).toContain('class="wrench"')
  expect(mascot('idle', false).svg).not.toContain('class="sweat"')
  expect(mascot('idle', true).svg).toContain('class="sweat"')
  expect(mascot('idle', false)).toMatchObject({ width: 40, height: 20 })
})

test('band stays out of the way during a survey', async ($, on) => {
  await measure($, on)
  const ui = await $.ui.mount({
    plugin: 'usage-band',
    surface: 'terminal',
    ...BAND,
    props: { ...BAND.props, hasSurvey: true },
  })

  expect(await ui.find({ type: 'Text', text: 'Session' })).toBeUndefined()
  expect(await ui.find({ key: 'engine' })).toBeDefined()

  await ui.unmount()
})

test('another band beneath this one is still drawn, above the status row', async ($, on) => {
  await measure($, on)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'usage-band', surface, ...BAND })
    expect(await ui.find({ key: 'usage-band' })).toBeDefined()
    expect(await ui.find({ key: 'engine' })).toBeDefined()
    await ui.unmount()
  }
})
