import { useEffect, useMemo, useState } from 'react'
import { Archive, ArchiveRestore, Check, Pencil, Plus, Trash2 } from 'lucide-react'
import { hm, moneyText } from '@shared/format'
import { sessionStart } from '@shared/report'
import { segmentsMs } from '@shared/timer'
import { PROJECT_COLORS, type AppData, type Language, type Project } from '@shared/types'
import { Button, IconButton, inputClass } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { colorOf, errorText, run } from '@/lib/app-state'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'

function parseRate(value: string, lang: Language): number | null | 'invalid' {
  const compact = value.trim().replace(/\s|€/g, '')
  if (!compact) return null
  const text =
    lang === 'de'
      ? compact.replace(/\.(?=\d{3}(,|$))/g, '').replace(',', '.')
      : compact.replace(/,/g, '')
  const number = Number(text)
  return Number.isFinite(number) && number >= 0 ? number : 'invalid'
}

function ProjectDialog({
  open,
  project,
  onClose
}: {
  open: boolean
  project: Project | null
  onClose: () => void
}): React.JSX.Element {
  const { m, lang } = useI18n()
  const [name, setName] = useState('')
  const [rate, setRate] = useState('')
  const [colorIndex, setColorIndex] = useState<number | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setName(project?.name ?? '')
    setRate(project?.hourlyRate == null ? '' : moneyText(project.hourlyRate, lang))
    setColorIndex(project?.colorIndex)
    setError(null)
  }, [open, project, lang])

  const save = async (): Promise<void> => {
    const hourlyRate = parseRate(rate, lang)
    if (hourlyRate === 'invalid') {
      setError(m.error.rateFormat)
      return
    }
    try {
      const input = { name, hourlyRate, ...(colorIndex === undefined ? {} : { colorIndex }) }
      if (project) await window.api.updateProject(project.id, input)
      else await window.api.createProject(input)
      onClose()
    } catch (e) {
      setError(errorText(e))
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={project ? m.projects.edit : m.projects.newProject}
      description={m.projects.rateApplies}
    >
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
            autoFocus
            data-testid="project-name"
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-[12px] text-ink-3">
          {m.projects.rateLabel}
          <input
            className={inputClass}
            value={rate}
            inputMode="decimal"
            placeholder={m.projects.ratePlaceholder}
            data-testid="project-rate"
            onChange={(e) => setRate(e.target.value)}
          />
        </label>
        <div className="flex flex-col gap-2 text-[12px] text-ink-3" role="radiogroup" aria-label={m.projects.color}>
          {m.projects.color}
          <div className="flex gap-2">
            {PROJECT_COLORS.map((color, index) => (
              <button
                key={color}
                type="button"
                role="radio"
                aria-checked={colorIndex === index}
                aria-label={m.projects.colorN(index + 1)}
                onClick={() => setColorIndex(index)}
                className="press flex size-7 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                style={{ background: color }}
              >
                {colorIndex === index && <Check className="size-3.5 text-white" />}
              </button>
            ))}
          </div>
        </div>
        {error && (
          <p role="alert" className="text-[13px] text-danger" data-testid="project-error">
            {error}
          </p>
        )}
        <div className="mt-1 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {m.action.cancel}
          </Button>
          <Button variant="primary" type="submit" data-testid="project-save">
            {m.action.save}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

export function ProjectsPage({ state }: { state: AppData }): React.JSX.Element {
  const { m, lang } = useI18n()
  const [dialog, setDialog] = useState<{ open: boolean; project: Project | null }>({ open: false, project: null })

  const stats = useMemo(() => {
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime()
    const map = new Map<string, { month: number; total: number; count: number }>()
    for (const session of state.sessions) {
      const entry = map.get(session.projectId) ?? { month: 0, total: 0, count: 0 }
      const ms = segmentsMs(session.segments)
      entry.total += ms
      entry.count += 1
      if (sessionStart(session) >= monthStart) entry.month += ms
      map.set(session.projectId, entry)
    }
    return map
  }, [state.sessions])

  const sorted = [...state.projects].sort(
    (a, b) => Number(a.archived) - Number(b.archived) || a.name.localeCompare(b.name, lang)
  )

  return (
    <div className="mx-auto max-w-[920px] px-8 pb-12 pt-8">
      <div className="flex items-center justify-between">
        <h1 className="text-[26px] font-light tracking-tight">{m.projects.title}</h1>
        <Button variant="primary" data-testid="project-new" onClick={() => setDialog({ open: true, project: null })}>
          <Plus className="size-4" />
          {m.projects.newProject}
        </Button>
      </div>

      {sorted.length === 0 && <p className="py-16 text-center text-[14px] text-ink-3">{m.projects.empty}</p>}

      {sorted.length > 0 && (
        <div className="mt-8 grid grid-cols-[1fr_110px_110px_110px_84px] border-b border-line pb-2 text-[12px] text-ink-3">
          <span>{m.common.project}</span>
          <span className="text-right">{m.projects.rate}</span>
          <span className="text-right">{m.projects.thisMonth}</span>
          <span className="text-right">{m.projects.total}</span>
          <span />
        </div>
      )}
      <ul>
        {sorted.map((project) => {
          const entry = stats.get(project.id)
          return (
            <li
              key={project.id}
              data-testid="project-row"
              className={cn(
                'group grid h-14 grid-cols-[1fr_110px_110px_110px_84px] items-center border-b border-line/60',
                project.archived && 'opacity-50'
              )}
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: colorOf(project) }} />
                <span className="truncate text-[14px]">{project.name}</span>
                {project.archived && <span className="text-[11px] text-ink-3">{m.projects.archived}</span>}
              </span>
              <span className="text-right font-mono text-[13px] tabular-nums text-ink-2">
                {project.hourlyRate === null ? m.projects.noRate : `${moneyText(project.hourlyRate, lang)} €`}
              </span>
              <span className="text-right font-mono text-[13px] tabular-nums text-ink-2">
                {hm(entry?.month ?? 0)} h
              </span>
              <span className="text-right font-mono text-[13px] tabular-nums text-ink-2">
                {hm(entry?.total ?? 0)} h
              </span>
              <span className="flex justify-end opacity-0 transition-opacity duration-150 focus-within:opacity-100 group-hover:opacity-100">
                <IconButton
                  label={m.projects.edit}
                  data-testid="project-edit"
                  onClick={() => setDialog({ open: true, project })}
                >
                  <Pencil className="size-3.5" />
                </IconButton>
                {entry ? (
                  <IconButton
                    label={project.archived ? m.projects.restore : m.projects.archive}
                    onClick={() => run(window.api.updateProject(project.id, { archived: !project.archived }))}
                  >
                    {project.archived ? <ArchiveRestore className="size-3.5" /> : <Archive className="size-3.5" />}
                  </IconButton>
                ) : (
                  <IconButton
                    label={m.projects.remove}
                    data-testid="project-delete"
                    onClick={() => run(window.api.deleteProject(project.id))}
                  >
                    <Trash2 className="size-3.5" />
                  </IconButton>
                )}
              </span>
            </li>
          )
        })}
      </ul>

      <ProjectDialog
        open={dialog.open}
        project={dialog.project}
        onClose={() => setDialog((d) => ({ ...d, open: false }))}
      />
    </div>
  )
}
