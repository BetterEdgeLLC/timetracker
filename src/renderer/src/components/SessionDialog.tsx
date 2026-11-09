import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { toLocalInput } from '@shared/format'
import { defaultSessionName } from '@shared/timer'
import type { AppData, Session } from '@shared/types'
import { AnimatedSelect } from '@/components/ui/animated-select'
import { Button, IconButton, inputClass } from '@/components/ui/button'
import { DateTimeField } from '@/components/ui/date-time-field'
import { Dialog } from '@/components/ui/dialog'
import { activeProjects, colorOf, errorText } from '@/lib/app-state'
import { useI18n } from '@/lib/i18n'

interface Row {
  key: number
  start: string
  end: string
}

let rowKey = 0
const toRow = (start: number, end: number): Row => ({
  key: rowKey++,
  start: toLocalInput(start),
  end: toLocalInput(end)
})

export function SessionDialog({
  state,
  open,
  session,
  onClose
}: {
  state: AppData
  open: boolean
  /** null legt einen manuellen Eintrag an. */
  session: Session | null
  onClose: () => void
}): React.JSX.Element {
  const { m, lang } = useI18n()
  const [projectId, setProjectId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [nameEdited, setNameEdited] = useState(false)
  const [rows, setRows] = useState<Row[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    if (session) {
      setProjectId(session.projectId)
      setName(session.name)
      setNameEdited(true)
      setRows(session.segments.map((s) => toRow(s.start, s.end)))
      return
    }
    const now = Date.now()
    const first = state.selectedProjectId ?? activeProjects(state)[0]?.id ?? null
    const project = state.projects.find((p) => p.id === first)
    setProjectId(first)
    setName(project ? defaultSessionName(project.name, now, lang) : '')
    setNameEdited(false)
    setRows([toRow(now - 3_600_000, now)])
    // Nur beim Öffnen vorbelegen, spätere Zustandsänderungen dürfen die Eingabe nicht überschreiben.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, session])

  const options = state.projects
    .filter((p) => !p.archived || p.id === session?.projectId)
    .map((p) => ({ id: p.id, label: p.name, color: colorOf(p) }))

  const chooseProject = (id: string): void => {
    setProjectId(id)
    const project = state.projects.find((p) => p.id === id)
    const firstStart = rows[0] ? new Date(rows[0].start).getTime() : Date.now()
    if (project && !nameEdited) setName(defaultSessionName(project.name, firstStart, lang))
  }

  const updateRow = (key: number, field: 'start' | 'end', value: string): void => {
    setRows((list) => list.map((row) => (row.key === key ? { ...row, [field]: value } : row)))
  }

  const save = async (): Promise<void> => {
    if (!projectId) {
      setError(m.error.chooseProject)
      return
    }
    const segments = rows.map((row) => ({
      start: new Date(row.start).getTime(),
      end: new Date(row.end).getTime()
    }))
    try {
      const input = { projectId, name, segments }
      if (session) await window.api.updateSession(session.id, input)
      else await window.api.createSession(input)
      onClose()
    } catch (e) {
      setError(errorText(e))
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={session ? m.sessionDialog.editTitle : m.sessionDialog.addTitle}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <label className="flex flex-col gap-1.5 text-[12px] text-ink-3">
          {m.common.name}
          <input
            className={inputClass}
            value={name}
            data-testid="session-dialog-name"
            onChange={(e) => {
              setName(e.target.value)
              setNameEdited(true)
            }}
          />
        </label>

        <div className="flex flex-col gap-1.5 text-[12px] text-ink-3">
          {m.common.project}
          <AnimatedSelect
            label={m.common.project}
            placeholder={m.common.chooseProject}
            testId="session-dialog-project"
            value={projectId}
            options={options}
            onChange={chooseProject}
          />
        </div>

        <div className="flex flex-col gap-1.5 text-[12px] text-ink-3">
          {m.sessionDialog.blocks}
          <div className="thin-scroll flex max-h-44 flex-col gap-2 overflow-y-auto">
            {rows.map((row, i) => (
              <div key={row.key} className="flex items-center gap-2">
                <DateTimeField
                  label={m.sessionDialog.blockStart(i + 1)}
                  testId="session-dialog-start"
                  value={row.start}
                  onChange={(value) => updateRow(row.key, 'start', value)}
                />
                <DateTimeField
                  label={m.sessionDialog.blockEnd(i + 1)}
                  testId="session-dialog-end"
                  value={row.end}
                  onChange={(value) => updateRow(row.key, 'end', value)}
                />
                <IconButton
                  label={m.sessionDialog.removeBlock}
                  disabled={rows.length === 1}
                  onClick={() => setRows((list) => list.filter((r) => r.key !== row.key))}
                >
                  <Trash2 className="size-3.5" />
                </IconButton>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="press flex h-8 items-center gap-1.5 self-start rounded-lg text-[12px] text-ink-3 hover:text-ink"
            onClick={() => {
              const last = rows.at(-1)
              const from = last ? new Date(last.end).getTime() + 900_000 : Date.now()
              setRows((list) => [...list, toRow(from, from + 1_800_000)])
            }}
          >
            <Plus className="size-3.5" />
            {m.sessionDialog.addBlock}
          </button>
        </div>

        {error && (
          <p role="alert" className="text-[13px] text-danger" data-testid="session-dialog-error">
            {error}
          </p>
        )}

        <div className="mt-1 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {m.action.cancel}
          </Button>
          <Button variant="primary" type="submit" data-testid="session-dialog-save">
            {m.action.save}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
