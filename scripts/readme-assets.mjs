// Renders the README images from the real built UI with made-up sample data.
// Usage: npm run build && node scripts/readme-assets.mjs
import { createServer } from 'node:http'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'
import { chromium } from '@playwright/test'
import sharp from 'sharp'

const IMAGES = resolve('docs/images')
const EXAMPLES = resolve('docs/examples')
const RENDERER = resolve('out/renderer')
const RAW = resolve('test-results/readme-raw')
const NOW = new Date('2026-11-27T15:42:10').getTime()
const DAY = 86_400_000
const MIN = 60_000

for (const dir of [IMAGES, EXAMPLES, RAW]) mkdirSync(dir, { recursive: true })

const CATALOG = [
  { id: 'atlas', name: 'Atlas Coffee Rebrand', colorIndex: 0, hourlyRate: 120, tasks: ['Logo concepts', 'Packaging layout', 'Brand guidelines', 'Client review call'] },
  { id: 'harbor', name: 'Harbor Legal Website', colorIndex: 1, hourlyRate: 150, tasks: ['Homepage copy', 'CMS setup', 'Accessibility fixes', 'Launch checklist'] },
  { id: 'nova', name: 'Nova Mobile App', colorIndex: 2, hourlyRate: 95, tasks: ['Sprint planning', 'Onboarding flow', 'Push notifications', 'Bug triage'] },
  { id: 'internal', name: 'Internal Admin', colorIndex: 3, hourlyRate: null, tasks: ['Invoicing', 'Inbox zero', 'Team sync'] },
  { id: 'fjord', name: 'Fjord Travel Shop', colorIndex: 4, hourlyRate: 110, tasks: ['Checkout redesign', 'Product photos', 'Performance audit'] }
]

function sampleData() {
  let seed = 42
  const rand = (n) => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed % n
  }
  const projects = CATALOG.map(({ tasks, ...p }, i) => ({ ...p, archived: false, createdAt: i + 1 }))
  const sessions = []
  for (let back = 0; back < 331; back++) {
    const date = new Date(NOW - back * DAY)
    if (date.getDay() === 0 || date.getDay() === 6) continue
    let cursor = new Date(date).setHours(8, 30 + rand(40), 0, 0)
    const count = 2 + rand(3)
    for (let s = 0; s < count; s++) {
      const project = CATALOG[rand(CATALOG.length)]
      const minutes = 35 + rand(30) * 5
      const seconds = rand(50) * 1000
      const withBreak = rand(4) === 0 && minutes > 60
      const end = cursor + minutes * MIN + seconds
      if (end > NOW - 95 * MIN) break
      const segments = withBreak
        ? [
            { start: cursor, end: cursor + 40 * MIN },
            { start: cursor + 52 * MIN, end: end + 12 * MIN }
          ]
        : [{ start: cursor, end }]
      sessions.push({
        id: `s-${back}-${s}`,
        projectId: project.id,
        name: project.tasks[rand(project.tasks.length)],
        createdAt: cursor,
        segments
      })
      cursor = segments.at(-1).end + (10 + rand(40)) * MIN
    }
  }
  return {
    version: 1,
    projects,
    sessions,
    settings: { language: 'en', autostart: true, widgetEnabled: true, rounding: { minutes: 15, mode: 'nearest' } },
    selectedProjectId: 'atlas',
    active: null,
    lastSeenAt: NOW
  }
}

const running = (data, since) => ({
  ...data,
  active: { status: 'running', projectId: 'harbor', name: 'Homepage copy', segments: [], openSince: since }
})

/** In-page stand-in for the Electron preload bridge. */
function installMock(initial) {
  let state = initial
  const listeners = new Set()
  const emit = () => listeners.forEach((fn) => fn(state))
  const set = (next) => {
    state = next
    emit()
  }
  window.__csv = {}
  window.api = {
    getState: async () => state,
    getSystemLocale: async () => 'en-US',
    onState: (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    onNavigate: () => () => undefined,
    start: async () => {
      if (state.active?.status === 'paused') {
        set({ ...state, active: { ...state.active, status: 'running', openSince: Date.now() } })
      } else if (!state.active) {
        const project = state.projects.find((p) => p.id === state.selectedProjectId)
        set({
          ...state,
          active: { status: 'running', projectId: project.id, name: 'Logo concepts', segments: [], openSince: Date.now() }
        })
      }
    },
    pause: async () => {
      const a = state.active
      set({
        ...state,
        active: { ...a, status: 'paused', openSince: null, segments: [...a.segments, { start: a.openSince, end: Date.now() }] }
      })
    },
    stop: async () => {
      const a = state.active
      const segments = a.openSince ? [...a.segments, { start: a.openSince, end: Date.now() }] : a.segments
      set({
        ...state,
        active: null,
        sessions: [...state.sessions, { id: `new-${Date.now()}`, projectId: a.projectId, name: a.name, createdAt: Date.now(), segments }]
      })
    },
    switchProject: async (id) => set({ ...state, selectedProjectId: id }),
    renameActive: async () => undefined,
    updateSession: async () => undefined,
    updateSettings: async (patch) => set({ ...state, settings: { ...state.settings, ...patch } }),
    saveCsv: async (name, content) => {
      window.__csv[name] = content
      return { saved: true, path: name }
    },
    copyText: async () => undefined,
    openMain: async () => undefined,
    openDataFolder: async () => undefined,
    widgetIgnoreMouse: async () => undefined
  }
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff' }
const server = createServer((req, res) => {
  try {
    const path = join(RENDERER, decodeURIComponent(req.url.split('?')[0]))
    const body = readFileSync(path)
    res.writeHead(200, { 'content-type': MIME[extname(path)] ?? 'application/octet-stream' })
    res.end(body)
  } catch {
    res.writeHead(404).end()
  }
})
await new Promise((done) => server.listen(0, '127.0.0.1', done))
const BASE = `http://127.0.0.1:${server.address().port}`

async function launchBrowser() {
  for (const channel of ['chrome', 'msedge']) {
    try {
      return await chromium.launch({ channel })
    } catch {
      // try the next installed browser
    }
  }
  throw new Error('Chrome or Edge is required')
}

const browser = await launchBrowser()

async function open(file, state, { viewport, scale = 2, fixedTime = true, transparent = false }) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: scale })
  const page = await context.newPage()
  if (fixedTime) await page.clock.setFixedTime(NOW)
  await page.addInitScript(installMock, state)
  await page.goto(`${BASE}/${file}`)
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(transparent ? 300 : 500)
  return { context, page }
}

const nav = async (page, target) => {
  await page.getByTestId(`nav-${target}`).click()
  await page.waitForTimeout(450)
}

const dataUri = (path) => `data:image/png;base64,${readFileSync(path).toString('base64')}`
const rawPath = (name) => join(RAW, `${name}.png`)

const CAPTION = `<div style="position:absolute;top:0;right:0;height:48px;display:flex;color:#8a8983">
  ${['M3 8h10', 'M4 4h8v8H4z', 'M4 4l8 8M12 4l-8 8']
    .map((d) => `<span style="width:46px;display:flex;align-items:center;justify-content:center"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor"><path d="${d}"/></svg></span>`)
    .join('')}</div>`

const windowBox = (src, width, extra = '') => `
  <div style="position:relative;width:${width}px;border-radius:14px;overflow:hidden;border:1px solid rgba(255,255,255,.12);box-shadow:0 40px 90px rgba(0,0,0,.65);${extra}">
    <img src="${src}" style="display:block;width:100%">${CAPTION}
  </div>`

const BACKDROP = 'background:radial-gradient(900px 520px at 22% -8%,rgba(226,183,122,.20),transparent 70%),radial-gradient(800px 620px at 96% 108%,rgba(57,135,229,.13),transparent 70%),#0b0b0e'

async function compose(name, html, width, targetWidth = 1800) {
  const context = await browser.newContext({ viewport: { width, height: 400 }, deviceScaleFactor: 1.5 })
  const page = await context.newPage()
  await page.setContent(`<!doctype html><html><body style="margin:0;font-family:'Segoe UI',sans-serif">${html}</body></html>`)
  await page.waitForLoadState('load')
  await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode())))
  const buffer = await page.locator('#stage').screenshot()
  await context.close()
  await sharp(buffer).resize({ width: targetWidth }).png({ compressionLevel: 9, effort: 10 }).toFile(join(IMAGES, `${name}.png`))
  console.log('wrote', name)
}

const framed = (name) =>
  compose(
    name,
    `<div id="stage" style="${BACKDROP};padding:56px;width:max-content">${windowBox(dataUri(rawPath(name)), 1280)}</div>`,
    1392
  )

const data = sampleData()

// Main window captures
{
  const { context, page } = await open('index.html', running(data, NOW - (83 * MIN + 7000)), { viewport: { width: 1280, height: 860 } })
  await page.screenshot({ path: rawPath('timer') })
  await nav(page, 'sessions')
  await page.screenshot({ path: rawPath('sessions') })
  await nav(page, 'projects')
  await page.screenshot({ path: rawPath('projects') })
  await nav(page, 'settings')
  await page.screenshot({ path: rawPath('settings') })
  await context.close()
}

const csv = {}
{
  const { context, page } = await open('index.html', data, { viewport: { width: 1280, height: 1120 } })
  await nav(page, 'reports')
  await page.waitForTimeout(900)
  await page.screenshot({ path: rawPath('reports') })

  await page.getByTestId('export-table').click()
  await page.waitForTimeout(250)
  await page.getByTestId('export-sessions').click()
  await page.waitForTimeout(250)
  Object.assign(csv, await page.evaluate(() => window.__csv))

  await page.getByTestId('report-chart').hover({ position: { x: 560, y: 150 } })
  await page.waitForTimeout(300)
  await page.screenshot({ path: rawPath('reports-hover'), clip: { x: 40, y: 200, width: 1200, height: 420 } })
  await context.close()
}

// Fresh page, so no export toast sits on top of the table.
{
  const { context, page } = await open('index.html', data, { viewport: { width: 1280, height: 1120 } })
  await nav(page, 'reports')
  await page.getByTestId('period-year').click()
  await page.getByTestId('group-month').click()
  await page.waitForTimeout(1000)
  await page.screenshot({ path: rawPath('reports-year') })
  await context.close()
}

// Fresh page again, with the copy popover open and one project deselected.
{
  const { context, page } = await open('index.html', data, { viewport: { width: 1280, height: 860 } })
  await nav(page, 'reports')
  await page.waitForTimeout(900)
  await page.getByTestId('clipboard-trigger').click()
  await page.getByTestId('clipboard-project').last().click()
  await page.waitForTimeout(500)
  await page.screenshot({ path: rawPath('clipboard') })
  await context.close()
}

// Hero source: shorter window so the widget can sit beside it
{
  const { context, page } = await open('index.html', running(data, NOW - (83 * MIN + 7000)), { viewport: { width: 1280, height: 860 } })
  await nav(page, 'reports')
  await page.waitForTimeout(900)
  await page.screenshot({ path: rawPath('hero-window') })
  await context.close()
}

async function widgetShot(name, state, action) {
  const { context, page } = await open('widget.html', state, { viewport: { width: 360, height: 520 }, transparent: true })
  await action(page)
  await page.screenshot({ path: rawPath(name), omitBackground: true })
  await context.close()
}

const openWidget = async (page) => {
  await page.getByTestId('widget-handle').hover()
  await page.waitForTimeout(700)
  // Park the pointer on a quiet area of the panel so no field shows its hover state.
  await page.mouse.move(250, 180)
  await page.waitForTimeout(250)
}

const live = running(data, NOW - (83 * MIN + 7000))
await widgetShot('widget-closed', live, async () => undefined)
await widgetShot('widget-open', live, openWidget)
await widgetShot('widget-projects', live, async (page) => {
  await openWidget(page)
  await page.getByTestId('widget-project').click()
  await page.waitForTimeout(450)
  await page.mouse.move(120, 180)
  await page.waitForTimeout(200)
})

// Composites
await framed('timer')
await framed('sessions')
await framed('projects')
await framed('settings')
await framed('reports')
await framed('reports-year')
await framed('clipboard')

await compose(
  'hero',
  `<div id="stage" style="${BACKDROP};position:relative;width:1560px;height:980px;overflow:hidden">
    <div style="position:absolute;left:60px;top:60px">${windowBox(dataUri(rawPath('hero-window')), 1280)}</div>
    <img src="${dataUri(rawPath('widget-open'))}" style="position:absolute;right:0;top:230px;width:360px">
  </div>`,
  1560
)

await compose(
  'widget-states',
  `<div id="stage" style="${BACKDROP};width:1200px;height:370px;overflow:hidden;display:flex;justify-content:space-between;position:relative">
    ${['widget-closed', 'widget-open', 'widget-projects']
      .map((n) => `<div style="width:400px;display:flex;justify-content:flex-end;border-left:1px solid rgba(255,255,255,.05)"><img src="${dataUri(rawPath(n))}" style="width:360px;height:520px;margin-top:-75px"></div>`)
      .join('')}
  </div>`,
  1200,
  1600
)

await compose(
  'chart-detail',
  `<div id="stage" style="${BACKDROP};padding:40px;width:max-content">${`<div style="border-radius:14px;overflow:hidden;border:1px solid rgba(255,255,255,.12)"><img src="${dataUri(rawPath('reports-hover'))}" style="display:block;width:1200px"></div>`}</div>`,
  1280
)

// Example CSV files and a neutral spreadsheet view of them
const fileOf = (prefix) => csv[Object.keys(csv).find((k) => k.includes(prefix))]
const reportCsv = fileOf('report')
const sessionsCsvText = fileOf('sessions')
writeFileSync(join(EXAMPLES, 'sample-report.csv'), `﻿${reportCsv}`)
writeFileSync(join(EXAMPLES, 'sample-sessions.csv'), `﻿${sessionsCsvText}`)

function parseCsv(text) {
  return text.trim().split('\r\n').map((line) => {
    const cells = []
    let cell = ''
    let quoted = false
    for (const ch of line) {
      if (ch === '"') quoted = !quoted
      else if (ch === ',' && !quoted) {
        cells.push(cell)
        cell = ''
      } else cell += ch
    }
    cells.push(cell)
    return cells
  })
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')

function sheet(title, rows, totalRow) {
  const columns = rows[0].length
  const letters = Array.from({ length: columns }, (_, i) => String.fromCharCode(65 + i))
  const numeric = (s) => /^[\d.:,]+$/.test(s)
  const body = rows
    .map((row, r) => {
      const bold = r === 0 || r === totalRow
      return `<tr><th style="background:#f3f3f1;color:#77766f;font-weight:400;border:1px solid #dddcd6;padding:7px 12px">${r + 1}</th>${row
        .map(
          (c) =>
            `<td style="border:1px solid #e4e3dd;padding:7px 14px;white-space:nowrap;text-align:${r > 0 && numeric(c) ? 'right' : 'left'};font-weight:${bold ? 600 : 400};background:${r === 0 ? '#faf6ee' : '#fff'}">${esc(c)}</td>`
        )
        .join('')}</tr>`
    })
    .join('')
  return `<div style="border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,.14);box-shadow:0 30px 70px rgba(0,0,0,.55);width:max-content;background:#fff">
    <div style="background:#1a1a1d;color:#d7d6d0;padding:12px 18px;font-size:14px">${esc(title)}</div>
    <table style="border-collapse:collapse;font-size:14px;color:#1b1b1a">
      <tr><th style="background:#f3f3f1;border:1px solid #dddcd6"></th>${letters.map((l) => `<th style="background:#f3f3f1;color:#77766f;font-weight:400;border:1px solid #dddcd6;padding:5px">${l}</th>`).join('')}</tr>
      ${body}
    </table></div>`
}

const reportRows = parseCsv(reportCsv)
const sessionRows = parseCsv(sessionsCsvText)
await compose(
  'spreadsheet',
  `<div id="stage" style="${BACKDROP};padding:48px;width:max-content;display:flex;flex-direction:column;gap:28px">
    ${sheet('sample-report.csv', reportRows, reportRows.length - 1)}
    ${sheet('sample-sessions.csv', sessionRows.slice(0, 11), -1)}
  </div>`,
  1500
)

// Animated widget demo
{
  const { context, page } = await open('widget.html', data, { viewport: { width: 760, height: 420 }, scale: 1, fixedTime: false })
  await page.addStyleTag({
    content: `html.widget, html.widget body { background: radial-gradient(520px 320px at 18% 0%, rgba(226,183,122,.20), transparent 70%), radial-gradient(520px 360px at 100% 100%, rgba(57,135,229,.14), transparent 70%), #0b0b0e !important; }
      #fake-cursor { position: fixed; z-index: 9999; left: 0; top: 0; pointer-events: none; width: 20px; height: 20px; }`
  })
  await page.evaluate(() => {
    const cursor = document.createElement('div')
    cursor.id = 'fake-cursor'
    cursor.innerHTML = '<svg viewBox="0 0 20 20" width="20" height="20"><path d="M3 2l13 9.5-6 .7-3.3 5.3z" fill="#fff" stroke="#111" stroke-width="1"/></svg>'
    document.body.appendChild(cursor)
    document.addEventListener('mousemove', (e) => {
      cursor.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`
    })
  })
  const cdp = await context.newCDPSession(page)
  const frames = []
  cdp.on('Page.screencastFrame', async ({ data: frame, metadata, sessionId }) => {
    frames.push({ buffer: Buffer.from(frame, 'base64'), t: metadata.timestamp })
    await cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => undefined)
  })
  await page.mouse.move(420, 120)
  await cdp.send('Page.startScreencast', { format: 'png', everyNthFrame: 1 })
  await page.waitForTimeout(350)
  await page.mouse.move(748, 210, { steps: 22 })
  await page.waitForTimeout(650)
  const box = async (id) => page.getByTestId(id).boundingBox()
  const clickAt = async (id) => {
    const b = await box(id)
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 16 })
    await page.waitForTimeout(220)
    await page.mouse.down()
    await page.waitForTimeout(70)
    await page.mouse.up()
  }
  await clickAt('dock-start')
  await page.waitForTimeout(3100)
  await clickAt('dock-pause')
  await page.waitForTimeout(800)
  await clickAt('dock-stop')
  await page.waitForTimeout(1000)
  await page.mouse.move(300, 300, { steps: 18 })
  await page.waitForTimeout(800)
  await cdp.send('Page.stopScreencast')
  await context.close()

  // Resample the variable-rate screencast to a steady 15 fps.
  const FRAME_MS = 66
  const start = frames[0].t
  const total = (frames.at(-1).t - start) * 1000
  const picked = []
  for (let at = 0; at <= total; at += FRAME_MS) {
    let current = frames[0]
    for (const f of frames) {
      if ((f.t - start) * 1000 <= at) current = f
      else break
    }
    picked.push(current.buffer)
  }
  const unique = []
  const delays = []
  for (const buffer of picked) {
    if (unique.length && unique.at(-1).equals(buffer)) delays[delays.length - 1] += FRAME_MS
    else {
      unique.push(buffer)
      delays.push(FRAME_MS)
    }
  }
  delays[delays.length - 1] += 1200
  const resized = await Promise.all(unique.map((b) => sharp(b).resize({ width: 680 }).png().toBuffer()))
  await sharp(resized, { join: { animated: true } })
    .gif({ delay: delays, loop: 0, colours: 96, effort: 10, dither: 0 })
    .toFile(join(IMAGES, 'widget-demo.gif'))
  console.log('wrote widget-demo.gif', unique.length, 'frames')
}

await browser.close()
server.close()
console.log('\nSample CSV (report):\n' + reportCsv)
