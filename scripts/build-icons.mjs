// Erzeugt App-Icon und Tray-Icons aus dem Logo-SVG.
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import sharp from 'sharp'
import pngToIco from 'png-to-ico'

const out = resolve('resources')
mkdirSync(out, { recursive: true })

const mark = (ring, hand, width) => `
  <path d="M32 10a22 22 0 1 1-22 22" fill="none" stroke="${ring}" stroke-width="${width}" stroke-linecap="round"/>
  <path d="M32 32 18.5 18.5" fill="none" stroke="${hand}" stroke-width="${width}" stroke-linecap="round"/>`

const appIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1c1c20"/>
      <stop offset="1" stop-color="#0a0a0c"/>
    </linearGradient>
    <linearGradient id="edge" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.22"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0.04"/>
    </linearGradient>
  </defs>
  <rect x="16" y="16" width="480" height="480" rx="112" fill="url(#bg)"/>
  <rect x="17.5" y="17.5" width="477" height="477" rx="110.5" fill="none" stroke="url(#edge)" stroke-width="3"/>
  <g transform="translate(64 64) scale(6)">${mark('#efeeea', '#e2b77a', 5.5)}</g>
</svg>`

const trayIcon = (ring, hand) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${mark(ring, hand, 7)}</svg>`

const png = (svg, size) => sharp(Buffer.from(svg), { density: 384 }).resize(size, size).png().toBuffer()

await sharp(Buffer.from(appIcon), { density: 384 }).resize(1024, 1024).png().toFile(resolve(out, 'icon.png'))
writeFileSync(resolve(out, 'logo.svg'), appIcon)
const sizes = await Promise.all([16, 24, 32, 48, 64, 128, 256].map((size) => png(appIcon, size)))
writeFileSync(resolve(out, 'icon.ico'), await pngToIco(sizes))
writeFileSync(resolve(out, 'tray-idle.png'), await png(trayIcon('#efeeea', '#efeeea'), 32))
writeFileSync(resolve(out, 'tray-running.png'), await png(trayIcon('#e2b77a', '#e2b77a'), 32))
console.log('Icons geschrieben nach', out)
