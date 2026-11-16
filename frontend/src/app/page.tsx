export const dynamic = 'force-dynamic';

async function isApiReady(): Promise<boolean> {
  const baseUrl = process.env.API_INTERNAL_URL;
  if (!baseUrl) return false;
  try {
    const response = await fetch(new URL('/api/health', baseUrl), {
      cache: 'no-store',
      signal: AbortSignal.timeout(3500),
    });
    if (!response.ok) return false;
    const health = await response.json();
    return health.status === 'ok' && health.database === 'up';
  } catch {
    return false;
  }
}

export default async function Home() {
  const ready = await isApiReady();
  return <main><section><h1>Home & Lifestyle Décor</h1>
    <p role="status">{ready ? 'API connection: connected · Database: up' : 'API connection: unavailable · Please try again shortly.'}</p>
  </section></main>;
}
