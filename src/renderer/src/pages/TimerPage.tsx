import { useMemo } from 'react'
import { Pause, Play, Plus, Square } from 'lucide-react'
import { clock, hm, timeText } from '@shared/format'
import { sessionEnd, sessionStart } from '@shared/report'
import { segmentsMs } from '@shared/timer'
import type { AppData } from '@shared/types'
import { NameField } from '@/components/NameField'
import { AnimateDigits } from '@/components/ui/animate-digits'
import { AnimatedSelect } from '@/components/ui/animated-select'
import { Button } from '@/components/ui/button'
import { activeProjects, colorOf, run, useElapsed } from '@/lib/app-state'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'

function RoundAction({
  label,
  testId,
  primary,
  disabled,
  onClick,
  children
}: {
  label: string
  testId: string
  primary?: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex w-20 flex-col items-center gap-2">
      <button
        type="button"
        aria-label={label}
        data-testid={testId}
        disabled={disabled}
        onClick={onClick}
        className={cn(
          'press flex items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-accent/60 disabled:pointer-events-none',
          primary
            ? 'size-[72px] bg-accent text-accent-ink hover:bg-accent/90 disabled:bg-raised disabled:text-ink-3/50'
            : 'size-14 border border-line-strong text-ink hover:bg-hover disabled:border-line disabled:text-ink-3/40'
        )}
      >
        {children}
      </button>
      <span className={cn('text-[12px]', disabled ? 'text-ink-3/60' : 'text-ink-3')}>{label}</span>
    </div>
  )
}

export function TimerPage({
  state,
  onGoToProjects
}: {
  state: AppData
  onGoToProjects: () => void
}): React.JSX.Element {
  const { m } = useI18n()
  const { active } = state
  const elapsed = useElapsed(active)
  const running = active?.status === 'running'
  const paused = active?.status === 'paused'
  const projects = activeProjects(state)
  const selectedId = active?.projectId ?? state.selectedProjectId

  const today = useMemo(() => {
    const dayStart = new Date().setHours(0, 0, 0, 0)
    return state.sessions.filter((s) => sessionStart(s) >= dayStart).sort((a, b) => sessionStart(b) - sessionStart(a))
  }, [state.sessions])
  const todayMs = today.reduce((sum, s) => sum + segmentsMs(s.segments), 0)

  if (state.projects.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-5 pb-16 text-center">
        <p className="max-w-xs text-[15px] leading-relaxed text-ink-2">{m.timer.emptyHint}</p>
        <Button variant="primary" onClick={onGoToProjects} data-testid="empty-new-project">
          <Plus className="size-4" />
          {m.common.createProject}
        </Button>
      </div>
    )
  }

  return (
    <div className="relative mx-auto flex min-h-full max-w-[720px] flex-col px-8 pb-10">
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute left-1/2 top-16 h-72 w-[560px] -translate-x-1/2 rounded-full opacity-0 blur-3xl transition-opacity duration-700',
          running && 'opacity-100'
        )}
        style={{ background: 'radial-gradient(closest-side, rgba(226,183,122,0.10), transparent)' }}
      />

      <section className="relative flex flex-col items-center pt-14">
        <AnimatedSelect
          className="w-64"
          label={m.common.project}
          placeholder={m.common.chooseProject}
          testId="timer-project"
          value={selectedId}
          options={projects.map((p) => ({ id: p.id, label: p.name, color: colorOf(p) }))}
          onChange={(id) => run(window.api.switchProject(id))}
        />

        <div className="mt-9" data-testid="timer-clock" data-status={active?.status ?? 'idle'}>
          <AnimateDigits
            value={clock(elapsed)}
            className={cn(
              'font-mono text-[104px] font-extralight leading-none tracking-[-0.04em] transition-colors duration-300',
              paused ? 'text-ink-3' : 'text-ink'
            )}
            enterY={22}
            enterBlur={5}
          />
        </div>

        <div className="mt-3 h-9 w-full max-w-md">
          {active ? (
            <NameField
              value={active.name}
              label={m.common.sessionName}
              testId="timer-name"
              onCommit={(name) => run(window.api.renameActive(name))}
              className="h-9 w-full text-center text-[14px] text-ink-2 focus:text-ink"
            />
          ) : (
            <p className="flex h-9 items-center justify-center text-[14px] text-ink-3">{m.timer.autoName}</p>
          )}
        </div>

        <div className="mt-8 flex items-center justify-center gap-5">
          <RoundAction
            label={m.action.pause}
            testId="timer-pause"
            disabled={!running}
            onClick={() => run(window.api.pause())}
          >
            <Pause className="size-5" />
          </RoundAction>
          <RoundAction
            primary
            label={paused ? m.action.resume : m.action.start}
            testId="timer-start"
            disabled={running || !selectedId}
            onClick={() => run(window.api.start())}
          >
            <Play className="size-6 translate-x-px" />
          </RoundAction>
          <RoundAction label={m.action.stop} testId="timer-stop" disabled={!active} onClick={() => run(window.api.stop())}>
            <Square className="size-[18px]" />
          </RoundAction>
        </div>
      </section>

      <section className="relative mt-12" aria-label={m.timer.today}>
        <div className="flex items-baseline justify-between border-b border-line pb-2.5">
          <h2 className="text-[13px] font-medium text-ink-2">{m.timer.today}</h2>
          <span className="font-mono text-[13px] tabular-nums text-ink-2" data-testid="today-total">
            {hm(todayMs)} h
          </span>
        </div>
        {today.length === 0 && <p className="py-5 text-[13px] text-ink-3">{m.timer.todayEmpty}</p>}
        <ul>
          {today.map((session) => {
            const project = state.projects.find((p) => p.id === session.projectId)
            return (
              <li key={session.id} className="flex h-11 items-center gap-3 border-b border-line/60">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: project ? colorOf(project) : undefined }}
                />
                <NameField
                  value={session.name}
                  label={m.common.sessionName}
                  testId="today-name"
                  onCommit={(name) => run(window.api.updateSession(session.id, { name }))}
                  className="-ml-1 h-8 flex-1 text-[13px] text-ink"
                />
                <span className="font-mono text-[12px] tabular-nums text-ink-3">
                  {timeText(sessionStart(session))} {m.common.to} {timeText(sessionEnd(session))}
                </span>
                <span className="w-12 text-right font-mono text-[13px] tabular-nums text-ink-2">
                  {hm(segmentsMs(session.segments))}
                </span>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
