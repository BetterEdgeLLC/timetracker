import { copyFileSync, existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { DEFAULT_SETTINGS, emptyData, type AppData } from '../shared/types'

const SAVE_DELAY_MS = 200

export type StoreWarning = 'restored' | 'lost'

/**
 * Der Name der App bestimmt den Datenordner. Nach der Umbenennung werden die alten Daten
 * einmalig kopiert. Das Original bleibt als Sicherung liegen.
 */
export function migrateLegacyData(file: string, legacyFile: string): boolean {
  if (existsSync(file) || !existsSync(legacyFile)) return false
  copyFileSync(legacyFile, file)
  return true
}

function parse(file: string): AppData {
  const raw = JSON.parse(readFileSync(file, 'utf8')) as Partial<AppData>
  if (raw.version !== 1 || !Array.isArray(raw.projects) || !Array.isArray(raw.sessions)) {
    throw new Error('Unknown data format')
  }
  const base = emptyData(Date.now())
  return {
    ...base,
    ...raw,
    settings: {
      ...DEFAULT_SETTINGS,
      ...raw.settings,
      rounding: { ...DEFAULT_SETTINGS.rounding, ...raw.settings?.rounding }
    }
  } as AppData
}

/** JSON-Datei mit atomarem Schreiben. Eine beschädigte Datei wird nie überschrieben. */
export class Store {
  data: AppData
  /** Gesetzt, wenn beim Laden auf das Backup zurückgegriffen werden musste. */
  warning: StoreWarning | null = null
  private timer: NodeJS.Timeout | null = null

  constructor(private readonly file: string) {
    this.data = this.load()
  }

  private get backup(): string {
    return `${this.file}.bak`
  }

  private load(): AppData {
    if (!existsSync(this.file)) {
      return existsSync(this.backup) ? this.fromBackup() : emptyData(Date.now())
    }
    try {
      const data = parse(this.file)
      copyFileSync(this.file, this.backup)
      return data
    } catch {
      renameSync(this.file, `${this.file}.damaged-${Date.now()}`)
      return this.fromBackup()
    }
  }

  private fromBackup(): AppData {
    try {
      const data = parse(this.backup)
      this.warning = 'restored'
      return data
    } catch {
      this.warning = 'lost'
      return emptyData(Date.now())
    }
  }

  schedule(): void {
    if (this.timer) return
    this.timer = setTimeout(() => this.flush(), SAVE_DELAY_MS)
  }

  flush(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    const temp = `${this.file}.tmp`
    writeFileSync(temp, JSON.stringify(this.data, null, 2), 'utf8')
    renameSync(temp, this.file)
  }
}
