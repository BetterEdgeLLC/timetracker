import type { TimetrackerApi } from '@shared/types'

declare global {
  interface Window {
    api: TimetrackerApi
  }
}
