"use client";
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { authService } from './service';
import { ApiError } from '../../lib/api';
export function CheckEmail({ initialEmail = '', initialCooldown = 0 }: { initialEmail?: string; initialCooldown?: number }) {
  const [email, setEmail] = useState(initialEmail);
  const [seconds, setSeconds] = useState(initialCooldown);
  const [busy, setBusy] = useState(false); const lock = useRef(false);
  const [message, setMessage] = useState('If this address is eligible, you’ll receive an activation email. If you already have an account, sign in.');
  useEffect(() => { if (seconds <= 0) return; const timer = setTimeout(() => setSeconds(s => s - 1), 1000); return () => clearTimeout(timer); }, [seconds]);
  async function resend(event: React.FormEvent) {
    event.preventDefault(); if (lock.current || seconds > 0) return; lock.current = true; setBusy(true);
    try { const result = await authService.resend(email); setMessage(result.message); setSeconds(result.resendAfterSeconds); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Please try again.'); }
    finally { lock.current = false; setBusy(false); }
  }
  return <section className="card"><p className="eyebrow">One small step</p><h1>Check your email</h1><p role="status">{message}</p><p>Check your spam folder too. When you request another link, use the most recent email.</p><form onSubmit={resend}><label htmlFor="resend-email">Email address</label><input id="resend-email" type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} required maxLength={254} /><button disabled={busy || seconds > 0}>{busy ? 'Requesting…' : seconds > 0 ? `Resend in ${seconds}s` : 'Resend activation email'}</button></form><p><Link href="/login">Back to sign in</Link></p></section>;
}
export function Activation() {
  const token = useRef<string | null>(null); const captured = useRef(false); const lock = useRef(false);
  const [state, setState] = useState<'loading' | 'ready' | 'busy' | 'success' | 'invalid' | 'network'>('loading');
  const [error, setError] = useState('');
  useEffect(() => {
    function capture() {
      if (captured.current && !window.location.hash) return;
      captured.current = true;
      const value = new URLSearchParams(window.location.hash.slice(1)).get('token');
      window.history.replaceState(null, '', window.location.pathname);
      token.current = value && /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null;
      queueMicrotask(() => { setError(''); setState(token.current ? 'ready' : 'invalid'); });
    }
    capture();
    window.addEventListener('hashchange', capture);
    return () => window.removeEventListener('hashchange', capture);
  }, []);
  async function verify() {
    if (!token.current || lock.current) return; lock.current = true; setState('busy');
    const submitted = token.current;
    try { await authService.verify(submitted); if (token.current === submitted) { token.current = null; setState('success'); } }
    catch (e) { if (token.current !== submitted) return; const network = e instanceof ApiError && (e.status === 0 || e.status >= 500); setError(network ? 'Unable to verify right now. Please try again.' : 'This link is invalid, expired, or already used. Request a new email.'); setState(network ? 'network' : 'invalid'); if (!network) token.current = null; }
    finally { lock.current = false; }
  }
  return <section className="card"><p className="eyebrow">Home & Lifestyle</p><h1>{state === 'success' ? 'Email verified' : 'Verify your email'}</h1>
    {state === 'loading' && <p role="status">Preparing your link…</p>}
    {['ready', 'busy', 'network'].includes(state) && <><p>Choose the button below to confirm this email address. You’ll sign in separately afterwards.</p><button onClick={verify} disabled={state === 'busy'}>{state === 'busy' ? 'Verifying…' : 'Verify email'}</button></>}
    {state === 'success' && <p role="status">Your email has been verified. You can now sign in.</p>}
    {(state === 'invalid' || state === 'network') && <p role="alert">{error || 'This link is invalid, expired, or already used. Request a new email.'}</p>}
    <p><Link href="/login">Sign in</Link></p>{state !== 'success' && <Link href="/check-email">Resend activation</Link>}
  </section>;
}
