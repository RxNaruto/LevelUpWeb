import { pushApi } from '@/api/endpoints'

export const pushSupported =
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window

export function permission(): NotificationPermission | 'unsupported' {
  return pushSupported ? Notification.permission : 'unsupported'
}

function registration(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.register('/sw.js').then(() => navigator.serviceWorker.ready)
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index)
  return bytes
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported) return null
  const reg = await navigator.serviceWorker.getRegistration('/sw.js')
  return (await reg?.pushManager.getSubscription()) ?? null
}

/**
 * Asks for permission if needed and registers this browser with the server,
 * so reminders arrive with the tab closed. Resolves to the resulting permission.
 */
export async function enablePush(publicKey: string): Promise<NotificationPermission | 'unsupported'> {
  if (!pushSupported) return 'unsupported'
  const result = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission
  if (result !== 'granted') return result

  const reg = await registration()
  const existing = await reg.pushManager.getSubscription()
  const subscription =
    existing ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) }))
  await pushApi.subscribe(subscription.toJSON())
  return 'granted'
}

export async function disablePush(): Promise<void> {
  const subscription = await currentSubscription()
  if (!subscription) return
  await pushApi.unsubscribe(subscription.endpoint).catch(() => undefined)
  await subscription.unsubscribe()
}

/** Shows a notification from this tab, for when the server has no push keys configured. */
export async function showLocalNotification(title: string, body: string): Promise<boolean> {
  if (!pushSupported) return false
  const result = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission
  if (result !== 'granted') return false
  const reg = await registration()
  await reg.showNotification(title, { body, icon: '/icon-192.png', badge: '/icon-192.png', tag: 'levelup-local' })
  return true
}
