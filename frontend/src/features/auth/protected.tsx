"use client";
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from './provider';
import type { User } from './service';
export function Protected({ role, children }: { role: User['role']; children: React.ReactNode }) {
  const auth = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (auth.status === 'unauthenticated') router.replace(`/login?returnTo=${encodeURIComponent(pathname)}`);
    if (auth.status === 'authenticated' && auth.user?.role !== role) router.replace('/access-denied');
  }, [auth.status, auth.user, role, router, pathname]);
  if (auth.status === 'initializing') return <section role="status">Loading your session…</section>;
  if (auth.status === 'error') return <section role="alert"><p>{auth.error ?? 'Unable to restore your session.'}</p><button onClick={auth.retryInitialization}>Try again</button></section>;
  if (auth.status !== 'authenticated' || auth.user?.role !== role) return <p role="status">Redirecting…</p>;
  return <div key={auth.user.id}>{children}</div>;
}
