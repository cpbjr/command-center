import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, setStayLoggedIn } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// Gated behind VITE_REQUIRE_AUTH so the app keeps working on the current
// (anon-access) Supabase project. Flipped to true as part of the new-project
// security lockdown — see .agent/Tasks/Implementation/ cutover runbook.
const REQUIRE_AUTH = import.meta.env.VITE_REQUIRE_AUTH === 'true'

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(REQUIRE_AUTH)

  useEffect(() => {
    if (!REQUIRE_AUTH) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (!REQUIRE_AUTH) return <>{children}</>

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-pine-deep">
        <span className="text-meta text-sand animate-pulse">Loading…</span>
      </div>
    )
  }

  if (!session) return <LoginPage />

  return <>{children}</>
}

function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [stayLoggedIn, setStay] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPending(true)
    setError(null)
    // Record the storage preference before signing in so the session lands in
    // the right place (localStorage = persistent, sessionStorage = this tab only).
    setStayLoggedIn(stayLoggedIn)
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) setError(signInError.message)
    setPending(false)
  }

  return (
    // Pine field is the brand's front door. A parchment card holds the form.
    <div className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-b from-pine-deep to-pine-forest p-6">
      <div className="w-full max-w-sm">
        {/* Wordmark lockup — .wordmark/.wordmark-tagline promoted to wpa-brand.css */}
        <div className="mb-8 text-center">
          <div className="wordmark text-4xl text-white">WPA</div>
          <div className="wordmark-tagline mt-2 text-sand">Command Center · Field Operations</div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 rounded-2xl border border-pine-mid/30 bg-parchment p-6 shadow-xl"
        >
          <div className="space-y-1.5">
            <label htmlFor="login-email" className="section-eyebrow">Email</label>
            <Input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@whitepineagency.com"
              autoComplete="email"
              className="h-11"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="login-password" className="section-eyebrow">Password</label>
            <Input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              className="h-11"
              required
            />
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer select-none py-1">
            <input
              type="checkbox"
              checked={stayLoggedIn}
              onChange={(e) => setStay(e.target.checked)}
              className="h-4 w-4 shrink-0 rounded border-input accent-pine-mid"
            />
            <span className="text-sm text-text-secondary">Stay logged in</span>
            <span className="text-meta ml-auto text-text-tertiary">
              {stayLoggedIn ? 'this device' : 'this session'}
            </span>
          </label>

          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}

          <Button
            type="submit"
            disabled={pending || !email || !password}
            className="h-11 w-full bg-ridge text-white hover:bg-ridge/90"
          >
            {pending ? 'Signing in…' : 'Sign in'}
          </Button>

          <p className="text-meta text-center text-text-tertiary">
            Uncheck "stay logged in" on shared computers
          </p>
        </form>
      </div>
    </div>
  )
}
