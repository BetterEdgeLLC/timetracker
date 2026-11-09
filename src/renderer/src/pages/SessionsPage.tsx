import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { DATE_PATTERNS } from '@shared/dates'
import { hm, timeText } from '@shared/format'
import { sessionEnd, sessionStart } from '@shared/report'
import { segmentsMs } from '@shared/timer'
import type { AppData, Session } from '@shared/types'
import { NameField } from '@/components/NameField'
import { SessionDialog } from '@/components/SessionDialog'
import { Button, IconButton, inputClass } from '@/components/ui/button'
import { colorOf, run } from '@/lib/app-state'
import { useI18n } from '@/lib/i18n'

export function SessionsPage({ state }: { state: AppData }): React.JSX.Element {
  const { m, lang } = useI18n()
  const [query, setQuery] = useState('')
  const [dialog, setDialog] = useState<{ open: boolean; session: Session | null }>({ open: false, session: null })
  const patterns = DATE_PATTERNS[lang]

  const projectName = (id: string): string =>
    state.projects.find((p) => p.id === id)?.name ?? m.common.deletedProject

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const list = state.sessions
      .filter((s) => !needle || `${s.name} ${projectName(s.projectId)}`.toLowerCase().includes(needle))
      .sort((a, b) => sessionStart(b) - sessionStart(a))
    const map = new Map<string, Session[]>()
    for (const session of list) {
      const key = format(sessionStart(session), 'yyyy-MM-dd')
      map.set(key, [...(map.get(key) ?? []), session])
    }
    return [...map.entries()]
    // projectName liest nur state.projects und die Sprache.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.sessions, state.projects, query, lang])

  const remove = (session: Session): void => {
    run(window.api.deleteSession(session.id))
    toast(m.sessions.deleted, {
      action: {
        label: m.action.undo,
        onClick: () =>
          run(
            window.api.createSession({
              projectId: session.projectId,
              name: session.name,
              segments: session.segments
            })
          )
      }
    })
  }

  return (
    <div className="mx-auto max-w-[920px] px-8 pb-12 pt-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-[26px] font-light tracking-tight">{m.sessions.title}</h1>
        <div className="flex items-center gap-2">
          <div className="relative w-60">
            <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-3" aria-hidden />
            <input
              className={`${inputClass} h-9 pl-8`}
              placeholder={m.sessions.search}
              aria-label={m.sessions.searchLabel}
              data-testid="sessions-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Button
            variant="primary"
            data-testid="sessions-add"
            onClick={() => setDialog({ open: true, session: null })}
            disabled={state.projects.length === 0}
          >
            <Plus className="size-4" />
            {m.sessions.add}
          </Button>
        </div>
      </div>

      {groups.length === 0 && (
        <p className="py-16 text-center text-[14px] text-ink-3">{query ? m.sessions.nothingFound : m.sessions.empty}</p>
      )}

      {groups.map(([day, sessions]) => (
        <section key={day} className="mt-8" aria-label={day}>
          <div className="flex items-baseline justify-between border-b border-line pb-2">
            <h2 className="text-[13px] font-medium text-ink-2">
              {format(new Date(`${day}T12:00:00`), patterns.long, { locale: patterns.locale })}
            </h2>
            <span className="font-mono text-[13px] tabular-nums text-ink-2">
              {hm(sessions.reduce((sum, s) => sum + segmentsMs(s.segments), 0))} h
            </span>
          </div>
          <ul>
            {sessions.map((session) => {
              const project = state.projects.find((p) => p.id === session.projectId)
              return (
                <li
                  key={session.id}
                  data-testid="session-row"
                  className="group flex h-12 items-center gap-3 border-b border-line/60"
                >
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ background: project ? colorOf(project) : undefined }}
                  />
                  <NameField
                    value={session.name}
                    label={m.common.sessionName}
                    testId="session-name"
                    onCommit={(name) => run(window.api.updateSession(session.id, { name }))}
                    className="-ml-1 h-8 flex-1 text-[13px] text-ink"
                  />
                  <span className="w-36 truncate text-right text-[12px] text-ink-3">
                    {projectName(session.projectId)}
                  </span>
                  <span className="w-28 text-right font-mono text-[12px] tabular-nums text-ink-3">
                    {timeText(sessionStart(session))} {m.common.to} {timeText(sessionEnd(session))}
                  </span>
                  <span className="w-12 text-right font-mono text-[13px] tabular-nums text-ink">
                    {hm(segmentsMs(session.segments))}
                  </span>
                  <span className="flex opacity-0 transition-opacity duration-150 focus-within:opacity-100 group-hover:opacity-100">
                    <IconButton
                      label={m.sessions.edit}
                      data-testid="session-edit"
                      onClick={() => setDialog({ open: true, session })}
                    >
                      <Pencil className="size-3.5" />
                    </IconButton>
                    <IconButton label={m.sessions.remove} data-testid="session-delete" onClick={() => remove(session)}>
                      <Trash2 className="size-3.5" />
                    </IconButton>
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      ))}

      <SessionDialog
        state={state}
        open={dialog.open}
        session={dialog.session}
        onClose={() => setDialog((d) => ({ ...d, open: false }))}
      />
    </div>
  )
}
