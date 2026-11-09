import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { close, go, launch, newDataDir, type Running } from './helpers'

const shots = resolve('test-results/screenshots')
const names = ['Atlas Rebrand', 'Harbor Legal', 'Nova App']

/** Datei im Format bis Version 1.2: ein einzelner laufender Timer im Feld `active`. */
function legacyFile(): string {
  const now = Date.now()
  return JSON.stringify({
    version: 1,
    projects: names.map((name, i) => ({ id: `p${i}`, name, colorIndex: i, hourlyRate: 80, archived: false, createdAt: i })),
    sessions: [],
    settings: { language: 'de', autostart: false, widgetEnabled: true, rounding: { minutes: 0, mode: 'nearest' } },
    selectedProjectId: 'p0',
    active: { status: 'running', projectId: 'p0', name: 'Aus alter Version', segments: [], openSince: now - 90_000 },
    lastSeenAt: now
  })
}

const pause = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms))

const openWidget = async (r: Running): Promise<void> => {
  await r.widget.getByTestId('widget-handle').hover()
  await expect(r.widget.getByTestId('widget-root')).toHaveAttribute('data-open', 'true')
}

const tab = (page: Page, name: string) => page.locator(`[role="tab"][data-project="${name}"]`)
const handle = (r: Running) => r.widget.getByTestId('widget-handle')

test('parallele Timer in der echten App', async ({}, info) => {
  const dataDir = newDataDir()
  writeFileSync(resolve(dataDir, 'timetracker-data.json'), legacyFile())
  const r = await launch(dataDir, info)
  const errors: string[] = []
  for (const page of [r.main, r.widget]) {
    page.on('pageerror', (e) => errors.push(e.message))
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  }

  await test.step('laufender Timer aus der alten Version wird übernommen', async () => {
    await expect(r.main.getByTestId('timer-clock')).toHaveAttribute('data-status', 'running')
    await expect(r.main.getByTestId('timer-name')).toHaveValue('Aus alter Version')
    await expect(handle(r)).toHaveAttribute('data-timers', '1')
  })

  await test.step('Plus öffnet die Projektliste, Auswahl startet noch nichts', async () => {
    await openWidget(r)
    await r.widget.getByTestId('widget-add').click()
    await expect(r.widget.getByTestId('widget-add-option')).toHaveCount(2)
    await r.widget.getByTestId('widget-add-option').filter({ hasText: 'Harbor Legal' }).click()
    await expect(r.widget.getByTestId('widget-project')).toHaveText('Harbor Legal')
    await expect(r.widget.getByTestId('widget-status')).toHaveText('Bereit')
    await expect(handle(r)).toHaveAttribute('data-timers', '1')
    // Das Hauptfenster bleibt beim laufenden Projekt.
    await expect(r.main.getByTestId('timer-project')).toHaveText('Atlas Rebrand')
  })

  await test.step('Start im neuen Tab, der erste Timer läuft weiter', async () => {
    await r.widget.getByTestId('dock-start').click()
    await expect(r.widget.getByTestId('widget-status')).toHaveText('Läuft')
    await expect(handle(r)).toHaveAttribute('data-timers', '2')
    await expect(handle(r)).toHaveAttribute('data-status', 'running')
    await expect(r.widget.getByTestId('widget-handle-pips')).toBeVisible()
    await expect(r.main.getByTestId('timer-tab')).toHaveCount(2)
    await go(r.main, 'sessions')
    await expect(r.main.getByTestId('header-running-more')).toHaveText('+1')
    await go(r.main, 'timer')
    await pause(400)
    await r.widget.mouse.move(250, 180)
    await pause(250)
    await r.widget.screenshot({ path: resolve(shots, '20-widget-parallel.png'), omitBackground: true })
    await r.main.screenshot({ path: resolve(shots, '21-timer-parallel.png') })
  })

  await test.step('Hinweis nennt Projekt und Laufzeit', async () => {
    await tab(r.widget, 'Atlas Rebrand').hover()
    await expect(r.widget.getByTestId('widget-tab-hint')).toContainText('Atlas Rebrand')
    await expect(r.widget.getByTestId('widget-tab-hint')).toContainText(/\d:\d{2}:\d{2}/)
    await pause(250)
    await r.widget.screenshot({ path: resolve(shots, '22-widget-hint.png'), omitBackground: true })
  })

  await test.step('Knöpfe wirken nur auf den gewählten Tab', async () => {
    await tab(r.widget, 'Atlas Rebrand').click()
    await expect(r.widget.getByTestId('widget-project')).toHaveText('Atlas Rebrand')
    await expect(r.widget.getByTestId('widget-name')).toHaveValue('Aus alter Version')
    await r.widget.getByTestId('dock-pause').click()
    await expect(r.widget.getByTestId('widget-status')).toHaveText('Pausiert')
    await expect(handle(r)).toHaveAttribute('data-status', 'running')

    await tab(r.widget, 'Harbor Legal').click()
    await expect(r.widget.getByTestId('widget-status')).toHaveText('Läuft')
    await r.widget.getByTestId('widget-name').fill('Nur Harbor')
    await r.widget.getByTestId('widget-name').press('Enter')
    await expect(r.main.getByTestId('timer-name')).toHaveValue('Nur Harbor')
  })

  await test.step('Stopp speichert nur diesen Timer und zeigt ihn kurz als gespeichert', async () => {
    await pause(1100)
    await r.widget.getByTestId('dock-stop').click()
    await expect(r.widget.getByTestId('widget-status')).toHaveText('Gespeichert')
    await expect(r.widget.getByTestId('widget-saved-name')).toHaveValue('Nur Harbor')
    await expect(handle(r)).toHaveAttribute('data-timers', '1')
    await expect(handle(r)).toHaveAttribute('data-status', 'paused')
    await expect(r.main.getByTestId('today-name')).toHaveCount(1)
  })

  await test.step('Beim Einfahren geht der Blick zurück auf den verbliebenen Timer', async () => {
    await r.widget.mouse.move(10, 10)
    await expect(r.widget.getByTestId('widget-root')).not.toHaveAttribute('data-open', 'true')
    await openWidget(r)
    await expect(r.widget.getByTestId('widget-project')).toHaveText('Atlas Rebrand')
    await expect(r.widget.getByTestId('widget-status')).toHaveText('Pausiert')
    await r.widget.mouse.move(10, 10)
  })

  await test.step('Plus im Hauptfenster startet parallel, ohne andere Fenster zu verändern', async () => {
    await go(r.main, 'timer')
    await r.main.getByTestId('timer-add').click()
    await expect(r.main.getByTestId('timer-add-option')).toHaveCount(2)
    await r.main.getByTestId('timer-add-option').filter({ hasText: 'Nova App' }).click()
    await expect(r.main.getByTestId('timer-project')).toHaveText('Nova App')
    await expect(r.main.getByTestId('timer-clock')).toHaveAttribute('data-status', 'idle')
    await r.main.getByTestId('timer-start').click()
    await expect(r.main.getByTestId('timer-clock')).toHaveAttribute('data-status', 'running')
    await expect(r.main.getByTestId('timer-tab')).toHaveCount(2)
    await pause(300)
  })

  await test.step('Punkt im Hauptfenster wechselt den Timer, ohne ihn anzufassen', async () => {
    await tab(r.main, 'Atlas Rebrand').click()
    await expect(r.main.getByTestId('timer-project')).toHaveText('Atlas Rebrand')
    await expect(r.main.getByTestId('timer-clock')).toHaveAttribute('data-status', 'paused')
    await r.main.getByTestId('timer-start').click()
    await expect(r.main.getByTestId('timer-clock')).toHaveAttribute('data-status', 'running')
    await expect(r.main.getByTestId('today-name')).toHaveCount(1)
  })

  await test.step('Projekt mit Timer im Hintergrund lässt sich nicht löschen', async () => {
    await go(r.main, 'projects')
    const row = r.main.getByTestId('project-row').filter({ hasText: 'Nova App' })
    await row.hover()
    await row.getByTestId('project-delete').click()
    await expect(r.main.getByText('Stoppe zuerst die laufende Session dieses Projekts')).toBeVisible()
    await expect(row).toHaveCount(1)
    await go(r.main, 'timer')
  })

  expect(errors).toEqual([])
  await close(r, info, 'trace-parallel-1')

  await test.step('beide Timer überstehen einen Neustart', async () => {
    const again = await launch(dataDir, info)
    await expect(again.widget.getByTestId('widget-handle')).toHaveAttribute('data-timers', '2')
    await expect(again.main.getByTestId('timer-tab')).toHaveCount(2)
    await close(again, info, 'trace-parallel-2')
  })
})
