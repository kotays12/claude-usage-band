// The desktop band's bars as plain SVG images: a slim context lane and a tiny
// ring per rate-limit window. No text and no frame: the engine's Text draws
// the figures in the person's theme, and an image has no background.

export type SceneSegment = { name: string; tokens: number }
export type Drawing = { svg: string; width: number; height: number }

const LANE = { w: 120, h: 5 }
const SEGMENTS = ['#7c9cff', '#b98cff', '#4fc3a1', '#f2b84b', '#e879c6', '#5cc8e6', '#a3d977']
const LEVEL = { ok: '#5b8cff', warn: '#f5a524', hot: '#ef4444' }
const TRACK = 'rgba(128,128,140,0.28)'

export const level = (p: number) => (p >= 90 ? 'hot' : p >= 70 ? 'warn' : 'ok')
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const f = (n: number) => +n.toFixed(2)

// -- context lane ------------------------------------------------------------

export const lane = (percent: number, segments: SceneSegment[], isWorking: boolean): Drawing => {
  const { w, h } = LANE
  const fillW = (clamp(percent, 0, 100) / 100) * w
  const used = segments.reduce((sum, s) => sum + s.tokens, 0)

  let cursor = 0
  const rects = (used > 0 ? segments : [{ name: 'Context', tokens: 1 }])
    .map((s, i) => {
      const sw = (s.tokens / (used || 1)) * fillW
      const r = `<rect x="${f(cursor)}" width="${f(Math.max(sw, 0.8))}" height="${h}" fill="${SEGMENTS[i % SEGMENTS.length]}"/>`
      cursor += sw
      return r
    })
    .join('')

  const style =
    `.shine{animation:shine ${isWorking ? 1.4 : 3.6}s linear infinite}` +
    `@keyframes shine{from{transform:translateX(0)}to{transform:translateX(${w + 30}px)}}`

  const svg =
    // preserveAspectRatio none: the band may draw the lane narrower than this,
    // and the bar then squeezes across rather than shrinking whole.
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><style>${style}</style>` +
    `<defs>` +
    `<clipPath id="lane"><rect width="${w}" height="${h}" rx="${h / 2}"/></clipPath>` +
    `<clipPath id="fill"><rect width="${f(fillW)}" height="${h}"/></clipPath>` +
    `<linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="0.5" stop-color="#fff" stop-opacity="0.7"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>` +
    `</defs>` +
    `<rect width="${w}" height="${h}" rx="${h / 2}" fill="${TRACK}"/>` +
    `<g clip-path="url(#lane)"><g clip-path="url(#fill)">${rects}<rect x="-30" width="30" height="${h}" fill="url(#g)" opacity="0.6" class="shine"/></g></g></svg>`

  return { svg, width: w, height: h }
}

// -- rate-limit ring ---------------------------------------------------------

const RING = { size: 14, r: 5, sw: 2.2 }

export const ring = (percent: number): Drawing => {
  const { size, r, sw } = RING
  const c = size / 2
  const circumference = 2 * Math.PI * r
  const p = clamp(percent, 0, 100) / 100
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${TRACK}" stroke-width="${sw}"/>` +
    (p > 0
      ? `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${LEVEL[level(percent)]}" stroke-width="${sw}" stroke-linecap="round" ` +
        `stroke-dasharray="${f(circumference)}" stroke-dashoffset="${f(circumference * (1 - p))}" transform="rotate(-90 ${c} ${c})"/>`
      : '') +
    `</svg>`

  return { svg, width: size, height: size }
}

// -- session hourglass -------------------------------------------------------

/** A tiny hourglass, sand trickling from the top bulb to the bottom one. */
export const hourglass = (): Drawing => {
  const size = 14
  const ink = '#9a9aa3'
  const sand = '#e0a64b'
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    `<style>.flow{stroke-dasharray:1 1.2;animation:flow .7s linear infinite}@keyframes flow{to{stroke-dashoffset:-2.2}}</style>` +
    `<rect x="2.5" y="1" width="9" height="1.4" rx="0.7" fill="${ink}"/>` +
    `<rect x="2.5" y="11.6" width="9" height="1.4" rx="0.7" fill="${ink}"/>` +
    `<path d="M3.8 2.4 H10.2 L7.7 7 L10.2 11.6 H3.8 L6.3 7 Z" fill="none" stroke="${ink}" stroke-width="1.1" stroke-linejoin="round"/>` +
    `<path d="M5.4 4.6 H8.6 L7 6.6 Z" fill="${sand}"/>` +
    `<path d="M4.9 11.1 H9.1 L7 9.1 Z" fill="${sand}"/>` +
    `<line x1="7" y1="6.8" x2="7" y2="10.6" stroke="${sand}" stroke-width="0.9" class="flow"/>` +
    `</svg>`

  return { svg, width: size, height: size }
}
