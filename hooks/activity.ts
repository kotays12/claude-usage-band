// What Clawd is doing, read off the tool the model just called.

export type Activity = 'idle' | 'code' | 'read' | 'design' | 'ops'

type Call = {
  tool: string
  file_path?: unknown
  notebook_path?: unknown
  skill?: unknown
  subagent_type?: unknown
}

const DESIGN_FILE = /\.(css|scss|sass|less|styl|svg|png|jpe?g|gif|webp|fig|sketch)$/i
const DESIGN_WORD = /design|figma|ui-?ux|brand|banner|artifact|canvas|visuali[sz]e|show_widget|frontend/i
const READING = new Set(['Read', 'Grep', 'Glob', 'LSP', 'WebFetch', 'WebSearch', 'ToolSearch', 'NotebookRead'])
const WRITING = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit'])
const MCP_READ = /(^|_)(get|list|search|read|query|find|fetch|whoami|discover)(_|$)/i

const text = (v: unknown) => (typeof v === 'string' ? v : '')

export const classify = (call: Call): Activity => {
  const { tool } = call
  const skill = text(call.skill)

  if (DESIGN_WORD.test(tool) || DESIGN_WORD.test(skill)) return 'design'
  if (WRITING.has(tool)) {
    return DESIGN_FILE.test(text(call.file_path) || text(call.notebook_path)) ? 'design' : 'code'
  }
  if (READING.has(tool)) return 'read'
  if (tool === 'Skill') return 'read'
  if (tool === 'Agent' || tool === 'Task') {
    return /explore|plan|review|guide/i.test(text(call.subagent_type)) ? 'read' : 'ops'
  }
  if (tool.startsWith('mcp__')) return MCP_READ.test(tool.split('__').pop() ?? '') ? 'read' : 'ops'

  return 'ops'
}
