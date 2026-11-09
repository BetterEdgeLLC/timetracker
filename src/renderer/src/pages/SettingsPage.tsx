import { FolderOpen } from 'lucide-react'
import type { Messages } from '@shared/i18n'
import type { AppData, Language, RoundingMinutes, RoundingMode } from '@shared/types'
import { AnimatedSelect } from '@/components/ui/animated-select'
import { Button } from '@/components/ui/button'
import { SegmentedTabs } from '@/components/ui/segmented-tabs'
import { Switch } from '@/components/ui/switch'
import { run } from '@/lib/app-state'
import { useI18n } from '@/lib/i18n'

export function roundingOptions(m: Messages): { id: string; label: string }[] {
  return [
    { id: '0', label: m.settings.roundingNone },
    ...[5, 6, 10, 15, 30].map((n) => ({ id: String(n), label: m.settings.roundingMinutes(n) })),
    { id: '60', label: m.settings.roundingHour }
  ]
}

function Row({
  title,
  hint,
  children
}: {
  title: string
  hint: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex min-h-[72px] items-center justify-between gap-8 border-b border-line/60 py-3">
      <div>
        <p className="text-[14px] text-ink">{title}</p>
        <p className="mt-0.5 text-[12px] text-ink-3">{hint}</p>
      </div>
      {children}
    </div>
  )
}

export function SettingsPage({ state }: { state: AppData }): React.JSX.Element {
  const { m } = useI18n()
  const { settings } = state
  return (
    <div className="mx-auto max-w-[680px] px-8 pb-12 pt-8">
      <h1 className="text-[26px] font-light tracking-tight">{m.settings.title}</h1>
      <div className="mt-6 border-t border-line">
        <Row title={m.settings.language} hint={m.settings.languageHint}>
          <SegmentedTabs<Language>
            label={m.settings.language}
            testId="language"
            value={settings.language}
            options={[
              { value: 'de', label: 'Deutsch' },
              { value: 'en', label: 'English' }
            ]}
            onChange={(language) => run(window.api.updateSettings({ language }))}
          />
        </Row>
        <Row title={m.settings.autostart} hint={m.settings.autostartHint}>
          <Switch
            label={m.settings.autostart}
            testId="setting-autostart"
            checked={settings.autostart}
            onChange={(autostart) => run(window.api.updateSettings({ autostart }))}
          />
        </Row>
        <Row title={m.settings.widget} hint={m.settings.widgetHint}>
          <Switch
            label={m.settings.widget}
            testId="setting-widget"
            checked={settings.widgetEnabled}
            onChange={(widgetEnabled) => run(window.api.updateSettings({ widgetEnabled }))}
          />
        </Row>
        <Row title={m.settings.rounding} hint={m.settings.roundingHint}>
          <AnimatedSelect
            className="w-48"
            label={m.settings.roundingLabel}
            placeholder={m.settings.roundingLabel}
            value={String(settings.rounding.minutes)}
            options={roundingOptions(m)}
            onChange={(id) =>
              run(
                window.api.updateSettings({
                  rounding: { ...settings.rounding, minutes: Number(id) as RoundingMinutes }
                })
              )
            }
          />
        </Row>
        <Row title={m.settings.mode} hint={m.settings.modeHint}>
          <SegmentedTabs<RoundingMode>
            label={m.settings.mode}
            value={settings.rounding.mode}
            options={[
              { value: 'nearest', label: m.settings.modeNearest },
              { value: 'up', label: m.settings.modeUp }
            ]}
            onChange={(mode) => run(window.api.updateSettings({ rounding: { ...settings.rounding, mode } }))}
          />
        </Row>
        <Row title={m.settings.data} hint={m.settings.dataHint}>
          <Button onClick={() => run(window.api.openDataFolder())}>
            <FolderOpen className="size-4" />
            {m.settings.openFolder}
          </Button>
        </Row>
      </div>
    </div>
  )
}
