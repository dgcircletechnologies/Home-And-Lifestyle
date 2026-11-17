"use client";
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { ApiError } from '../../lib/api';
import { useAuth } from './provider';
import { authService, safeReturn } from './service';
import { CheckEmail } from './activation';
export function AuthForm({ register = false }: { register?: boolean }) {
  const [busy, setBusy] = useState(false); const lock = useRef(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [registered, setRegistered] = useState<{ email: string; cooldown: number } | null>(null);
  const [show, setShow] = useState(false);
  const auth = useAuth(); const router = useRouter();
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (lock.current) return;
    setError(null);
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email')); const password = String(form.get('password'));
    if (register && (Array.from(password).length < 15 || Array.from(password).length > 128)) { setError(new ApiError(400, 'Please check your password.', { password: ['Use 15–128 characters. Spaces and Unicode are welcome.'] })); return; }
    if (register && password !== form.get('confirm')) { setError(new ApiError(400, 'Passwords must match.', { confirm: ['Enter the same password again.'] })); return; }
    lock.current = true; setBusy(true);
    try {
      if (register) { const result = await authService.register(String(form.get('name')), email, password); setRegistered({ email, cooldown: result.resendAfterSeconds }); }
      else { const user = await authService.login(email, password); auth.accept(user); router.replace(safeReturn(new URLSearchParams(window.location.search).get('returnTo'), user)); }
    } catch (e) { setError(e instanceof ApiError ? e : new ApiError(0, 'Please try again.')); }
    finally { lock.current = false; setBusy(false); }
  }
  if (registered) return <CheckEmail initialEmail={registered.email} initialCooldown={registered.cooldown} />;
  const fields = register ? ['name', 'email', 'password', 'confirm'] : ['email', 'password'];
  return <section className="card"><p className="eyebrow">Home & Lifestyle</p><h1>{register ? 'Make yourself at home' : 'Welcome back'}</h1><p>{register ? 'Create your account, verify your email, then sign in.' : 'Your little corner of Home & Lifestyle.'}</p><form onSubmit={submit}>
    {fields.map(field => { const secret = field === 'password' || field === 'confirm'; return <div key={field}><label htmlFor={field}>{field === 'name' ? 'Full name' : field === 'email' ? 'Email address' : field === 'confirm' ? 'Confirm password' : 'Password'}</label><input id={field} name={field} type={secret ? show ? 'text' : 'password' : field === 'name' ? 'text' : 'email'} required maxLength={secret ? 256 : field === 'name' ? 100 : 254} autoComplete={secret ? register ? 'new-password' : 'current-password' : field} aria-invalid={!!error?.fields[field]} aria-describedby={`${field}-error`} /><small id={`${field}-error`}>{error?.fields[field]?.join(' ')}</small></div>; })}
    <button className="secondary" type="button" aria-pressed={show} onClick={() => setShow(v => !v)}>{show ? 'Hide password' : 'Show password'}</button>
    {register && <p className="muted">Use 15–128 characters. Spaces, Unicode and password managers are welcome. Known compromised passwords are rejected.</p>}
    {error && <p role="alert">{error.message}</p>}
    {error?.code === 'EMAIL_NOT_VERIFIED' && <Link href="/check-email">Resend activation email</Link>}
    <button disabled={busy}>{busy ? 'Please wait…' : register ? 'Create account' : 'Sign in'}</button>
  </form><p>{register ? 'Already have an account?' : 'New here?'} <Link href={register ? '/login' : '/register'}>{register ? 'Sign in' : 'Create an account'}</Link></p></section>;
}
