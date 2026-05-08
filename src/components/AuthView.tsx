import { FormEvent, useState } from 'react';
import { supabase } from '../lib/supabase';

export function AuthView() {
  const [mode, setMode] = useState<'login' | 'signup'>('signup');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (mode === 'signup') {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              display_name: displayName.trim() || email.split('@')[0],
            },
          },
        });
        if (signUpError) throw signUpError;
        setMessage('Account created. Check your email if confirmation is enabled, then sign in.');
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-layout">
      <section className="hero-panel" aria-labelledby="hero-title">
        <p className="eyebrow">75 day community challenge</p>
        <h1 id="hero-title">Build hard habits without exposing private work.</h1>
        <p>
          Join a strict daily challenge, track required habits, reset honestly when a core habit is missed, and share
          lessons only when you choose.
        </p>
        <div className="hero-grid" aria-label="Platform highlights">
          <span>Strict reset logic</span>
          <span>Optional faith templates</span>
          <span>Private reflections</span>
          <span>Public progress feed</span>
        </div>
      </section>

      <section className="auth-card" aria-labelledby="auth-title">
        <div className="segmented-control" role="tablist" aria-label="Authentication mode">
          <button className={mode === 'signup' ? 'active' : ''} type="button" onClick={() => setMode('signup')}>
            Sign up
          </button>
          <button className={mode === 'login' ? 'active' : ''} type="button" onClick={() => setMode('login')}>
            Log in
          </button>
        </div>

        <h2 id="auth-title">{mode === 'signup' ? 'Start your challenge' : 'Welcome back'}</h2>
        <form onSubmit={handleSubmit} className="stacked-form">
          {mode === 'signup' ? (
            <label>
              Display name
              <input
                autoComplete="name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Amina, Omar, Alex..."
              />
            </label>
          ) : null}

          <label>
            Email
            <input
              required
              autoComplete="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />
          </label>

          <label>
            Password
            <input
              required
              minLength={8}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 8 characters"
            />
          </label>

          {error ? <p className="form-error" role="alert">{error}</p> : null}
          {message ? <p className="form-success" role="status">{message}</p> : null}

          <button className="primary-action" disabled={loading} type="submit">
            {loading ? 'Please wait...' : mode === 'signup' ? 'Create account' : 'Log in'}
          </button>
        </form>
      </section>
    </main>
  );
}
