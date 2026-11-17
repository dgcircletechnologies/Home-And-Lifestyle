"use client";
import Link from 'next/link';
import { useRef, useState } from 'react';
import { useAuth } from '../features/auth/provider';
import { homeFor } from '../features/auth/service';
export function Header() {
  const auth = useAuth(); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const lock = useRef(false);
  async function signOut() {
    if (lock.current) return; lock.current = true; setBusy(true); setError('');
    try { await auth.logout(); } catch { setError('Server sign-out failed. Please try again.'); } finally { lock.current = false; setBusy(false); }
  }
  return <header><Link className="brand" href="/">Home & Lifestyle</Link><nav aria-label="Main navigation">{auth.user ? <><Link href={homeFor(auth.user)}>My space</Link><button disabled={busy} onClick={signOut}>{busy ? 'Signing out…' : 'Sign out'}</button></> : <Link href="/login">Sign in</Link>}</nav>{error && <div><p role="alert">{error}</p><button disabled={busy} onClick={signOut}>Retry sign out</button></div>}</header>;
}
