// 21st.dev: kevingirelli/bar-chart. barPath, Hover-Tooltip und Tastatur-Slider übernommen,
// auf gestapelte Serien mit Raster und Stundenachse erweitert.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { hm, numberText } from '@shared/format'
import type { ChartData } from '@shared/report'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'

const HEIGHT = 248
const AXIS_WIDTH = 44
const AXIS_HEIGHT = 24
const OTHER_COLOR = '#6f6e69'
const GAP = 2
const n = (value: number): number => Math.round(value * 100) / 100

function barPath(x: number, y: number, width: number, height: number, radius: number): string {
  if (width <= 0 || height <= 0) return ''
  const r = Math.max(0, Math.min(radius, width / 2, height))
  return `M${n(x)} ${n(y + height)} L${n(x)} ${n(y + r)} A${n(r)} ${n(r)} 0 0 1 ${n(x + r)} ${n(y)} L${n(x + width - r)} ${n(y)} A${n(r)} ${n(r)} 0 0 1 ${n(x + width)} ${n(y + r)} L${n(x + width)} ${n(y + height)} Z`
}

const HOUR = 3_600_000

function niceStep(maxHours: number): number {
  for (const step of [0.25, 0.5, 1, 2, 5, 10, 20, 25, 50, 100, 200, 500, 1000]) {
    if (maxHours / step <= 4) return step
  }
  return 2000
}

export function StackedBarChart({ data, chartKey }: { data: ChartData; chartKey: string }): React.JSX.Element {
  const { m, lang } = useI18n()
  const hourLabel = (hours: number): string => `${numberText(hours, lang)} h`
  const [plot, setPlot] = useState<HTMLDivElement | null>(null)
  const [width, setWidth] = useState(640)
  const [active, setActive] = useState<number | null>(null)

  const plotRef = useCallback((node: HTMLDivElement | null) => setPlot(node), [])

  useEffect(() => {
    if (!plot) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry?.contentRect.width) setWidth(entry.contentRect.width)
    })
    observer.observe(plot)
    return () => observer.disconnect()
  }, [plot])

  const { buckets, series } = data
  const plotWidth = Math.max(0, width - AXIS_WIDTH)
  const plotHeight = HEIGHT - AXIS_HEIGHT
  const band = buckets.length ? plotWidth / buckets.length : 0
  const barWidth = Math.min(30, Math.max(3, band * 0.62))

  const scale = useMemo(() => {
    const maxHours = Math.max(...buckets.map((b) => b.total / HOUR), 0)
    const step = niceStep(maxHours || 1)
    const top = Math.max(step, Math.ceil(maxHours / step) * step)
    const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step)
    return { top, ticks }
  }, [buckets])

  const y = (hours: number): number => plotHeight - (hours / scale.top) * (plotHeight - 4)

  const labelEvery = Math.max(1, Math.ceil(buckets.length / Math.max(2, Math.floor(plotWidth / 38))))
  const stagger = Math.min(30, 300 / Math.max(1, buckets.length))

  const onPointer = (event: React.PointerEvent<HTMLDivElement>): void => {
    const box = event.currentTarget.getBoundingClientRect()
    const index = Math.floor(((event.clientX - box.left - AXIS_WIDTH) / plotWidth) * buckets.length)
    setActive(index >= 0 && index < buckets.length ? index : null)
  }

  const onKeyDown = (event: React.KeyboardEvent): void => {
    const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (!delta) return
    event.preventDefault()
    setActive((current) => Math.min(buckets.length - 1, Math.max(0, (current ?? buckets.length - 1) + delta)))
  }

  const bucket = active === null ? undefined : buckets[active]
  const tipLeft = active === null ? 0 : AXIS_WIDTH + (active + 0.5) * band
  const flip = tipLeft > width / 2

  return (
    <div
      ref={plotRef}
      role="slider"
      tabIndex={0}
      aria-label={m.chart.label}
      aria-valuemin={1}
      aria-valuemax={buckets.length}
      aria-valuenow={(active ?? 0) + 1}
      aria-valuetext={bucket ? `${bucket.fullLabel}: ${hm(bucket.total)} ${m.chart.hours}` : undefined}
      data-testid="report-chart"
      className="relative w-full rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
      style={{ height: HEIGHT }}
      onPointerMove={onPointer}
      onPointerLeave={() => setActive(null)}
      onBlur={() => setActive(null)}
      onKeyDown={onKeyDown}
    >
      <svg width={width} height={HEIGHT} aria-hidden className="absolute inset-0 overflow-visible">
        {scale.ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={AXIS_WIDTH}
              x2={width}
              y1={y(tick)}
              y2={y(tick)}
              stroke={tick === 0 ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.06)'}
            />
            <text x={0} y={y(tick) + 4} fill="var(--color-ink-3)" fontSize="11" fontFamily="var(--font-mono)">
              {hourLabel(tick)}
            </text>
          </g>
        ))}

        {buckets.map((b, index) => {
          const x = AXIS_WIDTH + index * band + (band - barWidth) / 2
          const present = series.filter((s) => (b.values[s.id] ?? 0) > 0)
          let cursor = 0
          return (
            <g
              key={`${chartKey}-${b.key}`}
              className="bar-column"
              style={{ animationDelay: `${n(index * stagger)}ms` }}
              opacity={active !== null && active !== index ? 0.4 : 1}
            >
              {present.map((s, i) => {
                const hours = (b.values[s.id] ?? 0) / HOUR
                const topY = y(cursor + hours)
                const bottomY = y(cursor)
                cursor += hours
                const gap = i === 0 ? 0 : GAP
                const height = Math.max(1, bottomY - topY - gap)
                const isTop = i === present.length - 1
                return (
                  <path
                    key={s.id}
                    d={barPath(x, topY, barWidth, height, isTop ? 4 : 0)}
                    fill={s.color ?? OTHER_COLOR}
                  />
                )
              })}
            </g>
          )
        })}

        {buckets.map((b, index) =>
          index % labelEvery === 0 ? (
            <text
              key={b.key}
              x={AXIS_WIDTH + (index + 0.5) * band}
              y={HEIGHT - 6}
              textAnchor="middle"
              fill="var(--color-ink-3)"
              fontSize="11"
            >
              {b.label}
            </text>
          ) : null
        )}
      </svg>

      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute top-2 z-10 min-w-44 rounded-xl border border-line-strong bg-raised px-3 py-2.5 text-[12px] shadow-xl shadow-black/50 transition-opacity duration-100',
          bucket ? 'opacity-100' : 'opacity-0'
        )}
        style={{
          left: tipLeft,
          transform: `translateX(${flip ? 'calc(-100% - 14px)' : '14px'})`
        }}
      >
        {bucket && (
          <>
            <p className="font-medium text-ink">{bucket.fullLabel}</p>
            <ul className="mt-1.5 flex flex-col gap-1">
              {series
                .filter((s) => (bucket.values[s.id] ?? 0) > 0)
                .map((s) => (
                  <li key={s.id} className="flex items-center gap-2 text-ink-2">
                    <span className="size-2 rounded-[3px]" style={{ background: s.color ?? OTHER_COLOR }} />
                    <span className="max-w-40 flex-1 truncate">{s.name}</span>
                    <span className="font-mono tabular-nums text-ink">{hm(bucket.values[s.id] ?? 0)}</span>
                  </li>
                ))}
            </ul>
            {bucket.total === 0 && <p className="mt-1 text-ink-3">{m.chart.noTime}</p>}
          </>
        )}
      </div>
    </div>
  )
}
