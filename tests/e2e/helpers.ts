import { mkdirSync, mkdtempSync } from 'node:fs'
import { resolve } from 'node:path'
import { _electron as electron, type ElectronApplication, type Page, type TestInfo } from '@playwright/test'

export interface Running {
  app: ElectronApplication
  main: Page
  widget: Page
}

export function newDataDir(): string {
  const root = resolve('test-results/data')
  mkdirSync(root, { recursive: true })
  return mkdtempSync(resolve(root, 'run-'))
}

export async function pageWith(app: ElectronApplication, part: string): Promise<Page> {
  for (let attempt = 0; attempt < 100; attempt++) {
    const found = app.windows().find((w) => w.url().includes(part))
    if (found) return found
    await new Promise((r) => setTimeout(r, 100))
  }
  throw new Error(`Fenster ${part} nicht gefunden`)
}

export async function launch(dataDir: string, info: TestInfo): Promise<Running> {
  const env = { ...process.env, TIMETRACKER_DATA_DIR: dataDir } as Record<string, string>
  delete env.ELECTRON_RENDERER_URL
  delete env.ELECTRON_RUN_AS_NODE
  const executablePath = process.env.TIMETRACKER_EXE
  const app = await electron.launch({
    ...(executablePath ? { executablePath, args: [] } : { args: ['.'] }),
    env,
    recordVideo: { dir: info.outputPath('video'), size: { width: 1180, height: 780 } }
  })
  const main = await pageWith(app, 'index.html')
  const widget = await pageWith(app, 'widget.html')
  await main.context().tracing.start({ screenshots: true, snapshots: true })
  await main.waitForLoadState('domcontentloaded')
  await widget.waitForLoadState('domcontentloaded')
  return { app, main, widget }
}

export async function close(running: Running, info: TestInfo, name = 'trace'): Promise<void> {
  await running.main.context().tracing.stop({ path: info.outputPath(`${name}.zip`) })
  await running.app.evaluate(({ app }) => app.quit())
  await running.app.waitForEvent('close').catch(() => undefined)
}

export const go = (page: Page, target: string): Promise<void> => page.getByTestId(`nav-${target}`).click()
