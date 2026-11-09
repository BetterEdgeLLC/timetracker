import { contextBridge, ipcRenderer } from 'electron'
import type { AppData, MainPage, TimetrackerApi } from '../shared/types'

const call =
  <T>(channel: string) =>
  (...args: unknown[]): Promise<T> =>
    ipcRenderer.invoke(channel, ...args) as Promise<T>

function subscribe<T>(channel: string, listener: (value: T) => void): () => void {
  const wrapped = (_event: unknown, value: T): void => listener(value)
  ipcRenderer.on(channel, wrapped)
  return () => ipcRenderer.removeListener(channel, wrapped)
}

const api: TimetrackerApi = {
  getState: call('getState'),
  getSystemLocale: call('getSystemLocale'),
  onState: (listener) => subscribe<AppData>('state', listener),
  onNavigate: (listener) => subscribe<MainPage>('navigate', listener),
  start: call('start'),
  pause: call('pause'),
  stop: call('stop'),
  switchProject: call('switchProject'),
  renameActive: call('renameActive'),
  createProject: call('createProject'),
  updateProject: call('updateProject'),
  deleteProject: call('deleteProject'),
  createSession: call('createSession'),
  updateSession: call('updateSession'),
  deleteSession: call('deleteSession'),
  updateSettings: call('updateSettings'),
  saveCsv: call('saveCsv'),
  openMain: call('openMain'),
  openDataFolder: call('openDataFolder'),
  widgetIgnoreMouse: call('widgetIgnoreMouse')
}

contextBridge.exposeInMainWorld('api', api)
