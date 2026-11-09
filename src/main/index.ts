import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  powerMonitor,
  screen,
  shell,
  Tray,
  type IpcMainInvokeEvent,
  type WebContents
} from 'electron'
import * as timer from '../shared/timer'
import { initialLanguage, messages, type Messages } from '../shared/i18n'
import { PROJECT_COLORS, type AppData, type MainPage, type Project, type Session } from '../shared/types'
import { migrateLegacyData, Store } from './store'
import { validators } from './validate'

const WIDGET_WIDTH = 360
const WIDGET_HEIGHT = 520
const HEARTBEAT_MS = 30_000

const DATA_FILE = 'timetracker-data.json'
const LEGACY_APP_NAME = 'Zeittracker'
const LEGACY_DATA_FILE = 'zeittracker-daten.json'

const customDataDir = process.env.TIMETRACKER_DATA_DIR
if (customDataDir) {
  mkdirSync(customDataDir, { recursive: true })
  app.setPath('userData', customDataDir)
}

let store: Store
let mainWindow: BrowserWindow | null = null
let widgetWindow: BrowserWindow | null = null
let tray: Tray | null = null
let quitting = false

const m = (): Messages => messages[store.data.settings.language]
const validate = (): ReturnType<typeof validators> => validators(m())

const resource = (name: string): string => join(app.getAppPath(), 'resources', name)
const preload = (): string => join(__dirname, '../preload/index.js')

function loadPage(window: BrowserWindow, page: 'index' | 'widget'): void {
  const devUrl = process.env.ELECTRON_RENDERER_URL
  if (devUrl) void window.loadURL(`${devUrl}/${page}.html`)
  else void window.loadFile(join(__dirname, `../renderer/${page}.html`))
}

function lockDown(contents: WebContents): void {
  contents.setWindowOpenHandler(() => ({ action: 'deny' }))
  contents.on('will-navigate', (event) => event.preventDefault())
}

function broadcast(): void {
  for (const window of [mainWindow, widgetWindow]) {
    if (window && !window.isDestroyed()) window.webContents.send('state', store.data)
  }
  refreshTray()
}

function commit(next: AppData): void {
  if (next === store.data) return
  store.data = next
  store.schedule()
  broadcast()
}

function createMainWindow(show: boolean): void {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 900,
    minHeight: 620,
    show: false,
    title: 'Timetracker',
    icon: resource('icon.ico'),
    backgroundColor: '#09090b',
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#09090b', symbolColor: '#8a8983', height: 48 },
    webPreferences: { preload: preload(), contextIsolation: true, sandbox: true, nodeIntegration: false }
  })
  lockDown(mainWindow.webContents)
  mainWindow.once('ready-to-show', () => {
    if (show) mainWindow?.show()
  })
  mainWindow.on('close', (event) => {
    if (quitting) return
    event.preventDefault()
    mainWindow?.hide()
  })
  mainWindow.on('closed', () => {
    mainWindow = null
  })
  loadPage(mainWindow, 'index')
}

function openMain(page?: MainPage): void {
  if (!mainWindow) createMainWindow(true)
  if (mainWindow?.isMinimized()) mainWindow.restore()
  mainWindow?.show()
  mainWindow?.focus()
  if (page) mainWindow?.webContents.send('navigate', page)
}

function widgetBounds(): Electron.Rectangle {
  const { workArea } = screen.getPrimaryDisplay()
  return {
    x: workArea.x + workArea.width - WIDGET_WIDTH,
    y: workArea.y + Math.round((workArea.height - WIDGET_HEIGHT) / 2),
    width: WIDGET_WIDTH,
    height: WIDGET_HEIGHT
  }
}

function placeWidget(): void {
  widgetWindow?.setBounds(widgetBounds())
}

function createWidget(): void {
  widgetWindow = new BrowserWindow({
    ...widgetBounds(),
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    hasShadow: false,
    alwaysOnTop: true,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: { preload: preload(), contextIsolation: true, sandbox: true, nodeIntegration: false }
  })
  lockDown(widgetWindow.webContents)
  widgetWindow.setAlwaysOnTop(true, 'screen-saver')
  // Klicks gehen durch die transparente Fläche, bis die Maus den Knopf berührt.
  widgetWindow.setIgnoreMouseEvents(true, { forward: true })
  widgetWindow.once('ready-to-show', () => widgetWindow?.showInactive())
  widgetWindow.on('closed', () => {
    widgetWindow = null
  })
  loadPage(widgetWindow, 'widget')
}

function syncWidget(): void {
  const enabled = store.data.settings.widgetEnabled
  if (enabled && !widgetWindow) createWidget()
  if (!enabled && widgetWindow) widgetWindow.destroy()
}

function applyAutostart(): void {
  if (!app.isPackaged || customDataDir) return
  app.setLoginItemSettings({ name: LEGACY_APP_NAME, openAtLogin: false })
  app.setLoginItemSettings({
    name: 'Timetracker',
    openAtLogin: store.data.settings.autostart,
    path: process.execPath,
    args: ['--hidden']
  })
}

function trayIcon(): Electron.NativeImage {
  const running = store.data.timers.some((t) => t.status === 'running')
  return nativeImage.createFromPath(resource(running ? 'tray-running.png' : 'tray-idle.png'))
}

/** Bei mehreren Timern bekommt jeder ein eigenes Untermenü, statt die Knöpfe zu vervielfachen. */
function parallelTrayItems(): Electron.MenuItemConstructorOptions[] {
  const { timers, projects } = store.data
  const t = m()
  return [
    { label: t.tray.activeCount(timers.length), enabled: false },
    { type: 'separator' },
    ...timers.map((item): Electron.MenuItemConstructorOptions => ({
      label: `${projects.find((p) => p.id === item.projectId)?.name ?? t.common.project} · ${t.status[item.status]}`,
      submenu: [
        item.status === 'paused'
          ? { label: t.action.resume, click: () => commit(timer.start(store.data, Date.now(), item.projectId)) }
          : { label: t.action.pause, click: () => commit(timer.pause(store.data, Date.now(), item.projectId)) },
        { label: t.action.stop, click: () => stopTimer(item.projectId) }
      ]
    })),
    { type: 'separator' },
    {
      label: t.tray.pauseAll,
      enabled: timers.some((item) => item.status === 'running'),
      click: () => commit(timer.pauseAll(store.data, Date.now()))
    },
    { label: t.tray.stopAll, click: () => commit(timer.stopAll(store.data, Date.now(), randomUUID)) }
  ]
}

function singleTrayItems(): Electron.MenuItemConstructorOptions[] {
  const { timers, selectedProjectId, projects } = store.data
  const active = timers[0]
  const projectId = active?.projectId ?? selectedProjectId ?? undefined
  const project = projects.find((p) => p.id === projectId)
  const t = m()
  return [
    { label: `${t.status[active?.status ?? 'idle']}${project ? ` · ${project.name}` : ''}`, enabled: false },
    { type: 'separator' },
    {
      label: active?.status === 'paused' ? t.action.resume : t.action.start,
      enabled: active?.status !== 'running' && Boolean(project),
      click: () => commit(timer.start(store.data, Date.now(), projectId))
    },
    {
      label: t.action.pause,
      enabled: active?.status === 'running',
      click: () => commit(timer.pause(store.data, Date.now(), projectId))
    },
    { label: t.action.stop, enabled: Boolean(active), click: () => stopTimer(projectId) }
  ]
}

function refreshTray(): void {
  if (!tray) return
  const { timers, selectedProjectId, projects, settings } = store.data
  const t = m()
  const projectId = timers[0]?.projectId ?? selectedProjectId
  const project = projects.find((p) => p.id === projectId)
  const status = t.status[timers[0]?.status ?? 'idle']
  tray.setImage(trayIcon())
  tray.setToolTip(
    timers.length > 1
      ? `Timetracker: ${t.tray.activeCount(timers.length)}`
      : project
        ? `Timetracker: ${status} (${project.name})`
        : `Timetracker: ${status}`
  )
  tray.setContextMenu(
    Menu.buildFromTemplate([
      ...(timers.length > 1 ? parallelTrayItems() : singleTrayItems()),
      { type: 'separator' },
      { label: t.tray.open, click: () => openMain() },
      {
        label: t.tray.showWidget,
        type: 'checkbox',
        checked: settings.widgetEnabled,
        click: (item) => updateSettings({ widgetEnabled: item.checked })
      },
      { type: 'separator' },
      { label: t.tray.quit, click: () => app.quit() }
    ])
  )
}

function createTray(): void {
  tray = new Tray(trayIcon())
  tray.on('click', () => openMain())
  refreshTray()
}

function stopTimer(projectId?: string): string | null {
  const result = timer.stop(store.data, Date.now(), randomUUID, projectId)
  commit(result.data)
  return result.session?.id ?? null
}

function updateSettings(value: unknown): void {
  const patch = validate().settingsPatch(value, store.data.settings)
  commit({ ...store.data, settings: { ...store.data.settings, ...patch } })
  applyAutostart()
  syncWidget()
}

function leastUsedColor(projects: Project[]): number {
  const usage = PROJECT_COLORS.map((_, index) => projects.filter((p) => p.colorIndex === index).length)
  return usage.indexOf(Math.min(...usage))
}

function assertProject(id: string): void {
  if (!store.data.projects.some((p) => p.id === id)) throw new Error(m().error.projectNotFound)
}

const optionalId = (value: unknown): string | undefined => (value === undefined ? undefined : validate().id(value))

function handle(channel: string, fn: (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown): void {
  ipcMain.handle(channel, fn)
}

function registerIpc(): void {
  handle('getState', () => store.data)
  handle('getSystemLocale', () => app.getSystemLocale())
  handle('start', (_e, projectId) => commit(timer.start(store.data, Date.now(), optionalId(projectId))))
  handle('pause', (_e, projectId) => commit(timer.pause(store.data, Date.now(), optionalId(projectId))))
  handle('stop', (_e, projectId) => stopTimer(optionalId(projectId)))
  handle('switchProject', (_e, projectId, fromProjectId) =>
    commit(timer.switchProject(store.data, Date.now(), validate().id(projectId), randomUUID, optionalId(fromProjectId)))
  )
  handle('renameActive', (_e, name, projectId) => {
    if (typeof name !== 'string' || name.length > 200) throw new Error(m().error.invalidSessionName)
    commit(timer.renameActive(store.data, name, optionalId(projectId)))
  })

  handle('createProject', (_e, value) => {
    const input = validate().projectInput(value)
    const project: Project = {
      id: randomUUID(),
      name: input.name,
      hourlyRate: input.hourlyRate,
      colorIndex: input.colorIndex ?? leastUsedColor(store.data.projects),
      archived: false,
      createdAt: Date.now()
    }
    commit({
      ...store.data,
      projects: [...store.data.projects, project],
      selectedProjectId: store.data.selectedProjectId ?? project.id
    })
    return project
  })
  handle('updateProject', (_e, id, value) => {
    const projectId = validate().id(id)
    assertProject(projectId)
    const patch = validate().projectPatch(value)
    if (patch.archived && timer.timerFor(store.data, projectId)) throw new Error(m().error.stopFirst)
    commit(
      timer.settleFocus({
        ...store.data,
        projects: store.data.projects.map((p) => (p.id === projectId ? { ...p, ...patch } : p)),
        selectedProjectId:
          patch.archived && store.data.selectedProjectId === projectId ? null : store.data.selectedProjectId
      })
    )
  })
  handle('deleteProject', (_e, id) => {
    const projectId = validate().id(id)
    if (timer.timerFor(store.data, projectId)) throw new Error(m().error.stopFirst)
    if (store.data.sessions.some((s) => s.projectId === projectId)) {
      throw new Error(m().error.archiveOnly)
    }
    commit(
      timer.settleFocus({
        ...store.data,
        projects: store.data.projects.filter((p) => p.id !== projectId),
        selectedProjectId: store.data.selectedProjectId === projectId ? null : store.data.selectedProjectId
      })
    )
  })

  handle('createSession', (_e, value) => {
    const input = validate().sessionInput(value)
    assertProject(input.projectId)
    const session: Session = { id: randomUUID(), createdAt: Date.now(), ...input }
    commit({ ...store.data, sessions: [...store.data.sessions, session] })
  })
  handle('updateSession', (_e, id, value) => {
    const sessionId = validate().id(id)
    const patch = validate().sessionPatch(value)
    if (patch.projectId) assertProject(patch.projectId)
    commit({
      ...store.data,
      sessions: store.data.sessions.map((s) => (s.id === sessionId ? { ...s, ...patch } : s))
    })
  })
  handle('deleteSession', (_e, id) => {
    const sessionId = validate().id(id)
    commit({ ...store.data, sessions: store.data.sessions.filter((s) => s.id !== sessionId) })
  })

  handle('updateSettings', (_e, value) => updateSettings(value))
  handle('saveCsv', async (_e, name, content) => {
    if (typeof content !== 'string') throw new Error(m().error.exportMissing)
    const options = {
      title: m().reports.csvTitle,
      defaultPath: join(app.getPath('documents'), validate().fileName(name)),
      filters: [{ name: 'CSV', extensions: ['csv'] }]
    }
    const result = mainWindow
      ? await dialog.showSaveDialog(mainWindow, options)
      : await dialog.showSaveDialog(options)
    if (result.canceled || !result.filePath) return { saved: false }
    writeFileSync(result.filePath, `﻿${content}`, 'utf8')
    return { saved: true, path: result.filePath }
  })
  handle('copyText', (_e, content) => {
    if (typeof content !== 'string') throw new Error(m().error.exportMissing)
    clipboard.writeText(content)
  })
  handle('openMain', (_e, page) => openMain(page as MainPage | undefined))
  handle('openDataFolder', () => shell.openPath(app.getPath('userData')))
  handle('widgetIgnoreMouse', (event, ignore) => {
    if (!widgetWindow || event.sender !== widgetWindow.webContents) return
    if (ignore === true) widgetWindow.setIgnoreMouseEvents(true, { forward: true })
    else widgetWindow.setIgnoreMouseEvents(false)
  })
}

function boot(): void {
  mkdirSync(app.getPath('userData'), { recursive: true })
  const dataFile = join(app.getPath('userData'), DATA_FILE)
  migrateLegacyData(dataFile, join(app.getPath('appData'), LEGACY_APP_NAME, LEGACY_DATA_FILE))
  const firstRun = !existsSync(dataFile)
  store = new Store(dataFile)
  if (firstRun && !store.warning) {
    store.data.settings.language = initialLanguage(app.getSystemLocale())
  }
  store.data = { ...timer.settleFocus(timer.recover(store.data, Date.now())), lastSeenAt: Date.now() }
  store.schedule()

  Menu.setApplicationMenu(null)
  registerIpc()
  createMainWindow(!process.argv.includes('--hidden'))
  syncWidget()
  createTray()
  applyAutostart()
  if (store.warning) dialog.showErrorBox('Timetracker', m().store[store.warning])

  setInterval(() => {
    store.data = { ...store.data, lastSeenAt: Date.now() }
    store.schedule()
  }, HEARTBEAT_MS)

  // Im Standby läuft keine Arbeitszeit weiter.
  powerMonitor.on('suspend', () => commit(timer.pauseAll(store.data, Date.now())))
  powerMonitor.on('shutdown', () => persistNow())
  for (const event of ['display-added', 'display-removed', 'display-metrics-changed'] as const) {
    screen.on(event as 'display-added', placeWidget)
  }
}

function persistNow(): void {
  store.data = { ...store.data, lastSeenAt: Date.now() }
  store.flush()
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.setAppUserModelId('de.zeittracker.app')
  app.on('second-instance', () => openMain())
  app.on('before-quit', () => {
    quitting = true
    persistNow()
  })
  // Das Hauptfenster versteckt sich nur, die App lebt im Tray weiter.
  app.on('window-all-closed', () => undefined)
  void app.whenReady().then(boot)
}
