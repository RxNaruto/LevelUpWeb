import { parseTime } from '@/lib/time'

function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value)
}

function Nudge({ glyph, onClick, disabled, label }: { glyph: string; onClick: () => void; disabled?: boolean; label: string }) {
  return (
    <button type="button" className="time-picker__nudge" onClick={onClick} disabled={disabled} aria-label={label}>
      {glyph}
    </button>
  )
}

/** Hour and five-minute nudges with an AM/PM toggle, matching the mobile picker. */
export function TimePicker({
  value,
  onChange,
  label,
  disabled,
}: {
  /** "HH:MM", 24-hour. */
  value: string
  onChange: (next: string) => void
  label?: string
  disabled?: boolean
}) {
  const { hour, minute } = parseTime(value)

  const set = (nextHour: number, nextMinute: number) =>
    onChange(`${pad2((nextHour + 24) % 24)}:${pad2((nextMinute + 60) % 60)}`)

  const pm = hour >= 12
  const twelve = hour % 12 === 0 ? 12 : hour % 12

  const setMeridiem = (nextPm: boolean) => {
    if (nextPm !== pm) set(nextPm ? hour + 12 : hour - 12, minute)
  }

  return (
    <div className="field">
      {label ? <span className="t-label">{label}</span> : null}
      <div className={`time-picker ${disabled ? 'time-picker--disabled' : ''}`}>
        <div className="time-picker__col">
          <Nudge glyph="▲" label="Later hour" disabled={disabled} onClick={() => set(hour + 1, minute)} />
          <span className="time-picker__unit t-timer">{pad2(twelve)}</span>
          <Nudge glyph="▼" label="Earlier hour" disabled={disabled} onClick={() => set(hour - 1, minute)} />
        </div>

        <span className="time-picker__colon t-timer">:</span>

        <div className="time-picker__col">
          <Nudge glyph="▲" label="Later minute" disabled={disabled} onClick={() => set(hour, minute + 5)} />
          <span className="time-picker__unit t-timer">{pad2(minute)}</span>
          <Nudge glyph="▼" label="Earlier minute" disabled={disabled} onClick={() => set(hour, minute - 5)} />
        </div>

        <div className="time-picker__meridiem" role="radiogroup" aria-label="AM or PM">
          {(['AM', 'PM'] as const).map((option) => {
            const active = (option === 'PM') === pm
            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={disabled}
                className={`time-picker__mer ${active ? 'active' : ''}`}
                onClick={() => setMeridiem(option === 'PM')}
              >
                {option}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
