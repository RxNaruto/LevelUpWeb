import {
  forwardRef,
  useId,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react'

const cx = (...names: Array<string | false | null | undefined>) => names.filter(Boolean).join(' ')

/* Screen */

export function Screen({
  children,
  bare = false,
  narrow = false,
}: {
  children: ReactNode
  /** Detail and auth screens: no tab bar to clear on phones. */
  bare?: boolean
  narrow?: boolean
}) {
  return <main className={cx('screen', bare && 'screen--bare', narrow && 'screen--narrow')}>{children}</main>
}

/* Button */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'title'> {
  title: string
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  fullWidth?: boolean
}

export function Button({
  title,
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  disabled,
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx('btn', `btn--${variant}`, `btn--${size}`, fullWidth && 'btn--full', className)}
      {...props}
    >
      {loading ? <span className="spinner" aria-label="Loading" /> : title}
    </button>
  )
}

/* Card */

export function Card({
  children,
  onClick,
  accent = false,
  className,
  style,
}: {
  children: ReactNode
  onClick?: () => void
  accent?: boolean
  className?: string
  style?: CSSProperties
}) {
  const classes = cx('card', accent && 'card--accent', onClick && 'card--pressable', className)
  if (onClick) {
    return (
      <button type="button" className={classes} style={style} onClick={onClick}>
        {children}
      </button>
    )
  }
  return (
    <section className={classes} style={style}>
      {children}
    </section>
  )
}

/* Chip */

export function Chip({ label, variant = 'default' }: { label: string; variant?: 'default' | 'accent' | 'success' | 'warning' }) {
  return <span className={cx('chip', variant !== 'default' && `chip--${variant}`)}>{label}</span>
}

/* Input */

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  label?: string
  error?: string | null
  hint?: string
  prefix?: ReactNode
  suffix?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, prefix, suffix, id, className, ...props },
  ref,
) {
  const generated = useId()
  const inputId = id ?? generated
  return (
    <div className="field">
      {label ? <label className="t-label" htmlFor={inputId}>{label}</label> : null}
      <div className={cx('field__box', error && 'field__box--error')}>
        {prefix}
        <input
          ref={ref}
          id={inputId}
          className={cx('field__input', className)}
          aria-invalid={Boolean(error) || undefined}
          {...props}
        />
        {suffix}
      </div>
      {error ? <span className="field__error">{error}</span> : hint ? <span className="field__hint">{hint}</span> : null}
    </div>
  )
})

export function TextArea({
  label,
  hint,
  maxLength,
  value,
  id,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; hint?: string; value: string }) {
  const generated = useId()
  const inputId = id ?? generated
  return (
    <div className="field">
      {label ? <label className="t-label" htmlFor={inputId}>{label}</label> : null}
      <div className="field__box field__box--multiline">
        <textarea id={inputId} className="field__input field__textarea" value={value} maxLength={maxLength} {...props} />
      </div>
      {hint || maxLength ? (
        <div className="field__footer">
          {hint ? <span className="field__hint">{hint}</span> : <span />}
          {maxLength ? <span className="field__hint">{value.length}/{maxLength}</span> : null}
        </div>
      ) : null}
    </div>
  )
}

/* Segmented */

function sentenceCase(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase()
}

export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  format = sentenceCase as (option: T) => string,
}: {
  label?: string
  options: readonly T[]
  value: T
  onChange: (next: T) => void
  format?: (option: T) => string
}) {
  const labelId = useId()
  return (
    <div className="field">
      {label ? <span className="t-label" id={labelId}>{label}</span> : null}
      <div className="segmented" role="radiogroup" aria-labelledby={label ? labelId : undefined}>
        {options.map((option) => {
          const active = option === value
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={active}
              className={cx('segmented__option', active && 'active')}
              onClick={() => onChange(option)}
            >
              {format(option)}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* Stepper */

export function Stepper({
  label,
  hint,
  value,
  onChange,
  min = 0,
  max = 9999,
  step = 1,
  unit,
}: {
  label?: string
  hint?: string
  value: number
  onChange: (next: number) => void
  min?: number
  max?: number
  step?: number
  unit?: string
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const inputId = useId()
  const clamp = (next: number) => Math.min(max, Math.max(min, next))

  const commit = () => {
    if (draft !== null) onChange(clamp(Number(draft.replace(/\D/g, '')) || min))
    setDraft(null)
  }

  return (
    <div className="field">
      {label ? <label className="t-label" htmlFor={inputId}>{label}</label> : null}
      <div className="stepper">
        <button
          type="button"
          className="stepper__btn"
          aria-label="Decrease"
          disabled={value <= min}
          onClick={() => onChange(clamp(value - step))}
        >
          −
        </button>
        <div className="stepper__value">
          <input
            id={inputId}
            className="stepper__input"
            inputMode="numeric"
            value={draft ?? String(value)}
            onChange={(event) => setDraft(event.target.value)}
            onFocus={(event) => event.target.select()}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === 'Enter') (event.target as HTMLInputElement).blur()
              if (event.key === 'ArrowUp') { event.preventDefault(); onChange(clamp(value + step)) }
              if (event.key === 'ArrowDown') { event.preventDefault(); onChange(clamp(value - step)) }
            }}
          />
          {unit ? <span className="stepper__unit">{unit}</span> : null}
        </div>
        <button
          type="button"
          className="stepper__btn"
          aria-label="Increase"
          disabled={value >= max}
          onClick={() => onChange(clamp(value + step))}
        >
          +
        </button>
      </div>
      {hint ? <span className="field__hint">{hint}</span> : null}
    </div>
  )
}

/* Stat */

export function Stat({ label, value, hint, tint = 'var(--primary-hover)' }: { label: string; value: string | number; hint?: string; tint?: string }) {
  return (
    <div className="stat">
      <span className="stat__label">{label}</span>
      <span className="stat__value" style={{ color: tint }}>{value}</span>
      {hint ? <span className="stat__hint">{hint}</span> : null}
    </div>
  )
}

/* PageHeader */

export function PageHeader({
  title,
  subtitle,
  eyebrow,
  onBack,
  action,
}: {
  title: string
  subtitle?: string
  eyebrow?: string
  onBack?: () => void
  action?: ReactNode
}) {
  return (
    <header className="page-header">
      {onBack ? (
        <button type="button" className="page-header__back" onClick={onBack} aria-label="Go back">
          ←
        </button>
      ) : null}
      {eyebrow ? <span className="page-header__eyebrow">{eyebrow}</span> : null}
      <div className="page-header__row">
        <h1 className="t-display clamp-2">{title}</h1>
        {action}
      </div>
      {subtitle ? <p className="t-body-muted">{subtitle}</p> : null}
    </header>
  )
}

/* ProgressBar */

export function ProgressBar({ value, height = 6, tint = 'var(--primary)' }: { value: number; height?: number; tint?: string }) {
  const pct = Math.round(Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0)) * 100)
  return (
    <div className="progress" style={{ height }} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className="progress__fill" style={{ width: `${pct}%`, background: tint }} />
    </div>
  )
}

/* IconButton */

export function IconButton({ label, onClick, disabled, ariaLabel }: { label: string; onClick?: () => void; disabled?: boolean; ariaLabel?: string }) {
  return (
    <button type="button" className="icon-btn" onClick={onClick} disabled={disabled} aria-label={ariaLabel ?? label}>
      {label}
    </button>
  )
}

/* Switch */

export function Switch({ checked, onChange, disabled, label }: { checked: boolean; onChange: (next: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="switch"
      disabled={disabled}
      onClick={() => onChange(!checked)}
    />
  )
}

export function SwitchRow({
  title,
  hint,
  value,
  onChange,
  disabled,
}: {
  title: string
  hint: string
  value: boolean
  onChange: (next: boolean) => void
  disabled?: boolean
}) {
  return (
    <div className={cx('switch-row', disabled && 'switch-row--dim')}>
      <div className="stack gap-xs grow">
        <span className="t-subheading">{title}</span>
        <span className="t-caption t-faint">{hint}</span>
      </div>
      <Switch checked={value} onChange={onChange} disabled={disabled} label={title} />
    </div>
  )
}

/* States */

export function EmptyState({ title, message, icon = '◎' }: { title: string; message?: string; icon?: string }) {
  return (
    <div className="empty">
      <span className="empty__icon" aria-hidden>{icon}</span>
      <span className="t-subheading">{title}</span>
      {message ? <p className="t-body-muted empty__message">{message}</p> : null}
    </div>
  )
}

export function ErrorState({ title = 'Something went wrong', message, onRetry }: { title?: string; message: string; onRetry?: () => void }) {
  return (
    <div className="error-state" role="alert">
      <span className="t-subheading t-danger">{title}</span>
      <p className="t-body-muted">{message}</p>
      {onRetry ? <Button title="Try again" variant="secondary" size="sm" onClick={onRetry} /> : null}
    </div>
  )
}

export function LoadingState({ message, fullScreen = false }: { message?: string; fullScreen?: boolean }) {
  return (
    <div className={cx('loading', fullScreen && 'loading--full')} role="status">
      <span className="spinner spinner--lg" />
      {message ? <span className="t-caption">{message}</span> : null}
    </div>
  )
}
