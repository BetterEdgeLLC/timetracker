import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { clock } from '@shared/format'
import { focusedTimer } from '@shared/timer'
import type { AppData, MainPage } from '@shared/types'
import { Mark } from './components/Mark'
import { SegmentedTabs } from './components/ui/segmented-tabs'
import { colorOf, useAppState, useElapsed } from './lib/app-state'
import { I18nProvider, useI18n } from './lib/i18n'
import { ProjectsPage } from './pages/ProjectsPage'
import { ReportsPage } from './pages/ReportsPage'
import { SessionsPage } from './pages/SessionsPage'
import { SettingsPage } from './pages/SettingsPage'
import { TimerPage } from './pages/TimerPage'

function RunningBadge({ state }: { state: AppData }): React.JSX.Element | null {
  const shown = focusedTimer(state) ?? state.timers[0] ?? null
  const elapsed = useElapsed(shown)
  if (!shown) return null
  const project = state.projects.find((p) => p.id === shown.projectId)
  const others = state.timers.length - 1
  return (
    <div className="flex items-center gap-2 text-[12px] text-ink-2" data-testid="header-running">
      {project && <span className="size-2 rounded-full" style={{ background: colorOf(project) }} />}
      <span className="max-w-28 truncate">{project?.name}</span>
      <span className="font-mono tabular-nums text-ink">{clock(elapsed)}</span>
      {others > 0 && (
        <span className="font-mono tabular-nums text-ink-3" data-testid="header-running-more">
          +{others}
        </span>
      )}
    </div>
  )
}

function Shell({ state }: { state: AppData }): React.JSX.Element {
  const { m } = useI18n()
  const [page, setPage] = useState<MainPage>('timer')

  useEffect(() => window.api.onNavigate(setPage), [])

  const pages: { value: MainPage; label: string }[] = [
    { value: 'timer', label: m.nav.timer },
    { value: 'sessions', label: m.nav.sessions },
    { value: 'reports', label: m.nav.reports },
    { value: 'projects', label: m.nav.projects },
    { value: 'settings', label: m.nav.settings }
  ]

  return (
    <div className="flex h-full flex-col">
      <header className="drag relative flex h-12 shrink-0 items-center justify-between pl-4 pr-[150px]">
        <div className="flex items-center gap-2.5">
          <Mark size={20} className="text-ink" />
          <span className="text-[13px] font-medium tracking-tight">Timetracker</span>
        </div>
        <div className="absolute left-1/2 top-1.5 -translate-x-1/2">
          <SegmentedTabs options={pages} value={page} onChange={setPage} label={m.nav.label} testId="nav" />
        </div>
        {page !== 'timer' && <RunningBadge state={state} />}
      </header>

      <main className="thin-scroll min-h-0 flex-1 overflow-y-auto">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={page}
            className="h-full"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.08 } }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            {page === 'timer' && <TimerPage state={state} onGoToProjects={() => setPage('projects')} />}
            {page === 'sessions' && <SessionsPage state={state} />}
            {page === 'reports' && <ReportsPage state={state} />}
            {page === 'projects' && <ProjectsPage state={state} />}
            {page === 'settings' && <SettingsPage state={state} />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  )
}

export function App(): React.JSX.Element | null {
  const state = useAppState()
  if (!state) return null
  return (
    <I18nProvider language={state.settings.language}>
      <Shell state={state} />
    </I18nProvider>
  )
}
