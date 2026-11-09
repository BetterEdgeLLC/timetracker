/** Das Logo: ein Ziffernblatt mit offenem Zeitsektor, der Zeiger zeigt in die Lücke. */
export function Mark({
  size = 24,
  spinning = false,
  className
}: {
  size?: number
  spinning?: boolean
  className?: string
}): React.JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} aria-hidden>
      <g className={spinning ? 'ring-spin' : undefined}>
        <path
          d="M32 10a22 22 0 1 1-22 22"
          stroke="currentColor"
          strokeWidth="5.5"
          strokeLinecap="round"
        />
      </g>
      <path d="M32 32 18.5 18.5" stroke="var(--color-accent)" strokeWidth="5.5" strokeLinecap="round" />
    </svg>
  )
}
