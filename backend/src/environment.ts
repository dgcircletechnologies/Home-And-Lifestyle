import '../load-env';
export function readEnvironment() {
  const databaseUrl = process.env.DATABASE_URL;
  try {
    const u = new URL(databaseUrl ?? '');
    if (!['postgres:', 'postgresql:'].includes(u.protocol) || !u.hostname || !u.username || !u.password || u.pathname.length < 2 || u.hash) throw Error();
  } catch { throw Error('DATABASE_URL must be a PostgreSQL URL with credentials, host and database.'); }
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  if (!['development', 'test', 'production'].includes(nodeEnv)) throw Error('Invalid NODE_ENV.');
  const port = Number(process.env.PORT ?? process.env.BACKEND_PORT ?? 9007);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('Invalid PORT.');
  const origins = (process.env.CORS_ORIGINS ?? (nodeEnv === 'production' ? '' : 'http://localhost:5007')).split(',').map(s => s.trim());
  if (!origins.length || origins.some(origin => {
    try { const u = new URL(origin); return u.origin !== origin || !['http:', 'https:'].includes(u.protocol) || (nodeEnv === 'production' && u.protocol !== 'https:'); } catch { return true; }
  })) throw Error('CORS_ORIGINS must contain explicit origins (HTTPS in production).');
  return { databaseUrl: databaseUrl!, port, origins, production: nodeEnv === 'production' };
}
