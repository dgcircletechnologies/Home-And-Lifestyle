import { api, ApiError, configureRenewal, getAccessToken, setAccessToken } from '../../lib/api';

export type User = { id: string; name: string; email: string; role: 'CUSTOMER' | 'ADMIN'; emailVerifiedAt?: string; avatarUrl?: string | null };
type Session = { user: User; accessToken: string; expiresIn: number };
type SessionListener = (user: User) => void;
let epoch = 0;
let blocked = false;
let renewing: Promise<User> | null = null;
let channel: BroadcastChannel | null = null;
let listener: SessionListener | null = null;
let tail: Promise<unknown> = Promise.resolve();

async function sessionLock<T>(work: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.locks) return navigator.locks.request('hl-auth-session', work);
  const next = tail.then(work, work); tail = next.catch(() => undefined); return next;
}
function notify(user: User) { listener?.(user); }
export function onSessionUser(callback: SessionListener) { listener = callback; return () => { if (listener === callback) listener = null; }; }
export function clearAuthMemory() { epoch++; blocked = true; setAccessToken(null); }
export function startAuthEvents() {
  channel?.close();
  channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('hl-auth-events') : null;
  if (channel) channel.onmessage = event => { if (event.data === 'logout' || event.data === 'account-changed') { clearAuthMemory(); window.dispatchEvent(new Event('auth:expired')); } };
  return () => { channel?.close(); channel = null; };
}
function expired() { clearAuthMemory(); if (typeof window !== 'undefined') window.dispatchEvent(new Event('auth:expired')); }
export function refreshSession(): Promise<User> {
  if (blocked) return Promise.reject(new ApiError(401, 'Please sign in again.'));
  if (renewing) return renewing;
  const generation = epoch;
  renewing = sessionLock(async () => {
    if (generation !== epoch) throw new ApiError(401, 'Session changed.');
    let result: Session;
    try { result = await api<Session>('auth/refresh', { method: 'POST', quiet401: true }); }
    catch (error) {
      if (error instanceof ApiError && error.code === 'REFRESH_CONFLICT' && generation === epoch) result = await api<Session>('auth/refresh', { method: 'POST', quiet401: true });
      else throw error;
    }
    if (generation !== epoch) throw new ApiError(401, 'Session changed.');
    setAccessToken(result.accessToken); notify(result.user); return result.user;
  }).catch(error => { if (error instanceof ApiError && error.status === 401 && generation === epoch) expired(); throw error; }).finally(() => { renewing = null; });
  return renewing;
}
configureRenewal(refreshSession);

export const authService = {
  initialize: async () => { blocked = false; return refreshSession(); },
  me: (signal?: AbortSignal) => api<User>('auth/me', { signal }),
  login: (email: string, password: string) => sessionLock(async () => {
    const generation = ++epoch;
    const result = await api<Session>('auth/login', { method: 'POST', body: { email, password }, quiet401: true });
    if (generation !== epoch) throw new ApiError(401, 'Session changed.');
    blocked = false; setAccessToken(result.accessToken); notify(result.user); channel?.postMessage('account-changed'); return result.user;
  }),
  register: (name: string, email: string, password: string) => api<{ message: string; resendAfterSeconds: number }>('auth/register', { method: 'POST', body: { name, email, password }, quiet401: true, timeoutMs: 30000 }),
  resend: (email: string) => api<{ message: string; resendAfterSeconds: number }>('auth/resend-activation', { method: 'POST', body: { email }, quiet401: true, timeoutMs: 30000 }),
  verify: (token: string) => api<{ message: string }>('auth/verify-email', { method: 'POST', body: { token }, quiet401: true }),
  refreshUser: async () => { const user = await api<User>('auth/me'); notify(user); return user; },
  logout: async () => {
    const access = getAccessToken(); clearAuthMemory(); channel?.postMessage('logout'); window.dispatchEvent(new Event('auth:expired'));
    await sessionLock(() => api<void>('auth/logout', { method: 'POST', quiet401: true, headers: access ? { Authorization: `Bearer ${access}` } : undefined }));
  },
};
export function homeFor(user: User) { return user.role === 'ADMIN' ? '/admin' : '/account'; }
export function safeReturn(value: string | null, user: User) {
  if (user.role === 'ADMIN') return homeFor(user);
  if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\r\n]/.test(value)) return homeFor(user);
  if (/^\/(admin|login|register|activate|check-email|access-denied)(\/|\?|$)/.test(value)) return homeFor(user);
  return value;
}
