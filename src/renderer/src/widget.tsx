import { useCallback, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { AnimatePresence, motion, MotionConfig } from 'motion/react'
import { Check, ChevronLeft, Maximize2, Pause, Play, Plus, Square } from 'lucide-react'
import './styles.css'
import { clock } from '@shared/format'
import type { AppData } from '@shared/types'
import { Mark } from './components/Mark'
import { NameField } from './components/NameField'
import { AnimateDigits } from './components/ui/animate-digits'
import { ToolbarDock } from './components/ui/toolbar-dock'
import { activeProjects, colorOf, useAppState, useElapsed } from './lib/app-state'
import { I18nProvider, useI18n } from './lib/i18n'
import { cn } from './lib/utils'

const PANEL_WIDTH = 288
const CLOSE_DELAY_MS = 360
const SAVED_VISIBLE_MS = 8000
const DRAWER = { type: 'spring' as const, stiffness: 420, damping: 38, mass: 0.9 }
const ICON = 'size-[17px]'

function Handle({ state }: { state: AppData }): React.JSX.Element {
  const status = state.active?.status
  return (
    <div
      data-testid="widget-handle"
      data-status={status ?? 'idle'}
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
    </div>
  )
}

function ProjectList({ state, onDone }: { state: AppData; onDone: () => void }): React.JSX.Element {
  const { m } = useI18n()
  const projects = activeProjects(state)
  const current = state.active?.projectId ?? state.selectedProjectId
  return (
    <div className="flex h-full flex-col">
      <button
        type="button"
        onClick={onDone}
        className="press mb-1 flex h-8 items-center gap-1.5 self-start rounded-lg px-1.5 text-[12px] text-ink-3 hover:text-ink"
      >
        <ChevronLeft className="size-3.5" />
        {m.common.chooseProject}
      </button>
      <div className="thin-scroll -mr-1 min-h-0 flex-1 overflow-y-auto pr-1">
        {projects.map((project, i) => (
          <motion.button
            key={project.id}
            type="button"
            data-testid="widget-project-option"
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.18, delay: Math.min(i * 0.03, 0.15), ease: [0.22, 1, 0.36, 1] }}
            onClick={() => {
              void window.api.switchProject(project.id)
              onDone()
            }}
            className="flex h-9 w-full items-center gap-2.5 rounded-lg px-2 text-left text-[13px] text-ink-2 transition-colors duration-100 hover:bg-hover hover:text-ink"
          >
            <span className="size-2 shrink-0 rounded-full" style={{ background: colorOf(project) }} />
            <span className="min-w-0 flex-1 truncate">{project.name}</span>
            {project.id === current && <Check className="size-3.5 shrink-0 text-accent" />}
          </motion.button>
        ))}
      </div>
    </div>
  )
}

function Controls({
  state,
  savedSessionId,
  onStopped,
  onPickProject
}: {
  state: AppData
  savedSessionId: string | null
  onStopped: () => void
  onPickProject: () => void
}): React.JSX.Element {
  const { m } = useI18n()
  const { active } = state
  const elapsed = useElapsed(active)
  const projectId = active?.projectId ?? state.selectedProjectId
  const project = state.projects.find((p) => p.id === projectId)
  const saved = !active && savedSessionId ? state.sessions.find((s) => s.id === savedSessionId) : undefined
  const running = active?.status === 'running'
  const paused = active?.status === 'paused'
  const statusText = running ? m.status.running : paused ? m.status.paused : saved ? m.status.saved : m.status.idle

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

  return (
    <div className="flex h-full flex-col">
      <button
        type="button"
        data-testid="widget-project"
        onClick={onPickProject}
        className="press -mx-1 flex h-8 items-center gap-2 self-start rounded-lg px-1.5 text-[13px] text-ink-2 hover:bg-hover hover:text-ink"
      >
        {project && <span className="size-2 rounded-full" style={{ background: colorOf(project) }} />}
        <span className="max-w-[210px] truncate">{project?.name ?? m.common.chooseProject}</span>
      </button>

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
        {active && (
          <NameField
            value={active.name}
            label={m.common.sessionName}
            testId="widget-name"
            onCommit={(name) => void window.api.renameActive(name)}
            className="-ml-2 h-8 w-[calc(100%+8px)] text-[12px] text-ink-3 focus:text-ink"
          />
        )}
        {saved && (
          <NameField
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
              disabled: running || !project,
              onClick: () => void window.api.start()
            },
            {
              id: 'pause',
              label: m.action.pause,
              icon: <Pause className={ICON} />,
              disabled: !running,
              active: paused,
              onClick: () => void window.api.pause()
            },
            {
              id: 'stop',
              label: m.action.stop,
              icon: <Square className={ICON} />,
              disabled: !active,
              onClick: () => void window.api.stop().then(onStopped)
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
  const [view, setView] = useState<'controls' | 'projects'>('controls')
  const [savedSessionId, setSavedSessionId] = useState<string | null>(null)
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
      setView('controls')
    }, CLOSE_DELAY_MS)
  }, [])

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
    if (!savedSessionId) return
    const timer = setTimeout(() => {
      if (!(document.activeElement instanceof HTMLInputElement)) setSavedSessionId(null)
    }, SAVED_VISIBLE_MS)
    return () => clearTimeout(timer)
  }, [savedSessionId])

  if (!state) return null

  const markSaved = (): void => {
    void window.api.getState().then((latest) => setSavedSessionId(latest.sessions.at(-1)?.id ?? null))
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
              key={view}
              className="h-full p-4 pb-3"
              initial={{ opacity: 0, x: view === 'projects' ? 14 : -14, filter: 'blur(2px)' }}
              animate={{ opacity: open ? 1 : 0, x: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, x: view === 'projects' ? 14 : -14, transition: { duration: 0.1 } }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1], delay: open && view === 'controls' ? 0.04 : 0 }}
            >
              {view === 'controls' ? (
                <Controls
                  state={state}
                  savedSessionId={savedSessionId}
                  onStopped={markSaved}
                  onPickProject={() => setView('projects')}
                />
              ) : (
                <ProjectList state={state} onDone={() => setView('controls')} />
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
