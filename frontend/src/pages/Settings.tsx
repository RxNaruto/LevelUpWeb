import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { describeError } from '@/api/client'
import { pushApi, settingsApi } from '@/api/endpoints'
import { keys, queryClient } from '@/api/queryClient'
import type { Settings as SettingsShape } from '@/api/types'
import { useAuth } from '@/auth/useAuth'
import { useFeedback } from '@/components/useFeedback'
import { TimePicker } from '@/components/TimePicker'
import { Button, Card, ErrorState, Input, LoadingState, PageHeader, Screen, Stepper, SwitchRow } from '@/components/ui'
import { currentSubscription, disablePush, enablePush, permission, pushSupported, showLocalNotification } from '@/lib/push'
import { formatTime, reminderSlots } from '@/lib/time'

export default function Settings() {
  const settings = useQuery({ queryKey: keys.settings, queryFn: settingsApi.get })

  if (settings.isPending) {
    return (
      <Screen>
        <LoadingState message="Loading settings…" fullScreen />
      </Screen>
    )
  }

  if (settings.isError) {
    return (
      <Screen>
        <ErrorState message={describeError(settings.error)} onRetry={() => void settings.refetch()} />
      </Screen>
    )
  }

  return <SettingsForm initial={settings.data} />
}

/** Starts from the loaded settings and doesn't re-sync afterwards, so a background refetch never wipes unsaved edits. */
function SettingsForm({ initial }: { initial: SettingsShape }) {
  const { user, logout, updateUser } = useAuth()
  const { toast, confirm } = useFeedback()
  const push = useQuery({ queryKey: keys.push, queryFn: pushApi.config })

  const [displayName, setDisplayName] = useState(initial.displayName)
  const [reminderTime, setReminderTime] = useState(initial.reminderTime)
  const [remindersEnabled, setRemindersEnabled] = useState(initial.remindersEnabled)
  const [reminderHourly, setReminderHourly] = useState(initial.reminderHourly)
  const [countdownEnabled, setCountdownEnabled] = useState(initial.countdownEnabled)
  const [countdownLeadHours, setCountdownLeadHours] = useState(initial.countdownLeadHours)

  const [granted, setGranted] = useState(() => permission())
  const [subscribed, setSubscribed] = useState<boolean | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(true)

  useEffect(() => {
    void currentSubscription().then((subscription) => setSubscribed(Boolean(subscription)))
  }, [])

  /** Marks the form dirty on any change, so "Saved" never lies. */
  const edit = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value)
    setSaved(false)
  }

  const slots = useMemo(() => reminderSlots(reminderTime, reminderHourly), [reminderTime, reminderHourly])

  const countdownStart = useMemo(() => {
    const midnight = new Date()
    midnight.setHours(24, 0, 0, 0)
    const start = new Date(midnight.getTime() - countdownLeadHours * 60 * 60 * 1000)
    return formatTime({ hour: start.getHours(), minute: start.getMinutes() })
  }, [countdownLeadHours])

  const pushReady = Boolean(push.data?.enabled && push.data.publicKey)

  /** Registers this browser for push the moment reminders are switched on. */
  const enableReminders = async (next: boolean) => {
    setRemindersEnabled(next)
    setSaved(false)
    if (next) await subscribeBrowser()
  }

  const subscribeBrowser = async () => {
    if (!pushSupported) return
    try {
      const result = pushReady ? await enablePush(push.data!.publicKey!) : await Notification.requestPermission()
      setGranted(result)
      if (pushReady) setSubscribed(result === 'granted')
      void queryClient.invalidateQueries({ queryKey: keys.push })
      if (result === 'denied') {
        toast('Notifications are blocked for this site. Allow them in your browser’s site settings.', {
          title: 'Notifications are blocked',
          tone: 'error',
        })
      }
    } catch (error) {
      toast(describeError(error), { title: 'Could not enable notifications', tone: 'error' })
    }
  }

  const save = async () => {
    setSaving(true)
    try {
      const patch: Partial<SettingsShape> = {
        reminderTime,
        remindersEnabled,
        reminderHourly,
        countdownEnabled,
        countdownLeadHours,
        ...(displayName.trim() ? { displayName: displayName.trim() } : {}),
      }
      const next = await settingsApi.update(patch)
      queryClient.setQueryData(keys.settings, next)
      updateUser({ name: next.displayName })
      if (!remindersEnabled) {
        await disablePush()
        setSubscribed(false)
      }
      void queryClient.invalidateQueries({ queryKey: keys.push })
      setSaved(true)
    } catch (error) {
      toast(describeError(error), { title: 'Could not save settings', tone: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const sendTest = async (kind: 'reminder' | 'countdown') => {
    const local =
      kind === 'countdown'
        ? ['Time left today', `The timer starts at ${countdownStart} and runs down to 12:00 AM.`]
        : ['Level Up', 'Reminders are working. This is what your nudge looks like.']
    try {
      if (pushReady && (push.data?.subscriptions ?? 0) > 0) {
        await pushApi.test(kind)
      } else if (!(await showLocalNotification(local[0]!, local[1]!))) {
        setGranted(permission())
        toast('Allow notifications for this site first.', { title: 'Notifications are blocked', tone: 'error' })
      }
    } catch (error) {
      toast(describeError(error), { title: 'Could not send a test', tone: 'error' })
    }
  }

  const confirmLogout = async (everywhere: boolean) => {
    const ok = await confirm({
      title: everywhere ? 'Sign out everywhere?' : 'Sign out?',
      message: everywhere
        ? 'Every browser and phone signed in to this account has to sign in again. Your data stays put.'
        : 'This browser stops receiving reminders. Your data stays in your account.',
      confirmLabel: 'Sign out',
      destructive: true,
    })
    if (!ok) return
    await disablePush().catch(() => undefined)
    await logout(everywhere)
  }

  const blocked = remindersEnabled && (granted === 'denied' || granted === 'unsupported')

  return (
    <Screen>
      <PageHeader title="Settings" subtitle="Reminders, your name, and your account." />

      <Card className="gap-xl mb-lg">
        <Input label="Display name" value={displayName} maxLength={60} onChange={(event) => edit(setDisplayName)(event.target.value)} />
      </Card>

      <Card className="gap-xl mb-lg">
        <SwitchRow
          title="Daily reminder"
          hint="Sent by the server through your browser’s push service, so it arrives with this tab closed."
          value={remindersEnabled}
          onChange={(next) => void enableReminders(next)}
        />

        <TimePicker label="First nudge at" value={reminderTime} disabled={!remindersEnabled} onChange={edit(setReminderTime)} />

        <SwitchRow
          title="Repeat every hour"
          hint="Keeps nudging on the hour from the time above until the day resets at midnight."
          value={reminderHourly}
          onChange={edit(setReminderHourly)}
          disabled={!remindersEnabled}
        />

        {remindersEnabled ? (
          <div className="preview">
            <span className="t-label">{slots.length === 1 ? 'One nudge' : `${slots.length} nudges`}</span>
            <span className="preview__times">{slots.map((slot) => formatTime(slot)).join('  ·  ')}</span>
          </div>
        ) : null}

        {blocked ? (
          <p className="t-caption t-warning" style={{ lineHeight: '18px' }}>
            {granted === 'unsupported'
              ? 'This browser can’t receive push notifications. Install the app to your home screen or use another browser.'
              : 'Notification permission is off, so nothing will arrive. Allow notifications in your browser’s site settings.'}
          </p>
        ) : null}

        {remindersEnabled && pushReady && subscribed === false && !blocked ? (
          <Button
            title="Get reminders in this browser"
            variant="secondary"
            size="sm"
            onClick={() => void subscribeBrowser()}
          />
        ) : null}

        {remindersEnabled && push.data && !push.data.enabled ? (
          <p className="t-caption t-warning" style={{ lineHeight: '18px' }}>
            This server has no push keys configured, so reminders only appear while LevelUp is open in a tab.
          </p>
        ) : null}

        <Button title="Send a test notification" variant="ghost" size="sm" disabled={granted === 'denied' || granted === 'unsupported'} onClick={() => void sendTest('reminder')} />
      </Card>

      <Card className="gap-xl mb-lg">
        <SwitchRow
          title="On-screen countdown"
          hint="A timer on Today that counts the time left down to midnight, second by second, plus a heads-up notification when it starts."
          value={countdownEnabled}
          onChange={edit(setCountdownEnabled)}
        />

        <Stepper
          label="Appears this long before midnight"
          value={countdownLeadHours}
          onChange={edit(setCountdownLeadHours)}
          min={1}
          max={12}
          unit={countdownLeadHours === 1 ? 'hour' : 'hours'}
          hint={`The timer will start at ${countdownStart} and run down to 12:00 AM.`}
        />

        <Button
          title="Show the countdown now"
          variant="ghost"
          size="sm"
          disabled={granted === 'denied' || granted === 'unsupported' || !countdownEnabled}
          onClick={() => void sendTest('countdown')}
        />
      </Card>

      <p className="t-caption t-faint mb-lg" style={{ lineHeight: '18px' }}>
        Reminders follow your current timezone ({initial.timezone || user?.timezone}). They skip the nudge
        once every task for the day is done.
      </p>

      <Button title={saved ? 'Saved' : 'Save changes'} loading={saving} disabled={saved} fullWidth className="mb-lg" onClick={() => void save()} />

      <Card className="gap-xl mb-lg">
        <span className="t-label">Account</span>
        <div className="stack gap-xs">
          <span className="t-subheading">{user?.name}</span>
          <span className="t-caption t-faint">{user?.email}</span>
        </div>
        <Button title="Sign out" variant="danger" fullWidth onClick={() => void confirmLogout(false)} />
        <Button title="Sign out of every device" variant="ghost" size="sm" onClick={() => void confirmLogout(true)} />
      </Card>

      <p className="version">LevelUp 1.0.0</p>
    </Screen>
  )
}
