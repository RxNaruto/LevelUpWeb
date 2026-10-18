import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { describeError } from '@/api/client'
import { connectionsApi } from '@/api/endpoints'
import { invalidateProgress, keys, queryClient } from '@/api/queryClient'
import type { ConnectionState, SyncOutcome } from '@/api/types'
import { useFeedback } from '@/components/useFeedback'
import { Button, Card, Chip, EmptyState, ErrorState, Input, LoadingState, PageHeader, Screen, Switch } from '@/components/ui'
import { relativeTime } from '@/lib/dates'

function summariseSync(outcomes: SyncOutcome[]): string {
  if (outcomes.length === 0) return 'No apps connected yet'
  const updated = outcomes.filter((outcome) => outcome.status === 'updated').length
  const failed = outcomes.filter((outcome) => outcome.status === 'failed').length
  if (updated > 0) return `${updated} goal${updated === 1 ? '' : 's'} updated from your apps`
  if (failed > 0) return `${failed} connection${failed === 1 ? '' : 's'} failed to sync`
  return 'Everything already up to date'
}

function ConnectionCard({ connection }: { connection: ConnectionState }) {
  const { confirm } = useFeedback()
  const needsSecret = connection.authKind === 'revocable-token' || connection.authKind === 'api-key'
  // A key issued by an app you own identifies you on its own; the others read a named profile.
  const needsHandle = connection.authKind !== 'api-key'

  const [handle, setHandle] = useState(connection.handle ?? '')
  const [secret, setSecret] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async (action: () => Promise<{ connections: ConnectionState[] }>) => {
    setBusy(true)
    setError(null)
    try {
      const result = await action()
      queryClient.setQueryData(keys.connections, result.connections)
      setSecret('')
    } catch (cause) {
      setError(describeError(cause))
    } finally {
      setBusy(false)
    }
  }

  const disconnect = async () => {
    const ok = await confirm({
      title: `Disconnect ${connection.label}?`,
      message: 'The handle and any stored token are removed from your account. Tasks stay, but stop syncing.',
      confirmLabel: 'Disconnect',
      destructive: true,
    })
    if (ok) {
      await run(() => connectionsApi.remove(connection.provider))
      setHandle('')
    }
  }

  return (
    <Card className="gap-md">
      <div className="row start between gap-md">
        <div className="stack gap-xs grow">
          <h2 className="t-subheading">{connection.label}</h2>
          <span className="t-caption" style={{ color: 'var(--text-faint)' }}>{connection.requires}</span>
        </div>
        {connection.connected ? (
          <Chip
            label={connection.lastSyncedAt ? relativeTime(connection.lastSyncedAt) : 'connected'}
            variant={connection.lastSyncOk ? 'success' : 'warning'}
          />
        ) : (
          <Chip label={connection.autoTrackable ? 'not connected' : 'manual'} />
        )}
      </div>

      {connection.hint ? <p className="t-caption t-faint" style={{ lineHeight: '19px' }}>{connection.hint}</p> : null}

      {connection.lastSyncError ? (
        <p className="t-caption t-danger" style={{ lineHeight: '19px' }}>Last sync failed: {connection.lastSyncError}</p>
      ) : null}

      {connection.autoTrackable ? (
        <form
          className="stack gap-md divider-top"
          onSubmit={(event) => {
            event.preventDefault()
            void run(() =>
              connectionsApi.save(connection.provider, { handle: handle.trim() || null, secret: secret.trim() || null }),
            )
          }}
        >
          {needsHandle ? (
            <Input
              label="Username"
              placeholder="your handle"
              value={handle}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              onChange={(event) => setHandle(event.target.value)}
            />
          ) : null}

          {needsSecret ? (
            <Input
              label={connection.hasSecret ? 'Token (saved, encrypted)' : 'Token'}
              placeholder={connection.hasSecret ? 'leave blank to keep current' : 'paste token'}
              type="password"
              autoComplete="off"
              value={secret}
              onChange={(event) => setSecret(event.target.value)}
            />
          ) : null}

          {error ? <p className="t-caption t-danger" role="alert">{error}</p> : null}

          {connection.connected ? (
            <div className="inline-switch">
              <span className="t-caption">Include in sync</span>
              <Switch
                label={`Include ${connection.label} in sync`}
                checked={connection.enabled}
                disabled={busy}
                onChange={(next) => void run(() => connectionsApi.setEnabled(connection.provider, next))}
              />
            </div>
          ) : null}

          <div className="row end gap-sm">
            {connection.connected ? (
              <Button title="Disconnect" variant="ghost" size="sm" disabled={busy} onClick={() => void disconnect()} />
            ) : null}
            <Button
              type="submit"
              title="Save"
              size="sm"
              loading={busy}
              disabled={needsHandle ? !handle.trim() : !secret.trim() && !connection.hasSecret}
            />
          </div>
        </form>
      ) : null}
    </Card>
  )
}

export default function Connections() {
  const { toast } = useFeedback()
  const connections = useQuery({ queryKey: keys.connections, queryFn: connectionsApi.list })
  const [syncing, setSyncing] = useState(false)
  const [outcomes, setOutcomes] = useState<SyncOutcome[] | null>(null)

  const runSync = async () => {
    setSyncing(true)
    try {
      setOutcomes(await connectionsApi.sync())
      await Promise.all([queryClient.invalidateQueries({ queryKey: keys.connections }), invalidateProgress()])
    } catch (error) {
      toast(describeError(error), { title: 'Could not sync', tone: 'error' })
    } finally {
      setSyncing(false)
    }
  }

  if (connections.isPending) {
    return (
      <Screen>
        <LoadingState message="Loading connections…" fullScreen />
      </Screen>
    )
  }

  if (connections.isError) {
    return (
      <Screen>
        <ErrorState message={describeError(connections.error)} onRetry={() => void connections.refetch()} />
      </Screen>
    )
  }

  const live = connections.data.filter((item) => item.connected && item.enabled).length

  return (
    <Screen>
      <PageHeader
        title="Apps"
        subtitle="Link an app and it can finish your goals for you. Anything it can't see, you still tick off yourself."
      />

      <Card accent className="gap-md mb-lg">
        <div className="row between gap-md">
          <h2 className="t-subheading">{live} app{live === 1 ? '' : 's'} syncing</h2>
          <Button title="Sync now" size="sm" loading={syncing} onClick={() => void runSync()} />
        </div>

        <p className="t-caption t-faint" style={{ lineHeight: '19px' }}>
          Your apps sync automatically every 30 minutes, when you open Today, and whenever you press this.
        </p>

        {outcomes ? (
          <div className="stack gap-sm divider-top">
            <span className="t-caption t-primary">{summariseSync(outcomes)}</span>
            {outcomes.map((outcome) => (
              <div key={outcome.provider} className="row gap-sm">
                <Chip
                  label={outcome.status}
                  variant={outcome.status === 'updated' ? 'success' : outcome.status === 'failed' ? 'warning' : 'default'}
                />
                <span className="t-caption grow clamp-2">{outcome.label} — {outcome.message}</span>
              </div>
            ))}
          </div>
        ) : null}
      </Card>

      {connections.data.length === 0 ? (
        <EmptyState title="No providers available" icon="⇄" />
      ) : (
        <div className="stack gap-md">
          {connections.data.map((connection) => (
            <ConnectionCard key={`${connection.provider}:${connection.handle ?? ''}`} connection={connection} />
          ))}
        </div>
      )}

      <p className="t-caption t-faint" style={{ lineHeight: '19px', padding: 'var(--xl) 0' }}>
        Tokens are encrypted on the server and never sent back to any device. The website and the mobile app share
        the same connections, so you only enter them once.
      </p>
    </Screen>
  )
}
