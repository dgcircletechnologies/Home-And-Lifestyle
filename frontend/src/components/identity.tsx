"use client";

import { useAuth } from '../features/auth/provider';

export function Identity({ area }: { area: 'account' | 'admin' }) {
  const auth = useAuth();
  if (auth.status === 'error') return <p role="alert">{auth.error}</p>;
  if (!auth.user) return <p role="status">Loading your details…</p>;
  const user = auth.user;
  return <section className="card"><p className="eyebrow">{area === 'admin' ? 'Administration' : 'Your account'}</p><h1>Hello, {user.name}</h1><dl><dt>Email</dt><dd>{user.email}</dd><dt>Role</dt><dd>{user.role}</dd></dl><p>Your secure account is connected.</p></section>;
}
