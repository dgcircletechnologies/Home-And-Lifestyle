export class ApiError extends Error {
  constructor(public status: number, message: string, public fields: Record<string, string[]> = {}, public code = 'REQUEST_FAILED') { super(message); }
}
export function apiBase(value = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:9007/api') {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || !['', '/', '/api', '/api/'].includes(url.pathname)) throw Error('Invalid NEXT_PUBLIC_API_URL.');
  return `${url.origin}/api`;
}
let accessToken: string | null = null;
let renew: (() => Promise<unknown>) | null = null;
export function setAccessToken(token: string | null) {
  if (typeof window === 'undefined' && token) throw Error('Access credentials must be browser request scoped.');
  accessToken = token;
}
export function getAccessToken() { return accessToken; }
export function configureRenewal(callback: () => Promise<unknown>) { renew = callback; }
type Options = Omit<RequestInit, 'body'> & { body?: unknown; timeoutMs?: number; quiet401?: boolean };
export async function api<T>(path: string, options: Options = {}, retried = false): Promise<T> {
  const { body, timeoutMs = 10000, quiet401 = false, signal, headers, ...request } = options;
  if (!/^\/?[a-z][a-z0-9/-]*$/i.test(path)) throw Error('Invalid API endpoint.');
  const endpoint = path.replace(/^\//, '').replace(/^api\//, '');
  const multipart = typeof FormData !== 'undefined' && body instanceof FormData;
  const requestHeaders = new Headers(headers);
  requestHeaders.set('X-CSRF-Protection', '1');
  if (accessToken) requestHeaders.set('Authorization', `Bearer ${accessToken}`);
  if (body !== undefined && !multipart) requestHeaders.set('Content-Type', 'application/json');
  let response: Response;
  let text: string;
  try {
    response = await fetch(`${apiBase()}/${endpoint}`, { ...request, headers: requestHeaders, body: body === undefined ? undefined : multipart ? body as FormData : JSON.stringify(body), credentials: 'include', cache: 'no-store', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs) });
    text = await response.text();
  } catch {
    throw new ApiError(0, signal?.aborted ? 'Request cancelled.' : 'Unable to connect. Check your connection and try again.');
  }
  let data: unknown;
  try { data = text ? JSON.parse(text) : undefined; } catch { data = undefined; }
  if (response.ok) return data as T;
  const error = (data as { error?: { message?: string; fields?: Record<string, string[]>; code?: string } })?.error;
  if (response.status === 401 && !quiet401 && !retried && error?.code === 'ACCESS_INVALID' && renew) {
    await renew();
    return api<T>(path, options, true);
  }
  if (response.status === 401 && !quiet401 && typeof window !== 'undefined') window.dispatchEvent(new Event('auth:expired'));
  throw new ApiError(response.status, response.status >= 500 ? 'The service is unavailable. Please try again.' : error?.message ?? 'Request failed. Please try again.', error?.fields, error?.code);
}
