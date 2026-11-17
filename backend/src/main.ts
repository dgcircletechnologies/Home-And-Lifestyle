import { authConfig } from './auth/config';
import 'reflect-metadata';
import { createApp } from './bootstrap';
import { readEnvironment } from './environment';
async function bootstrap() {
  let port: number;
  try { ({ port } = readEnvironment()); authConfig(); } catch (error) { console.error(error instanceof Error ? error.message : 'Invalid configuration.'); process.exitCode = 1; return; }
  const app = await createApp();
  await app.listen(port, '0.0.0.0');
}
void bootstrap().catch(() => { console.error('API startup failed. Verify environment configuration and service availability.'); process.exitCode = 1; });
