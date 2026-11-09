import { useCallback, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { AnimatePresence, motion, MotionConfig } from 'motion/react'
import { Check, ChevronLeft, Maximize2, Pause, Play, Plus, Square } from 'lucide-react'
import './styles.css'
import { clock } from '@shared/format'
import { freeProjects, MAX_TIMERS, timerFor } from '@shared/timer'
import type { AppData } from '@shared/types'
import { Mark } from './components/Mark'
import { NameField } from './components/NameField'
import { AnimateDigits } from './components/ui/animate-digits'
import { AddTimerButton, TimerTabs, type TimerTab } from './components/ui/timer-tabs'
import { ToolbarDock } from './components/ui/toolbar-dock'
import { activeProjects, colorOf, useAppState, useElapsed, useTimerView, type TimerView } from './lib/app-state'
import { I18nProvider, useI18n } from './lib/i18n'
import { cn } from './lib/utils'

const PANEL_WIDTH = 288
const CLOSE_DELAY_MS = 360
const SAVED_VISIBLE_MS = 8000
const SAVED_RECHECK_MS = 1000
const DRAWER = { type: 'spring' as const, stiffness: 420, damping: 38, mass: 0.9 }
const ICON = 'size-[17px]'
/** Innenbreite des Panels und Platzbedarf der Kopfzeile, daraus ergibt sich die Länge des Projektnamens. */
const PANEL_INNER = 256
const COLLAPSED_TAB = 26
const ADD_BUTTON = 30
const ACTIVE_TAB_CHROME = 32
const MAX_NAME = 210

interface SavedInfo {
  sessionId: string
  projectId: string
}

function Handle({ state }: { state: AppData }): React.JSX.Element {
  const status = state.timers.some((t) => t.status === 'running')
    ? 'running'
    : state.timers.length > 0
      ? 'paused'
      : undefined
  return (
    <div
      data-testid="widget-handle"
      data-status={status ?? 'idle'}
      data-timers={state.timers.length}
      className="relative z-10 -mr-px flex h-[72px] w-[34px] items-center justify-center rounded-l-2xl border border-r-0 border-line-strong bg-surface shadow-[-3px_0_10px_rgba(0,0,0,0.35)]"
    >
      {status === 'paused' ? (
        <span className="flex gap-[3px]">
          <span className="h-3.5 w-[3px] rounded-full bg-accent" />
          <span className="h-3.5 w-[3px] rounded-full bg-accent" />
        </span>
      ) : (
        <Mark size={20} spinning={status === 'running'} className={status === 'running' ? 'text-ink' : 'text-ink-3'} />
      )}
      {status === 'running' && (
        <span className="status-breathe absolute right-1.5 top-2 size-1.5 rounded-full bg-accent" />
      )}
      {state.timers.length > 1 && (
        <span className="absolute inset-x-0 bottom-2 flex justify-center gap-[3px]" data-testid="widget-handle-pips">
          {state.timers.map((timer) => {
            const project = state.projects.find((p) => p.id === timer.projectId)
            return (
              <span
                key={timer.projectId}
                className={cn('size-[3px] rounded-full', timer.status === 'paused' && 'opacity-40')}
                style={{ background: project ? colorOf(project) : undefined }}
              />
            )
          })}
        </span>
      )}
    </div>
  )
}

function ProjectList({
  state,
  view,
  mode,
  onDone
}: {
  state: AppData
  view: TimerView
  mode: 'switch' | 'add'
  onDone: () => void
}): React.JSX.Element {
  const { m } = useI18n()
  const projects = mode === 'add' ? freeProjects(state) : activeProjects(state)
  return (
    <div className="flex h-full flex-col">
      <button
        type="button"
        onClick={onDone}
        className="press mb-1 flex h-8 items-center gap-1.5 self-start rounded-lg px-1.5 text-[12px] text-ink-3 hover:text-ink"
      >
        <ChevronLeft className="size-3.5" />
        {mode === 'add' ? m.timer.addParallel : m.common.chooseProject}
      </button>
      <div className="thin-scroll -mr-1 min-h-0 flex-1 overflow-y-auto pr-1">
        {projects.map((project, i) => {
          const tracked = timerFor(state, project.id)
          return (
            <motion.button
              key={project.id}
              type="button"
              data-testid={mode === 'add' ? 'widget-add-option' : 'widget-project-option'}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.18, delay: Math.min(i * 0.03, 0.15), ease: [0.22, 1, 0.36, 1] }}
              onClick={() => {
                if (mode === 'add') view.setDraft(project.id)
                else view.pick(project.id)
                onDone()
              }}
              className="flex h-9 w-full items-center gap-2.5 rounded-lg px-2 text-left text-[13px] text-ink-2 transition-colors duration-100 hover:bg-hover hover:text-ink"
            >
              <span className="size-2 shrink-0 rounded-full" style={{ background: colorOf(project) }} />
              <span className="min-w-0 flex-1 truncate">{project.name}</span>
              {project.id === view.projectId ? (
                <Check className="size-3.5 shrink-0 text-accent" />
              ) : (
                tracked && <span className="text-[11px] text-ink-3">{m.status[tracked.status]}</span>
              )}
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}

function Controls({
  state,
  view,
  saved: savedInfo,
  onStopped,
  onPickProject,
  onAddTimer
}: {
  state: AppData
  view: TimerView
  saved: SavedInfo | null
  onStopped: (projectId: string, sessionId: string | null) => void
  onPickProject: () => void
  onAddTimer: () => void
}): React.JSX.Element {
  const { m } = useI18n()
  const { timer, projectId } = view
  const elapsed = useElapsed(timer)
  const project = state.projects.find((p) => p.id === projectId)
  const saved =
    !timer && savedInfo?.projectId === projectId ? state.sessions.find((s) => s.id === savedInfo?.sessionId) : undefined
  const running = timer?.status === 'running'
  const paused = timer?.status === 'paused'
  const statusText = running ? m.status.running : paused ? m.status.paused : saved ? m.status.saved : m.status.idle
  const canStart = Boolean(project) && !running && (Boolean(timer) || state.timers.length < MAX_TIMERS)

  if (activeProjects(state).length === 0) {
    return (
      <div className="flex h-full flex-col items-start justify-center gap-3">
        <p className="text-[13px] leading-snug text-ink-2">{m.widget.firstProject}</p>
        <button
          type="button"
          onClick={() => void window.api.openMain('projects')}
          className="press flex h-9 items-center gap-2 rounded-xl bg-accent px-3 text-[13px] font-medium text-accent-ink"
        >
          <Plus className="size-4" />
          {m.common.createProject}
        </button>
      </div>
    )
  }

  const tabs: TimerTab[] = view.tabIds.flatMap((id) => {
    const item = state.projects.find((p) => p.id === id)
    if (!item) return []
    const tabTimer = timerFor(state, id) ?? null
    return [
      {
        id,
        label: item.name,
        color: colorOf(item),
        timer: tabTimer,
        statusLabel: m.status[tabTimer?.status ?? 'idle']
      }
    ]
  })
  if (tabs.length === 0) tabs.push({ id: '', label: m.common.chooseProject, statusLabel: m.status.idle, timer: null })

  const nameWidth = Math.min(
    MAX_NAME,
    PANEL_INNER - (tabs.length - 1) * COLLAPSED_TAB - (view.canAdd ? ADD_BUTTON : 0) - ACTIVE_TAB_CHROME
  )

  const startView = (): void => {
    if (projectId) void window.api.start(projectId).then(() => view.setDraft(null))
  }

  const stopView = (): void => {
    if (!projectId) return
    // Der gestoppte Tab bleibt kurz stehen, damit "Gespeichert" und das Namensfeld sichtbar sind.
    view.setDraft(projectId)
    void window.api.stop(projectId).then((sessionId) => onStopped(projectId, sessionId))
  }

  return (
    <div className="flex h-full flex-col">
      <div className="-mx-1.5 flex h-8 items-center">
        <TimerTabs
          tabs={tabs}
          value={projectId && tabs.some((t) => t.id === projectId) ? projectId : ''}
          onChange={view.focus}
          onOpenCurrent={onPickProject}
          label={m.timer.activeTimers}
          testId="widget-tab"
          activeTestId="widget-project"
          labelMaxWidth={nameWidth}
        />
        {view.canAdd && <AddTimerButton label={m.timer.addParallel} onClick={onAddTimer} testId="widget-add" />}
      </div>

      <div className="mt-1.5 flex items-end justify-between">
        <AnimateDigits
          value={clock(elapsed)}
          className="font-mono text-[34px] font-light leading-none tracking-tight text-ink"
          enterY={10}
          enterBlur={3}
        />
        <span
          data-testid="widget-status"
          className={cn('mb-0.5 text-[11px]', running || paused ? 'text-accent' : 'text-ink-3')}
        >
          {statusText}
        </span>
      </div>

      <div className="mt-1.5 h-8">
        {timer && (
          <NameField
            key={timer.projectId}
            value={timer.name}
            label={m.common.sessionName}
            testId="widget-name"
            onCommit={(name) => void window.api.renameActive(name, timer.projectId)}
            className="-ml-2 h-8 w-[calc(100%+8px)] text-[12px] text-ink-3 focus:text-ink"
          />
        )}
        {saved && (
          <NameField
            key={saved.id}
            value={saved.name}
            label={m.common.savedSessionName}
            testId="widget-saved-name"
            onCommit={(name) => void window.api.updateSession(saved.id, { name })}
            className="-ml-2 h-8 w-[calc(100%+8px)] text-[12px] text-ink-2 focus:text-ink"
          />
        )}
      </div>

      <div className="mt-auto">
        <ToolbarDock
          items={[
            {
              id: 'start',
              label: paused ? m.action.resume : m.action.start,
              icon: <Play className={ICON} />,
              disabled: !canStart,
              onClick: startView
            },
            {
              id: 'pause',
              label: m.action.pause,
              icon: <Pause className={ICON} />,
              disabled: !running,
              active: paused,
              onClick: () => void window.api.pause(projectId ?? undefined)
            },
            {
              id: 'stop',
              label: m.action.stop,
              icon: <Square className={ICON} />,
              disabled: !timer,
              onClick: stopView
            },
            {
              id: 'open',
              label: m.action.open,
              icon: <Maximize2 className={ICON} />,
              onClick: () => void window.api.openMain()
            }
          ]}
        />
      </div>
    </div>
  )
}

function Widget(): React.JSX.Element | null {
  const state = useAppState()
  const [open, setOpen] = useState(false)
  const [panel, setPanel] = useState<'controls' | 'projects' | 'add'>('controls')
  const [saved, setSaved] = useState<SavedInfo | null>(null)
  const view = useTimerView(state)
  const { setDraft } = view
  const rootRef = useRef<HTMLDivElement>(null)
  const hovering = useRef(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cancelClose = (): void => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    closeTimer.current = null
  }

  const scheduleClose = useCallback((): void => {
    cancelClose()
    closeTimer.current = setTimeout(() => {
      // Solange getippt wird, bleibt die Schublade offen.
      if (hovering.current || document.activeElement instanceof HTMLInputElement) return
      setOpen(false)
      setPanel('controls')
      // Ein nicht gestarteter Tab verschwindet mit der Schublade.
      setDraft(null)
    }, CLOSE_DELAY_MS)
  }, [setDraft])

  const enter = (): void => {
    hovering.current = true
    cancelClose()
    void window.api.widgetIgnoreMouse(false)
    setOpen(true)
  }

  const leave = useCallback((): void => {
    if (!hovering.current) return
    hovering.current = false
    void window.api.widgetIgnoreMouse(true)
    scheduleClose()
  }, [scheduleClose])

  useEffect(() => {
    document.documentElement.addEventListener('mouseleave', leave)
    const onFocusOut = (): void => {
      if (!hovering.current) scheduleClose()
    }
    document.addEventListener('focusout', onFocusOut)
    return () => {
      document.documentElement.removeEventListener('mouseleave', leave)
      document.removeEventListener('focusout', onFocusOut)
    }
  }, [leave, scheduleClose])

  useEffect(() => {
    if (!saved) return
    let timer: ReturnType<typeof setTimeout>
    const expire = (): void => {
      // Wer gerade den Namen tippt, behält die Anzeige. Danach läuft sie von selbst aus.
      if (document.activeElement instanceof HTMLInputElement) {
        timer = setTimeout(expire, SAVED_RECHECK_MS)
        return
      }
      setSaved(null)
      setDraft((current) => (current === saved.projectId ? null : current))
    }
    timer = setTimeout(expire, SAVED_VISIBLE_MS)
    return () => clearTimeout(timer)
  }, [saved, setDraft])

  if (!state) return null

  const markStopped = (projectId: string, sessionId: string | null): void => {
    if (sessionId) {
      setSaved({ sessionId, projectId })
    } else {
      setSaved(null)
      setDraft(null)
    }
  }

  return (
    <I18nProvider language={state.settings.language}>
    <div className="pointer-events-none fixed inset-0 flex items-center justify-end">
      <motion.div
        ref={rootRef}
        data-testid="widget-root"
        data-open={open || undefined}
        className="pointer-events-auto flex items-center"
        initial={false}
        animate={{ x: open ? 0 : PANEL_WIDTH }}
        transition={DRAWER}
        onMouseEnter={enter}
        onMouseLeave={leave}
      >
        <Handle state={state} />
        <div className="relative h-[212px]" style={{ width: PANEL_WIDTH }}>
          {/* Eigene Ebene: Im eingeklappten Zustand darf kein Schatten auf den Desktop fallen. */}
          <div
            aria-hidden
            className={cn(
              'absolute inset-0 rounded-l-2xl shadow-[-14px_14px_44px_rgba(0,0,0,0.55)] transition-opacity duration-200',
              open ? 'opacity-100' : 'opacity-0'
            )}
          />
          <div
            inert={!open}
            className="relative h-full overflow-hidden rounded-l-2xl border border-r-0 border-line-strong bg-surface"
          >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={panel}
              className="h-full p-4 pb-3"
              initial={{ opacity: 0, x: panel === 'controls' ? -14 : 14, filter: 'blur(2px)' }}
              animate={{ opacity: open ? 1 : 0, x: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, x: panel === 'controls' ? -14 : 14, transition: { duration: 0.1 } }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1], delay: open && panel === 'controls' ? 0.04 : 0 }}
            >
              {panel === 'controls' ? (
                <Controls
                  state={state}
                  view={view}
                  saved={saved}
                  onStopped={markStopped}
                  onPickProject={() => setPanel('projects')}
                  onAddTimer={() => setPanel('add')}
                />
              ) : (
                <ProjectList
                  state={state}
                  view={view}
                  mode={panel === 'add' ? 'add' : 'switch'}
                  onDone={() => setPanel('controls')}
                />
              )}
            </motion.div>
          </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>
    </I18nProvider>
  )
}

createRoot(document.getElementById('root')!).render(
  <MotionConfig reducedMotion="user">
    <Widget />
  </MotionConfig>
)
