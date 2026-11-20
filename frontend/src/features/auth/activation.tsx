"use client";

import Link from 'next/link';
import { CheckCircle2, MailCheck, RefreshCw, ShieldCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button, FormField, StatusMessage } from '../../components/ui/auth-ui';
import { ApiError } from '../../lib/api';
import { AuthShell } from './auth-shell';
import { authService } from './service';

type VerificationContext = { email: string; delivery: 'accepted' | 'failed' | 'requested'; message: string; nextAvailableAt: number; createdAt: number };
const contextKey = 'hl-verification-context';
export function saveVerificationContext(input: { email: string; delivery: VerificationContext['delivery']; message: string; resendAfterSeconds: number }) {
  if (typeof window === 'undefined') return;
  const context: VerificationContext = { email: input.email.trim(), delivery: input.delivery, message: input.message, nextAvailableAt: Date.now() + input.resendAfterSeconds * 1000, createdAt: Date.now() };
  window.sessionStorage.setItem(contextKey, JSON.stringify(context));
}
function readVerificationContext(): VerificationContext | null {
  try {
    const raw = window.sessionStorage.getItem(contextKey); if (!raw) return null;
    const value = JSON.parse(raw) as VerificationContext;
    if (typeof value.email !== 'string' || value.email.length > 254 || !['accepted', 'failed', 'requested'].includes(value.delivery) || !Number.isFinite(value.nextAvailableAt) || Date.now() - value.createdAt > 86400000) return null;
    return value;
  } catch { return null; }
}
export function CheckEmail() {
  const [email, setEmail] = useState(''); const [delivery, setDelivery] = useState<'accepted' | 'failed' | 'requested' | 'direct'>('direct');
  const [message, setMessage] = useState('Enter your email address to request a verification link.');
  const [nextAvailableAt, setNextAvailableAt] = useState(0); const [seconds, setSeconds] = useState(0);
  const [busy, setBusy] = useState(false); const lock = useRef(false);
  useEffect(() => { queueMicrotask(() => { const context = readVerificationContext(); if (!context) return; setEmail(context.email); setDelivery(context.delivery); setMessage(context.message); setNextAvailableAt(context.nextAvailableAt); setSeconds(Math.max(0, Math.ceil((context.nextAvailableAt - Date.now()) / 1000))); }); }, []);
  useEffect(() => { if (seconds <= 0) return; const timer = window.setTimeout(() => setSeconds(Math.max(0, Math.ceil((nextAvailableAt - Date.now()) / 1000))), 1000); return () => window.clearTimeout(timer); }, [seconds, nextAvailableAt]);
  async function resend(event: React.FormEvent) {
    event.preventDefault(); if (lock.current || seconds > 0) return; lock.current = true; setBusy(true);
    try {
      const result = await authService.resend(email.trim());
      const next = Date.now() + result.resendAfterSeconds * 1000;
      setDelivery(result.delivery === 'failed' ? 'failed' : 'requested'); setMessage(result.message); setNextAvailableAt(next); setSeconds(result.resendAfterSeconds);
      saveVerificationContext({ email, delivery: result.delivery, message: result.message, resendAfterSeconds: result.resendAfterSeconds });
    } catch (reason) { setDelivery('failed'); setMessage(reason instanceof Error ? reason.message : 'We couldn’t request the email. Please try again.'); setSeconds(0); }
    finally { lock.current = false; setBusy(false); }
  }
  const failed = delivery === 'failed';
  return <div className="check-email-screen"><div className="check-email-wrap"><Link href="/" className="check-email-brand">Home &amp; Lifestyle</Link><section className="check-email-panel" aria-labelledby="check-email-title"><div className="check-email-icon"><MailCheck size={25} aria-hidden="true" /></div><h1 id="check-email-title">{failed ? 'We couldn’t send your verification email' : delivery === 'direct' ? 'Verify your email.' : 'Check your email.'}</h1><p className="check-email-intro">{failed ? 'Your account is ready to verify. Try sending the link again.' : delivery === 'direct' ? 'Request a verification link to activate your account.' : delivery === 'requested' ? 'If this account needs verification, a message will be sent when eligible.' : 'Our email service accepted your verification message. It may take a moment to arrive.'}</p><form onSubmit={resend} className="check-email-form"><FormField id="resend-email" label="Email address" type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} required maxLength={254} />{email && <p className="check-email-recipient">Sending to <strong>{email}</strong></p>}<div className={`check-email-status ${failed ? 'is-error' : ''}`} role="status" aria-live="polite">{message}</div><Button type="submit" busy={busy} disabled={seconds > 0} className="w-full">{busy ? 'Requesting…' : seconds > 0 ? `Resend available in ${seconds}s` : failed ? 'Retry sending email' : <><RefreshCw size={16} aria-hidden="true" />Resend verification email</>}</Button></form><p className="check-email-hint">Check your spam folder if the message takes a few minutes.</p><Link href="/login" className="check-email-back">Back to login</Link></section></div></div>;
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
