// Clawd in seven poses, as a plain SVG image animated with CSS keyframes: an
// image needs no frame, so it sits on the band with no background of its own.
//
// The body is Clawd's canonical 12x8 grid and colour, as ClawdMoji recovered
// them from the logo (https://github.com/afspies/ClawdMoji, MIT). It sits at
// columns 4-15, rows 4-11 of a 20x12 canvas of 3px pixels; the props fill the
// rest. Each animation moves whole pixels (`steps`) so the art stays crisp.

import type { Activity } from './activity'
import type { Drawing } from './scene'

export type Pose = Activity | 'done' | 'sleep'

const P = 3
const COLS = 20
const ROWS = 12
// Rows above the hats stay off the image, so Clawd's body sits centred.
const TOP = 2
const OX = 4 // the body's grid origin on the canvas
const OY = 4

const CLAWD = '#da7758'
const EYE = '#141416'

// -- drawing helpers ---------------------------------------------------------

/** A rect in canvas cells (fractions allowed), with an optional class/style. */
const cell = (col: number, row: number, w: number, h: number, fill: string, cls = '', style = '') =>
  `<rect x="${+(col * P).toFixed(2)}" y="${+(row * P).toFixed(2)}" width="${+(w * P).toFixed(2)}" height="${+(h * P).toFixed(2)}" fill="${fill}"` +
  `${cls ? ` class="${cls}"` : ''}${style ? ` style="${style}"` : ''}/>`

/** A rect in the body's own grid (ART coordinates). */
const art = (col: number, row: number, w: number, h: number, fill = CLAWD, cls = '') => cell(OX + col, OY + row, w, h, fill, cls)

/** A rect in raw pixels, for 1px details. */
const dot = (x: number, y: number, w: number, h: number, fill: string, cls = '', style = '') =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"${cls ? ` class="${cls}"` : ''}${style ? ` style="${style}"` : ''}/>`

// The canonical grid, split into the parts that move on their own.
const torso = art(2, 0, 8, 2) + art(2, 2, 8, 2) + art(2, 4, 8, 2)
const armL = (cls = '') => `<g class="${cls}">${art(0, 2, 2, 2)}</g>`
const armR = (cls = '') => `<g class="${cls}">${art(10, 2, 2, 2)}</g>`
const legs = (cls = '') => `<g class="${cls}">${art(2, 6, 1, 2)}${art(4, 6, 1, 2)}${art(7, 6, 1, 2)}${art(9, 6, 1, 2)}</g>`

// Eye cells sit at ART (3,1) and (8,1); in pixels:
const EYES = [(OX + 3) * P, (OX + 8) * P]
const EYE_Y = (OY + 1) * P

const eyesOpen = () => `<g class="look"><g class="blink">${EYES.map(x => dot(x, EYE_Y, P, P, EYE)).join('')}</g></g>`
const eyesDown = () => EYES.map(x => dot(x, EYE_Y + 1, P, 2, EYE)).join('')
const eyesShut = () => EYES.map(x => dot(x, EYE_Y + 2, P, 1, EYE)).join('')
const eyesHappy = () => EYES.map(x => dot(x, EYE_Y + 1, 1, 1, EYE) + dot(x + 1, EYE_Y, 1, 1, EYE) + dot(x + 2, EYE_Y + 1, 1, 1, EYE)).join('')

// -- animation ---------------------------------------------------------------

const STYLE = `
.bob{animation:bob 2.4s steps(1) infinite}
@keyframes bob{50%{transform:translateY(1px)}}
.slow{animation:bob 4.2s steps(1) infinite}
.blink{transform-box:fill-box;transform-origin:center bottom;animation:blink 5.3s steps(1) infinite}
@keyframes blink{0%,94%,100%{transform:scaleY(1)}95%,97%{transform:scaleY(.34)}}
.look{animation:look 9s steps(1) infinite}
@keyframes look{0%,30%{transform:translateX(0)}31%,45%{transform:translateX(-1px)}46%,64%{transform:translateX(0)}65%,78%{transform:translateX(1px)}79%{transform:translateX(0)}}
.typeL{animation:type .3s steps(1) infinite}
.typeR{animation:type .3s steps(1) infinite .15s}
@keyframes type{50%{transform:translateY(2px)}}
.glow{animation:glow 1.6s steps(4) infinite}
@keyframes glow{0%,100%{opacity:.04}50%{opacity:.13}}
.bit{opacity:0;animation:bit 1.5s steps(6) infinite}
@keyframes bit{0%{opacity:0;transform:translateY(0)}15%{opacity:1}100%{opacity:0;transform:translateY(-9px)}}
.page{transform-box:fill-box;transform-origin:left center;opacity:0;animation:page 3.4s steps(8) infinite}
@keyframes page{0%,60%{opacity:0;transform:scaleX(1)}64%{opacity:1;transform:scaleX(1)}90%{opacity:1;transform:scaleX(-1)}94%,100%{opacity:0;transform:scaleX(-1)}}
.stroke{transform-box:fill-box;transform-origin:left center;transform:scaleX(0);animation:stroke 4.8s steps(6) infinite}
@keyframes stroke{0%{transform:scaleX(0)}20%,92%{transform:scaleX(1)}100%{transform:scaleX(0)}}
.brush{animation:brush 4.8s steps(1) infinite}
@keyframes brush{0%{transform:translate(0,0)}10%{transform:translate(2px,0)}20%{transform:translate(0,3px)}30%{transform:translate(2px,3px)}40%{transform:translate(0,6px)}50%{transform:translate(2px,6px)}60%,100%{transform:translate(0,0)}}
.wrench{transform-box:view-box;transform-origin:${(OX + 12) * P}px ${(OY + 3) * P}px;animation:wrench .8s steps(4) infinite alternate}
@keyframes wrench{from{transform:rotate(-30deg)}to{transform:rotate(25deg)}}
.spark{opacity:0;animation:spark .8s steps(1) infinite}
@keyframes spark{40%{opacity:1}60%{opacity:0}}
.jump{animation:jump .55s steps(5) 4}
@keyframes jump{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
.cheer{animation:cheer .55s steps(1) 4}
@keyframes cheer{50%{transform:translateY(-3px)}}
.confetti{opacity:0;animation:confetti 1.4s steps(7) infinite}
@keyframes confetti{0%{opacity:1;transform:translateY(0)}100%{opacity:0;transform:translateY(14px)}}
.z{opacity:0;animation:z 3s steps(6) infinite}
@keyframes z{0%{opacity:0;transform:translate(0,0)}20%{opacity:1}100%{opacity:0;transform:translate(4px,-10px)}}
.sweat{animation:sweat 1.3s steps(5) infinite}
@keyframes sweat{0%{opacity:1;transform:translate(0,0)}100%{opacity:0;transform:translate(1px,6px)}}
`

// -- poses -------------------------------------------------------------------

const idle = () => `<g class="bob">${torso}${armL()}${armR()}${eyesOpen()}</g>${legs()}`

const sleep = () => {
  // A 3x3 "z" in 1px pixels, three of them drifting up.
  const z = (x: number, y: number, delay: number) =>
    `<g class="z" style="animation-delay:${delay}s">${dot(x, y, 3, 1, '#9aa3b5')}${dot(x + 1, y + 1, 1, 1, '#9aa3b5')}${dot(x, y + 2, 3, 1, '#9aa3b5')}</g>`

  return (
    `<g class="slow">${torso}${armL()}${armR()}${eyesShut()}</g>${legs()}` +
    z(47, 16, 0) + z(51, 12, 1) + z(55, 8, 2)
  )
}

const done = () => {
  const colors = ['#ef4444', '#f5c518', '#4fc3a1', '#5b8cff', '#b98cff', '#e879c6']
  const confetti = colors
    .map((c, i) => dot(4 + i * 9, 6 + (i % 3) * 2, 2, 2, c, 'confetti', `animation-delay:${(i * 0.23).toFixed(2)}s`))
    .join('')

  return `<g class="jump">${torso}${armL('cheer')}${armR('cheer')}${eyesHappy()}${legs()}</g>${confetti}`
}

const code = () => {
  const lid = cell(6, 8, 8, 2.67, '#c9cdd5') + dot(9.5 * P, 9 * P, 3, 3, '#e8eaee') + dot(9.5 * P + 1, 9 * P - 1, 1, 5, '#e8eaee') + dot(9.5 * P - 1, 9 * P + 1, 5, 1, '#e8eaee')
  const base = cell(5, 10.67, 10, 0.67, '#8e949e')
  const glow = cell(6, 5, 8, 1, '#8fd0ff', 'glow')
  const bits = [0, 1, 2]
    .map(i => dot(49 + i * 3, 12 - i, 2, 2, i === 1 ? '#5b8cff' : '#4fc3a1', 'bit', `animation-delay:${i * 0.5}s`))
    .join('')

  return (
    `<g class="bob">${torso}${eyesOpen()}${glow}</g>${legs()}` +
    `${armL('typeL')}${armR('typeR')}${lid}${base}${bits}`
  )
}

const read = () => {
  const glasses =
    EYES.map(x => `<rect x="${x - 1.5}" y="${EYE_Y - 1.5}" width="${P + 3}" height="${P + 3}" fill="none" stroke="#2a2a30" stroke-width="1"/>`).join('') +
    dot(EYES[0]! + P + 1.5, EYE_Y, EYES[1]! - EYES[0]! - P - 3, 1, '#2a2a30')
  const cover = cell(5, 9, 10, 2.67, '#8b5e3c')
  const pages = cell(6, 8.67, 4, 2.33, '#f4efe3') + cell(10, 8.67, 4, 2.33, '#f4efe3') + dot(10 * P - 0.5, 8.67 * P, 1, 7, '#c9bfa8')
  const lines = [6.33, 10.33]
    .map(c => [9.33, 10, 10.67].map((r, i) => dot(c * P, r * P, i === 2 ? 7 : 9, 1, '#b9b1a0')).join(''))
    .join('')

  return (
    `<g class="slow">${torso}${eyesDown()}${glasses}</g>` +
    `${cover}${pages}${lines}${cell(10, 8.67, 4, 2.33, '#fffaf0', 'page')}${armL()}${armR()}`
  )
}

const design = () => {
  const beret = cell(6, 2.67, 8, 1.33, '#6d5dfc') + cell(13.67, 3.33, 1, 0.67, '#6d5dfc') + cell(9.67, 2, 0.67, 0.67, '#6d5dfc')
  const easel = cell(16.33, 4, 3.33, 4, '#f6f1e7') + dot(17 * P, 8 * P, 1, 12, '#a07850') + dot(19 * P, 8 * P, 1, 12, '#a07850')
  const strokes = ['#ef4444', '#f5c518', '#5b8cff']
    .map((c, i) => cell(16.67, 4.67 + i * 1.1, 2.67, 0.67, c, 'stroke', `animation-delay:${(i * 0.9).toFixed(1)}s`))
    .join('')
  const brush = `<g class="brush">${dot(15.5 * P, 4.5 * P, 1, 6, '#c49a6c')}${dot(15.5 * P - 0.5, 4.5 * P - 2, 2, 2, '#ef4444')}</g>`
  const palette = cell(0.33, 7.33, 3, 2, '#e9d8b4') + dot(3, 24, 2, 2, '#ef4444') + dot(6, 23, 2, 2, '#4fc3a1') + dot(4, 27, 2, 2, '#5b8cff')

  return `<g class="bob">${torso}${eyesOpen()}${beret}</g>${legs()}${armL()}${armR()}${palette}${easel}${strokes}${brush}`
}

const ops = () => {
  const hat = cell(6, 2.33, 8, 1.67, '#f5c518') + cell(8.67, 2.33, 2.67, 0.67, '#ffe066') + cell(5, 3.67, 10, 0.67, '#d9a800')
  const wrench =
    `<g class="wrench">${dot((OX + 12) * P, (OY + 3) * P - 1, 8, 2, '#a3a9b4')}` +
    `${dot((OX + 12) * P + 7, (OY + 3) * P - 4, 2, 8, '#a3a9b4')}${dot((OX + 12) * P + 9, (OY + 3) * P - 4, 2, 2, '#a3a9b4')}${dot((OX + 12) * P + 9, (OY + 3) * P + 2, 2, 2, '#a3a9b4')}</g>`
  const sparks =
    dot(57, 12, 2, 2, '#ffd166', 'spark') +
    dot(55, 20, 1, 1, '#ffd166', 'spark', 'animation-delay:.3s') +
    dot(58, 17, 1, 1, '#ff9f43', 'spark', 'animation-delay:.55s')

  return `<g class="bob">${torso}${eyesOpen()}${hat}</g>${legs()}${armL()}${armR()}${wrench}${sparks}`
}

const POSE: Record<Pose, () => string> = { idle, sleep, done, code, read, design, ops }

export const ALT: Record<Pose, string> = {
  idle: 'Clawd is resting',
  sleep: 'Clawd is asleep',
  done: 'Clawd is celebrating',
  code: 'Clawd is coding',
  read: 'Clawd is reading',
  design: 'Clawd is designing',
  ops: 'Clawd is doing ops work',
}

// Drawn at 3px pixels, shown at 2px: every cell lands on whole pixels.
const SHOWN = 2 / 3

export const mascot = (pose: Pose, isSweating: boolean): Drawing => {
  const w = COLS * P
  const h = (ROWS - TOP) * P
  const shownW = w * SHOWN
  const shownH = h * SHOWN
  const sweat = isSweating
    ? `<path d="M${(OX - 1) * P} ${OY * P} q2 3 0 5 q-2 -2 0 -5z" fill="#6ec3ff" class="sweat"/>`
    : ''
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${shownW}" height="${shownH}" viewBox="0 ${TOP * P} ${w} ${h}" shape-rendering="crispEdges">` +
    `<style>${STYLE}</style>${POSE[pose]()}${sweat}</svg>`

  return { svg, width: shownW, height: shownH }
}
