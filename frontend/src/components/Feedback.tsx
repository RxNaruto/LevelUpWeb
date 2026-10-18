import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Button } from './ui'
import { FeedbackContext, type ConfirmOptions, type FeedbackValue, type ToastTone } from './useFeedback'

interface Toast {
  id: number
  title?: string
  message: string
  tone: ToastTone
}

/**
 * The web counterpart of the mobile app's `Alert.alert`: transient toasts for
 * failures, and a promise-returning confirm dialog for destructive actions.
 */
export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const [dialog, setDialog] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null)
  const nextId = useRef(0)

  const toast = useCallback<FeedbackValue['toast']>((message, options) => {
    const id = ++nextId.current
    setToasts((current) => [...current.slice(-2), { id, message, title: options?.title, tone: options?.tone ?? 'info' }])
    setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), 4000)
  }, [])

  const confirm = useCallback<FeedbackValue['confirm']>(
    (options) => new Promise((resolve) => setDialog({ ...options, resolve })),
    [],
  )

  const close = (ok: boolean) => {
    dialog?.resolve(ok)
    setDialog(null)
  }

  useEffect(() => {
    if (!dialog) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const value = useMemo(() => ({ toast, confirm }), [toast, confirm])

  return (
    <FeedbackContext.Provider value={value}>
      {children}

      <div className="toasts" aria-live="polite">
        {toasts.map((item) => (
          <div key={item.id} className={`toast ${item.tone === 'error' ? 'toast--error' : ''}`} role="status">
            {item.title ? <div className="toast__title">{item.title}</div> : null}
            <div>{item.message}</div>
          </div>
        ))}
      </div>

      {dialog ? (
        <div className="dialog-backdrop" onClick={() => close(false)}>
          <div
            className="dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="dialog-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="dialog-title" className="t-heading">{dialog.title}</h2>
            <p className="t-body-muted">{dialog.message}</p>
            <div className="row end gap-sm mt-lg">
              <Button title="Cancel" variant="ghost" size="sm" onClick={() => close(false)} />
              <Button
                title={dialog.confirmLabel}
                variant={dialog.destructive ? 'danger' : 'primary'}
                size="sm"
                autoFocus
                onClick={() => close(true)}
              />
            </div>
          </div>
        </div>
      ) : null}
    </FeedbackContext.Provider>
  )
}
