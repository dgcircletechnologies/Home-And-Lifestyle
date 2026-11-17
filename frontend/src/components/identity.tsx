"use client";
import { useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import type { User } from '../features/auth/service';
export function Identity({ area }: { area: 'account' | 'admin' }) {
  const [user, setUser] = useState<User | null>(null); const [error, setError] = useState('');
  useEffect(() => { const controller = new AbortController(); api<User>(area, { signal: controller.signal }).then(setUser).catch((e: ApiError) => { if (!controller.signal.aborted) setError(e.status === 403 ? 'Access denied.' : e.message); }); return () => controller.abort(); }, [area]);
  if (error) return <p role="alert">{error}</p>;
  if (!user) return <p role="status">Loading your details…</p>;
  return <section className="card"><p className="eyebrow">{area === 'admin' ? 'Administration' : 'Your account'}</p><h1>Hello, {user.name}</h1><dl><dt>Email</dt><dd>{user.email}</dd><dt>Role</dt><dd>{user.role}</dd></dl><p>Your secure account is connected.</p></section>;
}
