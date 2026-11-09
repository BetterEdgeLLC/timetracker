import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'
import { toLocalInput } from '../../src/shared/format'
import { close, go, launch, newDataDir, pageWith, type Running } from './helpers'

async function createProject(r: Running, name: string, rate: string): Promise<void> {
  await go(r.main, 'projects')
  await r.main.getByTestId('project-new').click()
  await r.main.getByTestId('project-name').fill(name)
  await r.main.getByTestId('project-rate').fill(rate)
  await r.main.getByTestId('project-save').click()
  await expect(r.main.getByTestId('project-row').filter({ hasText: name })).toBeVisible()
}

const openWidget = async (r: Running): Promise<void> => {
  await r.widget.getByTestId('widget-handle').hover()
  await expect(r.widget.getByTestId('widget-root')).toHaveAttribute('data-open', 'true')
}

const pause = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms))

test('alle Abläufe in der echten App', async ({}, info) => {
  const dataDir = newDataDir()
  const r = await launch(dataDir, info)
  const errors: string[] = []
  for (const page of [r.main, r.widget]) {
    page.on('pageerror', (e) => errors.push(e.message))
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  }

  await test.step('leerer Start führt zum Projekt', async () => {
    await expect(r.main.getByTestId('empty-new-project')).toBeVisible()
    await r.main.getByTestId('empty-new-project').click()
    await expect(r.main.getByTestId('project-new')).toBeVisible()
  })

  await test.step('Projekte anlegen', async () => {
    await createProject(r, 'Acme', '80')
    await createProject(r, 'Beta', '')
    await r.main.getByTestId('project-new').click()
    await r.main.getByTestId('project-name').fill('Falsch')
    await r.main.getByTestId('project-rate').fill('abc')
    await r.main.getByTestId('project-save').click()
    await expect(r.main.getByTestId('project-error')).toBeVisible()
    await r.main.keyboard.press('Escape')
  })

  await test.step('Start, Pause, Fortsetzen, Stopp im Hauptfenster', async () => {
    await go(r.main, 'timer')
    const clock = r.main.getByTestId('timer-clock')
    await expect(clock).toHaveAttribute('data-status', 'idle')
    await r.main.getByTestId('timer-start').click()
    await expect(clock).toHaveAttribute('data-status', 'running')
    await expect(r.main.getByTestId('timer-name')).toHaveValue(/^Acme · \d{2}\.\d{2}\.\d{4}$/)
    await pause(1300)
    await r.main.getByTestId('timer-pause').click()
    await expect(clock).toHaveAttribute('data-status', 'paused')
    await r.main.getByTestId('timer-start').click()
    await expect(clock).toHaveAttribute('data-status', 'running')
    await r.main.getByTestId('timer-name').fill('Konzept Workshop')
    await r.main.getByTestId('timer-name').press('Enter')
    await pause(300)
    await r.main.getByTestId('timer-stop').click()
    await expect(clock).toHaveAttribute('data-status', 'idle')
    await expect(r.main.getByTestId('today-name').first()).toHaveValue('Konzept Workshop')
  })

  await test.step('Session direkt umbenennen', async () => {
    await r.main.getByTestId('today-name').first().fill('Konzept Workshop final')
    await r.main.getByTestId('today-name').first().press('Enter')
    await go(r.main, 'sessions')
    await expect(r.main.getByTestId('session-name').first()).toHaveValue('Konzept Workshop final')
  })

  await test.step('Widget fährt aus und wieder ein', async () => {
    await expect(r.widget.getByTestId('widget-handle')).toHaveAttribute('data-status', 'idle')
    await openWidget(r)
    await r.widget.mouse.move(10, 10)
    await expect(r.widget.getByTestId('widget-root')).not.toHaveAttribute('data-open', 'true')
  })

  await test.step('Start, Pause, Stopp aus dem Widget, synchron zum Hauptfenster', async () => {
    await go(r.main, 'timer')
    await openWidget(r)
    await r.widget.getByTestId('dock-start').click()
    await expect(r.widget.getByTestId('widget-status')).toHaveText('Läuft')
    await expect(r.main.getByTestId('timer-clock')).toHaveAttribute('data-status', 'running')
    await pause(1200)
    await r.widget.getByTestId('dock-pause').click()
    await expect(r.widget.getByTestId('widget-status')).toHaveText('Pausiert')
    await expect(r.main.getByTestId('timer-clock')).toHaveAttribute('data-status', 'paused')
    await r.widget.getByTestId('dock-start').click()
    await expect(r.widget.getByTestId('widget-status')).toHaveText('Läuft')
    await r.widget.getByTestId('dock-stop').click()
    await expect(r.widget.getByTestId('widget-status')).toHaveText('Gespeichert')
    await r.widget.getByTestId('widget-saved-name').fill('Aus dem Widget benannt')
    await r.widget.getByTestId('widget-saved-name').press('Enter')
    await expect(r.main.getByTestId('today-name').first()).toHaveValue('Aus dem Widget benannt')
  })

  await test.step('Projektwechsel im Widget', async () => {
    await openWidget(r)
    await r.widget.getByTestId('dock-start').click()
    await expect(r.widget.getByTestId('widget-status')).toHaveText('Läuft')
    await pause(1200)
    await r.widget.getByTestId('widget-project').click()
    await r.widget.getByTestId('widget-project-option').filter({ hasText: 'Beta' }).click()
    await expect(r.widget.getByTestId('widget-project')).toHaveText('Beta')
    await expect(r.widget.getByTestId('widget-status')).toHaveText('Läuft')
    await pause(1200)
    await r.widget.getByTestId('dock-stop').click()
    await expect(r.main.getByTestId('today-name')).toHaveCount(4)
  })

  await test.step('Zeit nachtragen, Fehler, bearbeiten, löschen, rückgängig', async () => {
    await go(r.main, 'sessions')
    await r.main.getByTestId('sessions-add').click()
    const day = new Date()
    day.setHours(1, 0, 0, 0)
    const start = day.getTime()
    await r.main.getByTestId('session-dialog-start').fill(toLocalInput(start))
    await r.main.getByTestId('session-dialog-end').fill(toLocalInput(start - 60_000))
    await r.main.getByTestId('session-dialog-save').click()
    await expect(r.main.getByTestId('session-dialog-error')).toContainText('endet vor')
    await r.main.getByTestId('session-dialog-end').fill(toLocalInput(start + 90 * 60_000))
    await r.main.getByTestId('session-dialog-name').fill('Nachgetragen')
    await r.main.getByTestId('session-dialog-project').click()
    await r.main.getByTestId('session-dialog-project-option').filter({ hasText: 'Acme' }).click()
    await r.main.getByTestId('session-dialog-save').click()
    const row = r.main.getByTestId('session-row').filter({ has: r.main.locator('input[value="Nachgetragen"]') })
    await expect(row).toContainText('1:30')

    await row.hover()
    await row.getByTestId('session-edit').click()
    await r.main.getByTestId('session-dialog-end').fill(toLocalInput(start + 120 * 60_000))
    await r.main.getByTestId('session-dialog-save').click()
    await expect(row).toContainText('2:00')

    await row.hover()
    await row.getByTestId('session-delete').click()
    await expect(row).toHaveCount(0)
    await r.main.getByRole('button', { name: 'Rückgängig' }).click()
    await expect(row).toHaveCount(1)
  })

  await test.step('Auswertung: Summe, Filter, Gruppen, Zeitraum', async () => {
    await go(r.main, 'reports')
    await expect(r.main.getByTestId('total-sessions')).toHaveText('5')
    await expect(r.main.getByTestId('report-chart')).toBeVisible()
    // Ein Klick blendet alles außer dem gewählten Projekt aus.
    await r.main.getByTestId('legend-project').filter({ hasText: 'Acme' }).click()
    await expect(r.main.getByTestId('total-sessions')).toHaveText('4')
    await expect(r.main.getByTestId('total-amount')).toContainText('160,')
    await r.main.getByTestId('legend-reset').click()
    await expect(r.main.getByTestId('total-sessions')).toHaveText('5')
    for (const group of ['month', 'week', 'day', 'session', 'project']) {
      await r.main.getByTestId(`group-${group}`).click()
      await expect(r.main.getByTestId('report-table')).toBeVisible()
    }
    await r.main.getByTestId('period-week').click()
    await expect(r.main.getByTestId('period-label')).toContainText('KW')
    await r.main.getByTestId('period-prev').click()
    await r.main.getByTestId('period-next').click()
    await expect(r.main.getByTestId('total-sessions')).toHaveText('5')
    await r.main.getByTestId('period-custom').click()
    await r.main.getByTestId('date-range-trigger').click()
    await r.main.getByRole('button', { name: 'Letzte Woche' }).click()
    await r.main.getByRole('button', { name: 'Übernehmen' }).click()
    await expect(r.main.getByTestId('total-sessions')).toHaveText('0')
    await r.main.getByTestId('period-month').click()
  })

  await test.step('CSV-Export', async () => {
    const tablePath = resolve(dataDir, 'tabelle.csv')
    const sessionsPath = resolve(dataDir, 'sessions.csv')
    const mockSave = (path: string): Promise<void> =>
      r.app.evaluate(({ dialog }, filePath) => {
        dialog.showSaveDialog = (async () => ({ canceled: false, filePath })) as typeof dialog.showSaveDialog
      }, path)

    await mockSave(tablePath)
    await r.main.getByTestId('export-table').click()
    await expect(r.main.getByText('CSV gespeichert').first()).toBeVisible()
    const table = readFileSync(tablePath, 'utf8')
    expect(table.charCodeAt(0)).toBe(0xfeff)
    expect(table).toContain('Projekt;Sessions;Erfasst (h:mm);Abrechenbar (h);Stundensatz (EUR);Betrag netto (EUR)')
    expect(table).toContain('Gesamt;5;')

    await mockSave(sessionsPath)
    await r.main.getByTestId('export-sessions').click()
    await expect.poll(() => readFileSync(sessionsPath, 'utf8').length).toBeGreaterThan(100)
    const sessions = readFileSync(sessionsPath, 'utf8')
    expect(sessions).toContain('Nachgetragen')
    expect(sessions.split('\r\n').filter(Boolean)).toHaveLength(6)
  })

  await test.step('Fenster schließen lässt die App im Tray, Widget öffnet sie wieder', async () => {
    // BrowserWindow.close() entspricht dem Klick auf das X in der Titelleiste.
    await r.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find((w) => w.getTitle() === 'Timetracker')?.close())
    await expect.poll(() => r.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().filter((w) => w.isVisible()).length)).toBe(1)
    await openWidget(r)
    await r.widget.getByTestId('dock-open').click()
    await expect.poll(() => r.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().filter((w) => w.isVisible()).length)).toBe(2)
  })

  await test.step('Widget lässt sich abschalten', async () => {
    await go(r.main, 'settings')
    await r.main.getByTestId('setting-widget').click()
    await expect.poll(() => r.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(1)
    await r.main.getByTestId('setting-widget').click()
    await expect.poll(() => r.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(2)
    // Wieder einschalten erzeugt ein neues Widget-Fenster.
    r.widget = await pageWith(r.app, 'widget.html')
    await expect(r.widget.getByTestId('widget-handle')).toBeVisible()
  })

  await test.step('Sprache wechseln gilt sofort überall und bleibt gespeichert', async () => {
    await r.main.getByTestId('language-en').click()
    await expect(r.main.getByTestId('nav-settings')).toHaveText('Settings')
    await expect(r.main.getByRole('heading', { name: 'Settings' })).toBeVisible()
    await expect(r.main.locator('html')).toHaveAttribute('lang', 'en')
    await openWidget(r)
    await expect(r.widget.getByTestId('widget-status')).toHaveText('Ready')
    await r.widget.mouse.move(10, 10)

    await go(r.main, 'timer')
    await r.main.getByTestId('timer-start').click()
    await expect(r.main.getByTestId('timer-name')).toHaveValue(/^Beta · \d{2} [A-Z][a-z]{2} \d{4}$/)
    await pause(1100)
    await r.main.getByTestId('timer-stop').click()
    await expect(r.main.getByTestId('timer-clock')).toHaveAttribute('data-status', 'idle')

    await go(r.main, 'reports')
    await expect(r.main.getByTestId('period-month')).toHaveText('Month')
    await expect(r.main.getByTestId('total-amount')).toContainText('€160.00')
    const tablePath = resolve(dataDir, 'english.csv')
    await r.app.evaluate(({ dialog }, filePath) => {
      dialog.showSaveDialog = (async () => ({ canceled: false, filePath })) as typeof dialog.showSaveDialog
    }, tablePath)
    await r.main.getByTestId('export-table').click()
    await expect.poll(() => readFileSync(tablePath, 'utf8').length).toBeGreaterThan(50)
    expect(readFileSync(tablePath, 'utf8')).toContain('Tracked (h:mm)')

    await go(r.main, 'settings')
    await r.main.getByTestId('language-de').click()
    await expect(r.main.getByTestId('nav-settings')).toHaveText('Einstellungen')
  })

  await test.step('laufender Timer übersteht einen Neustart', async () => {
    await go(r.main, 'timer')
    await r.main.getByTestId('timer-start').click()
    await expect(r.main.getByTestId('timer-clock')).toHaveAttribute('data-status', 'running')
  })

  expect(errors).toEqual([])
  await close(r, info, 'trace-teil-1')

  const again = await launch(dataDir, info)
  await expect(again.main.getByTestId('timer-clock')).toHaveAttribute('data-status', 'running')
  await go(again.main, 'sessions')
  await expect(again.main.getByTestId('session-row')).toHaveCount(6)
  await close(again, info, 'trace-teil-2')
})
