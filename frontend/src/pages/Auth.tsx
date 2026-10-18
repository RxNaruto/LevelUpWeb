import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { describeError } from '@/api/client'
import { useAuth } from '@/auth/useAuth'
import { Button, Card, Input, PageHeader, Screen } from '@/components/ui'

function AuthBrand() {
  return (
    <Link to="/" className="auth-brand" aria-label="LevelUp home">
      <img src="/icon-192.png" alt="" width={32} height={32} />
      <span>LevelUp</span>
    </Link>
  )
}

export function Login() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!email.trim() || !password) {
      setError('Enter your email and password.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await login(email.trim(), password)
    } catch (cause) {
      setError(describeError(cause))
      setBusy(false)
    }
  }

  return (
    <Screen bare narrow>
      <AuthBrand />
      <PageHeader
        title="Welcome back"
        subtitle="Sign in to pick up your streak. The same account works on the website and the mobile app."
      />

      <Card className="gap-lg mb-lg">
        <form className="stack gap-lg" onSubmit={(event) => void submit(event)} noValidate>
          <Input
            label="Email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {error ? <p className="alert-box" role="alert">{error}</p> : null}
          <Button type="submit" title="Sign in" loading={busy} fullWidth />
        </form>
      </Card>

      <p className="auth-switch">
        New here? <Link to="/register">Create an account</Link>
      </p>
    </Screen>
  )
}

export function Register() {
  const { register } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim() || !email.trim()) {
      setError('Enter a name and an email address.')
      return
    }
    if (password.length < 8) {
      setError('Pick a password of at least 8 characters.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await register(name.trim(), email.trim(), password)
    } catch (cause) {
      setError(describeError(cause))
      setBusy(false)
    }
  }

  return (
    <Screen bare narrow>
      <AuthBrand />
      <PageHeader
        title="Create your account"
        subtitle="Recurring tasks, projects and XP — synced between the website and the mobile app."
      />

      <Card className="gap-lg mb-lg">
        <form className="stack gap-lg" onSubmit={(event) => void submit(event)} noValidate>
          <Input
            label="Display name"
            placeholder="Rith"
            autoComplete="name"
            autoFocus
            maxLength={60}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <Input
            label="Email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <Input
            label="Password"
            type="password"
            autoComplete="new-password"
            hint="At least 8 characters."
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {error ? <p className="alert-box" role="alert">{error}</p> : null}
          <Button type="submit" title="Create and continue" loading={busy} fullWidth />
        </form>
      </Card>

      <p className="auth-switch">
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </Screen>
  )
}
