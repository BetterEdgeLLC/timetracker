import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'
import { emptyData, type AppData, type Project, type Session } from '../../src/shared/types'
import { close, go, launch, newDataDir } from './helpers'

const HOUR = 3_600_000
const shots = resolve('test-results/screenshots')

function seed(): AppData {
  const now = Date.now()
  const names = ['Kanzlei Weber', 'Studio Nord', 'Hofmann GmbH', 'Interne Orga', 'Lumen Relaunch']
  const projects: Project[] = names.map((name, i) => ({
    id: `p${i}`,
    name,
    colorIndex: i,
    hourlyRate: i === 3 ? null : 70 + i * 15,
    archived: false,
    createdAt: i
  }))
  const sessions: Session[] = []
  for (let back = 0; back < 62; back++) {
    const day = new Date(now - back * 24 * HOUR)
    if (day.getDay() === 0 || day.getDay() === 6) continue
    for (let s = 0; s < 1 + ((back * 7) % 3); s++) {
      const p = (back * 3 + s * 2) % names.length
      const start = new Date(day).setHours(8 + s * 3, (back * 13) % 60, 0, 0)
      if (start > now - 2 * HOUR) continue
      const end = start + (1 + ((back + s) % 4)) * 0.75 * HOUR
      sessions.push({
        id: `s${back}-${s}`,
        projectId: `p${p}`,
        name: `${names[p]} · Arbeitsblock ${s + 1}`,
        createdAt: start,
        segments: [{ start, end }]
      })
    }
  }
  return { ...emptyData(now), projects, sessions, selectedProjectId: 'p1' }
}

test('Screenshots mit Beispieldaten', async ({}, info) => {
  const dataDir = newDataDir()
  writeFileSync(resolve(dataDir, 'timetracker-data.json'), JSON.stringify(seed()))
  const r = await launch(dataDir, info)
  await r.main.setViewportSize({ width: 1180, height: 780 })

  await go(r.main, 'settings')
  await r.main.getByTestId('language-en').click()
  await expect(r.main.getByTestId('nav-settings')).toHaveText('Settings')
  await r.main.waitForTimeout(400)
  await r.main.screenshot({ path: resolve(shots, '11-settings-english.png') })
  await go(r.main, 'reports')
  await expect(r.main.getByTestId('report-chart')).toBeVisible()
  await r.main.waitForTimeout(900)
  await r.main.screenshot({ path: resolve(shots, '12-reports-english.png') })
  await go(r.main, 'settings')
  await r.main.getByTestId('language-de').click()
  await expect(r.main.getByTestId('nav-settings')).toHaveText('Einstellungen')
  await go(r.main, 'timer')

  await r.main.getByTestId('timer-start').click()
  await r.main.waitForTimeout(2400)
  await r.main.screenshot({ path: resolve(shots, '01-timer.png') })

  await go(r.main, 'sessions')
  await r.main.waitForTimeout(400)
  await r.main.screenshot({ path: resolve(shots, '02-sessions.png') })

  await go(r.main, 'reports')
  await expect(r.main.getByTestId('report-chart')).toBeVisible()
  await r.main.waitForTimeout(900)
  await r.main.screenshot({ path: resolve(shots, '03-auswertung.png') })
  await r.main.getByTestId('report-chart').hover({ position: { x: 420, y: 120 } })
  await r.main.waitForTimeout(250)
  await r.main.screenshot({ path: resolve(shots, '04-auswertung-hover.png') })
  await r.main.mouse.move(5, 5)
  await r.main.getByTestId('group-month').click()
  await r.main.getByTestId('period-year').click()
  await r.main.waitForTimeout(900)
  await r.main.screenshot({ path: resolve(shots, '05-auswertung-jahr.png') })

  await go(r.main, 'projects')
  await r.main.waitForTimeout(400)
  await r.main.screenshot({ path: resolve(shots, '06-projekte.png') })
  await go(r.main, 'settings')
  await r.main.waitForTimeout(400)
  await r.main.screenshot({ path: resolve(shots, '07-einstellungen.png') })

  await r.widget.screenshot({ path: resolve(shots, '08-widget-zu.png') })
  await r.widget.getByTestId('widget-handle').hover()
  await expect(r.widget.getByTestId('widget-root')).toHaveAttribute('data-open', 'true')
  await r.widget.waitForTimeout(700)
  await r.widget.screenshot({ path: resolve(shots, '09-widget-offen.png') })
  await r.widget.getByTestId('widget-project').click()
  await r.widget.waitForTimeout(500)
  await r.widget.screenshot({ path: resolve(shots, '10-widget-projekte.png') })

  await close(r, info)
})
