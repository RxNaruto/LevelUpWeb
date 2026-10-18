import { createContext, useContext } from 'react'

export type ToastTone = 'info' | 'error'

export interface ConfirmOptions {
  title: string
  message: string
  confirmLabel: string
  destructive?: boolean
}

export interface FeedbackValue {
  toast: (message: string, options?: { title?: string; tone?: ToastTone }) => void
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

export const FeedbackContext = createContext<FeedbackValue | null>(null)

export function useFeedback(): FeedbackValue {
  const context = useContext(FeedbackContext)
  if (!context) throw new Error('useFeedback must be used inside <FeedbackProvider>')
  return context
}
