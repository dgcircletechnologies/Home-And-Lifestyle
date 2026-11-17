"use client";

import Link from 'next/link';
import { CheckCircle2, MailCheck, RefreshCw, ShieldCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button, FormField, StatusMessage } from '../../components/ui/auth-ui';
import { ApiError } from '../../lib/api';
import { AuthShell } from './auth-shell';
import { authService } from './service';

export function CheckEmail({ initialEmail = '', initialCooldown = 0 }: { initialEmail?: string; initialCooldown?: number }) {
  const [email, setEmail] = useState(initialEmail); const [seconds, setSeconds] = useState(initialCooldown); const [busy, setBusy] = useState(false); const lock = useRef(false);
  const [message, setMessage] = useState('If this address is eligible, you’ll receive an activation email. If you already have an account, sign in.');
  useEffect(() => { if (seconds <= 0) return; const timer = setTimeout(() => setSeconds(value => value - 1), 1000); return () => clearTimeout(timer); }, [seconds]);
  async function resend(event: React.FormEvent) {
    event.preventDefault(); if (lock.current || seconds > 0) return; lock.current = true; setBusy(true);
    try { const result = await authService.resend(email); setMessage(result.message); setSeconds(result.resendAfterSeconds); }
    catch (reason) { setMessage(reason instanceof Error ? reason.message : 'Please try again.'); }
    finally { lock.current = false; setBusy(false); }
  }
  return <AuthShell eyebrow="One small step" title="Check your email." intro="We’ve sent an activation link when this address is eligible. Open it, then return here to sign in.">
    <div className="mb-7 flex size-11 items-center justify-center rounded-full bg-[var(--hl-primary)] text-white"><MailCheck className="size-5" aria-hidden="true" /></div>
    <StatusMessage tone="neutral" role="status">{message}</StatusMessage>
    <p className="mt-5 text-sm leading-6 text-[var(--hl-muted)]">Check your spam folder too. If you request another link, please use the most recent email.</p>
    <form className="mt-7 grid gap-5" onSubmit={resend}><FormField id="resend-email" label="Email address" type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} required maxLength={254} /><Button type="submit" variant="secondary" busy={busy} disabled={seconds > 0} className="w-full">{busy ? 'Requesting…' : seconds > 0 ? `Resend available in ${seconds}s` : <><RefreshCw className="size-4" aria-hidden="true" />Resend activation email</>}</Button></form>
    <p className="mt-8 text-sm text-[var(--hl-muted)]"><Link className="font-semibold text-[var(--hl-primary)]" href="/login">Back to sign in</Link></p>
  </AuthShell>;
}

export function Activation() {
  const token = useRef<string | null>(null); const captured = useRef(false); const lock = useRef(false);
  const [state, setState] = useState<'loading' | 'ready' | 'busy' | 'success' | 'invalid' | 'network'>('loading'); const [error, setError] = useState('');
  useEffect(() => {
    function capture() { if (captured.current && !window.location.hash) return; captured.current = true; const value = new URLSearchParams(window.location.hash.slice(1)).get('token'); window.history.replaceState(null, '', window.location.pathname); token.current = value && /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null; queueMicrotask(() => { setError(''); setState(token.current ? 'ready' : 'invalid'); }); }
    capture(); window.addEventListener('hashchange', capture); return () => window.removeEventListener('hashchange', capture);
  }, []);
  async function verify() {
    if (!token.current || lock.current) return; lock.current = true; setState('busy'); const submitted = token.current;
    try { await authService.verify(submitted); if (token.current === submitted) { token.current = null; setState('success'); } }
    catch (reason) { if (token.current !== submitted) return; const network = reason instanceof ApiError && (reason.status === 0 || reason.status >= 500); setError(network ? 'Unable to verify right now. Please try again.' : 'This link is invalid, expired, or already used. Request a new email.'); setState(network ? 'network' : 'invalid'); if (!network) token.current = null; }
    finally { lock.current = false; }
  }
  const success = state === 'success';
  return <AuthShell eyebrow={success ? 'All set' : 'Account activation'} title={success ? 'Email verified.' : 'Verify your email.'} intro={success ? 'Your account is ready. Sign in to continue making yourself at home.' : 'For your security, confirmation happens only after you choose Verify email.'}>
    <div className={`mb-7 flex size-11 items-center justify-center rounded-full ${success ? 'bg-[var(--hl-success)] text-white' : 'bg-[var(--hl-primary)] text-white'}`}>{success ? <CheckCircle2 className="size-5" aria-hidden="true" /> : <ShieldCheck className="size-5" aria-hidden="true" />}</div>
    {state === 'loading' && <StatusMessage tone="neutral" role="status">Preparing your verification link…</StatusMessage>}
    {['ready', 'busy', 'network'].includes(state) && <div className="grid gap-5"><Button type="button" onClick={verify} busy={state === 'busy'} className="w-full">{state === 'busy' ? 'Verifying…' : 'Verify email'}</Button>{state === 'network' && <StatusMessage>{error}</StatusMessage>}</div>}
    {success && <StatusMessage tone="success" role="status">Your email has been verified. You can now sign in.</StatusMessage>}
    {state === 'invalid' && <StatusMessage>{error || 'This link is invalid, expired, or already used. Request a new email.'}</StatusMessage>}
    <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm"><Link className="font-semibold text-[var(--hl-primary)]" href="/login">Sign in</Link>{!success && <Link className="font-semibold text-[var(--hl-primary)]" href="/check-email">Resend activation</Link>}</div>
  </AuthShell>;
}
