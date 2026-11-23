"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Button, FormField, PasswordField, StatusMessage } from '../../components/ui/auth-ui';
import { ApiError } from '../../lib/api';
import { saveVerificationContext } from './activation';
import { AuthShell } from './auth-shell';
import { useAuth } from './provider';
import { authService, clearPendingReturn, safeCustomerReturn, safeReturn, savePendingReturn } from './service';
import { useCart } from '../cart/cart-provider';

export function AuthForm({ register = false }: { register?: boolean }) {
  const [busy, setBusy] = useState(false); const lock = useRef(false); const errorSummary = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [returnQuery, setReturnQuery] = useState('');
  const auth = useAuth(); const cart = useCart(); const router = useRouter();
  useEffect(() => { if (error) errorSummary.current?.focus(); }, [error]);
  useEffect(() => { queueMicrotask(() => setReturnQuery(window.location.search)); }, []);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (lock.current) return; setError(null);
    const form = new FormData(event.currentTarget); const email = String(form.get('email')); const password = String(form.get('password'));
    if (register && (Array.from(password).length < 8 || Array.from(password).length > 128)) { setError(new ApiError(400, 'Please check your password.', { password: ['Use 8–128 characters. Spaces and Unicode are welcome.'] })); return; }
    if (register && password !== form.get('confirm')) { setError(new ApiError(400, 'Passwords must match.', { confirm: ['Enter the same password again.'] })); return; }
    lock.current = true; setBusy(true);
    try {
      if (register) { const result = await authService.register(String(form.get('name')), email, password); saveVerificationContext({ email, delivery: result.delivery, message: result.message, resendAfterSeconds: result.resendAfterSeconds }); const requested = new URLSearchParams(window.location.search).get('returnTo'); if (requested) savePendingReturn(safeCustomerReturn(requested)); router.replace('/check-email'); }
      else { const user = await auth.login({ email, password }); if (user.role === 'CUSTOMER') { try { await cart.mergeGuestAfterLogin(); } catch { /* Keep the guest cart for retry on the next session refresh. */ } } const destination = safeReturn(new URLSearchParams(window.location.search).get('returnTo'), user); clearPendingReturn(); router.replace(destination); }
    } catch (reason) {
      if (register && reason instanceof ApiError && reason.code === 'EMAIL_ALREADY_REGISTERED') saveVerificationContext({ email, delivery: 'requested', message: 'Enter your email to request another verification link if your account is not yet active.', resendAfterSeconds: 0 });
      setError(reason instanceof ApiError ? reason : new ApiError(0, 'Please try again.'));
    }
    finally { lock.current = false; setBusy(false); }
  }
  const fields = error?.fields ?? {}; const passwordGuidance = 'Use 8–128 characters. Spaces, Unicode and password managers are welcome.';
  return <AuthShell title={register ? 'Make yourself at home.' : 'Welcome back.'} intro={register ? 'Create your account to begin. We’ll email you an activation link before you sign in.' : 'Sign in to continue making yourself at home.'}>
    <form className="grid gap-5" noValidate onSubmit={submit}>
      {register && <FormField id="name" name="name" label="Full name" type="text" required maxLength={100} autoComplete="name" error={fields.name?.join(' ')} />}
      <FormField id="email" name="email" label="Email address" type="email" required maxLength={254} autoComplete="email" inputMode="email" error={fields.email?.join(' ')} />
      <PasswordField id="password" name="password" label="Password" required minLength={register ? 8 : undefined} maxLength={256} autoComplete={register ? 'new-password' : 'current-password'} hint={register ? passwordGuidance : undefined} error={fields.password?.join(' ')} />
      {register && <PasswordField id="confirm" name="confirm" label="Confirm password" required maxLength={256} autoComplete="new-password" error={fields.confirm?.join(' ')} />}
      {error && <div ref={errorSummary} tabIndex={-1} className="outline-none"><StatusMessage>{error.message}</StatusMessage></div>}
      {error?.code === 'EMAIL_NOT_VERIFIED' && <Link className="-mt-2 text-sm font-semibold text-[var(--hl-primary)]" href="/check-email">Resend activation email</Link>}
      {error?.code === 'EMAIL_ALREADY_REGISTERED' && <Link className="text-sm font-semibold text-[var(--hl-primary)]" href="/check-email">Need a verification email?</Link>}
      <Button type="submit" busy={busy} className="mt-1 w-full">{busy ? (register ? 'Creating account…' : 'Signing in…') : (register ? 'Create account' : 'Sign in')}</Button>
    </form>
    <p className="mt-8 border-t border-[var(--hl-border)] pt-6 text-sm text-[var(--hl-muted)]">{register ? 'Already have an account?' : 'New to Home & Lifestyle?'} <Link className="font-semibold text-[var(--hl-primary)]" href={(register ? '/login' : '/register') + returnQuery}>{register ? 'Sign in' : 'Create an account'}</Link></p>
  </AuthShell>;
}
